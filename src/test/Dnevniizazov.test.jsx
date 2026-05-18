import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mockovi ──────────────────────────────────────────────────────────────────

vi.mock('leaflet', () => {
  const map = {
    setView: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    fitBounds: vi.fn(),
  };
  const tileLayer = { addTo: vi.fn().mockReturnThis() };
  const marker = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    openPopup: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  };
  const polyline = { addTo: vi.fn().mockReturnThis() };
  const latLngBounds = { pad: vi.fn().mockReturnThis() };
  return {
    default: {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => tileLayer),
      marker: vi.fn(() => marker),
      polyline: vi.fn(() => polyline),
      divIcon: vi.fn(() => ({})),
      latLngBounds: vi.fn(() => latLngBounds),
    }
  };
});

// Mock fetch globalno
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Helper funkcije (kopirane iz DnevniIzazov.jsx) ──────────────────────────

const formatBroj = (n) => Number(n).toLocaleString('hr-HR');

const formatVrijeme = (ts) =>
  new Date(ts).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' });

const RANG_ZNAKOVI = ['🥇', '🥈', '🥉'];

// ─── Komponente (kopirane iz DnevniIzazov.jsx) ────────────────────────────────

const { useState, useEffect, useRef, useCallback } = await import('react');

const SpinnerIkona = () => <span data-testid="spinner">...</span>;
const XIkona = () => <span data-testid="x-ikona">✕</span>;
const TrofejIkona = () => <span data-testid="trofej-ikona">🏆</span>;
const ZemljaSIkona = () => <span data-testid="zemlja-ikona">🌍</span>;

const RangLista = ({ rang, ukupnoClanova, mojeEmail }) => (
  <div>
    <div>
      <span>Rang lista</span>
      <span>{rang.length}/{ukupnoClanova} odgovorilo</span>
    </div>
    {rang.length === 0 ? (
      <div>Nitko još nije odgovorio. Budi prvi! 🌍</div>
    ) : (
      rang.map((unos, i) => {
        const jaMoje = unos.email_korisnika === mojeEmail;
        const ime = unos.ime_korisnika
          ? `${unos.ime_korisnika} ${unos.prezime_korisnika}`
          : unos.email_korisnika;
        return (
          <div key={unos.email_korisnika} data-testid={`rang-unos-${i}`}>
            <span>{i < 3 ? RANG_ZNAKOVI[i] : `#${i + 1}`}</span>
            <span>{ime}{jaMoje ? ' (ti)' : ''}</span>
            <span>{unos.udaljenost_km} km</span>
            <span>{formatBroj(unos.bodovi)}</span>
          </div>
        );
      })
    )}
  </div>
);

// Stub za Street View i karte — ne renderaju u jsdom
const StreetViewPanel = ({ onNemaSnimke }) => (
  <div data-testid="street-view">Street View Stub</div>
);
const KartaPogadjanja = ({ onGuessChange }) => (
  <div data-testid="karta-pogadjanja" onClick={() => onGuessChange({ lat: 45.8, lng: 16.0 })}>
    Karta Stub
  </div>
);
const KartaRezultata = ({ pravaLat, pravaLng }) => (
  <div data-testid="karta-rezultata">Karta rezultata: {pravaLat}, {pravaLng}</div>
);

