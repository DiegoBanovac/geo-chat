'use strict';
const Battle     = require('../models/Battle');
const GeoOdgovor = require('../models/GeoOdgovor');

// Runde igara u memoriji (ephemeral, ne trebaju DB)
const gameRunde = new Map(); // id_battle → [{ lat, lng, regija, broj_runde }]

// Praćenje predanih pogađanja po rundi — atomično u Node.js single-thread modelu
const roundGuesses = new Map(); // `${id_battle}_${broj_runde}` → Map<email, {lat,lng,bod,km}>

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function izracunajBodove(km) {
  return Math.round(5000 * Math.exp(-km / 2000));
}

module.exports = function registerGeoSocket(io) {
  io.on('connection', (socket) => {

    // Kreator poziva protivnika
    socket.on('invite_game', ({ chatId, idBattle, runde, inviterEmail }) => {
      gameRunde.set(idBattle, runde);
      socket.to(chatId).emit('game_invite', { idBattle, inviterEmail, chatId });
    });

    // Protivnik prihvatio
    socket.on('accept_game', async ({ idBattle, prihvatioEmail, chatId }) => {
      try {
        const battle = await Battle.findByPk(idBattle);
        if (!battle) return;
        await battle.update({ ir_email_2: prihvatioEmail, status_bitke: 'u_tijeku' });

        const runde = gameRunde.get(idBattle) || [];
        io.to(chatId).emit('game_started', {
          idBattle,
          runde,
          igrac1: battle.ir_email_1,
          igrac2: prihvatioEmail,
        });

        // Kratka pauza da UI procesira game_started, pa pokreni prvu rundu
        setTimeout(() => {
          if (runde.length > 0) {
            io.to(chatId).emit('round_start', { ...runde[0], ukupnoRundi: runde.length });
          }
        }, 800);
      } catch (err) {
        console.error('accept_game greška:', err);
      }
    });

    // Igrač predaje pogađanje
    socket.on('submit_guess', async ({ idBattle, brojRunde, lat, lng, email, chatId }) => {
      try {
        const runde = gameRunde.get(idBattle);
        if (!runde) return;
        const runda = runde.find(r => r.broj_runde === brojRunde);
        if (!runda) return;

        const key = `${idBattle}_${brojRunde}`;
        if (!roundGuesses.has(key)) roundGuesses.set(key, new Map());
        const guesses = roundGuesses.get(key);

        if (guesses.has(email)) return; // duplikat

        const km  = haversine(parseFloat(lat), parseFloat(lng), runda.lat, runda.lng);
        const bod = izracunajBodove(km);
        guesses.set(email, { lat: parseFloat(lat), lng: parseFloat(lng), bod, km: Math.round(km * 10) / 10 });

        if (guesses.size < 2) return; // čekamo drugog igrača

        // Oba predala — izračunaj i spremi
        roundGuesses.delete(key);

        const battle = await Battle.findByPk(idBattle);
        if (!battle) return;

        // Atomično ažuriraj bodove (oboje odjednom)
        const scoreUpdate = {};
        for (const [em, g] of guesses) {
          if (em === battle.ir_email_1) scoreUpdate.bodovi_ir_1 = (battle.bodovi_ir_1 || 0) + g.bod;
          else scoreUpdate.bodovi_ir_2 = (battle.bodovi_ir_2 || 0) + g.bod;
        }
        await battle.update(scoreUpdate);

        // Spremi u DB
        for (const [em, g] of guesses) {
          GeoOdgovor.create({
            id_battle: idBattle, broj_runde: brojRunde, email_igraca: em,
            guess_lat: g.lat, guess_lng: g.lng, bodovi: g.bod, udaljenost_km: g.km,
          }).catch(e => console.error('GeoOdgovor create:', e.message));
        }

        const svjeziBattle = await Battle.findByPk(idBattle);

        const roundRes = {
          brojRunde,
          pravaLat: runda.lat,
          pravaLng: runda.lng,
          regija:   runda.regija,
          odgovori: [...guesses.entries()].map(([em, g]) => ({ email: em, ...g })),
          ukupnoBodova: {
            [svjeziBattle.ir_email_1]: svjeziBattle.bodovi_ir_1,
            [svjeziBattle.ir_email_2]: svjeziBattle.bodovi_ir_2,
          },
        };

        io.to(chatId).emit('round_results', roundRes);

        if (brojRunde >= runde.length) {
          // Zadnja runda — završi igru
          const pobjednik = svjeziBattle.bodovi_ir_1 >= svjeziBattle.bodovi_ir_2
            ? svjeziBattle.ir_email_1
            : svjeziBattle.ir_email_2;
          await svjeziBattle.update({ status_bitke: 'zavrsena', datum_zavrsetka: new Date(), pobjednik_email: pobjednik });
          gameRunde.delete(idBattle);
          setTimeout(() => {
            io.to(chatId).emit('game_ended', {
              idBattle, pobjednik,
              igrac1: { email: svjeziBattle.ir_email_1, bodovi: svjeziBattle.bodovi_ir_1 },
              igrac2: { email: svjeziBattle.ir_email_2, bodovi: svjeziBattle.bodovi_ir_2 },
            });
          }, 3000);
        } else {
          // Sljedeća runda nakon pauze
          const sljedecaRunda = runde[brojRunde];
          setTimeout(() => {
            io.to(chatId).emit('round_start', { ...sljedecaRunda, ukupnoRundi: runde.length });
          }, 6000);
        }
      } catch (err) {
        console.error('submit_guess greška:', err);
      }
    });

    // Igrač odustao
    socket.on('cancel_game', async ({ idBattle, chatId }) => {
      try {
        await Battle.update({ status_bitke: 'zavrsena', datum_zavrsetka: new Date() }, { where: { id_battle: idBattle } });
        gameRunde.delete(idBattle);
        io.to(chatId).emit('game_cancelled', { idBattle });
      } catch (err) {
        console.error('cancel_game greška:', err);
      }
    });
  });
};
