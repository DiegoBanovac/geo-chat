import { useState } from "react";
import { loginKorisnik, registerKorisnik } from "../lib/supabase";

const MapGridBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#14b8a6" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
    <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-teal-500/5 blur-3xl" />
    <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
  </div>
);

const GeoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const InputField = ({ label, type = "text", value, onChange, placeholder, required = true }) => (
  <div>
    <label className="block text-sm font-medium text-slate-400 mb-1.5">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/70 focus:bg-slate-800 transition-all"
    />
  </div>
);

const Alert = ({ type, message }) => {
  const styles = {
    error: "bg-red-500/10 border-red-500/20 text-red-400",
    success: "bg-teal-500/10 border-teal-500/20 text-teal-400",
  };
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm ${styles[type]}`}>
      {message}
    </div>
  );
};

function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const korisnik = await loginKorisnik(email, lozinka);
      onSuccess(korisnik);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error" message={error} />}

      <InputField
        label="Email adresa"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="ime.prezime@gmail.com"
      />

      <InputField
        label="Lozinka"
        type="password"
        value={lozinka}
        onChange={setLozinka}
        placeholder="Unesite lozinku"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-2"
      >
        {loading ? "Prijavljujem..." : "Prijavi se"}
      </button>
    </form>
  );
}

function RegisterForm({ onSuccess }) {
  const [ime, setIme] = useState("");
  const [prezime, setPrezime] = useState("");
  const [email, setEmail] = useState("");
  const [lozinka, setLozinka] = useState("");
  const [potvrda, setPotvrda] = useState("");
  const [datum, setDatum] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lozinka !== potvrda) {
      setError("Lozinke se ne podudaraju");
      return;
    }
    if (lozinka.length < 6) {
      setError("Lozinka mora imati najmanje 6 znakova");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await registerKorisnik({ ime, prezime, email, lozinka, datum_rodenja: datum });
      setSuccess("Registracija je uspješna! Možete se prijaviti.");
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="grid grid-cols-2 gap-3">
        <InputField label="Ime" value={ime} onChange={setIme} placeholder="Vaše ime" />
        <InputField label="Prezime" value={prezime} onChange={setPrezime} placeholder="Vaše prezime" />
      </div>

      <InputField
        label="Email adresa"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="ime.prezime@gmail.com"
      />

      <InputField
        label="Datum rođenja"
        type="date"
        value={datum}
        onChange={setDatum}
        placeholder=""
      />

      <InputField
        label="Lozinka"
        type="password"
        value={lozinka}
        onChange={setLozinka}
        placeholder="Najmanje 6 znakova"
      />

      <InputField
        label="Potvrda lozinke"
        type="password"
        value={potvrda}
        onChange={setPotvrda}
        placeholder="Ponovite lozinku"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-2"
      >
        {loading ? "Registriram..." : "Registriraj se"}
      </button>
    </form>
  );
}

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");

  const switchMode = (newMode) => {
    setMode(newMode);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative">
      <MapGridBackground />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 mb-4">
            <GeoIcon />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GeoChat</h1>
          <p className="text-slate-500 text-sm mt-1">Započni svoju geo avanturu!</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800/60 rounded-2xl p-6 shadow-2xl">
          <div className="flex bg-slate-800/70 rounded-xl p-1 mb-6 gap-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "login"
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Prijava
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === "register"
                  ? "bg-teal-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Registracija
            </button>
          </div>

          {mode === "login" ? (
            <LoginForm onSuccess={onLogin} />
          ) : (
            <RegisterForm onSuccess={() => switchMode("login")} />
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          2026
        </p>
      </div>
    </div>
  );
}