// DnevniIzazov (simplificirana verzija za testiranje logike)
function DnevniIzazov({ chat, korisnik, onZatvori }) {
  const [stanje, setStanje] = useState('ucitavanje');
  const [podaci, setPodaci] = useState(null);
  const [greska, setGreska] = useState('');
  const [guess, setGuess] = useState(null);
  const [predaje, setPredaje] = useState(false);
  const [rezultat, setRezultat] = useState(null);
  const [nemaSnimke, setNemaSnimke] = useState(false);

  const nazivGrupe = chat.naziv_grupe;
  const apiBase = 'http://localhost:3001/api';
  const headeri = { 'X-User-Email': korisnik.email_korisnika };

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
          bodovi: data.moj_odgovor.bodovi,
          udaljenost_km: data.moj_odgovor.udaljenost_km,
          prava_lat: data.lat,
          prava_lng: data.lng,
          guess_lat: parseFloat(data.moj_odgovor.guess_lat),
          guess_lng: parseFloat(data.moj_odgovor.guess_lng),
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
      setRezultat({ ...data, guess_lat: guess.lat, guess_lng: guess.lng });
      setStanje('predano');
      const res2 = await fetch(`${apiBase}/dnevni-izazov/${encodeURIComponent(nazivGrupe)}`, { headers: headeri });
      const data2 = await res2.json();
      if (res2.ok) setPodaci(data2);
    } catch (e) {
      setGreska(e.message);
    } finally {
      setPredaje(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Zaglavlje */}
      <div data-testid="zaglavlje">
        <ZemljaSIkona />
        <h2>Dnevni izazov</h2>
        <p>{nazivGrupe} · Osvježava se svaki dan</p>
        <button onClick={onZatvori} data-testid="zatvori-btn">Zatvori</button>
      </div>

      {stanje === 'ucitavanje' && (
        <div data-testid="ucitavanje">
          <SpinnerIkona />
          <span>Učitavam izazov...</span>
        </div>
      )}

      {stanje === 'greska' && (
        <div data-testid="greska-panel">
          <p>⚠️</p>
          <p data-testid="greska-tekst">{greska}</p>
          <button onClick={ucitajIzazov} data-testid="pokusaj-ponovo">Pokušaj ponovo</button>
        </div>
      )}

      {stanje === 'pogadjanje' && podaci && (
        <div data-testid="pogadjanje-panel">
          <div data-testid="info-traka">
            <span>👥 {podaci.rang?.length ?? 0}/{podaci.ukupno_clanova} odgovorilo</span>
            {nemaSnimke && <span data-testid="nema-snimke">📷 Snimka nedostupna</span>}
          </div>
          <StreetViewPanel
            lat={podaci.lat}
            lng={podaci.lng}
            pano_id={podaci.pano_id}
            onNemaSnimke={() => setNemaSnimke(true)}
          />
          <KartaPogadjanja onGuessChange={setGuess} />
          <RangLista
            rang={podaci.rang ?? []}
            ukupnoClanova={podaci.ukupno_clanova}
            mojeEmail={korisnik.email_korisnika}
          />
          <button
            onClick={predajOdgovor}
            disabled={!guess || predaje}
            data-testid="predaj-btn"
          >
            {predaje ? 'Predajem...' : guess ? '✓ Pošalji odgovor' : 'Označi lokaciju na karti'}
          </button>
          {greska && <p data-testid="predaj-greska">{greska}</p>}
        </div>
      )}

      {stanje === 'predano' && podaci && rezultat && (
        <div data-testid="predano-panel">
          <p data-testid="bodovi">{formatBroj(rezultat.bodovi)} bodova</p>
          <p data-testid="udaljenost">Udaljenost: {rezultat.udaljenost_km} km</p>
          <KartaRezultata
            pravaLat={rezultat.prava_lat ?? podaci.lat}
            pravaLng={rezultat.prava_lng ?? podaci.lng}
            guessLat={rezultat.guess_lat}
            guessLng={rezultat.guess_lng}
            regija={podaci.regija}
          />
          <RangLista
            rang={podaci.rang ?? []}
            ukupnoClanova={podaci.ukupno_clanova}
            mojeEmail={korisnik.email_korisnika}
          />
          <p>Sljedeći izazov za grupu "{nazivGrupe}" dostupan sutra 🌅</p>
        </div>
      )}
    </div>
  );
}

// ─── Mock podaci ──────────────────────────────────────────────────────────────

const mockChat = { naziv_grupe: 'GeoMasters' };
const mockKorisnik = { email_korisnika: 'ivan@test.com', ime_korisnika: 'Ivan', prezime_korisnika: 'Horvat' };

