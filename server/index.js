'use strict';
require('dotenv').config();
const fs   = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { Op } = require('sequelize');
const sequelize = require('./db');
const authRoutes     = require('./routes/auth');
const chatRoutes     = require('./routes/chat');
const messagesRoutes = require('./routes/messages');
const priceRoutes    = require('./routes/price');
const geoRoutes      = require('./routes/geo');
const registerChatSocket = require('./sockets/chatSocket');
const registerGeoSocket  = require('./sockets/geoSocket');

// Osiguraj da uploads/ postoji
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Servira uploadane slike
app.use('/uploads', express.static(uploadsDir));

app.use('/api', authRoutes);
app.use('/api', chatRoutes);
app.use('/api', messagesRoutes);
app.use('/api', priceRoutes);
app.use('/api', geoRoutes);
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

registerChatSocket(io);
registerGeoSocket(io);

sequelize.authenticate()
  .then(async () => {
    console.log('Database connection established successfully.');

    // Dodaj kolonu lokacija_naziv ako ne postoji (idempotentna migracija)
    try {
      await sequelize.query(
        `ALTER TABLE geochat.objava_price ADD COLUMN IF NOT EXISTS lokacija_naziv VARCHAR(255);`
      );
    } catch (e) {
      console.warn('Migracija lokacija_naziv:', e.message);
    }

    // Ukloni FK ograničenje koje blokira geo igru (battle.ir_email_2 ne mora biti u individualni_razgovor)
    try {
      await sequelize.query(`ALTER TABLE geochat.battle DROP CONSTRAINT IF EXISTS fk_battle_chat;`);
    } catch (e) {
      console.warn('Migracija FK drop:', e.message);
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
      console.warn('Migracija geo_odgovor:', e.message);
    }

    // Brisanje isteklih priča svakih sat vremena
    const ObjavaPrice = require('./models/ObjavaPrice');
    const cleanupExpired = async () => {
      try {
        const n = await ObjavaPrice.destroy({ where: { datum_isteka: { [Op.lt]: new Date() } } });
        if (n > 0) console.log(`Obrisano ${n} isteklih priča`);
      } catch (err) {
        console.error('Cleanup greška:', err.message);
      }
    };
    cleanupExpired();
    setInterval(cleanupExpired, 60 * 60 * 1000);

    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
