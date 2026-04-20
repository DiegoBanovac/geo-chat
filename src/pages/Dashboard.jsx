export default function Dashboard({ korisnik, onOdjava }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white mb-1">
          Dobrodošli, {korisnik.ime_korisnika}!
        </h1>
        <p className="text-slate-500 text-sm mb-6">{korisnik.email_korisnika}</p>
        <button
          onClick={onOdjava}
          className="text-sm text-slate-400 hover:text-teal-400 transition-colors border border-slate-700 hover:border-teal-500/40 px-4 py-2 rounded-lg"
        >
          Odjava
        </button>
      </div>
    </div>
  );
}
