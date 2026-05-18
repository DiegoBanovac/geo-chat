"use strict";
const express = require("express");
const router = express.Router();
const { QueryTypes } = require("sequelize");
const sequelize = require("../db");

function requireAuth(req, res, next) {
  const email = req.headers["x-user-email"];
  if (!email) return res.status(401).json({ greska: "Nije autoriziran" });
  req.userEmail = email;
  next();
}

// ─── Haversine udaljenost u km ───────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Eksponencijalni scoring: max 5000 bodova
function izracunajBodove(km) {
  return Math.round(5000 * Math.exp(-km / 2000));
}

// ─── Dohvati ili generiraj dnevni izazov za grupu ───────────────────────────
// naziv_izazova = 'dnevni_YYYY-MM-DD' — datum je prirodni ključ za "izazov dana"
async function dohvatiIliKreirajDnevniIzazov(nazivGrupe) {
  const datumStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const nazivIzazova = `dnevni_${datumStr}`;

  // Provjeri postoji li već dnevni izazov za danas
  const postojeci = await sequelize.query(
    `SELECT naziv_izazova, lokacija_naziv, lat, lng, pano_id
     FROM geochat.izazov
     WHERE naziv_grupe = :skupina AND naziv_izazova = :naziv`,
    { replacements: { skupina: nazivGrupe, naziv: nazivIzazova }, type: QueryTypes.SELECT },
  );

  if (postojeci.length > 0) {
    return {
      naziv_izazova: postojeci[0].naziv_izazova,
      lat: parseFloat(postojeci[0].lat),
      lng: parseFloat(postojeci[0].lng),
      pano_id: postojeci[0].pano_id || null,
      regija: postojeci[0].lokacija_naziv || "Nepoznato",
      noviIzazov: false,
    };
  }

  // Generiraj novu nasumičnu lokaciju i spremi
  const lokacija = await nadjiNasumicnuLokaciju();

  await sequelize.query(
    `INSERT INTO geochat.izazov
       (naziv_grupe, naziv_izazova, tip_izazova, lokacija_naziv, lat, lng, pano_id)
     VALUES (:skupina, :naziv, 'dnevni', :regija, :lat, :lng, :pano_id)
     ON CONFLICT (naziv_grupe, naziv_izazova) DO NOTHING`,
    {
      replacements: {
        skupina: nazivGrupe,
        naziv: nazivIzazova,
        regija: lokacija.regija,
        lat: lokacija.lat,
        lng: lokacija.lng,
        pano_id: lokacija.pano_id || null,
      },
      type: QueryTypes.INSERT,
    },
  );

  // Dohvati umetnutu (ili konfliktnu) lokaciju
  const svjezi = await sequelize.query(
    `SELECT naziv_izazova, lokacija_naziv, lat, lng, pano_id
     FROM geochat.izazov
     WHERE naziv_grupe = :skupina AND naziv_izazova = :naziv`,
    { replacements: { skupina: nazivGrupe, naziv: nazivIzazova }, type: QueryTypes.SELECT },
  );

  const red = svjezi[0];
  return {
    naziv_izazova: red.naziv_izazova,
    lat: parseFloat(red.lat),
    lng: parseFloat(red.lng),
    pano_id: red.pano_id || null,
    regija: red.lokacija_naziv || lokacija.regija,
    noviIzazov: true,
  };
}

// ─── Nasumična lokacija (isti sustav kao geo.js) ─────────────────────────────
const REGIJE = [
  { name: "Europa", latMin: 35, latMax: 70, lngMin: -10, lngMax: 40 },
  { name: "SAD", latMin: 25, latMax: 49, lngMin: -125, lngMax: -65 },
  { name: "Japan", latMin: 30, latMax: 45, lngMin: 129, lngMax: 145 },
  { name: "Australija", latMin: -40, latMax: -10, lngMin: 110, lngMax: 155 },
  { name: "Brazil", latMin: -30, latMax: 5, lngMin: -75, lngMax: -35 },
  { name: "Indija", latMin: 8, latMax: 35, lngMin: 68, lngMax: 97 },
  { name: "J. Afrika", latMin: -35, latMax: -20, lngMin: 16, lngMax: 35 },
  { name: "Meksiko", latMin: 15, latMax: 32, lngMin: -118, lngMax: -86 },
];

