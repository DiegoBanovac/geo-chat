import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';

// ─── Ikone (preslikane iz ChatPage.jsx) ──────────────────────────────────────
const SpinnerIkona = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
const XIkona = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const TrofejIkona = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 21 12 17 16 21" /><line x1="12" y1="17" x2="12" y2="11" />
    <path d="M5 5H3v6a2 2 0 0 0 2 2h2" /><path d="M19 5h2v6a2 2 0 0 0-2 2h-2" />
    <rect x="5" y="1" width="14" height="10" rx="2" />
  </svg>
);
const ZemljaSIkona = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const KartaIkona = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

// ─── Google Maps loader (isti kao u ChatPage.jsx) ─────────────────────────────
let _mapsPromise = null;
function ucitajGoogleMaps(apiKey) {
  if (window.google?.maps?.StreetViewPanorama) return Promise.resolve(window.google.maps);
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve, reject) => {
    if (window.__gmCb) {
      // Callback već registriran, čekaj
      const provjeri = setInterval(() => {
        if (window.google?.maps?.StreetViewPanorama) {
          clearInterval(provjeri);
          resolve(window.google.maps);
        }
      }, 100);
      return;
    }
    window.__gmCb = () => { delete window.__gmCb; resolve(window.google.maps); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__gmCb&v=weekly&libraries=streetView`;
    s.async = true;
    s.onerror = () => { _mapsPromise = null; reject(new Error('Google Maps nije učitan')); };
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

// ─── Pomoćne funkcije ─────────────────────────────────────────────────────────
const RANG_ZNAKOVI = ['🥇', '🥈', '🥉'];

const formatBroj = (n) => Number(n).toLocaleString('hr-HR');

const formatVrijeme = (ts) =>
  new Date(ts).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });

// ─── Komponenta: Pregled rezultata s kartom ───────────────────────────────────
const KartaRezultata = ({ pravaLat, pravaLng, guessLat, guessLng, regija }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const karta = L.map(ref.current).setView([pravaLat, pravaLng], 3);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 18,
    }).addTo(karta);

    const pravaIk = L.divIcon({
      html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px #000)">📍</div>',
      iconSize: [22, 22], iconAnchor: [11, 22], className: '',
    });
    L.marker([pravaLat, pravaLng], { icon: pravaIk })
      .addTo(karta)
      .bindPopup(`<b>Prava lokacija</b><br>${regija}`)
      .openPopup();

    if (guessLat != null && guessLng != null) {
      const guessIk = L.divIcon({
        html: '<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 3px #000)">🔵</div>',
        iconSize: [20, 20], iconAnchor: [10, 10], className: '',
      });
      L.marker([guessLat, guessLng], { icon: guessIk })
        .addTo(karta)
        .bindPopup('<b>Tvoj pogodak</b>');
      L.polyline(
        [[pravaLat, pravaLng], [guessLat, guessLng]],
        { color: '#14b8a6', weight: 2, dashArray: '5,5', opacity: 0.8 }
      ).addTo(karta);

      const granice = L.latLngBounds([[pravaLat, pravaLng], [guessLat, guessLng]]);
      karta.fitBounds(granice.pad(0.3));
    }

    return () => karta.remove();
  }, [pravaLat, pravaLng, guessLat, guessLng]);

  return <div ref={ref} className="w-full h-full" />;
};

// ─── Komponenta: Street View panel ───────────────────────────────────────────
const StreetViewPanel = ({ lat, lng, pano_id, onNemaSnimke }) => {
  const ref = useRef(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const imaKljuc = apiKey && !apiKey.startsWith('OVDJE_');

  useEffect(() => {
    if (!ref.current || !imaKljuc) return;
    let otkazano = false;
    let timer;

    ucitajGoogleMaps(apiKey).then(maps => {
      if (otkazano || !ref.current) return;
      const pano = new maps.StreetViewPanorama(ref.current, {
        ...(pano_id
          ? { pano: pano_id }
          : { position: { lat, lng } }),
        addressControl: false,
        showRoadLabels: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        zoomControl: false,
      });
      timer = setTimeout(() => { if (!otkazano) onNemaSnimke?.(); }, 10000);
      pano.addListener('tiles_loaded', () => clearTimeout(timer));
    }).catch(() => { if (!otkazano) onNemaSnimke?.(); });

    return () => { otkazano = true; clearTimeout(timer); };
  }, [lat, lng, pano_id]);

  if (!imaKljuc) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-center p-6">
        <p className="text-4xl mb-3">🗺️</p>
        <p className="text-slate-400 text-sm font-medium">Google Maps API ključ nije postavljen</p>
        <p className="text-slate-600 text-xs mt-1">Dodaj VITE_GOOGLE_MAPS_KEY u .env</p>
        <p className="text-slate-500 text-xs mt-3">
          Koordinate: {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full h-full bg-slate-900"
      style={{ colorScheme: 'light' }}
    />
  );
};

// ─── Komponenta: Karta za pogađanje ──────────────────────────────────────────
const KartaPogadjanja = ({ onGuessChange }) => {
  const ref = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const karta = L.map(ref.current, { zoomControl: true }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 18,
    }).addTo(karta);

    karta.on('click', e => {
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker(e.latlng).addTo(karta);
      onGuessChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => karta.remove();
  }, []);

  return <div ref={ref} className="w-full h-full" />;
};

// ─── Rang lista ───────────────────────────────────────────────────────────────
const RangLista = ({ rang, ukupnoClanova, mojeEmail }) => (
  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
    <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <TrofejIkona /> Rang lista
      </span>
      <span className="text-xs text-slate-500">
        {rang.length}/{ukupnoClanova} odgovorilo
      </span>
    </div>
    {rang.length === 0 ? (
      <div className="px-4 py-6 text-center text-slate-600 text-sm">
        Nitko još nije odgovorio. Budi prvi! 🌍
      </div>
    ) : (
      rang.map((unos, i) => {
        const jaMoje = unos.email_korisnika === mojeEmail;
        const ime = unos.ime_korisnika
          ? `${unos.ime_korisnika} ${unos.prezime_korisnika}`
          : unos.email_korisnika;
        return (
          <div
            key={unos.email_korisnika}
            className={`flex items-center gap-3 px-4 py-2.5 ${i < rang.length - 1 ? 'border-b border-slate-700/30' : ''} ${jaMoje ? 'bg-teal-500/5' : ''}`}
          >
            <span className="w-6 text-center text-sm shrink-0">
              {i < 3 ? RANG_ZNAKOVI[i] : <span className="text-slate-500 text-xs">#{i + 1}</span>}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${jaMoje ? 'text-teal-400 font-medium' : 'text-slate-200'}`}>
                {ime}{jaMoje ? ' (ti)' : ''}
              </p>
              <p className="text-xs text-slate-500">
                {unos.udaljenost_km} km · {formatVrijeme(unos.submitted_at)}
              </p>
            </div>
            <span className={`text-sm font-bold shrink-0 ${i === 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {formatBroj(unos.bodovi)}
            </span>
          </div>
        );
      })
    )}
  </div>
);

// ─── Glavna komponenta ────────────────────────────────────────────────────────
export default function DnevniIzazov({ chat, korisnik, onZatvori }) {
  const [stanje, setStanje] = useState('ucitavanje'); // ucitavanje | pogadjanje | predano | greska
  const [podaci, setPodaci] = useState(null);         // odgovor servera
  const [greska, setGreska] = useState('');
  const [guess, setGuess] = useState(null);            // { lat, lng }
  const [predaje, setPredaje] = useState(false);
  const [rezultat, setRezultat] = useState(null);      // { bodovi, udaljenost_km, prava_lat, prava_lng }
  const [nemaSnimke, setNemaSnimke] = useState(false);
  const [prikaziKartu, setPrikaziKartu] = useState(false); // toggle Street View / Karta na mobilnom

  const nazivGrupe = chat.naziv_grupe;
  const apiBase    = 'http://localhost:3001/api';
  const headeri    = { 'X-User-Email': korisnik.email_korisnika };

  // ─── Učitaj podatke ──────────────────────────────────────────────────────
  const ucitajIzazov = useCallback(async () => {
    setStanje('ucitavanje');
    setGreska('');
    try {
      const res = await fetch(`${apiBase}/dnevni-izazov/${encodeURIComponent(nazivGrupe)}`, { headers: headeri });
      const data = await res.json();
      if (!res.ok) throw new Error(data.greska || 'Greška pri učitavanju');
      setPodaci(data);
      if (data.vec_odgovorio && data.moj_odgovor) {
        setRezultat({
          bodovi:        data.moj_odgovor.bodovi,
          udaljenost_km: data.moj_odgovor.udaljenost_km,
          prava_lat:     data.lat,
          prava_lng:     data.lng,
          guess_lat:     parseFloat(data.moj_odgovor.guess_lat),
          guess_lng:     parseFloat(data.moj_odgovor.guess_lng),
        });
        setStanje('predano');
      } else {
        setStanje('pogadjanje');
      }
    } catch (e) {
      setGreska(e.message);
      setStanje('greska');
    }
  }, [nazivGrupe]);

  useEffect(() => { ucitajIzazov(); }, [ucitajIzazov]);

  // ─── Predaj odgovor ──────────────────────────────────────────────────────
  const predajOdgovor = async () => {
    if (!guess || predaje) return;
    setPredaje(true);
    try {
      const res = await fetch(
        `${apiBase}/dnevni-izazov/${encodeURIComponent(nazivGrupe)}/odgovor`,
        {
          method: 'POST',
          headers: { ...headeri, 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: guess.lat, lng: guess.lng }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.greska || 'Greška pri predaji');

      setRezultat({
        ...data,
        guess_lat: guess.lat,
        guess_lng: guess.lng,
      });
      setStanje('predano');
      // Osvježi rang listu
      const res2 = await fetch(`${apiBase}/dnevni-izazov/${encodeURIComponent(nazivGrupe)}`, { headers: headeri });
      const data2 = await res2.json();
      if (res2.ok) setPodaci(data2);
    } catch (e) {
      setGreska(e.message);
    } finally {
      setPredaje(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Zaglavlje */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/60 shrink-0 bg-slate-900/50">
        <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
          <ZemljaSIkona />
        </div>
        <div className="flex-1">
          <h2 className="text-white font-semibold text-sm">Dnevni izazov</h2>
          <p className="text-xs text-slate-500">{nazivGrupe} · Osvježava se svaki dan</p>
        </div>
        <button
          onClick={onZatvori}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
        >
          <XIkona />
        </button>
      </div>

      {/* Sadržaj */}
      {stanje === 'ucitavanje' && (
        <div className="flex-1 flex items-center justify-center gap-2 text-slate-500">
          <SpinnerIkona />
          <span className="text-sm">Učitavam izazov...</span>
        </div>
      )}

      {stanje === 'greska' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-4xl">⚠️</p>
          <p className="text-slate-400 text-sm">{greska}</p>
          <button
            onClick={ucitajIzazov}
            className="px-4 py-2 text-sm text-teal-400 border border-teal-500/30 hover:border-teal-500/60 rounded-xl transition-all"
          >
            Pokušaj ponovo
          </button>
        </div>
      )}

      {stanje === 'pogadjanje' && podaci && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Info traka */}
          <div className="flex items-center gap-4 px-5 py-2.5 bg-slate-900/30 border-b border-slate-800/40 shrink-0 text-xs text-slate-500">
            <span>🗓️ Izazov #{podaci.naziv_izazova?.split('_')[2] ?? '—'}</span>
            <span>·</span>
            <span>👥 {podaci.rang?.length ?? 0}/{podaci.ukupno_clanova} odgovorilo</span>
            {nemaSnimke && <><span>·</span><span className="text-amber-500">📷 Snimka nedostupna</span></>}
          </div>

          {/* Glavni panel: Street View + Karta */}
          <div className="flex-1 flex overflow-hidden">
            {/* Street View */}
            <div
              className="w-[58%] shrink-0 relative border-r border-slate-800/60"
              style={{ colorScheme: 'light', isolation: 'isolate' }}
            >
              <StreetViewPanel
                lat={podaci.lat}
                lng={podaci.lng}
                pano_id={podaci.pano_id}
                onNemaSnimke={() => setNemaSnimke(true)}
              />
            </div>

            {/* Desna kolona: karta + rang lista */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Karta za pogađanje */}
              <div className="h-[55%] border-b border-slate-800/60 relative">
                <KartaPogadjanja onGuessChange={setGuess} />
                {!guess && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-slate-400 text-xs px-3 py-1.5 rounded-full pointer-events-none border border-slate-700/60 whitespace-nowrap">
                    <KartaIkona className="inline" /> Klikni na kartu za oznaku
                  </div>
                )}
              </div>

              {/* Rang lista + gumb */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <RangLista
                  rang={podaci.rang ?? []}
                  ukupnoClanova={podaci.ukupno_clanova}
                  mojeEmail={korisnik.email_korisnika}
                />
                <button
                  onClick={predajOdgovor}
                  disabled={!guess || predaje}
                  className="w-full py-3 text-sm font-semibold bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {predaje
                    ? <><SpinnerIkona /> Predajem...</>
                    : guess
                      ? '✓ Pošalji odgovor'
                      : 'Označi lokaciju na karti'}
                </button>
                {greska && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    {greska}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {stanje === 'predano' && podaci && rezultat && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Rezultat banner */}
          <div className="px-5 py-4 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border-b border-teal-500/20 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-lg">
                  {Number(rezultat.bodovi) >= 4000 ? '🏆' : Number(rezultat.bodovi) >= 2000 ? '🌟' : '📍'}{' '}
                  {formatBroj(rezultat.bodovi)} bodova
                </p>
                <p className="text-slate-400 text-xs mt-0.5">
                  Udaljenost: <span className="text-teal-400 font-medium">{rezultat.udaljenost_km} km</span>
                  {' · '}Regija: <span className="text-slate-300">{podaci.regija}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Tvoj rang</p>
                <p className="text-white font-bold text-xl">
                  #{(podaci.rang ?? []).findIndex(r => r.email_korisnika === korisnik.email_korisnika) + 1 || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Karta rezultata + rang lista */}
          <div className="flex-1 flex overflow-hidden">
            {/* Karta */}
            <div className="w-[55%] shrink-0 border-r border-slate-800/60">
              <KartaRezultata
                pravaLat={rezultat.prava_lat ?? podaci.lat}
                pravaLng={rezultat.prava_lng ?? podaci.lng}
                guessLat={rezultat.guess_lat}
                guessLng={rezultat.guess_lng}
                regija={podaci.regija}
              />
            </div>

            {/* Rang lista */}
            <div className="flex-1 overflow-y-auto p-3">
              <RangLista
                rang={podaci.rang ?? []}
                ukupnoClanova={podaci.ukupno_clanova}
                mojeEmail={korisnik.email_korisnika}
              />
              <p className="text-center text-xs text-slate-600 mt-3 pb-2">
                Sljedeći izazov za grupu "{nazivGrupe}" dostupan sutra 🌅
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
