import { useState } from "react";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [korisnik, setKorisnik] = useState(null);

  const handleLogin = (podaciKorisnika) => {
    setKorisnik(podaciKorisnika);
  };

  const handleOdjava = () => {
    setKorisnik(null);
  };

  if (korisnik) {
    return <Dashboard korisnik={korisnik} onOdjava={handleOdjava} />;
  }

  return <AuthPage onLogin={handleLogin} />;
}
