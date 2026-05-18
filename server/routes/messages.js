'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const path = require('path');
const multer = require('multer');
const Poruka = require('../models/Poruka');
const Korisnik = require('../models/Korisnik');

function requireAuth(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Nije autoriziran' });
  req.userEmail = email;
  next();
}

// GET /api/messages?type=individual&e1=email1&e2=email2
// GET /api/messages?type=group&g=naziv_grupe
router.get('/messages', requireAuth, async (req, res) => {
  const { type, e1, e2, g } = req.query;

  try {
    let whereClause;

    if (type === 'individual') {
      if (!e1 || !e2) return res.status(400).json({ error: 'e1 i e2 su obavezni' });
      whereClause = {
        naziv_grupe: null,
        [Op.or]: [
          { posiljatelj_email: e1, primatelj_email: e2 },
          { posiljatelj_email: e2, primatelj_email: e1 },
        ],
      };
    } else if (type === 'group') {
      if (!g) return res.status(400).json({ error: 'g (naziv_grupe) je obavezan' });
      whereClause = { naziv_grupe: g };
    } else {
      return res.status(400).json({ error: 'type mora biti individual ili group' });
    }

    const poruke = await Poruka.findAll({
      where: whereClause,
      order: [['vrijeme_slanja', 'ASC']],
      limit: 100,
    });

    // Attach sender names in one query
    const emailSet = [...new Set(poruke.map((p) => p.posiljatelj_email))];
    const korisnici = await Korisnik.findAll({
      where: { email_korisnika: emailSet },
      attributes: ['email_korisnika', 'ime_korisnika', 'prezime_korisnika'],
    });
    const korisnikMap = Object.fromEntries(
      korisnici.map((k) => [k.email_korisnika, `${k.ime_korisnika} ${k.prezime_korisnika}`])
    );

    const result = poruke.map((p) => ({
      id_poruke:         p.id_poruke,
      posiljatelj_email: p.posiljatelj_email,
      posiljatelj_ime:   korisnikMap[p.posiljatelj_email] || p.posiljatelj_email,
      naziv_grupe:       p.naziv_grupe,
      primatelj_email:   p.primatelj_email,
      vrijeme_slanja:    p.vrijeme_slanja,
      poruka_tekst:      p.poruka_tekst,
      tip_medija:        p.tip_medija,
      poruka_medij_url:  p.poruka_medij_url,
    }));

    res.json(result);
  } catch (err) {
    console.error('Dohvat poruka greška:', err);
    res.status(500).json({ error: 'Greška pri dohvatu poruka' });
  }
});

// ─── Upload slike u poruci ────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, `msg_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/messages/upload
router.post('/messages/upload', requireAuth, upload.single('slika'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nema slike' });

  const { chatId, e1, e2, naziv_grupe } = req.body;
  const medijaUrl = `/uploads/${req.file.filename}`;

  try {
    const poruka = await Poruka.create({
      posiljatelj_email: req.userEmail,
      primatelj_email:   e2     || null,
      naziv_grupe:       naziv_grupe || null,
      poruka_medij_url:  medijaUrl,
      tip_medija:        'slika',
    });

    const korisnik = await Korisnik.findOne({
      where: { email_korisnika: req.userEmail },
      attributes: ['ime_korisnika', 'prezime_korisnika'],
    });

    const result = {
      id_poruke:         poruka.id_poruke,
      posiljatelj_email: poruka.posiljatelj_email,
      posiljatelj_ime:   korisnik
        ? `${korisnik.ime_korisnika} ${korisnik.prezime_korisnika}`
        : req.userEmail,
      naziv_grupe:       poruka.naziv_grupe,
      primatelj_email:   poruka.primatelj_email,
      vrijeme_slanja:    poruka.vrijeme_slanja,
      poruka_tekst:      null,
      tip_medija:        'slika',
      poruka_medij_url:  medijaUrl,
    };

    const io = req.app.get('io');
    if (io) io.to(chatId).emit('new_message', result);

    res.json(result);
  } catch (err) {
    console.error('Upload poruke greška:', err);
    res.status(500).json({ error: 'Greška pri uploadu slike' });
  }
});

module.exports = router;