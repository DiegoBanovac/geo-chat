'use strict';
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const Korisnik = require('../models/Korisnik');

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => cb(null, `avatar_${Date.now()}${path.extname(file.originalname)}`),
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// PUT /api/korisnici/:email
router.put('/korisnici/:email', uploadAvatar.single('slika_profila'), async (req, res) => {
  const emailIzHeadera = req.headers['x-user-email'];
  if (!emailIzHeadera || emailIzHeadera !== req.params.email)
    return res.status(403).json({ error: 'Zabranjen pristup' });

  const { ime_korisnika, prezime_korisnika, datum_rodenja, lozinka_korisnika } = req.body;
  if (!ime_korisnika || !prezime_korisnika)
    return res.status(400).json({ error: 'Ime i prezime su obavezni' });

  try {
    const korisnik = await Korisnik.findOne({ where: { email_korisnika: req.params.email } });
    if (!korisnik) return res.status(404).json({ error: 'Korisnik nije pronađen' });

    korisnik.ime_korisnika     = ime_korisnika;
    korisnik.prezime_korisnika = prezime_korisnika;
    if (datum_rodenja)     korisnik.datum_rodenja     = datum_rodenja;
    if (lozinka_korisnika) korisnik.lozinka_korisnika = lozinka_korisnika;
    if (req.file)          korisnik.slika_profila     = `/uploads/${req.file.filename}`;

    await korisnik.save();
    return res.json(korisnik.toJSON());
  } catch (err) {
    console.error('Update korisnika greška:', err);
    return res.status(500).json({ error: 'Greška pri ažuriranju profila' });
  }
});

module.exports = router;