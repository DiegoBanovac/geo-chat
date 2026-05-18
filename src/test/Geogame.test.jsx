import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mockovi ──────────────────────────────────────────────────────────────────

// Mock socket.io
vi.mock('../../lib/socket', () => ({
  default: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connected: true, connect: vi.fn() }
}));

// Mock Leaflet — jsdom nema canvas/DOM za karte
vi.mock('leaflet', () => {
  const map = {
    setView: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    fitBounds: vi.fn(),
  };
  const tileLayer = { addTo: vi.fn().mockReturnThis() };
  const marker = { addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis(), openPopup: vi.fn().mockReturnThis(), remove: vi.fn() };
  const polyline = { addTo: vi.fn().mockReturnThis() };
  const divIcon = {};
  const latLngBounds = { pad: vi.fn().mockReturnThis() };
  return {
    default: {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => tileLayer),
      marker: vi.fn(() => marker),
      polyline: vi.fn(() => polyline),
      divIcon: vi.fn(() => divIcon),
      latLngBounds: vi.fn(() => latLngBounds),
    }
  };
});

// Mock Google Maps loader
vi.mock('../../lib/googleMaps', () => ({
  loadGoogleMaps: vi.fn(() => Promise.resolve({
    StreetViewPanorama: vi.fn(() => ({ addListener: vi.fn() }))
  }))
}));

// ─── Ikone (stubs) ────────────────────────────────────────────────────────────
const SpinnerIcon = () => <span data-testid="spinner">...</span>;
const XIcon = () => <span>X</span>;

// ─── GameLobby ────────────────────────────────────────────────────────────────
const GameLobby = ({ onCancel }) => (
  <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
    <div className="text-7xl">🌍</div>
    <div>
      <h2 className="text-white text-xl font-bold mb-2">Čekanje na protivnika</h2>
      <p className="text-slate-400 text-sm">Pozivnica je poslana. Čekam prihvaćanje...</p>
    </div>
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <SpinnerIcon />
      <span className="ml-1">Čekam odgovor...</span>
    </div>
    <button onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200 rounded-xl transition-all">
      Odustani
    </button>
  </div>
);

// ─── FinalResults ─────────────────────────────────────────────────────────────
const FinalResults = ({ final, korisnik, onClose, onPlayAgain }) => {
  const myEmail = korisnik.email_korisnika;
  const iAmWinner = final.pobjednik === myEmail;
  const igraci = [final.igrac1, final.igrac2].filter(Boolean);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
      <div className="text-7xl">{iAmWinner ? "🏆" : "🌍"}</div>
      <div>
        <h2 className="text-white text-2xl font-bold mb-1">
          {iAmWinner ? "Pobijedio/la si!" : "Kraj igre"}
        </h2>
        <p className="text-slate-400 text-sm">
          {iAmWinner
            ? "Čestitamo! Imao/la si bolji njuh za lokacije."
            : `Pobijedio/la: ${final.pobjednik?.split("@")[0] ?? "?"}`}
        </p>
      </div>
      <div className="w-full max-w-xs bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide px-5 py-3 border-b border-slate-800">
          Konačni bodovi
        </p>
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
        <button onClick={onClose} className="px-6 py-2.5 text-sm font-medium text-slate-400 border border-slate-700 hover:border-slate-500 rounded-xl transition-all">
          Zatvori
        </button>
        <button onClick={onPlayAgain} className="px-6 py-2.5 text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white rounded-xl transition-colors">
          Igraj ponovo
        </button>
      </div>
    </div>
  );
};

// ─── Testovi: GameLobby ───────────────────────────────────────────────────────

