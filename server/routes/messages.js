'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
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
      id_poruke:        p.id_poruke,
      posiljatelj_email: p.posiljatelj_email,
      posiljatelj_ime:  korisnikMap[p.posiljatelj_email] || p.posiljatelj_email,
      naziv_grupe:      p.naziv_grupe,
      primatelj_email:  p.primatelj_email,
      vrijeme_slanja:   p.vrijeme_slanja,
      poruka_tekst:     p.poruka_tekst,
      tip_medija:       p.tip_medija,
    }));

    res.json(result);
  } catch (err) {
    console.error('Dohvat poruka greška:', err);
    res.status(500).json({ error: 'Greška pri dohvatu poruka' });
  }
});

module.exports = router;
