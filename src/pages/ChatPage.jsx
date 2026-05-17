import { useState, useEffect, useRef, useCallback } from "react";
import {
  dohvatiChatove,
  kreirajIndividualniChat,
  kreirajGrupu,
  pretraziKorisnike,
} from "../lib/supabase";

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
    <div className={`${sz} ${getAvatarColor(name)} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}>
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
                <button onClick={() => removeClan(c.email_korisnika)} className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"><XIcon /></button>
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
        <span className="text-[10px] text-slate-600 flex-shrink-0 ml-2">{chat.type === "group" ? `${chat.memberCount} čl.` : ""}</span>
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
      <div className={`w-8 h-8 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
        {getInitials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{name}</p>
        <p className="text-xs text-slate-600 truncate">{korisnik.email_korisnika}</p>
      </div>
      <button onClick={onOdjava} className="text-xs text-slate-500 hover:text-teal-400 transition-colors flex-shrink-0 px-2 py-1 rounded-lg hover:bg-slate-800/60">
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

const ChatView = ({ chat }) => (
  <>
    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60">
      <Avatar name={chat.name} />
      <div>
        <h2 className="text-white font-semibold text-sm">{chat.name}</h2>
        <p className="text-xs text-slate-500">
          {chat.type === "group" ? `${chat.memberCount} članova · Grupni razgovor` : "Privatni razgovor"}
        </p>
      </div>
    </div>
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center px-6">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${getAvatarColor(chat.name)} mb-4`}>
          <span className="text-white font-bold text-lg">{getInitials(chat.name)}</span>
        </div>
        <h3 className="text-slate-300 font-medium text-sm mb-1">{chat.name}</h3>
        <p className="text-slate-600 text-xs leading-relaxed">
          {chat.type === "group" ? `Grupni razgovor · ${chat.memberCount} članova` : `Privatni razgovor · ${chat.drugiEmail}`}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 bg-slate-800/50 border border-slate-700/40 rounded-full px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-xs text-slate-500">Slanje poruka uskoro dostupno</span>
        </div>
      </div>
    </div>
  </>
);

export default function ChatPage({ korisnik, onOdjava }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [activeTab, setActiveTab] = useState("Svi");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

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

      <aside className="relative z-10 w-80 flex-shrink-0 flex flex-col bg-slate-900/70 backdrop-blur-sm border-r border-slate-800/60">
        <SidebarHeader onNewChat={() => setShowNewChat(true)} onNewGroup={() => setShowNewGroup(true)} />
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
        {activeChat ? <ChatView chat={activeChat} /> : <EmptyState />}
      </main>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onCreate={handleChatCreated} />}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} onCreate={handleChatCreated} />}
    </div>
  );
}
