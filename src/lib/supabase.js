const API_BASE = 'http://localhost:3001/api';

// ─── Interni helper ──────────────────────────────────────────────────────────
// Nakon login-a email se sprema u sessionStorage i šalje kao header
// na svaki authenticated zahtjev. U produkciji bi ovo bio JWT.

function getAuthHeader() {
  const email = sessionStorage.getItem('userEmail');
  return email ? { 'X-User-Email': email } : {};
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginKorisnik(email, lozinka) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, lozinka }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Greška pri spajanju na server');

  // Spremi identifikator u sessionStorage
  sessionStorage.setItem('userEmail', data.email_korisnika);
  return data;
}

export async function registerKorisnik({ ime, prezime, email, lozinka, datum_rodenja }) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ime, prezime, email, lozinka, datum_rodenja }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Greška tijekom registracije');
  return data;
}

export function odjavaKorisnik() {
  sessionStorage.removeItem('userEmail');
}

// ─── Korisnici ───────────────────────────────────────────────────────────────

// Pretraga korisnika za autocomplete (min 2 znaka)
export async function pretraziKorisnike(query) {
  if (!query || query.trim().length < 2) return [];
  const res = await fetch(
    `${API_BASE}/korisnici/search?q=${encodeURIComponent(query.trim())}`,
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Greška pri pretrazi');
  return data;
}

// ─── Chatovi ─────────────────────────────────────────────────────────────────

// Dohvati sve chatove trenutnog korisnika
export async function dohvatiChatove() {
  const res = await fetch(`${API_BASE}/chats`, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Greška pri dohvatu razgovora');
  return data;
}

// Kreiraj novi 1-na-1 razgovor
export async function kreirajIndividualniChat(emailDrugog) {
  const res = await fetch(`${API_BASE}/chats/individual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ email_korisnika_2: emailDrugog }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Greška pri kreiranju razgovora');
  return data;
}

// Kreiraj novu grupu
export async function kreirajGrupu({ naziv_grupe, clanovi = [] }) {
  const res = await fetch(`${API_BASE}/chats/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ naziv_grupe, clanovi }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Greška pri kreiranju grupe');
  return data;
}
