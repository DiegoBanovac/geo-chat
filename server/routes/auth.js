'use strict';
const express = require('express');
const router = express.Router();
const Korisnik = require('../models/Korisnik');

router.post('/login', async (req, res) => {
  const { email, lozinka } = req.body;
  if (!email || !lozinka) return res.status(400).json({ error: 'Email i lozinka su obavezni' });

  try {
    const korisnik = await Korisnik.findOne({
      where: { email_korisnika: email, lozinka_korisnika: lozinka },
    });
    if (!korisnik) return res.status(401).json({ error: 'Pogrešna email adresa ili lozinka' });
    return res.json(korisnik.toJSON());
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Greška pri spajanju na server' });
  }
});

router.post('/register', async (req, res) => {
  const { ime, prezime, email, lozinka, datum_rodenja } = req.body;
  if (!ime || !prezime || !email || !lozinka) return res.status(400).json({ error: 'Sva polja su obavezna' });

  try {
    const novi = await Korisnik.create({
      ime_korisnika: ime,
      prezime_korisnika: prezime,
      email_korisnika: email,
      lozinka_korisnika: lozinka,
      datum_rodenja: datum_rodenja || null,
      slika_profila: '',
    });
    return res.status(201).json(novi.toJSON());
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError')
      return res.status(409).json({ error: 'Korisnik sa tom email adresom već postoji' });
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Greška tijekom registracije' });
  }
});

// PUT /api/korisnici/:email
router.put('/korisnici/:email', async (req, res) => {
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

    await korisnik.save();
    return res.json(korisnik.toJSON());
  } catch (err) {
    console.error('Update korisnika greška:', err);
    return res.status(500).json({ error: 'Greška pri ažuriranju profila' });
  }
});

module.exports = router;