'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../db');

const Korisnik = require('../models/Korisnik');
const IndividualniRazgovor = require('../models/IndividualniRazgovor');
const GrupniRazgovor = require('../models/GrupniRazgovor');
const ClanstvoUGrupi = require('../models/ClanstvoUGrupi');


function requireAuth(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Nije autoriziran' });
  req.userEmail = email;
  next();
}


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
          attributes: ['email_korisnika', 'ime_korisnika', 'prezime_korisnika', 'slika_profila'],
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
          slika_profila: drugiKorisnik?.slika_profila || null,
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

// ════════════════════════════════════════════════════════════════════════════
//  Upravljanje grupom (dodavanje/uklanjanje članova, preimenovanje, brisanje)
//  Socket.io notifikacije: svaka promjena odmah stiže svim pogođenim korisnicima
// ════════════════════════════════════════════════════════════════════════════

// Helper: dohvati sve email-ove članova grupe
async function emailoviClanova(nazivGrupe) {
  const clanstva = await ClanstvoUGrupi.findAll({ where: { naziv_grupe: nazivGrupe } });
  return clanstva.map((c) => c.email_korisnika);
}

// Helper: emitira event svim članima grupe (svaki ima osobni user_{email} room)
function notificirajClanove(io, emailovi, event, payload) {
  emailovi.forEach((email) => io.to(`user_${email}`).emit(event, payload));
}

// ─── GET /api/chats/group/:naziv/members ─────────────────────────────────────
router.get('/chats/group/:naziv/members', requireAuth, async (req, res) => {
  const nazivGrupe = decodeURIComponent(req.params.naziv);
  const email = req.userEmail;
  try {
    const clanstvo = await ClanstvoUGrupi.findOne({ where: { email_korisnika: email, naziv_grupe: nazivGrupe } });
    if (!clanstvo) return res.status(403).json({ error: 'Nisi član ove grupe' });

    const clanovi = await ClanstvoUGrupi.findAll({ where: { naziv_grupe: nazivGrupe } });
    const rezultat = await Promise.all(clanovi.map(async (c) => {
      const k = await Korisnik.findOne({
        where: { email_korisnika: c.email_korisnika },
        attributes: ['email_korisnika', 'ime_korisnika', 'prezime_korisnika', 'slika_profila'],
      });
      return { email_korisnika: c.email_korisnika, ime_korisnika: k?.ime_korisnika ?? '', prezime_korisnika: k?.prezime_korisnika ?? '', slika_profila: k?.slika_profila ?? null, is_admin: c.is_admin };
    }));
    res.json(rezultat);
  } catch (err) {
    console.error('Dohvat članova greška:', err);
    res.status(500).json({ error: 'Greška pri dohvatu članova' });
  }
});

// ─── POST /api/chats/group/:naziv/members ────────────────────────────────────
// Dodaj člana — dostupno svim članovima grupe
router.post('/chats/group/:naziv/members', requireAuth, async (req, res) => {
  const nazivGrupe = decodeURIComponent(req.params.naziv);
  const zahtjevatelj = req.userEmail;
  const { email_korisnika } = req.body;
  const io = req.app.get('io');

  if (!email_korisnika) return res.status(400).json({ error: 'Email novog člana je obavezan' });

  try {
    const mojeclanstvo = await ClanstvoUGrupi.findOne({ where: { email_korisnika: zahtjevatelj, naziv_grupe: nazivGrupe } });
    if (!mojeclanstvo) return res.status(403).json({ error: 'Nisi član ove grupe' });

    const noviKorisnik = await Korisnik.findOne({
      where: { email_korisnika },
      attributes: ['email_korisnika', 'ime_korisnika', 'prezime_korisnika', 'slika_profila'],
    });
    if (!noviKorisnik) return res.status(404).json({ error: 'Korisnik ne postoji' });

    const vecClan = await ClanstvoUGrupi.findOne({ where: { email_korisnika, naziv_grupe: nazivGrupe } });
    if (vecClan) return res.status(409).json({ error: 'Korisnik je već član grupe' });

    await ClanstvoUGrupi.create({ email_korisnika, naziv_grupe: nazivGrupe, is_admin: false });

    const brojClanova = await ClanstvoUGrupi.count({ where: { naziv_grupe: nazivGrupe } });

    const noviClanData = {
      email_korisnika,
      ime_korisnika: noviKorisnik.ime_korisnika,
      prezime_korisnika: noviKorisnik.prezime_korisnika,
      slika_profila: noviKorisnik.slika_profila ?? null,
      is_admin: false,
    };

    // Notificiraj sve postojeće članove da se broj promijenio
    const postojeciEmailovi = (await emailoviClanova(nazivGrupe)).filter(e => e !== email_korisnika);
    notificirajClanove(io, postojeciEmailovi, 'group_member_count_changed', {
      naziv_grupe: nazivGrupe,
      memberCount: brojClanova,
    });

    // Novom članu pošalji cijeli grupni chat objekt da ga doda u svoju listu
    const grupa = await GrupniRazgovor.findOne({ where: { naziv_grupe: nazivGrupe } });
    const mojeClanstvoAdmin = await ClanstvoUGrupi.findOne({ where: { email_korisnika, naziv_grupe: nazivGrupe } });
    io.to(`user_${email_korisnika}`).emit('group_added', {
      type: 'group',
      id: `gr_${nazivGrupe}`,
      naziv_grupe: nazivGrupe,
      name: nazivGrupe,
      is_admin: false,
      memberCount: brojClanova,
      datum_kreiranja: grupa?.datum_kreiranja ?? new Date(),
    });

    res.status(201).json(noviClanData);
  } catch (err) {
    console.error('Dodavanje člana greška:', err);
    res.status(500).json({ error: 'Greška pri dodavanju člana' });
  }
});

