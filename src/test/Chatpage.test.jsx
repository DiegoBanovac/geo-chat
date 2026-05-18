import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mockovi ──────────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  dohvatiChatove: vi.fn(),
  kreirajIndividualniChat: vi.fn(),
  kreirajGrupu: vi.fn(),
  pretraziKorisnike: vi.fn(),
  dohvatiPoruke: vi.fn(),
  dohvatiPrice: vi.fn(),
  uploadPricu: vi.fn(),
  oznaciBrojPriče: vi.fn(),
  startGeoGame: vi.fn(),
}));

vi.mock('../lib/socket', () => ({
  default: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connected: true, connect: vi.fn() }
}));

// ─── Helper funkcije (kopirane iz ChatPage.jsx) ───────────────────────────────

const AVATAR_COLORS = [
  "bg-teal-600", "bg-cyan-600", "bg-blue-600",
  "bg-violet-600", "bg-emerald-600", "bg-sky-600",
];

const getInitials = (name = "") => {
  const p = name.trim().split(" ");
  return p.length >= 2
    ? (p[0][0] + p[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

// ─── Komponente (kopirane iz ChatPage.jsx) ────────────────────────────────────

const { useState, useRef } = await import('react');

const Avatar = ({ name = "", size = "md", avatarUrl = null }) => {
  const sz = size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  return (
    <div className={`${sz} ${getAvatarColor(name)} rounded-full flex items-center justify-center font-semibold text-white shrink-0 overflow-hidden`}>
      {avatarUrl
        ? <img src={`http://localhost:3001${avatarUrl}`} alt={name} className="w-full h-full object-cover" />
        : getInitials(name)
      }
    </div>
  );
};

const XIcon = () => <span data-testid="x-icon">✕</span>;
const SpinnerIcon = () => <span data-testid="spinner">...</span>;

const ChatItem = ({ chat, isActive, onClick }) => (
  <button
    onClick={() => onClick(chat)}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left group ${
      isActive ? "bg-teal-500/10 border border-teal-500/20" : "hover:bg-slate-800/60 border border-transparent"
    }`}
  >
    <Avatar name={chat.name} avatarUrl={chat.slika_profila} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className={`font-medium text-sm truncate ${isActive ? "text-teal-400" : "text-slate-200"}`}>
          {chat.name}
        </span>
        <span className="text-[10px] text-slate-600 shrink-0 ml-2">
          {chat.type === "group" ? `${chat.memberCount} čl.` : ""}
        </span>
      </div>
      <p className="text-xs text-slate-500 truncate">
        {chat.type === "group" ? "Grupni razgovor" : "Privatni razgovor"}
      </p>
    </div>
  </button>
);

const Tabs = ({ active, onChange, counts }) => (
  <div className="flex gap-1 px-4 pt-3 pb-2">
    {["Svi", "Privatni", "Grupe"].map((tab) => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
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

const EmptyState = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <h3 className="text-slate-400 font-medium text-sm mb-1">Odaberi razgovor</h3>
      <p className="text-slate-600 text-xs">Klikni na chat s lijeve strane da ga otvoriš</p>
    </div>
  </div>
);

const ProfileEditModal = ({ korisnik, onClose, onSave }) => {
  const [ime, setIme] = useState(korisnik.ime_korisnika);
  const [prezime, setPrezime] = useState(korisnik.prezime_korisnika);
  const [novaLozinka, setNovaLozinka] = useState("");
  const [potvrda, setPotvrda] = useState("");
  const [greska, setGreska] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!ime.trim() || !prezime.trim()) { setGreska("Ime i prezime su obavezni."); return; }
    if (novaLozinka && novaLozinka !== potvrda) { setGreska("Lozinke se ne podudaraju."); return; }
    setSaving(true);
    setGreska(null);
    try {
      const body = { ime_korisnika: ime.trim(), prezime_korisnika: prezime.trim() };
      if (novaLozinka) body.lozinka_korisnika = novaLozinka;
      const res = await fetch(
        `http://localhost:3001/api/korisnici/${encodeURIComponent(korisnik.email_korisnika)}`,
        { method: "PUT", headers: { "Content-Type": "application/json", "X-User-Email": korisnik.email_korisnika }, body: JSON.stringify(body) }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Greška"); }
      const updated = await res.json();
      onSave(updated);
    } catch (e) {
      setGreska(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <h2 className="text-white font-semibold text-sm">Uredi profil</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ime</label>
              <input type="text" value={ime} onChange={(e) => setIme(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Prezime</label>
              <input type="text" value={prezime} onChange={(e) => setPrezime(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Nova lozinka <span className="text-slate-600">(opcionalno)</span></label>
            <input type="password" value={novaLozinka} onChange={(e) => setNovaLozinka(e.target.value)}
              placeholder="Ostavi prazno za zadržavanje"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white" />
          </div>
          {novaLozinka && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Potvrdi lozinku</label>
              <input type="password" value={potvrda} onChange={(e) => setPotvrda(e.target.value)}
                placeholder="Ponovi novu lozinku"
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white" />
            </div>
          )}
          {greska && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{greska}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800/60">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm text-slate-400 border border-slate-700/60">Odustani</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold bg-teal-600 text-white">
            {saving ? "Spremam..." : "Spremi"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileFooter = ({ korisnik, onOdjava, onKorisnikUpdate }) => {
  const [showEdit, setShowEdit] = useState(false);
  const name = `${korisnik.ime_korisnika} ${korisnik.prezime_korisnika}`;
  return (
    <>
      <div className="px-4 py-3 border-t border-slate-800/60 flex items-center gap-3">
        <button onClick={() => setShowEdit(true)}
          className={`w-8 h-8 rounded-full ${getAvatarColor(name)} flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden`}>
          {korisnik.slika_profila
            ? <img src={`http://localhost:3001${korisnik.slika_profila}`} alt={name} className="w-full h-full object-cover" />
            : getInitials(name)
          }
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{name}</p>
          <p className="text-xs text-slate-600 truncate">{korisnik.email_korisnika}</p>
        </div>
        <button onClick={onOdjava} className="text-xs text-slate-500 hover:text-teal-400 transition-colors shrink-0 px-2 py-1 rounded-lg">
          Odjava
        </button>
      </div>
      {showEdit && (
        <ProfileEditModal korisnik={korisnik} onClose={() => setShowEdit(false)}
          onSave={(updated) => { onKorisnikUpdate(updated); setShowEdit(false); }} />
      )}
    </>
  );
};

// ─── Testovi: getInitials ─────────────────────────────────────────────────────

describe('getInitials', () => {
  it('vraća inicijale za ime i prezime', () => {
    expect(getInitials('Ivan Horvat')).toBe('IH');
  });

  it('vraća prva dva slova za jedno ime', () => {
    expect(getInitials('Marko')).toBe('MA');
  });

  it('radi s praznim stringom', () => {
    expect(getInitials('')).toBe('');
  });

  it('vraća velika slova', () => {
    expect(getInitials('ana baric')).toBe('AB');
  });

  it('radi s više od dva dijela imena', () => {
    expect(getInitials('Ivan Ante Horvat')).toBe('IA');
  });
});

// ─── Testovi: Avatar ──────────────────────────────────────────────────────────

describe('Avatar', () => {
  it('prikazuje inicijale kada nema avatarUrl', () => {
    render(<Avatar name="Ivan Horvat" />);
    expect(screen.getByText('IH')).toBeInTheDocument();
  });

  it('prikazuje sliku kada je avatarUrl postavljen', () => {
    render(<Avatar name="Ivan Horvat" avatarUrl="/uploads/avatar.jpg" />);
    const img = screen.getByAltText('Ivan Horvat');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'http://localhost:3001/uploads/avatar.jpg');
  });

  it('koristi manju veličinu za size="sm"', () => {
    const { container } = render(<Avatar name="Ivan Horvat" size="sm" />);
    expect(container.firstChild).toHaveClass('w-9');
  });

  it('koristi veću veličinu za size="md"', () => {
    const { container } = render(<Avatar name="Ivan Horvat" size="md" />);
    expect(container.firstChild).toHaveClass('w-11');
  });

  it('ne prikazuje img tag kada nema avatarUrl', () => {
    render(<Avatar name="Ivan Horvat" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

// ─── Testovi: ChatItem ────────────────────────────────────────────────────────

describe('ChatItem', () => {
  const mockIndividualniChat = {
    id: 'ir_a_b',
    name: 'Marko Marić',
    type: 'individual',
    slika_profila: null,
  };

  const mockGrupniChat = {
    id: 'gr_geo',
    name: 'GeoMasters',
    type: 'group',
    memberCount: 5,
    slika_profila: null,
  };

  it('prikazuje ime chata', () => {
    render(<ChatItem chat={mockIndividualniChat} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('Marko Marić')).toBeInTheDocument();
  });

  it('prikazuje "Privatni razgovor" za individualni chat', () => {
    render(<ChatItem chat={mockIndividualniChat} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('Privatni razgovor')).toBeInTheDocument();
  });

  it('prikazuje "Grupni razgovor" za grupni chat', () => {
    render(<ChatItem chat={mockGrupniChat} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('Grupni razgovor')).toBeInTheDocument();
  });

  it('prikazuje broj članova za grupni chat', () => {
    render(<ChatItem chat={mockGrupniChat} isActive={false} onClick={() => {}} />);
    expect(screen.getByText('5 čl.')).toBeInTheDocument();
  });

  it('ne prikazuje broj članova za individualni chat', () => {
    render(<ChatItem chat={mockIndividualniChat} isActive={false} onClick={() => {}} />);
    expect(screen.queryByText(/čl\./)).not.toBeInTheDocument();
  });

  it('poziva onClick s chatom kao argumentom', () => {
    const onClick = vi.fn();
    render(<ChatItem chat={mockIndividualniChat} isActive={false} onClick={onClick} />);
    fireEvent.click(screen.getByText('Marko Marić'));
    expect(onClick).toHaveBeenCalledWith(mockIndividualniChat);
  });

  it('primjenjuje aktivne klase kada je isActive=true', () => {
    const { container } = render(<ChatItem chat={mockIndividualniChat} isActive={true} onClick={() => {}} />);
    expect(container.firstChild).toHaveClass('bg-teal-500/10');
  });

  it('ne primjenjuje aktivne klase kada je isActive=false', () => {
    const { container } = render(<ChatItem chat={mockIndividualniChat} isActive={false} onClick={() => {}} />);
    expect(container.firstChild).not.toHaveClass('bg-teal-500/10');
  });
});

// ─── Testovi: Tabs ────────────────────────────────────────────────────────────

describe('Tabs', () => {
  const counts = { Svi: 5, Privatni: 3, Grupe: 2 };

  it('prikazuje sve tri kartice', () => {
    render(<Tabs active="Svi" onChange={() => {}} counts={counts} />);
    expect(screen.getByText('Svi')).toBeInTheDocument();
    expect(screen.getByText('Privatni')).toBeInTheDocument();
    expect(screen.getByText('Grupe')).toBeInTheDocument();
  });

  it('prikazuje brojeve chatova', () => {
    render(<Tabs active="Svi" onChange={() => {}} counts={counts} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('poziva onChange s ispravnim tabom', () => {
    const onChange = vi.fn();
    render(<Tabs active="Svi" onChange={onChange} counts={counts} />);
    fireEvent.click(screen.getByText('Privatni'));
    expect(onChange).toHaveBeenCalledWith('Privatni');
  });

  it('ne prikazuje broj ako je count 0', () => {
    render(<Tabs active="Svi" onChange={() => {}} counts={{ Svi: 0, Privatni: 0, Grupe: 0 }} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

// ─── Testovi: EmptyState ──────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('prikazuje poruku odabira razgovora', () => {
    render(<EmptyState />);
    expect(screen.getByText('Odaberi razgovor')).toBeInTheDocument();
  });

  it('prikazuje uputu za klik', () => {
    render(<EmptyState />);
    expect(screen.getByText('Klikni na chat s lijeve strane da ga otvoriš')).toBeInTheDocument();
  });
});

// ─── Testovi: ProfileFooter ───────────────────────────────────────────────────

describe('ProfileFooter', () => {
  const mockKorisnik = {
    ime_korisnika: 'Ivan',
    prezime_korisnika: 'Horvat',
    email_korisnika: 'ivan@test.com',
    slika_profila: '',
  };

  it('prikazuje ime i prezime korisnika', () => {
    render(<ProfileFooter korisnik={mockKorisnik} onOdjava={() => {}} onKorisnikUpdate={() => {}} />);
    expect(screen.getByText('Ivan Horvat')).toBeInTheDocument();
  });

  it('prikazuje email korisnika', () => {
    render(<ProfileFooter korisnik={mockKorisnik} onOdjava={() => {}} onKorisnikUpdate={() => {}} />);
    expect(screen.getByText('ivan@test.com')).toBeInTheDocument();
  });

  it('prikazuje gumb Odjava', () => {
    render(<ProfileFooter korisnik={mockKorisnik} onOdjava={() => {}} onKorisnikUpdate={() => {}} />);
    expect(screen.getByText('Odjava')).toBeInTheDocument();
  });

  it('poziva onOdjava klikom na Odjava', () => {
    const onOdjava = vi.fn();
    render(<ProfileFooter korisnik={mockKorisnik} onOdjava={onOdjava} onKorisnikUpdate={() => {}} />);
    fireEvent.click(screen.getByText('Odjava'));
    expect(onOdjava).toHaveBeenCalledTimes(1);
  });

  it('otvara ProfileEditModal klikom na avatar', () => {
    render(<ProfileFooter korisnik={mockKorisnik} onOdjava={() => {}} onKorisnikUpdate={() => {}} />);
    fireEvent.click(screen.getByText('IH'));
    expect(screen.getByText('Uredi profil')).toBeInTheDocument();
  });

  it('prikazuje sliku profila kada postoji slika_profila', () => {
    const korisnikSSlikom = { ...mockKorisnik, slika_profila: '/uploads/avatar.jpg' };
    render(<ProfileFooter korisnik={korisnikSSlikom} onOdjava={() => {}} onKorisnikUpdate={() => {}} />);
    const img = screen.getByAltText('Ivan Horvat');
    expect(img).toHaveAttribute('src', 'http://localhost:3001/uploads/avatar.jpg');
  });
});

// ─── Testovi: ProfileEditModal ────────────────────────────────────────────────

describe('ProfileEditModal', () => {
  const mockKorisnik = {
    ime_korisnika: 'Ivan',
    prezime_korisnika: 'Horvat',
    email_korisnika: 'ivan@test.com',
    slika_profila: '',
    datum_rodenja: '1990-01-01',
  };

  it('prikazuje naslov "Uredi profil"', () => {
    render(<ProfileEditModal korisnik={mockKorisnik} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText('Uredi profil')).toBeInTheDocument();
  });

  it('popunjava polja s postojećim podacima', () => {
    render(<ProfileEditModal korisnik={mockKorisnik} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByDisplayValue('Ivan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Horvat')).toBeInTheDocument();
  });

  it('poziva onClose klikom na Odustani', () => {
    const onClose = vi.fn();
    render(<ProfileEditModal korisnik={mockKorisnik} onClose={onClose} onSave={() => {}} />);
    fireEvent.click(screen.getByText('Odustani'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prikazuje grešku kada su ime/prezime prazni', async () => {
    render(<ProfileEditModal korisnik={mockKorisnik} onClose={() => {}} onSave={() => {}} />);
    fireEvent.change(screen.getByDisplayValue('Ivan'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Spremi'));
    await waitFor(() => {
      expect(screen.getByText('Ime i prezime su obavezni.')).toBeInTheDocument();
    });
  });

  it('prikazuje grešku kada se lozinke ne podudaraju', async () => {
    render(<ProfileEditModal korisnik={mockKorisnik} onClose={() => {}} onSave={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Ostavi prazno za zadržavanje'), { target: { value: 'lozinka1' } });
    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('Ponovi novu lozinku'), { target: { value: 'lozinka2' } });
    });
    fireEvent.click(screen.getByText('Spremi'));
    await waitFor(() => {
      expect(screen.getByText('Lozinke se ne podudaraju.')).toBeInTheDocument();
    });
  });

  it('prikazuje polje za potvrdu lozinke tek kad se upiše nova lozinka', () => {
    render(<ProfileEditModal korisnik={mockKorisnik} onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByPlaceholderText('Ponovi novu lozinku')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ostavi prazno za zadržavanje'), { target: { value: 'nova123' } });
    expect(screen.getByPlaceholderText('Ponovi novu lozinku')).toBeInTheDocument();
  });

  it('poziva onClose klikom na backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<ProfileEditModal korisnik={mockKorisnik} onClose={onClose} onSave={() => {}} />);
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});