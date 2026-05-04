const API_BASE = 'http://localhost:3001/api';

export async function loginKorisnik(email, lozinka) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, lozinka }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Greška pri spajanju na server');
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
