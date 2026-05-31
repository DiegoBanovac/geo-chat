import { io } from 'socket.io-client';

// Email se čita iz localStorage (tamo ga App.jsx sprema pri loginu).
// Šaljemo ga kao `auth` parametar da server zna tko se spaja
// čim se socket konekcija uspostavi — bez čekanja na React event.
function getEmail() {
  try {
    const raw = localStorage.getItem('korisnik');
    return raw ? JSON.parse(raw)?.email_korisnika ?? '' : '';
  } catch {
    return '';
  }
}

const socket = io('http://localhost:3001', {
  autoConnect: false,
  auth: { email: getEmail() },
});

// Ažuriraj email u auth prije svakog reconnecta
// (relevantno ako se korisnik odjavi i drugi se logira)
socket.on('reconnect_attempt', () => {
  socket.auth = { email: getEmail() };
});

export default socket;