const FALLBACK_LOKACIJE = [
  { lat: 48.8584, lng: 2.2945, regija: "Europa" }, // Pariz
  { lat: 40.7484, lng: -73.9967, regija: "SAD" }, // New York
  { lat: 35.6762, lng: 139.6503, regija: "Japan" }, // Tokio
  { lat: -33.8688, lng: 151.2093, regija: "Australija" }, // Sydney
  { lat: 41.8902, lng: 12.4922, regija: "Europa" }, // Rim
  { lat: -22.9068, lng: -43.1729, regija: "Brazil" }, // Rio
  { lat: 28.6139, lng: 77.209, regija: "Indija" }, // Delhi
  { lat: 19.4326, lng: -99.1332, regija: "Meksiko" }, // Mexico City
];

async function nadjiNasumicnuLokaciju() {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey || apiKey.startsWith("OVDJE_")) {
    return FALLBACK_LOKACIJE[
      Math.floor(Math.random() * FALLBACK_LOKACIJE.length)
    ];
  }

  const r = REGIJE[Math.floor(Math.random() * REGIJE.length)];
  for (let i = 0; i < 20; i++) {
    const lat = r.latMin + Math.random() * (r.latMax - r.latMin);
    const lng = r.lngMin + Math.random() * (r.lngMax - r.lngMin);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}&radius=5000&source=outdoor&key=${apiKey}`;
      const meta = await fetch(url).then((res) => res.json());
      if (meta.status === "OK") {
        return {
          lat: meta.location.lat,
          lng: meta.location.lng,
          pano_id: meta.pano_id,
          regija: r.name,
        };
      }
    } catch (_) {
      /* nastavi */
    }
  }
  // Fallback ako API ne vrati ništa
  return FALLBACK_LOKACIJE[
    Math.floor(Math.random() * FALLBACK_LOKACIJE.length)
  ];
}

// ─── GET /api/dnevni-izazov/:naziv_grupe ────────────────────────────────────
// Dohvati dnevni izazov za grupu (i generiraj ako ne postoji)
router.get("/dnevni-izazov/:naziv_grupe", requireAuth, async (req, res) => {
  const { naziv_grupe } = req.params;

  try {
    // Provjeri je li korisnik član grupe
    const clanstvo = await sequelize.query(
      `SELECT 1 FROM geochat.clanstvo_u_grupi
       WHERE email_korisnika = :email AND naziv_grupe = :skupina`,
      {
        replacements: { email: req.userEmail, skupina: naziv_grupe },
        type: QueryTypes.SELECT,
      },
    );
    if (clanstvo.length === 0)
      return res.status(403).json({ greska: "Nisi član ove grupe" });

    const izazov = await dohvatiIliKreirajDnevniIzazov(naziv_grupe);

    // Provjeri je li korisnik već odgovorio
    const odgovor = await sequelize.query(
      `SELECT guess_lat, guess_lng, bodovi, udaljenost_km, submitted_at
       FROM geochat.dnevni_izazov_odgovor
       WHERE naziv_grupe = :skupina
         AND naziv_izazova = :naziv
         AND email_korisnika = :email`,
      {
        replacements: {
          skupina: naziv_grupe,
          naziv: izazov.naziv_izazova,
          email: req.userEmail,
        },
        type: QueryTypes.SELECT,
      },
    );

    // Dohvati rang listu (samo korisnici koji su odgovorili)
    const rang = await sequelize.query(
      `SELECT d.email_korisnika,
              k.ime_korisnika,
              k.prezime_korisnika,
              d.bodovi,
              d.udaljenost_km,
              d.submitted_at
       FROM geochat.dnevni_izazov_odgovor d
       JOIN geochat.korisnik k ON d.email_korisnika = k.email_korisnika
       WHERE d.naziv_grupe = :skupina AND d.naziv_izazova = :naziv
       ORDER BY d.bodovi DESC, d.udaljenost_km ASC`,
      {
        replacements: { skupina: naziv_grupe, naziv: izazov.naziv_izazova },
        type: QueryTypes.SELECT,
      },
    );

    // Ukupno članova grupe
    const [{ ukupno_clanova }] = await sequelize.query(
      `SELECT COUNT(*) AS ukupno_clanova FROM geochat.clanstvo_u_grupi WHERE naziv_grupe = :skupina`,
      { replacements: { skupina: naziv_grupe }, type: QueryTypes.SELECT },
    );

    res.json({
      naziv_grupe,
      naziv_izazova: izazov.naziv_izazova,
      lat: izazov.lat,
      lng: izazov.lng,
      pano_id: izazov.pano_id,
      regija: izazov.regija,
      vec_odgovorio: odgovor.length > 0,
      moj_odgovor: odgovor[0] || null,
      rang,
      ukupno_clanova: parseInt(ukupno_clanova, 10),
    });
  } catch (err) {
    console.error("Dohvat dnevnog izazova greška:", err);
    res.status(500).json({ greska: err.message || "Interna greška" });
  }
});

// ─── POST /api/dnevni-izazov/:naziv_grupe/odgovor ───────────────────────────
// Korisnik predaje jedan odgovor (samo jednom!)
router.post(
  "/dnevni-izazov/:naziv_grupe/odgovor",
  requireAuth,
  async (req, res) => {
    const { naziv_grupe } = req.params;
    const { lat, lng } = req.body;

    if (lat == null || lng == null)
      return res.status(400).json({ greska: "lat i lng su obavezni" });

    try {
      // Provjeri clanstvo
      const clanstvo = await sequelize.query(
        `SELECT 1 FROM geochat.clanstvo_u_grupi
       WHERE email_korisnika = :email AND naziv_grupe = :skupina`,
        {
          replacements: { email: req.userEmail, skupina: naziv_grupe },
          type: QueryTypes.SELECT,
        },
      );
      if (clanstvo.length === 0)
        return res.status(403).json({ greska: "Nisi član ove grupe" });

      // Dohvati aktivni izazov
      const izazov = await dohvatiIliKreirajDnevniIzazov(naziv_grupe);

      // Provjeri nije li već odgovorio
      const vecPostoji = await sequelize.query(
        `SELECT 1 FROM geochat.dnevni_izazov_odgovor
       WHERE naziv_grupe = :skupina AND naziv_izazova = :naziv AND email_korisnika = :email`,
        {
          replacements: {
            skupina: naziv_grupe,
            naziv: izazov.naziv_izazova,
            email: req.userEmail,
          },
          type: QueryTypes.SELECT,
        },
      );
      if (vecPostoji.length > 0)
        return res
          .status(409)
          .json({ greska: "Već si predao odgovor za danas" });

      // Izračunaj bodove
      const km = haversine(
        parseFloat(lat),
        parseFloat(lng),
        izazov.lat,
        izazov.lng,
      );
      const bod = izracunajBodove(km);

      // Spremi odgovor
      await sequelize.query(
        `INSERT INTO geochat.dnevni_izazov_odgovor
         (naziv_grupe, naziv_izazova, email_korisnika, guess_lat, guess_lng, udaljenost_km, bodovi)
       VALUES (:skupina, :naziv, :email, :lat, :lng, :km, :bod)`,
        {
          replacements: {
            skupina: naziv_grupe,
            naziv: izazov.naziv_izazova,
            email: req.userEmail,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            km: Math.round(km * 10) / 10,
            bod,
          },
          type: QueryTypes.INSERT,
        },
      );

      // Ažuriraj leaderboard grupu
      await sequelize.query(
        `INSERT INTO geochat.leaderboard (email_korisnika, naziv_grupe, ukupni_bodovi, broj_pobjeda)
       VALUES (:email, :skupina, :bod, 0)
       ON CONFLICT (email_korisnika, naziv_grupe)
       DO UPDATE SET ukupni_bodovi = geochat.leaderboard.ukupni_bodovi + :bod`,
        {
          replacements: { email: req.userEmail, skupina: naziv_grupe, bod },
          type: QueryTypes.INSERT,
        },
      );

      res.json({
        bodovi: bod,
        udaljenost_km: Math.round(km * 10) / 10,
        prava_lat: izazov.lat,
        prava_lng: izazov.lng,
        regija: izazov.regija,
      });
    } catch (err) {
      console.error("Predaja dnevnog izazova greška:", err);
      res.status(500).json({ greska: err.message || "Interna greška" });
    }
  },
);

module.exports = router;
module.exports.nadjiNasumicnuLokaciju = nadjiNasumicnuLokaciju;