describe('GameLobby', () => {
  it('prikazuje naslov čekanja', () => {
    render(<GameLobby onCancel={() => {}} />);
    expect(screen.getByText('Čekanje na protivnika')).toBeInTheDocument();
  });

  it('prikazuje poruku o poslanoj pozivnici', () => {
    render(<GameLobby onCancel={() => {}} />);
    expect(screen.getByText('Pozivnica je poslana. Čekam prihvaćanje...')).toBeInTheDocument();
  });

  it('prikazuje gumb Odustani', () => {
    render(<GameLobby onCancel={() => {}} />);
    expect(screen.getByText('Odustani')).toBeInTheDocument();
  });

  it('poziva onCancel klikom na Odustani', () => {
    const onCancel = vi.fn();
    render(<GameLobby onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Odustani'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('prikazuje spinner dok čeka', () => {
    render(<GameLobby onCancel={() => {}} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('prikazuje globus emoji', () => {
    render(<GameLobby onCancel={() => {}} />);
    expect(screen.getByText('🌍')).toBeInTheDocument();
  });
});

// ─── Testovi: FinalResults ────────────────────────────────────────────────────

describe('FinalResults', () => {
  const mockKorisnik = { email_korisnika: 'ivan@test.com' };

  const mockFinalPobjeda = {
    pobjednik: 'ivan@test.com',
    igrac1: { email: 'ivan@test.com', bodovi: 4500 },
    igrac2: { email: 'marko@test.com', bodovi: 2100 },
  };

  const mockFinalPoraz = {
    pobjednik: 'marko@test.com',
    igrac1: { email: 'ivan@test.com', bodovi: 2100 },
    igrac2: { email: 'marko@test.com', bodovi: 4500 },
  };

  it('prikazuje trofej kada korisnik pobijedi', () => {
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('🏆')).toBeInTheDocument();
  });

  it('prikazuje globus kada korisnik izgubi', () => {
    render(<FinalResults final={mockFinalPoraz} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('🌍')).toBeInTheDocument();
  });

  it('prikazuje "Pobijedio/la si!" kada korisnik pobijedi', () => {
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('Pobijedio/la si!')).toBeInTheDocument();
  });

  it('prikazuje "Kraj igre" kada korisnik izgubi', () => {
    render(<FinalResults final={mockFinalPoraz} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('Kraj igre')).toBeInTheDocument();
  });

  it('prikazuje ime pobjednika kada korisnik izgubi', () => {
    render(<FinalResults final={mockFinalPoraz} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('Pobijedio/la: marko')).toBeInTheDocument();
  });

  it('prikazuje bodove oba igrača', () => {
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('4500')).toBeInTheDocument();
    expect(screen.getByText('2100')).toBeInTheDocument();
  });

  it('označava trenutnog korisnika s "(ti)"', () => {
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText(/\(ti\)/)).toBeInTheDocument();
  });

  it('prikazuje krunu pored pobjednika', () => {
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('👑')).toBeInTheDocument();
  });

  it('poziva onClose klikom na Zatvori', () => {
    const onClose = vi.fn();
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={onClose} onPlayAgain={() => {}} />);
    fireEvent.click(screen.getByText('Zatvori'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('poziva onPlayAgain klikom na Igraj ponovo', () => {
    const onPlayAgain = vi.fn();
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={onPlayAgain} />);
    fireEvent.click(screen.getByText('Igraj ponovo'));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('prikazuje natpis Konačni bodovi', () => {
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('Konačni bodovi')).toBeInTheDocument();
  });

  it('prikazuje samo postojeće igrače (filtrira null)', () => {
    const finalSJednimIgracem = {
      pobjednik: 'ivan@test.com',
      igrac1: { email: 'ivan@test.com', bodovi: 3000 },
      igrac2: null,
    };
    render(<FinalResults final={finalSJednimIgracem} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText('3000')).toBeInTheDocument();
  });

  it('prikazuje username bez domene (@)', () => {
    render(<FinalResults final={mockFinalPobjeda} korisnik={mockKorisnik} onClose={() => {}} onPlayAgain={() => {}} />);
    expect(screen.getByText(/ivan/)).toBeInTheDocument();
    expect(screen.queryByText('ivan@test.com')).not.toBeInTheDocument();
  });
});