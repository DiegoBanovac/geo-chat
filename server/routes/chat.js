'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../db');

const Korisnik = require('../models/Korisnik');
const IndividualniRazgovor = require('../models/IndividualniRazgovor');
const GrupniRazgovor = require('../models/GrupniRazgovor');
const ClanstvoUGrupi = require('../models/ClanstvoUGrupi');

// ─── Middleware: provjeri da je korisnik prijavljen ──────────────────────────
// Jednostavna provjera — email dolazi iz headera koji postavlja frontend
// nakon login-a (X-User-Email). U produkciji ovo bi bio JWT middleware.
function requireAuth(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Nije autoriziran' });
  req.userEmail = email;
  next();
}

// ─── GET /api/korisnici/search?q=tekst ──────────────────────────────────────
// Pretraga korisnika po imenu/prezimenu/emailu (za autocomplete pri kreir. chata)
router.get('/korisnici/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);

  try {
    const korisnici = await Korisnik.findAll({
      where: {
        [Op.and]: [
          { email_korisnika: { [Op.ne]: req.userEmail } }, // ne prikazuj sebe
          {
            [Op.or]: [
              { email_korisnika:   { [Op.iLike]: `%${q}%` } },
              { ime_korisnika:     { [Op.iLike]: `%${q}%` } },
              { prezime_korisnika: { [Op.iLike]: `%${q}%` } },
            ],
          },
        ],
      },
      attributes: ['email_korisnika', 'ime_korisnika', 'prezime_korisnika'],
      limit: 10,
    });
    res.json(korisnici);
  } catch (err) {
    console.error('Pretraga korisnika greška:', err);
    res.status(500).json({ error: 'Greška pri pretrazi' });
  }
});

// ─── GET /api/chats ──────────────────────────────────────────────────────────
// Dohvati sve chatove (individualne + grupne) za trenutnog korisnika
router.get('/chats', requireAuth, async (req, res) => {
  const email = req.userEmail;

  try {
    // 1. Individualni razgovori gdje je korisnik sudionik
    const individualniRaw = await IndividualniRazgovor.findAll({
      where: {
        [Op.or]: [
          { email_korisnika_1: email },
          { email_korisnika_2: email },
        ],
      },
    });

    // Za svaki individualni razgovor dohvati podatke o drugom korisniku
    const individualniChats = await Promise.all(
      individualniRaw.map(async (ir) => {
        const drugiEmail =
          ir.email_korisnika_1 === email
            ? ir.email_korisnika_2
            : ir.email_korisnika_1;

        const drugiKorisnik = await Korisnik.findOne({
          where: { email_korisnika: drugiEmail },
          attributes: ['email_korisnika', 'ime_korisnika', 'prezime_korisnika'],
        });

        return {
          type: 'individual',
          id: `ir_${ir.email_korisnika_1}_${ir.email_korisnika_2}`,
          email_korisnika_1: ir.email_korisnika_1,
          email_korisnika_2: ir.email_korisnika_2,
          drugiEmail,
          name: drugiKorisnik
            ? `${drugiKorisnik.ime_korisnika} ${drugiKorisnik.prezime_korisnika}`
            : drugiEmail,
          datum_kreiranja: ir.datum_kreiranja,
        };
      })
    );

    // 2. Grupni razgovori gdje je korisnik član
    const clanstva = await ClanstvoUGrupi.findAll({
      where: { email_korisnika: email },
    });

    const grupniChats = await Promise.all(
      clanstva.map(async (c) => {
        const grupa = await GrupniRazgovor.findOne({
          where: { naziv_grupe: c.naziv_grupe },
        });

        const brojClanova = await ClanstvoUGrupi.count({
          where: { naziv_grupe: c.naziv_grupe },
        });

        return {
          type: 'group',
          id: `gr_${c.naziv_grupe}`,
          naziv_grupe: c.naziv_grupe,
          name: c.naziv_grupe,
          is_admin: c.is_admin,
          memberCount: brojClanova,
          datum_kreiranja: grupa ? grupa.datum_kreiranja : null,
        };
      })
    );

    // 3. Spoji i sortiraj po datumu kreiranja (najnoviji prvo)
    const sviChats = [...individualniChats, ...grupniChats].sort(
      (a, b) => new Date(b.datum_kreiranja) - new Date(a.datum_kreiranja)
    );

    res.json(sviChats);
  } catch (err) {
    console.error('Dohvat chatova greška:', err);
    res.status(500).json({ error: 'Greška pri dohvatu razgovora' });
  }
});

