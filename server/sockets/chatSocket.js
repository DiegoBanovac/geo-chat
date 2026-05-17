'use strict';
const Poruka = require('../models/Poruka');
const Korisnik = require('../models/Korisnik');

module.exports = function registerChatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('join_chat', ({ chatId }) => {
      socket.join(chatId);
    });

    socket.on('leave_chat', ({ chatId }) => {
      socket.leave(chatId);
    });

    socket.on('send_message', async (data) => {
      const { chatId, text, type, e1, e2, naziv_grupe, senderEmail } = data;
      if (!text?.trim() || !senderEmail) return;

      try {
        const primatelj =
          type === 'individual' ? (senderEmail === e1 ? e2 : e1) : null;

        const novaPoruka = await Poruka.create({
          posiljatelj_email: senderEmail,
          naziv_grupe:       type === 'group' ? naziv_grupe : null,
          primatelj_email:   primatelj,
          poruka_tekst:      text.trim(),
          tip_medija:        'tekst',
        });

        const k = await Korisnik.findOne({
          where: { email_korisnika: senderEmail },
          attributes: ['ime_korisnika', 'prezime_korisnika'],
        });

        io.to(chatId).emit('new_message', {
          id_poruke:         novaPoruka.id_poruke,
          posiljatelj_email: senderEmail,
          posiljatelj_ime:   k ? `${k.ime_korisnika} ${k.prezime_korisnika}` : senderEmail,
          naziv_grupe:       novaPoruka.naziv_grupe,
          primatelj_email:   novaPoruka.primatelj_email,
          vrijeme_slanja:    novaPoruka.vrijeme_slanja,
          poruka_tekst:      novaPoruka.poruka_tekst,
          tip_medija:        'tekst',
        });
      } catch (err) {
        console.error('Socket send_message greška:', err);
        socket.emit('message_error', { error: 'Greška pri slanju poruke' });
      }
    });
  });
};