// ─── DELETE /api/chats/group/:naziv/members/:memberEmail ─────────────────────
// Ukloni člana — samo admin
router.delete('/chats/group/:naziv/members/:memberEmail', requireAuth, async (req, res) => {
  const nazivGrupe = decodeURIComponent(req.params.naziv);
  const adminEmail = req.userEmail;
  const memberEmail = decodeURIComponent(req.params.memberEmail);
  const io = req.app.get('io');

  try {
    const adminClanstvo = await ClanstvoUGrupi.findOne({ where: { email_korisnika: adminEmail, naziv_grupe: nazivGrupe, is_admin: true } });
    if (!adminClanstvo) return res.status(403).json({ error: 'Samo admin može uklanjati članove' });

    if (memberEmail === adminEmail) return res.status(400).json({ error: 'Admin ne može ukloniti samog sebe.' });

    const deleted = await ClanstvoUGrupi.destroy({ where: { email_korisnika: memberEmail, naziv_grupe: nazivGrupe } });
    if (!deleted) return res.status(404).json({ error: 'Član nije pronađen' });

    const brojClanova = await ClanstvoUGrupi.count({ where: { naziv_grupe: nazivGrupe } });

    // Preostalim članovima pošalji novi broj
    const preostaliEmailovi = await emailoviClanova(nazivGrupe);
    notificirajClanove(io, preostaliEmailovi, 'group_member_count_changed', {
      naziv_grupe: nazivGrupe,
      memberCount: brojClanova,
    });

    // Uklonjenom članu pošalji signal da mu se makne chat
    io.to(`user_${memberEmail}`).emit('group_removed', { naziv_grupe: nazivGrupe });

    res.json({ success: true });
  } catch (err) {
    console.error('Uklanjanje člana greška:', err);
    res.status(500).json({ error: 'Greška pri uklanjanju člana' });
  }
});

// ─── PATCH /api/chats/group/:naziv ───────────────────────────────────────────
// Preimenuj grupu — samo admin
router.patch('/chats/group/:naziv', requireAuth, async (req, res) => {
  const stariNaziv = decodeURIComponent(req.params.naziv);
  const adminEmail = req.userEmail;
  const { novi_naziv } = req.body;
  const io = req.app.get('io');

  if (!novi_naziv || novi_naziv.trim().length < 2) return res.status(400).json({ error: 'Naziv mora imati najmanje 2 znaka' });
  const noviNazivTrim = novi_naziv.trim();

  try {
    const adminClanstvo = await ClanstvoUGrupi.findOne({ where: { email_korisnika: adminEmail, naziv_grupe: stariNaziv, is_admin: true } });
    if (!adminClanstvo) return res.status(403).json({ error: 'Samo admin može preimenovati grupu' });

    const postojeci = await GrupniRazgovor.findOne({ where: { naziv_grupe: noviNazivTrim } });
    if (postojeci && noviNazivTrim !== stariNaziv) return res.status(409).json({ error: 'Naziv grupe je već zauzet' });

    // Dohvati sve emailove PRIJE rename-a
    const sviEmailovi = await emailoviClanova(stariNaziv);

    const t = await sequelize.transaction();
    try {
      await GrupniRazgovor.create({ naziv_grupe: noviNazivTrim, datum_kreiranja: new Date() }, { transaction: t });
      await ClanstvoUGrupi.update({ naziv_grupe: noviNazivTrim }, { where: { naziv_grupe: stariNaziv }, transaction: t });
      await GrupniRazgovor.destroy({ where: { naziv_grupe: stariNaziv }, transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }

    const brojClanova = await ClanstvoUGrupi.count({ where: { naziv_grupe: noviNazivTrim } });

    // Svim članovima pošalji novi naziv
    notificirajClanove(io, sviEmailovi, 'group_renamed', {
      stari_naziv: stariNaziv,
      novi_naziv: noviNazivTrim,
      memberCount: brojClanova,
    });

    res.json({ naziv_grupe: noviNazivTrim });
  } catch (err) {
    console.error('Preimenovanje grupe greška:', err);
    res.status(500).json({ error: 'Greška pri preimenovanju grupe' });
  }
});

// ─── DELETE /api/chats/group/:naziv ──────────────────────────────────────────
// Obriši grupu — samo admin
router.delete('/chats/group/:naziv', requireAuth, async (req, res) => {
  const nazivGrupe = decodeURIComponent(req.params.naziv);
  const adminEmail = req.userEmail;
  const io = req.app.get('io');

  try {
    const adminClanstvo = await ClanstvoUGrupi.findOne({ where: { email_korisnika: adminEmail, naziv_grupe: nazivGrupe, is_admin: true } });
    if (!adminClanstvo) return res.status(403).json({ error: 'Samo admin može obrisati grupu' });

    // Dohvati sve emailove PRIJE brisanja
    const sviEmailovi = await emailoviClanova(nazivGrupe);

    const t = await sequelize.transaction();
    try {
      await ClanstvoUGrupi.destroy({ where: { naziv_grupe: nazivGrupe }, transaction: t });
      await GrupniRazgovor.destroy({ where: { naziv_grupe: nazivGrupe }, transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }

    // Svim (bivšim) članovima pošalji signal da maknu grupu
    notificirajClanove(io, sviEmailovi, 'group_removed', { naziv_grupe: nazivGrupe });

    res.json({ success: true });
  } catch (err) {
    console.error('Brisanje grupe greška:', err);
    res.status(500).json({ error: 'Greška pri brisanju grupe' });
  }
});

module.exports = router;