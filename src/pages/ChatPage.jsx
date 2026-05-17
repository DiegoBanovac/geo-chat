import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  dohvatiChatove,
  kreirajIndividualniChat,
  kreirajGrupu,
  pretraziKorisnike,
  dohvatiPoruke,
  dohvatiPrice,
  uploadPricu,
  oznaciBrojPriče,
  startGeoGame,
} from "../lib/supabase";
import socket from "../lib/socket";

// Fix Leaflet default marker icons for Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Load Google Maps script exactly once for the lifetime of the page
let _mapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.StreetViewPanorama) return Promise.resolve(window.google.maps);
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve, reject) => {
    window.__gmCb = () => { delete window.__gmCb; resolve(window.google.maps); };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__gmCb&v=weekly&libraries=streetView`;
    s.async = true;
    s.onerror = () => { _mapsPromise = null; reject(new Error("Google Maps failed to load")); };
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const UsersIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const UserIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ChatBubbleIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const SpinnerIcon = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const PinIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);
const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const AVATAR_COLORS = [
  "bg-teal-600","bg-cyan-600","bg-blue-600",
  "bg-violet-600","bg-emerald-600","bg-sky-600",
];
const getInitials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};
const getAvatarColor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const Avatar = ({ name = "", size = "md" }) => {
  const sz = size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  return (
    <div className={`${sz} ${getAvatarColor(name)} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}>
      {getInitials(name)}
    </div>
  );
};

