const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const baseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

export async function loginKorisnik(email, lozinka) {
  const url =
    `${SUPABASE_URL}/rest/v1/korisnik` +
    `?email_korisnika=eq.${encodeURIComponent(email)}` +
    `&lozinka_korisnika=eq.${encodeURIComponent(lozinka)}` +
    `&select=*`;

  const res = await fetch(url, { headers: baseHeaders });

  if (!res.ok) {
    throw new Error("Greška pri spajanju na server");
  }

  const data = await res.json();

  if (!data || data.length === 0) {
    throw new Error("Pogrešna email adresa ili lozinka");
  }

  return data[0];
}

export async function registerKorisnik({ ime, prezime, email, lozinka, datum_rodenja }) {
  const url = `${SUPABASE_URL}/rest/v1/korisnik`;

  const res = await fetch(url, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      ime_korisnika: ime,
      prezime_korisnika: prezime,
      email_korisnika: email,
      lozinka_korisnika: lozinka,
      datum_rodenja: datum_rodenja,
      slika_profila: "",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    if (err.code === "23505") {
      throw new Error("Korisnik sa tom email adresom već postoji");
    }
    throw new Error(err.message || "Greska tijekom registracije");
  }

  const data = await res.json();
  return data[0];
}
