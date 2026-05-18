"use strict";
require("dotenv").config();
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { Op, QueryTypes } = require("sequelize");
const sequelize = require("./db");
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const messagesRoutes = require("./routes/messages");
const priceRoutes = require("./routes/price");
const geoRoutes = require("./routes/geo");
const registerChatSocket = require("./sockets/chatSocket");
const registerGeoSocket = require("./sockets/geoSocket");
const korisnikRoutes = require("./routes/korisnici");
const dnevniIzazovRoutes = require("./routes/dnevniIzazov");

// Osiguraj da uploads/ postoji
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
});
app.set("io", io);
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Servira uploadane slike
app.use("/uploads", express.static(uploadsDir));

app.use("/api", authRoutes);
app.use("/api", chatRoutes);
app.use("/api", messagesRoutes);
app.use("/api", priceRoutes);
app.use("/api", geoRoutes);
app.use("/api", korisnikRoutes);
app.use("/api", dnevniIzazovRoutes);
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// ─── Leaderboard routes ───────────────────────────────────────────────────────

// GET /api/leaderboard/grupe
// Grupe u kojima korisnik ima leaderboard unos
app.get("/api/leaderboard/grupe", async (req, res) => {
  const email = req.headers["x-user-email"];
  if (!email) return res.status(401).json({ poruka: "Nije autoriziran" });
  try {
    const grupe = await sequelize.query(
      `SELECT DISTINCT l.naziv_grupe
       FROM geochat.leaderboard l
       JOIN geochat.clanstvo_u_grupi c
         ON l.naziv_grupe = c.naziv_grupe
        AND c.email_korisnika = :email
       ORDER BY l.naziv_grupe`,
      { replacements: { email }, type: QueryTypes.SELECT },
    );
    res.json(grupe);
  } catch (err) {
    console.error("Greška leaderboard/grupe:", err);
    res.status(500).json({ poruka: "Interna greška servera" });
  }
});

// GET /api/leaderboard/:naziv_grupe
// Rang lista za grupu (samo ako si član)
app.get("/api/leaderboard/:naziv_grupe", async (req, res) => {
  const email = req.headers["x-user-email"];
  if (!email) return res.status(401).json({ poruka: "Nije autoriziran" });
  const { naziv_grupe } = req.params;
  try {
    const clanstvo = await sequelize.query(
      `SELECT 1 FROM geochat.clanstvo_u_grupi
       WHERE email_korisnika = :email AND naziv_grupe = :naziv`,
      { replacements: { email, naziv: naziv_grupe }, type: QueryTypes.SELECT },
    );
    if (clanstvo.length === 0)
      return res.status(403).json({ poruka: "Nemaš pristup ovoj grupi" });

    const rang = await sequelize.query(
      `SELECT
         l.email_korisnika,
         k.ime_korisnika,
         k.prezime_korisnika,
         k.slika_profila,
         l.ukupni_bodovi,
         l.broj_pobjeda
       FROM geochat.leaderboard l
       JOIN geochat.korisnik k ON l.email_korisnika = k.email_korisnika
       WHERE l.naziv_grupe = :naziv
       ORDER BY l.ukupni_bodovi DESC, l.broj_pobjeda DESC`,
      { replacements: { naziv: naziv_grupe }, type: QueryTypes.SELECT },
    );
    res.json(rang);
  } catch (err) {
    console.error("Greška leaderboard/:naziv_grupe:", err);
    res.status(500).json({ poruka: "Interna greška servera" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

registerChatSocket(io);
registerGeoSocket(io);

sequelize
  .authenticate()
  .then(async () => {
    console.log("Database connection established successfully.");

    // Dodaj kolonu lokacija_naziv ako ne postoji (idempotentna migracija)
    try {
      await sequelize.query(
        `ALTER TABLE geochat.objava_price ADD COLUMN IF NOT EXISTS lokacija_naziv VARCHAR(255);`,
      );
    } catch (e) {
      console.warn("Migracija lokacija_naziv:", e.message);
    }

    // Ukloni FK ograničenje koje blokira geo igru (battle.ir_email_2 ne mora biti u individualni_razgovor)
    try {
      await sequelize.query(
        `ALTER TABLE geochat.battle DROP CONSTRAINT IF EXISTS fk_battle_chat;`,
      );
    } catch (e) {
      console.warn("Migracija FK drop:", e.message);
    }

    // Kreiraj geo_odgovor tablicu ako ne postoji
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS geochat.geo_odgovor (
          id            SERIAL PRIMARY KEY,
          id_battle     INTEGER NOT NULL,
          broj_runde    INTEGER NOT NULL,
          email_igraca  VARCHAR(255) NOT NULL,
          guess_lat     NUMERIC(10,7),
          guess_lng     NUMERIC(10,7),
          bodovi        INTEGER DEFAULT 0,
          udaljenost_km NUMERIC(10,2),
          submitted_at  TIMESTAMP DEFAULT NOW()
        );
      `);
    } catch (e) {
      console.warn("Migracija geo_odgovor:", e.message);
    }

    // Dodaj lat/lng kolone i ukloni NOT NULL s lokacija_geog (idempotentno)
    try {
      await sequelize.query(`
        ALTER TABLE geochat.izazov
          ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7),
          ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7),
          ADD COLUMN IF NOT EXISTS pano_id VARCHAR(255);
      `);
      await sequelize.query(`
        ALTER TABLE geochat.izazov
          ALTER COLUMN lokacija_geog DROP NOT NULL;
      `);
    } catch (e) {
      console.warn("Migracija izazov lat/lng:", e.message);
    }

    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS geochat.dnevni_izazov_odgovor (
          id              SERIAL PRIMARY KEY,
          naziv_grupe     VARCHAR(255) NOT NULL,
          naziv_izazova   VARCHAR(255) NOT NULL,
          email_korisnika VARCHAR(255) NOT NULL,
          guess_lat       NUMERIC(10, 7) NOT NULL,
          guess_lng       NUMERIC(10, 7) NOT NULL,
          udaljenost_km   NUMERIC(10, 2),
          bodovi          INTEGER DEFAULT 0,
          submitted_at    TIMESTAMP DEFAULT NOW(),
          UNIQUE (naziv_grupe, naziv_izazova, email_korisnika)
        );
      `);
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_dnevni_odgovor_grupe
          ON geochat.dnevni_izazov_odgovor (naziv_grupe, naziv_izazova);
      `);
    } catch (e) {
      console.warn("Migracija dnevni_izazov_odgovor:", e.message);
    }

    // Brisanje isteklih priča svakih sat vremena
    const ObjavaPrice = require("./models/ObjavaPrice");
    const cleanupExpired = async () => {
      try {
        const n = await ObjavaPrice.destroy({
          where: { datum_isteka: { [Op.lt]: new Date() } },
        });
        if (n > 0) console.log(`Obrisano ${n} isteklih priča`);
      } catch (err) {
        console.error("Cleanup greška:", err.message);
      }
    };
    cleanupExpired();
    setInterval(cleanupExpired, 60 * 60 * 1000);

    server.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
    process.exit(1);
  });