// ─── POST /api/chats/individual ─────────────────────────────────────────────
// Kreiraj novi 1-na-1 razgovor
router.post('/chats/individual', requireAuth, async (req, res) => {
  const email1 = req.userEmail;
  const { email_korisnika_2 } = req.body;

  if (!email_korisnika_2) {
    return res.status(400).json({ error: 'Email drugog korisnika je obavezan' });
  }
  if (email1 === email_korisnika_2) {
    return res.status(400).json({ error: 'Ne možeš kreirati razgovor sam sa sobom' });
  }

  try {
    // Provjeri postoji li drugi korisnik
    const drugiKorisnik = await Korisnik.findOne({
      where: { email_korisnika: email_korisnika_2 },
    });
    if (!drugiKorisnik) {
      return res.status(404).json({ error: 'Korisnik s tim emailom ne postoji' });
    }

    // Provjeri postoji li već razgovor između ta dva korisnika
    const postojeci = await IndividualniRazgovor.findOne({
      where: {
        [Op.or]: [
          { email_korisnika_1: email1, email_korisnika_2 },
          { email_korisnika_1: email_korisnika_2, email_korisnika_2: email1 },
        ],
      },
    });

    if (postojeci) {
      // Vrati postojeći umjesto kreiranja duplikata
      return res.status(200).json({
        type: 'individual',
        id: `ir_${postojeci.email_korisnika_1}_${postojeci.email_korisnika_2}`,
        email_korisnika_1: postojeci.email_korisnika_1,
        email_korisnika_2: postojeci.email_korisnika_2,
        drugiEmail: email_korisnika_2,
        name: `${drugiKorisnik.ime_korisnika} ${drugiKorisnik.prezime_korisnika}`,
        datum_kreiranja: postojeci.datum_kreiranja,
        vecPostoji: true,
      });
    }

    // Kreiraj novi razgovor
    // Osiguraj konzistentni redoslijed (manji email uvijek ide kao _1)
    const [e1, e2] = [email1, email_korisnika_2].sort();
    const novi = await IndividualniRazgovor.create({
      email_korisnika_1: e1,
      email_korisnika_2: e2,
    });

    res.status(201).json({
      type: 'individual',
      id: `ir_${novi.email_korisnika_1}_${novi.email_korisnika_2}`,
      email_korisnika_1: novi.email_korisnika_1,
      email_korisnika_2: novi.email_korisnika_2,
      drugiEmail: email_korisnika_2,
      name: `${drugiKorisnik.ime_korisnika} ${drugiKorisnik.prezime_korisnika}`,
      datum_kreiranja: novi.datum_kreiranja,
    });
  } catch (err) {
    console.error('Kreiranje individual chata greška:', err);
    res.status(500).json({ error: 'Greška pri kreiranju razgovora' });
  }
});

// ─── POST /api/chats/group ───────────────────────────────────────────────────
// Kreiraj novu grupu
router.post('/chats/group', requireAuth, async (req, res) => {
  const adminEmail = req.userEmail;
  const { naziv_grupe, clanovi = [] } = req.body;

  if (!naziv_grupe || naziv_grupe.trim().length < 2) {
    return res.status(400).json({ error: 'Naziv grupe mora imati najmanje 2 znaka' });
  }

  const t = await sequelize.transaction();
  try {
    // Provjeri je li naziv zauzet
    const postojeca = await GrupniRazgovor.findOne({
      where: { naziv_grupe: naziv_grupe.trim() },
      transaction: t,
    });
    if (postojeca) {
      await t.rollback();
      return res.status(409).json({ error: 'Grupa s tim nazivom već postoji' });
    }

    // Kreiraj grupu
    const novaGrupa = await GrupniRazgovor.create(
      { naziv_grupe: naziv_grupe.trim() },
      { transaction: t }
    );

    // Dodaj admina (kreatora)
    await ClanstvoUGrupi.create(
      { email_korisnika: adminEmail, naziv_grupe: novaGrupa.naziv_grupe, is_admin: true },
      { transaction: t }
    );

    // Dodaj ostale članove (ignoriraj duplikate i nepostojeće korisnike)
    const validniClanovi = clanovi.filter(
      (e) => e && typeof e === 'string' && e !== adminEmail
    );

    for (const emailClana of validniClanovi) {
      const postoji = await Korisnik.findOne({
        where: { email_korisnika: emailClana },
        transaction: t,
      });
      if (postoji) {
        await ClanstvoUGrupi.create(
          { email_korisnika: emailClana, naziv_grupe: novaGrupa.naziv_grupe, is_admin: false },
          { transaction: t }
        );
      }
    }

    const brojClanova = await ClanstvoUGrupi.count({
      where: { naziv_grupe: novaGrupa.naziv_grupe },
      transaction: t,
    });

    await t.commit();

    res.status(201).json({
      type: 'group',
      id: `gr_${novaGrupa.naziv_grupe}`,
      naziv_grupe: novaGrupa.naziv_grupe,
      name: novaGrupa.naziv_grupe,
      is_admin: true,
      memberCount: brojClanova,
      datum_kreiranja: novaGrupa.datum_kreiranja,
    });
  } catch (err) {
    await t.rollback();
    console.error('Kreiranje grupe greška:', err);
    res.status(500).json({ error: 'Greška pri kreiranju grupe' });
  }
});

module.exports = router;