const KorisnikSearch = ({ placeholder, onSelect, excludeEmails = [] }) => {
  const [query, setQuery] = useState("");
  const [rezultati, setRezultati] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) { setRezultati([]); setOpen(false); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await pretraziKorisnike(query);
        const filtered = res.filter((k) => !excludeEmails.includes(k.email_korisnika));
        setRezultati(filtered);
        setOpen(true);
      } catch { setRezultati([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (k) => {
    onSelect(k);
    setQuery("");
    setRezultati([]);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 pr-9 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/70 focus:bg-slate-800 transition-all"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          {loading ? <SpinnerIcon /> : <SearchIcon />}
        </span>
      </div>
      {open && rezultati.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden z-50 max-h-48 overflow-y-auto">
          {rezultati.map((k) => (
            <button
              key={k.email_korisnika}
              onMouseDown={() => handleSelect(k)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/80 transition-colors text-left"
            >
              <Avatar name={`${k.ime_korisnika} ${k.prezime_korisnika}`} size="sm" />
              <div>
                <p className="text-sm text-slate-200 font-medium">{k.ime_korisnika} {k.prezime_korisnika}</p>
                <p className="text-xs text-slate-500">{k.email_korisnika}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && rezultati.length === 0 && !loading && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl z-50">
          <p className="text-xs text-slate-500 px-4 py-3 text-center">Nema korisnika za "{query}"</p>
        </div>
      )}
    </div>
  );
};

const NewChatModal = ({ onClose, onCreate }) => {
  const [odabrani, setOdabrani] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!odabrani) return;
    setLoading(true);
    setError("");
    try {
      const chat = await kreirajIndividualniChat(odabrani.email_korisnika);
      onCreate(chat);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-base">Novi razgovor</h2>
            <p className="text-slate-500 text-xs mt-0.5">Pretraži i odaberi korisnika</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1"><XIcon /></button>
        </div>
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-3 py-2">{error}</div>
        )}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Traži korisnika</label>
          <KorisnikSearch placeholder="Pretraži po imenu ili emailu..." onSelect={(k) => setOdabrani(k)} />
        </div>
        {odabrani && (
          <div className="mb-5 flex items-center gap-3 bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-2.5">
            <Avatar name={`${odabrani.ime_korisnika} ${odabrani.prezime_korisnika}`} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-teal-300 font-medium">{odabrani.ime_korisnika} {odabrani.prezime_korisnika}</p>
              <p className="text-xs text-slate-500 truncate">{odabrani.email_korisnika}</p>
            </div>
            <button onClick={() => setOdabrani(null)} className="text-slate-500 hover:text-slate-300"><XIcon /></button>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-xl transition-all">Odustani</button>
          <button
            onClick={handleCreate}
            disabled={!odabrani || loading}
            className="flex-1 py-2.5 text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><SpinnerIcon /> Kreiram...</> : "Započni chat"}
          </button>
        </div>
      </div>
    </div>
  );
};

const NewGroupModal = ({ onClose, onCreate }) => {
  const [naziv, setNaziv] = useState("");
  const [clanovi, setClanovi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addClan = (k) => {
    if (clanovi.some((c) => c.email_korisnika === k.email_korisnika)) return;
    setClanovi([...clanovi, k]);
  };
  const removeClan = (email) => setClanovi(clanovi.filter((c) => c.email_korisnika !== email));

  const handleCreate = async () => {
    if (!naziv.trim()) return;
    setLoading(true);
    setError("");
    try {
      const grupa = await kreirajGrupu({ naziv_grupe: naziv.trim(), clanovi: clanovi.map((c) => c.email_korisnika) });
      onCreate(grupa);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-base">Nova grupa</h2>
            <p className="text-slate-500 text-xs mt-0.5">Kreiraj grupni razgovor</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1"><XIcon /></button>
        </div>
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-3 py-2">{error}</div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Naziv grupe</label>
          <input
            type="text" value={naziv} onChange={(e) => setNaziv(e.target.value)}
            placeholder="npr. GeoMasters" autoFocus
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/70 focus:bg-slate-800 transition-all"
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Dodaj članove</label>
          <KorisnikSearch
            placeholder="Pretraži po imenu ili emailu..."
            onSelect={addClan}
            excludeEmails={clanovi.map((c) => c.email_korisnika)}
          />
        </div>
        {clanovi.length > 0 && (
          <div className="mb-4 space-y-1.5 max-h-32 overflow-y-auto">
            {clanovi.map((c) => (
              <div key={c.email_korisnika} className="flex items-center gap-2.5 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-1.5">
                <Avatar name={`${c.ime_korisnika} ${c.prezime_korisnika}`} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium truncate">{c.ime_korisnika} {c.prezime_korisnika}</p>
                </div>
                <button onClick={() => removeClan(c.email_korisnika)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0"><XIcon /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-xl transition-all">Odustani</button>
          <button
            onClick={handleCreate}
            disabled={!naziv.trim() || loading}
            className="flex-1 py-2.5 text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><SpinnerIcon /> Kreiram...</> : "Kreiraj grupu"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatItem = ({ chat, isActive, onClick }) => (
  <button
    onClick={() => onClick(chat)}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left group ${
      isActive ? "bg-teal-500/10 border border-teal-500/20" : "hover:bg-slate-800/60 border border-transparent"
    }`}
  >
    <Avatar name={chat.name} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className={`font-medium text-sm truncate ${isActive ? "text-teal-400" : "text-slate-200"}`}>{chat.name}</span>
        <span className="text-[10px] text-slate-600 shrink-0 ml-2">{chat.type === "group" ? `${chat.memberCount} čl.` : ""}</span>
      </div>
      <p className="text-xs text-slate-500 truncate">{chat.type === "group" ? "Grupni razgovor" : "Privatni razgovor"}</p>
    </div>
  </button>
);

const SidebarHeader = ({ onNewChat, onNewGroup }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="px-4 pt-4 pb-3 border-b border-slate-800/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-teal-400">
          <GeoIcon />
          <span className="font-bold text-white tracking-tight text-base">GeoChat</span>
        </div>
        <div ref={menuRef} className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-400 hover:bg-slate-800/60 transition-all">
            <PlusIcon />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden z-20">
              <button onClick={() => { onNewChat(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/80 hover:text-teal-400 transition-all">
                <UserIcon /> Novi razgovor
              </button>
              <div className="mx-3 border-t border-slate-800" />
              <button onClick={() => { onNewGroup(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/80 hover:text-teal-400 transition-all">
                <UsersIcon /> Nova grupa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Tabs = ({ active, onChange, counts }) => (
  <div className="flex gap-1 px-4 pt-3 pb-2">
    {["Svi", "Privatni", "Grupe"].map((tab) => (
      <button
        key={tab} onClick={() => onChange(tab)}
        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
          active === tab ? "bg-teal-500/15 text-teal-400 border border-teal-500/20" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        {tab}
        {counts[tab] > 0 && (
          <span className={`text-[9px] px-1 rounded-full ${active === tab ? "bg-teal-500/30" : "bg-slate-700"}`}>
            {counts[tab]}
          </span>
        )}
      </button>
    ))}
  </div>
);

const ChatSearch = ({ value, onChange }) => (
  <div className="px-4 pb-3">
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><SearchIcon /></span>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="Pretraži razgovore..."
        className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 transition-all"
      />
    </div>
  </div>
);

const ProfileFooter = ({ korisnik, onOdjava }) => {
  const name = `${korisnik.ime_korisnika} ${korisnik.prezime_korisnika}`;
  return (
    <div className="px-4 py-3 border-t border-slate-800/60 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
        {getInitials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{name}</p>
        <p className="text-xs text-slate-600 truncate">{korisnik.email_korisnika}</p>
      </div>
      <button onClick={onOdjava} className="text-xs text-slate-500 hover:text-teal-400 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-slate-800/60">
        Odjava
      </button>
    </div>
  );
};

const EmptyState = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-500/5 border border-teal-500/10 text-teal-500/30 mb-4">
        <ChatBubbleIcon />
      </div>
      <h3 className="text-slate-400 font-medium text-sm mb-1">Odaberi razgovor</h3>
      <p className="text-slate-600 text-xs">Klikni na chat s lijeve strane da ga otvoriš</p>
    </div>
  </div>
);

// ─── Stories: StoryUploadModal ───────────────────────────────────────────────

const StoryUploadModal = ({ onClose, onUploaded }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const nova = await uploadPricu({ file, lokacija_naziv: location.trim() || null });
      onUploaded(nova);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-base">Nova priča</h2>
            <p className="text-slate-500 text-xs mt-0.5">Briše se automatski za 24 sata</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 transition-colors">
            <XIcon />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {/* Image picker */}
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="mb-4 h-52 rounded-xl overflow-hidden border-2 border-dashed border-slate-700 hover:border-teal-500/60 transition-colors cursor-pointer flex items-center justify-center bg-slate-800/40"
        >
          {preview ? (
            <img src={preview} className="w-full h-full object-cover" alt="preview" />
          ) : (
            <div className="text-center select-none">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-700/60 text-slate-400 mb-3">
                <ImageIcon />
              </div>
              <p className="text-slate-400 text-sm font-medium">Klikni ili prevuci sliku</p>
              <p className="text-slate-600 text-xs mt-1">JPG, PNG, GIF, WebP · max 10 MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        {/* Location */}
        <div className="mb-5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-400 mb-1.5">
            <PinIcon /> Lokacija <span className="text-slate-600 font-normal">(opcionalno)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="npr. Rijeka, Hrvatska"
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/70 transition-all"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-xl transition-all"
          >
            Odustani
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="flex-1 py-2.5 text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><SpinnerIcon /> Objavljujem...</> : "Objavi priču"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Stories: StoryViewer ────────────────────────────────────────────────────

const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}m`;
  return "upravo";
};

const StoryViewer = ({ group, startIndex, korisnik, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(startIndex);
  const story = group.price[currentIdx];
  const name = `${group.ime} ${group.prezime}`;

  useEffect(() => {
    if (story && !group.isMine && !story.viewed) {
      oznaciBrojPriče(story.id_price).catch(() => {});
    }
  }, [story?.id_price]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft")  goPrev();
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIdx]);

  const goNext = () => {
    if (currentIdx < group.price.length - 1) setCurrentIdx((i) => i + 1);
    else onClose();
  };
  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-3 z-10">
          {group.price.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 rounded-full bg-white/20 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${i < currentIdx ? "bg-white w-full" : i === currentIdx ? "bg-white w-full" : "w-0"}`}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 flex items-center gap-2.5 px-3 z-10">
          <div className={`w-8 h-8 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
            {getInitials(name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-none">{name}</p>
            <p className="text-white/50 text-xs mt-0.5">{timeAgo(story.vrijeme_objave)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 relative">
          <img
            src={story.sadrzaj_url}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />

          {/* Location tag */}
          {story.lokacija_naziv && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-black/55 backdrop-blur-md text-white text-xs px-3.5 py-2 rounded-full flex items-center gap-1.5 border border-white/10">
                <PinIcon />
                {story.lokacija_naziv}
              </div>
            </div>
          )}

          {/* Navigation — left zone */}
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className={`absolute left-0 top-0 w-1/4 h-full flex items-center justify-start pl-2 ${currentIdx === 0 ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            aria-label="Prethodna"
          >
            <div className="bg-black/30 rounded-full p-1 text-white/70 hover:text-white transition-colors">
              <ChevronLeftIcon />
            </div>
          </button>

          {/* Navigation — right zone */}
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-0 top-0 w-1/4 h-full flex items-center justify-end pr-2"
            aria-label="Sljedeća"
          >
            <div className="bg-black/30 rounded-full p-1 text-white/70 hover:text-white transition-colors">
              <ChevronRightIcon />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Stories: StoriesStrip ───────────────────────────────────────────────────

const StoryBubble = ({ label, hasUnviewed, isMine, noStory, onClick }) => (
  <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={onClick}>
    <div className={`p-0.5 rounded-full ${hasUnviewed ? "bg-linear-to-tr from-teal-500 to-cyan-400" : isMine && !noStory ? "bg-linear-to-tr from-teal-500 to-cyan-400" : "bg-slate-700"}`}>
      <div className="p-0.5 bg-slate-900 rounded-full">
        <div className={`w-10 h-10 rounded-full ${getAvatarColor(label)} flex items-center justify-center text-white text-xs font-bold relative`}>
          {getInitials(label)}
          {noStory && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center border-2 border-slate-900">
              <span className="text-white text-[9px] font-bold leading-none">+</span>
            </div>
          )}
        </div>
      </div>
    </div>
    <span className="text-[9px] text-slate-500 truncate max-w-11 text-center leading-tight">
      {label.split(" ")[0]}
    </span>
  </div>
);

const StoriesStrip = ({ korisnik, storyGroups, onOpenStory, onAddStory }) => {
  const myName = `${korisnik.ime_korisnika} ${korisnik.prezime_korisnika}`;
  const myGroup = storyGroups.find((g) => g.isMine);
  const others = storyGroups.filter((g) => !g.isMine);

  return (
    <div className="px-3 pt-3 pb-2 border-b border-slate-800/60">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 px-0.5">
        Priče
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {/* Moja priča / dodaj */}
        <StoryBubble
          label={myName}
          hasUnviewed={false}
          isMine={true}
          noStory={!myGroup}
          onClick={() => (myGroup ? onOpenStory(myGroup, 0) : onAddStory())}
        />

        {/* Priče ostalih korisnika */}
        {others.map((group) => (
          <StoryBubble
            key={group.email_korisnika}
            label={`${group.ime} ${group.prezime}`}
            hasUnviewed={group.hasUnviewed}
            isMine={false}
            noStory={false}
            onClick={() => onOpenStory(group, 0)}
          />
        ))}

        {storyGroups.length === 0 && (
          <p className="text-xs text-slate-600 py-1 px-1">Nema aktivnih priča</p>
        )}
      </div>
    </div>
  );
};

// ─── Geo Igra: komponenti ────────────────────────────────────────────────────

const GameLobby = ({ onCancel }) => (
  <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
    <div className="text-7xl">🌍</div>
    <div>
      <h2 className="text-white text-xl font-bold mb-2">Čekanje na protivnika</h2>
      <p className="text-slate-400 text-sm">Pozivnica je poslana. Čekam prihvaćanje...</p>
    </div>
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <SpinnerIcon /><span className="ml-1">Čekam odgovor...</span>
    </div>
    <button onClick={onCancel}
      className="px-6 py-2.5 text-sm font-medium text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200 rounded-xl transition-all">
      Odustani
    </button>
  </div>
);

const GameRound = ({ runda, idBattle, chatId, korisnik, ukupnoRundi }) => {
  const [noImagery, setNoImagery] = useState(false);
  const svRef    = useRef(null);
  const mapRef   = useRef(null);
  const markerRef = useRef(null);
  const guessRef  = useRef(null);
  const submittedRef = useRef(false);
  const [guessSet, setGuessSet]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft]   = useState(60);

  const doSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitted(true);
    socket.emit("submit_guess", {
      idBattle,
      brojRunde: runda.broj_runde,
      lat: guessRef.current?.lat ?? 0,
      lng: guessRef.current?.lng ?? 0,
      email: korisnik.email_korisnika,
      chatId,
    });
  }, [idBattle, runda.broj_runde, korisnik.email_korisnika, chatId]);

  // Timer
  useEffect(() => {
    const submit = () => doSubmit();
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); submit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [doSubmit]);

  // Leaflet guess map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 18,
    }).addTo(map);
    map.on("click", e => {
      guessRef.current = { lat: e.latlng.lat, lng: e.latlng.lng };
      setGuessSet(true);
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker(e.latlng).addTo(map);
    });
    return () => map.remove();
  }, []);

  // Google Street View
  useEffect(() => {
    if (!svRef.current) return;
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    if (!apiKey || apiKey.startsWith("OVDJE_")) return;
    let timeoutId;
    let cancelled = false;
    loadGoogleMaps(apiKey).then(maps => {
      if (cancelled || !svRef.current) return;
      const pano = new maps.StreetViewPanorama(svRef.current, {
        ...(runda.pano_id ? { pano: runda.pano_id } : { position: { lat: runda.lat, lng: runda.lng } }),
        addressControl: false,
        showRoadLabels: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        zoomControl: false,
      });
      timeoutId = setTimeout(() => { if (!cancelled) setNoImagery(true); }, 10000);
      pano.addListener("tiles_loaded", () => clearTimeout(timeoutId));
    }).catch(() => { if (!cancelled) setNoImagery(true); });
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [runda.lat, runda.lng]);

  const timerColor = timeLeft > 20 ? "text-teal-400" : timeLeft > 10 ? "text-yellow-400" : "text-red-400";
  const hasKey = import.meta.env.VITE_GOOGLE_MAPS_KEY && !import.meta.env.VITE_GOOGLE_MAPS_KEY.startsWith("OVDJE_");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60 shrink-0 bg-slate-900/50">
        <span className="text-slate-400 text-sm">Runda {runda.broj_runde} / {ukupnoRundi}</span>
        <span className={`font-mono font-bold text-xl ${timerColor}`}>{timeLeft}s</span>
        <div className="w-24" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Street View */}
        <div className="w-[60%] shrink-0 relative" style={{ colorScheme: 'light', isolation: 'isolate' }}>
          <div ref={svRef} className="w-full h-full bg-slate-900" style={{ colorScheme: 'light' }} />
          {!hasKey && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-center p-6">
              <p className="text-5xl mb-4">🗺️</p>
              <p className="text-slate-300 font-medium text-sm mb-1">Google Maps API ključ nije postavljen</p>
              <p className="text-slate-500 text-xs">Dodaj VITE_GOOGLE_MAPS_KEY u .env</p>
            </div>
          )}
          {hasKey && noImagery && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-center p-6">
              <p className="text-5xl mb-4">📷</p>
              <p className="text-slate-300 font-medium text-sm">Snimka nije dostupna za ovu lokaciju</p>
              <p className="text-slate-500 text-xs mt-1">Pokušaj pogoditi na temelju koordinata</p>
            </div>
          )}
        </div>
        {/* Guess map */}
        <div className="flex-1 flex flex-col border-l border-slate-800/60">
          <div ref={mapRef} className="flex-1" />
          <div className="p-3 border-t border-slate-800/60 bg-slate-900/50 shrink-0">
            <button onClick={doSubmit} disabled={!guessSet || submitted}
              className="w-full py-2.5 text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors">
              {submitted ? "✓ Predano! Čekam protivnika..." : guessSet ? "Predaj pogađanje" : "Klikni na karti za označiti lokaciju"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoundResults = ({ rezultati, isLast, onNextRound }) => {
  const mapRef = useRef(null);
  const [countdown, setCountdown] = useState(7);
  const advancedRef = useRef(false);

  const doNext = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onNextRound();
  }, [onNextRound]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(t => {
        if (t <= 1) { clearInterval(id); doNext(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [doNext]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = L.map(mapRef.current).setView([0, 0], 1);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    const bounds = [[rezultati.pravaLat, rezultati.pravaLng]];
    const pravaIkona = L.divIcon({ html: '<div style="font-size:22px;line-height:1">📍</div>', iconSize: [22, 22], iconAnchor: [11, 22], className: "" });
    L.marker([rezultati.pravaLat, rezultati.pravaLng], { icon: pravaIkona })
      .addTo(map).bindPopup(`<b>Prava lokacija</b><br>${rezultati.regija || ""}`).openPopup();

    const emojis = ["🔵", "🟢"];
    rezultati.odgovori.forEach((o, i) => {
      if (o.lat == null || o.lng == null) return;
      const ik = L.divIcon({ html: `<div style="font-size:18px;line-height:1">${emojis[i] || "🟡"}</div>`, iconSize: [18, 18], iconAnchor: [9, 9], className: "" });
      L.marker([o.lat, o.lng], { icon: ik }).addTo(map)
        .bindPopup(`<b>${o.email.split("@")[0]}</b><br>${o.km} km · ${o.bod} bod.`);
      L.polyline([[rezultati.pravaLat, rezultati.pravaLng], [o.lat, o.lng]], { color: i === 0 ? "#3b82f6" : "#22c55e", weight: 2, dashArray: "5,5", opacity: 0.8 }).addTo(map);
      bounds.push([o.lat, o.lng]);
    });

    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds).pad(0.3));
    return () => map.remove();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60 shrink-0 bg-slate-900/50">
        <h3 className="text-white font-semibold text-sm">Rezultati — Runda {rezultati.brojRunde}</h3>
        {!isLast && <span className="text-slate-500 text-xs">Sljedeća za {countdown}s</span>}
      </div>
      <div ref={mapRef} className="flex-1" />
      <div className="p-4 border-t border-slate-800/60 bg-slate-900/50 shrink-0">
        <table className="w-full text-xs mb-3">
          <thead><tr className="text-slate-500 border-b border-slate-800">
            <th className="text-left pb-1.5">Igrač</th>
            <th className="text-right pb-1.5">Udaljenost</th>
            <th className="text-right pb-1.5">+ Bodovi</th>
            <th className="text-right pb-1.5">Ukupno</th>
          </tr></thead>
          <tbody>
            {rezultati.odgovori.map(o => (
              <tr key={o.email} className="border-b border-slate-800/30">
                <td className="py-1.5 text-slate-300">{o.email.split("@")[0]}</td>
                <td className="py-1.5 text-right text-slate-400">{o.km} km</td>
                <td className="py-1.5 text-right text-teal-400 font-medium">+{o.bod}</td>
                <td className="py-1.5 text-right text-white font-bold">{rezultati.ukupnoBodova?.[o.email] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={doNext}
          className="w-full py-2 text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white rounded-xl transition-colors">
          {isLast ? "Vidi konačne rezultate →" : `Sljedeća runda (${countdown}s)`}
        </button>
      </div>
    </div>
  );
};

const FinalResults = ({ final, korisnik, onClose, onPlayAgain }) => {
  const myEmail   = korisnik.email_korisnika;
  const iAmWinner = final.pobjednik === myEmail;
  const igraci    = [final.igrac1, final.igrac2].filter(Boolean);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
      <div className="text-7xl">{iAmWinner ? "🏆" : "🌍"}</div>
      <div>
        <h2 className="text-white text-2xl font-bold mb-1">{iAmWinner ? "Pobijedio/la si!" : "Kraj igre"}</h2>
        <p className="text-slate-400 text-sm">
          {iAmWinner ? "Čestitamo! Imao/la si bolji njuh za lokacije." : `Pobijedio/la: ${final.pobjednik?.split("@")[0] ?? "?"}`}
        </p>
      </div>
      <div className="w-full max-w-xs bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide px-5 py-3 border-b border-slate-800">Konačni bodovi</p>
        {igraci.map((igrac, i) => (
          <div key={igrac.email} className={`flex items-center justify-between px-5 py-3 ${i < igraci.length - 1 ? "border-b border-slate-800/40" : ""}`}>
            <span className={`text-sm flex items-center gap-2 ${igrac.email === myEmail ? "text-teal-400 font-medium" : "text-slate-300"}`}>
              {final.pobjednik === igrac.email && <span>👑</span>}
              {igrac.email.split("@")[0]}
              {igrac.email === myEmail && " (ti)"}
            </span>
            <span className="text-white font-bold text-lg">{igrac.bodovi}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-slate-400 border border-slate-700 hover:border-slate-500 rounded-xl transition-all">Zatvori</button>
        <button onClick={onPlayAgain} className="px-6 py-2.5 text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white rounded-xl transition-colors">Igraj ponovo</button>
      </div>
    </div>
  );
};

const GeoGame = ({ game, korisnik, chatId, onClose, onPlayAgain, onNextRound }) => (
  <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
    <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800/60 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-base">🌍</span>
        <span className="text-white font-semibold text-sm">Geo Igra</span>
      </div>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 transition-colors"><XIcon /></button>
    </div>
    <div className="flex-1 overflow-hidden">
      {game.faza === "lobby" && <GameLobby onCancel={onClose} />}
      {game.faza === "playing" && game.trenutnaRundaData && (
        <GameRound
          key={game.trenutnaRundaData.broj_runde}
          runda={game.trenutnaRundaData}
          idBattle={game.id_battle}
          chatId={chatId}
          korisnik={korisnik}
          ukupnoRundi={game.runde?.length ?? 5}
        />
      )}
      {game.faza === "waiting_round" && (
        <div className="flex items-center justify-center h-full gap-3 text-slate-500">
          <SpinnerIcon /><span>Čekam sljedeću rundu...</span>
        </div>
      )}
      {game.faza === "round_results" && game.rezultati && (
        <RoundResults
          key={`rr-${game.rezultati.brojRunde}`}
          rezultati={game.rezultati}
          isLast={game.rezultati.brojRunde >= (game.runde?.length ?? 5)}
          onNextRound={onNextRound}
        />
      )}
      {game.faza === "final_results" && game.final && (
        <FinalResults final={game.final} korisnik={korisnik} onClose={onClose} onPlayAgain={onPlayAgain} />
      )}
    </div>
  </div>
);

// ─── Chat formatters ─────────────────────────────────────────────────────────

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
};

const ChatView = ({ chat, korisnik, gameInvite, onGameEvent, onStartGame }) => {
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [inputText, setInputText] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Join room, load history, and register all socket listeners
  useEffect(() => {
    if (!chat) return;

    setMessages([]);
    setLoadingMsgs(true);

    if (!socket.connected) socket.connect();
    socket.emit("join_chat", { chatId: chat.id });

    const params =
      chat.type === "individual"
        ? { type: "individual", e1: chat.email_korisnika_1, e2: chat.email_korisnika_2 }
        : { type: "group", naziv_grupe: chat.naziv_grupe };

    dohvatiPoruke(params)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));

    const handleNew = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on("new_message", handleNew);

    // Geo game socket events
    const onGameInvite    = (d) => onGameEvent("invite",        d);
    const onGameStarted   = (d) => onGameEvent("started",       d);
    const onRoundStart    = (d) => onGameEvent("round_start",   d);
    const onRoundResults  = (d) => onGameEvent("round_results", d);
    const onGameEnded     = (d) => onGameEvent("ended",         d);
    const onGameCancelled = (d) => onGameEvent("cancelled",     d);

    socket.on("game_invite",    onGameInvite);
    socket.on("game_started",   onGameStarted);
    socket.on("round_start",    onRoundStart);
    socket.on("round_results",  onRoundResults);
    socket.on("game_ended",     onGameEnded);
    socket.on("game_cancelled", onGameCancelled);

    return () => {
      socket.emit("leave_chat", { chatId: chat.id });
      socket.off("new_message", handleNew);
      socket.off("game_invite",    onGameInvite);
      socket.off("game_started",   onGameStarted);
      socket.off("round_start",    onRoundStart);
      socket.off("round_results",  onRoundResults);
      socket.off("game_ended",     onGameEnded);
      socket.off("game_cancelled", onGameCancelled);
    };
  }, [chat.id]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = inputText.trim();
    if (!text) return;

    const payload = {
      chatId: chat.id,
      text,
      type: chat.type,
      senderEmail: korisnik.email_korisnika,
    };
    if (chat.type === "individual") {
      payload.e1 = chat.email_korisnika_1;
      payload.e2 = chat.email_korisnika_2;
    } else {
      payload.naziv_grupe = chat.naziv_grupe;
    }

    socket.emit("send_message", payload);
    setInputText("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60 shrink-0">
        <Avatar name={chat.name} />
        <div className="flex-1">
          <h2 className="text-white font-semibold text-sm">{chat.name}</h2>
          <p className="text-xs text-slate-500">
            {chat.type === "group"
              ? `${chat.memberCount} članova · Grupni razgovor`
              : "Privatni razgovor"}
          </p>
        </div>
        {chat.type === "individual" && (
          <button
            onClick={onStartGame}
            title="Pokreni Geo Igru"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-teal-400 hover:bg-slate-800/60 transition-all text-lg"
          >
            🌍
          </button>
        )}
      </div>

      {/* Geo game invite banner */}
      {gameInvite && gameInvite.chatId === chat.id && (
        <div className="mx-4 mt-3 shrink-0 bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-300">
            🌍 <b className="text-teal-400">{gameInvite.inviterEmail.split("@")[0]}</b> te poziva na Geo igru!
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onGameEvent("accept", gameInvite)}
              className="px-3 py-1.5 text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-white rounded-lg transition-colors"
            >Prihvati</button>
            <button
              onClick={() => onGameEvent("decline", {})}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors"
            >Odbij</button>
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loadingMsgs ? (
          <div className="flex items-center justify-center py-12 text-slate-600">
            <SpinnerIcon />
            <span className="ml-2 text-sm">Učitavam poruke...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-slate-600 text-sm">Nema poruka. Pošalji prvu!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.posiljatelj_email === korisnik.email_korisnika;
            return (
              <div
                key={msg.id_poruke}
                className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}
              >
                {!isMine && <Avatar name={msg.posiljatelj_ime} size="sm" />}
                <div className={`flex flex-col gap-0.5 max-w-xs lg:max-w-md ${isMine ? "items-end" : "items-start"}`}>
                  {chat.type === "group" && !isMine && (
                    <span className="text-xs text-slate-500 px-1">{msg.posiljatelj_ime}</span>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? "bg-teal-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.poruka_tekst}
                  </div>
                  <span className="text-[10px] text-slate-600 px-1">
                    {formatTime(msg.vrijeme_slanja)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 focus-within:border-teal-500/50 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Napiši poruku..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!inputText.trim()}
            className="text-teal-500 hover:text-teal-400 disabled:text-slate-700 transition-colors shrink-0"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </>
  );
};

export default function ChatPage({ korisnik, onOdjava }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [activeTab, setActiveTab] = useState("Svi");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  // ── Geo igra ───────────────────────────────────────────────────────────────
  const [activeGame, setActiveGame] = useState(null);
  const [gameInvite, setGameInvite] = useState(null);

  const handleGameEvent = useCallback((event, data) => {
    switch (event) {
      case "invite":
        setGameInvite(data);
        break;
      case "accept":
        setGameInvite(null);
        setActiveGame({ id_battle: data.idBattle, faza: "lobby" });
        socket.emit("accept_game", {
          idBattle: data.idBattle,
          prihvatioEmail: korisnik.email_korisnika,
          chatId: data.chatId,
        });
        break;
      case "decline":
        setGameInvite(null);
        break;
      case "started":
        setGameInvite(null);
        setActiveGame(g => g
          ? { ...g, ...data, faza: "playing" }
          : { ...data, faza: "playing" });
        break;
      case "round_start":
        setActiveGame(g => g ? { ...g, faza: "playing", trenutnaRundaData: data } : g);
        break;
      case "round_results":
        setActiveGame(g => g ? { ...g, faza: "round_results", rezultati: data } : g);
        break;
      case "ended":
        setActiveGame(g => g ? { ...g, faza: "final_results", final: data } : g);
        break;
      case "cancelled":
        setActiveGame(null);
        setGameInvite(null);
        break;
      default:
        break;
    }
  }, [korisnik.email_korisnika]);

  const handleStartGame = useCallback(async (chatId) => {
    try {
      const { id_battle, runde } = await startGeoGame(chatId);
      setActiveGame({ id_battle, runde, faza: "lobby" });
      socket.emit("invite_game", {
        chatId,
        idBattle: id_battle,
        runde,
        inviterEmail: korisnik.email_korisnika,
      });
    } catch (err) {
      alert(err.message);
    }
  }, [korisnik.email_korisnika]);

  // ── Priče ──────────────────────────────────────────────────────────────────
  const [storyGroups, setStoryGroups] = useState([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null); // { group, startIdx }
  const [showStoryUpload, setShowStoryUpload] = useState(false);

  const ucitajPrice = useCallback(async () => {
    try {
      const data = await dohvatiPrice();
      setStoryGroups(data);
    } catch { /* tiha greška — priče nisu kritične */ }
  }, []);

  useEffect(() => { ucitajPrice(); }, [ucitajPrice]);

  const handleStoryUploaded = () => {
    setShowStoryUpload(false);
    ucitajPrice();
  };
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => { socket.disconnect(); };
  }, []);

  const ucitajChatove = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await dohvatiChatove();
      setChats(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { ucitajChatove(); }, [ucitajChatove]);

  const filteredChats = chats.filter((c) => {
    const tabOk =
      activeTab === "Svi" ||
      (activeTab === "Privatni" && c.type === "individual") ||
      (activeTab === "Grupe" && c.type === "group");
    const searchOk = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return tabOk && searchOk;
  });

  const counts = {
    Svi: chats.length,
    Privatni: chats.filter((c) => c.type === "individual").length,
    Grupe: chats.filter((c) => c.type === "group").length,
  };

  const handleChatCreated = (noviChat) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === noviChat.id);
      if (idx !== -1) return prev;
      return [noviChat, ...prev];
    });
    setActiveChat(noviChat);
    setActiveTab("Svi");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex relative">
      <MapGridBackground />

      <aside className="relative z-10 w-80 shrink-0 flex flex-col bg-slate-900/70 backdrop-blur-sm border-r border-slate-800/60">
        <SidebarHeader onNewChat={() => setShowNewChat(true)} onNewGroup={() => setShowNewGroup(true)} />
        <StoriesStrip
          korisnik={korisnik}
          storyGroups={storyGroups}
          onOpenStory={(group, idx) => setActiveStoryGroup({ group, startIdx: idx })}
          onAddStory={() => setShowStoryUpload(true)}
        />
        <Tabs active={activeTab} onChange={setActiveTab} counts={counts} />
        <ChatSearch value={searchQuery} onChange={setSearchQuery} />

        <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-600">
              <SpinnerIcon />
              <span className="ml-2 text-sm">Učitavam razgovore...</span>
            </div>
          ) : loadError ? (
            <div className="px-2 py-4 text-center">
              <p className="text-red-400 text-xs mb-2">{loadError}</p>
              <button onClick={ucitajChatove} className="text-xs text-teal-400 hover:text-teal-300 underline">Pokušaj ponovo</button>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-600 text-sm">
                {searchQuery ? `Nema rezultata za "${searchQuery}"` : "Nema razgovora"}
              </p>
              {!searchQuery && (
                <button onClick={() => setShowNewChat(true)} className="text-xs text-teal-400 hover:text-teal-300 mt-2 underline">
                  Započni prvi razgovor
                </button>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => (
              <ChatItem key={chat.id} chat={chat} isActive={activeChat?.id === chat.id} onClick={setActiveChat} />
            ))
          )}
        </div>

        <ProfileFooter korisnik={korisnik} onOdjava={onOdjava} />
      </aside>

      <main className="relative z-10 flex-1 flex flex-col bg-slate-950/50 backdrop-blur-sm">
        {activeChat ? (
          <ChatView
            chat={activeChat}
            korisnik={korisnik}
            gameInvite={gameInvite}
            onGameEvent={handleGameEvent}
            onStartGame={() => handleStartGame(activeChat.id)}
          />
        ) : <EmptyState />}
      </main>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onCreate={handleChatCreated} />}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} onCreate={handleChatCreated} />}

      {showStoryUpload && (
        <StoryUploadModal
          onClose={() => setShowStoryUpload(false)}
          onUploaded={handleStoryUploaded}
        />
      )}
      {activeStoryGroup && (
        <StoryViewer
          group={activeStoryGroup.group}
          startIndex={activeStoryGroup.startIdx}
          korisnik={korisnik}
          onClose={() => { setActiveStoryGroup(null); ucitajPrice(); }}
        />
      )}

      {activeGame && (
        <GeoGame
          game={activeGame}
          korisnik={korisnik}
          chatId={activeChat?.id}
          onClose={() => {
            if (activeGame.id_battle && activeGame.faza !== "final_results") {
              socket.emit("cancel_game", { idBattle: activeGame.id_battle, chatId: activeChat?.id });
            }
            setActiveGame(null);
          }}
          onPlayAgain={() => activeChat && handleStartGame(activeChat.id)}
          onNextRound={() => setActiveGame(g => g ? { ...g, faza: "waiting_round" } : g)}
        />
      )}
    </div>
  );
}