const mockPodaciIzazov = {
  naziv_izazova: 'izazov_GeoMasters_42',
  lat: 45.8,
  lng: 16.0,
  pano_id: null,
  regija: 'Zagreb, Hrvatska',
  rang: [],
  ukupno_clanova: 5,
  vec_odgovorio: false,
  moj_odgovor: null,
};

const mockPodaciVecOdgovorio = {
  ...mockPodaciIzazov,
  vec_odgovorio: true,
  moj_odgovor: {
    bodovi: 3500,
    udaljenost_km: 42.5,
    guess_lat: '45.1',
    guess_lng: '15.9',
  },
  rang: [
    {
      email_korisnika: 'ivan@test.com',
      ime_korisnika: 'Ivan',
      prezime_korisnika: 'Horvat',
      bodovi: 3500,
      udaljenost_km: 42.5,
      submitted_at: new Date().toISOString(),
    },
  ],
};

// ─── Testovi: formatBroj ──────────────────────────────────────────────────────

describe('formatBroj', () => {
  it('formatira broj s tisućicama', () => {
    expect(formatBroj(5000)).toBe('5.000');
  });

  it('formatira mali broj bez separatora', () => {
    expect(formatBroj(500)).toBe('500');
  });

  it('radi s nulom', () => {
    expect(formatBroj(0)).toBe('0');
  });

  it('radi sa stringom broja', () => {
    expect(formatBroj('3500')).toBe('3.500');
  });
});

// ─── Testovi: RangLista ───────────────────────────────────────────────────────

