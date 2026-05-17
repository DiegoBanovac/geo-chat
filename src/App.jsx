import { useState } from "react";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import { odjavaKorisnik } from "./lib/supabase";

export default function App() {
  const [korisnik, setKorisnik] = useState(null);

  const handleLogin = (podaciKorisnika) => {
    setKorisnik(podaciKorisnika);
  };

  const handleOdjava = () => {
    odjavaKorisnik(); // briše sessionStorage
    setKorisnik(null);
  };

  if (korisnik) {
    return <ChatPage korisnik={korisnik} onOdjava={handleOdjava} />;
  }

  return <AuthPage onLogin={handleLogin} />;
}
