'use strict';
const express  = require('express');
const router   = express.Router();
const Battle   = require('../models/Battle');
const GeoOdgovor = require('../models/GeoOdgovor');

function requireAuth(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Nije autoriziran' });
  req.userEmail = email;
  next();
}

// ─── Geografske regije s visokim Street View pokrićem ────────────────────────
const REGIJE = [
  { name: 'Europa',     latMin: 35,  latMax: 70,  lngMin: -10, lngMax: 40  },
  { name: 'SAD',        latMin: 25,  latMax: 49,  lngMin: -125,lngMax: -65 },
  { name: 'Japan',      latMin: 30,  latMax: 45,  lngMin: 129, lngMax: 145 },
  { name: 'Australija', latMin: -40, latMax: -10, lngMin: 110, lngMax: 155 },
  { name: 'Brazil',     latMin: -30, latMax: 5,   lngMin: -75, lngMax: -35 },
  { name: 'Indija',     latMin: 8,   latMax: 35,  lngMin: 68,  lngMax: 97  },
  { name: 'J. Afrika',  latMin: -35, latMax: -20, lngMin: 16,  lngMax: 35  },
  { name: 'Meksiko',    latMin: 15,  latMax: 32,  lngMin: -118,lngMax: -86 },
];

// Haversine udaljenost u kilometrima
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Eksponencijalni scoring: max 5000 bodova, pada s udaljenošću
function izracunajBodove(km) {
  return Math.round(5000 * Math.exp(-km / 2000));
}

// Provjeri Street View pokrivenost za nasumičnu točku u regiji (Metadata API = besplatno)
async function nadjiLokaciju() {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey || apiKey.startsWith('OVDJE_')) {
    // Fallback: nasumična poznata lokacija kad nema API ključa (za razvoj)
    const fallback = [
      { lat: 48.8584, lng: 2.2945,   regija: 'Europa'  },  // Eiffelov toranj
      { lat: 40.7484, lng: -73.9967, regija: 'SAD'     },  // New York
      { lat: 35.6762, lng: 139.6503, regija: 'Japan'   },  // Tokio
      { lat: -33.8688,lng: 151.2093, regija: 'Australija' }, // Sydney
      { lat: 41.8902, lng: 12.4922,  regija: 'Europa'  },  // Rim
    ];
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  const r = REGIJE[Math.floor(Math.random() * REGIJE.length)];
  for (let i = 0; i < 20; i++) {
    const lat = r.latMin + Math.random() * (r.latMax - r.latMin);
    const lng = r.lngMin + Math.random() * (r.lngMax - r.lngMin);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}&radius=5000&source=outdoor&key=${apiKey}`;
      const meta = await fetch(url).then(res => res.json());
      if (meta.status === 'OK') {
        return { lat: meta.location.lat, lng: meta.location.lng, pano_id: meta.pano_id, regija: r.name };
      }
    } catch (_) {
      // preskoči na sljedeći pokušaj
    }
  }
  throw new Error(`Nije pronađena Street View lokacija u regiji ${r.name}`);
}

// ─── POST /api/geo/start ─────────────────────────────────────────────────────
router.post('/geo/start', requireAuth, async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ error: 'chatId je obavezan' });

  try {
    // Kreiraj battle zapis
    const battle = await Battle.create({
      ir_email_1:   req.userEmail,
      status_bitke: 'cekanje',
    });

    // Generiraj 5 nasumičnih lokacija paralelno
    const runde = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        nadjiLokaciju().then(lok => ({ ...lok, broj_runde: i + 1 }))
      )
    );

    res.status(201).json({ id_battle: battle.id_battle, runde });
  } catch (err) {
    console.error('Geo start greška:', err);
    res.status(500).json({ error: err.message || 'Greška pri pokretanju igre' });
  }
});

// ─── GET /api/geo/:id ────────────────────────────────────────────────────────
router.get('/geo/:id', requireAuth, async (req, res) => {
  const idBattle = parseInt(req.params.id, 10);
  if (isNaN(idBattle)) return res.status(400).json({ error: 'Nevaljan id' });

  try {
    const battle = await Battle.findByPk(idBattle);
    if (!battle) return res.status(404).json({ error: 'Igra nije pronađena' });

    const odgovori = await GeoOdgovor.findAll({ where: { id_battle: idBattle } });
    res.json({ battle, odgovori });
  } catch (err) {
    console.error('Geo get greška:', err);
    res.status(500).json({ error: 'Greška pri dohvatu igre' });
  }
});

// ─── POST /api/geo/:id/guess ─────────────────────────────────────────────────
router.post('/geo/:id/guess', requireAuth, async (req, res) => {
  const idBattle = parseInt(req.params.id, 10);
  if (isNaN(idBattle)) return res.status(400).json({ error: 'Nevaljan id' });

  const { broj_runde, lat, lng, prava_lat, prava_lng } = req.body;
  if (!broj_runde || lat == null || lng == null || prava_lat == null || prava_lng == null) {
    return res.status(400).json({ error: 'Nedostaju podaci' });
  }

  try {
    const battle = await Battle.findByPk(idBattle);
    if (!battle) return res.status(404).json({ error: 'Igra nije pronađena' });

    const km = haversine(parseFloat(lat), parseFloat(lng), parseFloat(prava_lat), parseFloat(prava_lng));
    const bod = izracunajBodove(km);

    await GeoOdgovor.create({
      id_battle:    idBattle,
      broj_runde,
      email_igraca: req.userEmail,
      guess_lat:    lat,
      guess_lng:    lng,
      bodovi:       bod,
      udaljenost_km: Math.round(km * 10) / 10,
    });

    // Ažuriraj ukupne bodove u battle zapisu
    const jeIgrac1 = battle.ir_email_1 === req.userEmail;
    const updatePolje = jeIgrac1 ? { bodovi_ir_1: battle.bodovi_ir_1 + bod }
                                 : { bodovi_ir_2: battle.bodovi_ir_2 + bod };
    await battle.update(updatePolje);

    // Provjeri jesu li oba igrača predala za ovu rundu
    const odgovoriRunde = await GeoOdgovor.findAll({
      where: { id_battle: idBattle, broj_runde },
    });
    const obaPredalaSuRanitije = odgovoriRunde.length >= 2;

    let zavrsenoGame = false;
    if (obaPredalaSuRanitije && broj_runde >= 5) {
      // Završi igru
      const novaStanjaBattle = await Battle.findByPk(idBattle);
      const pobjednik =
        novaStanjaBattle.bodovi_ir_1 >= novaStanjaBattle.bodovi_ir_2
          ? novaStanjaBattle.ir_email_1
          : novaStanjaBattle.ir_email_2;
      await novaStanjaBattle.update({
        status_bitke:    'zavrsena',
        datum_zavrsetka: new Date(),
        pobjednik_email: pobjednik,
      });
      zavrsenoGame = true;
    }

    res.json({ bodovi: bod, udaljenost_km: Math.round(km * 10) / 10, obaPredalaSuRanitije, zavrsenoGame });
  } catch (err) {
    console.error('Geo guess greška:', err);
    res.status(500).json({ error: 'Greška pri predaji pogađanja' });
  }
});

module.exports = router;