describe('RangLista', () => {
  it('prikazuje poruku kada je rang prazan', () => {
    render(<RangLista rang={[]} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText(/Nitko još nije odgovorio/)).toBeInTheDocument();
  });

  it('prikazuje broj odgovorenih od ukupnih', () => {
    render(<RangLista rang={[]} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText('0/5 odgovorilo')).toBeInTheDocument();
  });

  it('prikazuje igrača u rang listi', () => {
    const rang = [{
      email_korisnika: 'marko@test.com',
      ime_korisnika: 'Marko',
      prezime_korisnika: 'Marić',
      bodovi: 4500,
      udaljenost_km: 12.3,
      submitted_at: new Date().toISOString(),
    }];
    render(<RangLista rang={rang} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText('Marko Marić')).toBeInTheDocument();
  });

  it('označava trenutnog korisnika s "(ti)"', () => {
    const rang = [{
      email_korisnika: 'ivan@test.com',
      ime_korisnika: 'Ivan',
      prezime_korisnika: 'Horvat',
      bodovi: 3500,
      udaljenost_km: 42.5,
      submitted_at: new Date().toISOString(),
    }];
    render(<RangLista rang={rang} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText('Ivan Horvat (ti)')).toBeInTheDocument();
  });

  it('prikazuje zlatnu medalju za prvog', () => {
    const rang = [{
      email_korisnika: 'marko@test.com',
      ime_korisnika: 'Marko',
      prezime_korisnika: 'Marić',
      bodovi: 5000,
      udaljenost_km: 5.0,
      submitted_at: new Date().toISOString(),
    }];
    render(<RangLista rang={rang} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
  });

  it('prikazuje bodove igrača formatirane', () => {
    const rang = [{
      email_korisnika: 'marko@test.com',
      ime_korisnika: 'Marko',
      prezime_korisnika: 'Marić',
      bodovi: 4500,
      udaljenost_km: 12.3,
      submitted_at: new Date().toISOString(),
    }];
    render(<RangLista rang={rang} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText('4.500')).toBeInTheDocument();
  });

  it('prikazuje udaljenost igrača', () => {
    const rang = [{
      email_korisnika: 'marko@test.com',
      ime_korisnika: 'Marko',
      prezime_korisnika: 'Marić',
      bodovi: 4500,
      udaljenost_km: 12.3,
      submitted_at: new Date().toISOString(),
    }];
    render(<RangLista rang={rang} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText('12.3 km')).toBeInTheDocument();
  });

  it('prikazuje # za igrača izvan top 3', () => {
    const rang = Array.from({ length: 4 }, (_, i) => ({
      email_korisnika: `igrac${i}@test.com`,
      ime_korisnika: `Igrac${i}`,
      prezime_korisnika: 'Test',
      bodovi: 5000 - i * 500,
      udaljenost_km: i * 10,
      submitted_at: new Date().toISOString(),
    }));
    render(<RangLista rang={rang} ukupnoClanova={5} mojeEmail="ivan@test.com" />);
    expect(screen.getByText('#4')).toBeInTheDocument();
  });
});

// ─── Testovi: DnevniIzazov ────────────────────────────────────────────────────

describe('DnevniIzazov', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('prikazuje spinner pri učitavanju', () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciIzazov });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    expect(screen.getByTestId('ucitavanje')).toBeInTheDocument();
  });

  it('prikazuje naziv grupe u zaglavlju', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciIzazov });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    expect(screen.getByText(/GeoMasters/)).toBeInTheDocument();
  });

  it('poziva onZatvori klikom na Zatvori', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciIzazov });
    const onZatvori = vi.fn();
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={onZatvori} />);
    fireEvent.click(screen.getByTestId('zatvori-btn'));
    expect(onZatvori).toHaveBeenCalledTimes(1);
  });

  it('prikazuje panel za pogađanje nakon učitavanja', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciIzazov });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('pogadjanje-panel')).toBeInTheDocument();
    });
  });

  it('prikazuje panel "predano" ako je korisnik već odgovorio', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciVecOdgovorio });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('predano-panel')).toBeInTheDocument();
    });
  });

  it('prikazuje bodove u panelu predano', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciVecOdgovorio });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('bodovi')).toHaveTextContent('3.500 bodova');
    });
  });

  it('prikazuje udaljenost u panelu predano', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciVecOdgovorio });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('udaljenost')).toHaveTextContent('42.5 km');
    });
  });

  it('gumb za predaju je onemogućen bez odabira lokacije', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciIzazov });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('predaj-btn')).toBeDisabled();
    });
  });

  it('gumb za predaju se aktivira nakon odabira lokacije', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciIzazov });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('karta-pogadjanja')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('karta-pogadjanja'));
    await waitFor(() => {
      expect(screen.getByTestId('predaj-btn')).not.toBeDisabled();
    });
  });

  it('prikazuje grešku kada server vrati grešku', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ greska: 'Izazov nije pronađen' }) });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('greska-tekst')).toHaveTextContent('Izazov nije pronađen');
    });
  });

  it('prikazuje gumb "Pokušaj ponovo" u slučaju greške', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ greska: 'Greška' }) });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('pokusaj-ponovo')).toBeInTheDocument();
    });
  });

  it('"Pokušaj ponovo" poziva fetch ponovo', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, json: async () => ({ greska: 'Greška' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => mockPodaciIzazov });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => screen.getByTestId('pokusaj-ponovo'));
    fireEvent.click(screen.getByTestId('pokusaj-ponovo'));
    await waitFor(() => {
      expect(screen.getByTestId('pogadjanje-panel')).toBeInTheDocument();
    });
  });

  it('prikazuje broj odgovorenih clanova', async () => {
    const podaciSRangom = {
      ...mockPodaciIzazov,
      rang: [
        { email_korisnika: 'a@test.com', ime_korisnika: 'A', prezime_korisnika: 'B', bodovi: 100, udaljenost_km: 50, submitted_at: new Date().toISOString() },
      ],
      ukupno_clanova: 5,
    };
    mockFetch.mockResolvedValue({ ok: true, json: async () => podaciSRangom });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('👥 1/5 odgovorilo')).toBeInTheDocument();
    });
  });

  it('prikazuje poruku o sljedećem izazovu u panelu predano', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => mockPodaciVecOdgovorio });
    render(<DnevniIzazov chat={mockChat} korisnik={mockKorisnik} onZatvori={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/dostupan sutra/)).toBeInTheDocument();
    });
  });
});