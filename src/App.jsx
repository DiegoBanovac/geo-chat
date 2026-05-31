import { useState } from "react";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import { odjavaKorisnik } from "./lib/supabase";

// Pokušaj dohvatiti korisnika iz localStorage pri prvom renderu.
// Ako postoji, korisnik ostaje ulogiran i nakon refresha.
function ucitajKorisnikaIzStorage() {
  try {
    const raw = localStorage.getItem("korisnik");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [korisnik, setKorisnik] = useState(() => ucitajKorisnikaIzStorage());

  const handleLogin = (podaciKorisnika) => {
    // Spremi cijeli objekt u localStorage da preživi refresh
    localStorage.setItem("korisnik", JSON.stringify(podaciKorisnika));
    setKorisnik(podaciKorisnika);
  };

  const handleOdjava = () => {
    odjavaKorisnik();
    setKorisnik(null);
  };

  const handleKorisnikUpdate = (updated) => {
    localStorage.setItem("korisnik", JSON.stringify(updated));
    setKorisnik(updated);
  };

  if (korisnik) {
    return (
      <ChatPage
        korisnik={korisnik}
        onOdjava={handleOdjava}
        onKorisnikUpdate={handleKorisnikUpdate}
      />
    );
  }

  return <AuthPage onLogin={handleLogin} />;
}