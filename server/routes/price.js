'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const ObjavaPrice = require('../models/ObjavaPrice');
const PrikazPrice = require('../models/PrikazPrice');
const Korisnik = require('../models/Korisnik');

function requireAuth(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Nije autoriziran' });
  req.userEmail = email;
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(
      path.extname(file.originalname).toLowerCase()
    );
    ok ? cb(null, true) : cb(new Error('Samo slike su dozvoljene (jpg, png, gif, webp)'));
  },
});

// POST /api/price — objavi novu priču
router.post('/price', requireAuth, (req, res, next) => {
  upload.single('slika')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Slika je obavezna' });

  const sadrzajUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const lokacijaNaziv = req.body.lokacija_naziv?.trim() || null;

  try {
    const nova = await ObjavaPrice.create({
      email_korisnika: req.userEmail,
      sadrzaj_url:     sadrzajUrl,
      lokacija_naziv:  lokacijaNaziv,
      datum_isteka:    new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    res.status(201).json({
      id_price:       nova.id_price,
      sadrzaj_url:    nova.sadrzaj_url,
      lokacija_naziv: nova.lokacija_naziv,
      vrijeme_objave: nova.vrijeme_objave,
      datum_isteka:   nova.datum_isteka,
    });
  } catch (err) {
    console.error('Upload priče greška:', err);
    res.status(500).json({ error: 'Greška pri objavljivanju priče' });
  }
});

// GET /api/price — dohvati sve aktivne priče (grupirane po korisniku)
router.get('/price', requireAuth, async (req, res) => {
  const now = new Date();
  const myEmail = req.userEmail;

  try {
    const aktivne = await ObjavaPrice.findAll({
      where: { datum_isteka: { [Op.gt]: now } },
      order: [['vrijeme_objave', 'DESC']],
    });

    if (aktivne.length === 0) return res.json([]);

    const emailSet = [...new Set(aktivne.map((p) => p.email_korisnika))];
    const korisnici = await Korisnik.findAll({
      where: { email_korisnika: emailSet },
      attributes: ['email_korisnika', 'ime_korisnika', 'prezime_korisnika', 'slika_profila'],
    });
    const korisnikMap = Object.fromEntries(
      korisnici.map((k) => [k.email_korisnika, k])
    );

    const prikazi = await PrikazPrice.findAll({
      where: {
        id_price:         aktivne.map((p) => p.id_price),
        email_gledatelja: myEmail,
      },
    });
    const viewedSet = new Set(prikazi.map((pv) => pv.id_price));

    const grouped = {};
    for (const p of aktivne) {
      if (!grouped[p.email_korisnika]) {
        const k = korisnikMap[p.email_korisnika];
        grouped[p.email_korisnika] = {
          email_korisnika: p.email_korisnika,
          ime:             k?.ime_korisnika     || '',
          prezime:         k?.prezime_korisnika || '',
          slika_profila:   k?.slika_profila     || null,
          isMine:          p.email_korisnika === myEmail,
          hasUnviewed:     false,
          price:           [],
        };
      }
      const viewed = viewedSet.has(p.id_price);
      grouped[p.email_korisnika].price.push({
        id_price:       p.id_price,
        sadrzaj_url:    p.sadrzaj_url,
        lokacija_naziv: p.lokacija_naziv,
        vrijeme_objave: p.vrijeme_objave,
        datum_isteka:   p.datum_isteka,
        viewed,
      });
      if (!viewed && p.email_korisnika !== myEmail) {
        grouped[p.email_korisnika].hasUnviewed = true;
      }
    }

    // Redoslijed: vlastita priča prva, zatim neviđene, potom viđene
    const result = Object.values(grouped).sort((a, b) => {
      if (a.isMine && !b.isMine) return -1;
      if (!a.isMine && b.isMine) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    res.json(result);
  } catch (err) {
    console.error('Dohvat priča greška:', err);
    res.status(500).json({ error: 'Greška pri dohvatu priča' });
  }
});

// POST /api/price/:id/view — označi priču kao pregledanu
router.post('/price/:id/view', requireAuth, async (req, res) => {
  const idPrice = parseInt(req.params.id, 10);
  if (isNaN(idPrice)) return res.status(400).json({ error: 'Nevaljan id' });

  try {
    await PrikazPrice.findOrCreate({
      where:    { id_price: idPrice, email_gledatelja: req.userEmail },
      defaults: { id_price: idPrice, email_gledatelja: req.userEmail },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Prikaz priče greška:', err);
    res.status(500).json({ error: 'Greška' });
  }
});

module.exports = router;
