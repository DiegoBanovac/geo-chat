import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Helper funkcije (kopirane iz ChatPage.jsx) ───────────────────────────────

const getInitials = (name) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-green-500", "bg-purple-500",
  "bg-red-500", "bg-yellow-500", "bg-pink-500",
];

const getAvatarColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ─── timeAgo (kopirana iz ChatPage.jsx) ──────────────────────────────────────

const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 1) return `${h}h`;
  if (m >= 1) return `${m}m`;
  return "upravo";
};

// ─── StoryBubble (kopirana iz ChatPage.jsx) ───────────────────────────────────

const StoryBubble = ({ label, hasUnviewed, isMine, noStory, onClick, avatarUrl }) => (
  <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={onClick}>
    <div className={`p-0.5 rounded-full ${hasUnviewed ? "bg-teal-500" : isMine && !noStory ? "bg-teal-500" : "bg-slate-700"}`}>
      <div className="p-0.5 bg-slate-900 rounded-full">
        <div className={`w-10 h-10 rounded-full ${getAvatarColor(label)} flex items-center justify-center text-white text-xs font-bold relative overflow-hidden`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={label} className="w-full h-full object-cover rounded-full" />
          ) : (
            getInitials(label)
          )}
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

// ─── StoriesStrip (kopirana iz ChatPage.jsx) ──────────────────────────────────

const StoriesStrip = ({ korisnik, storyGroups, onOpenStory, onAddStory }) => {
  const myName = `${korisnik.ime_korisnika} ${korisnik.prezime_korisnika}`;
  const myGroup = storyGroups.find((g) => g.isMine);
  const others = storyGroups.filter((g) => !g.isMine);

  return (
    <div>
      <StoryBubble
        label={myName}
        hasUnviewed={false}
        isMine={true}
        noStory={!myGroup}
        onClick={() => (myGroup ? onOpenStory(myGroup, 0) : onAddStory())}
        avatarUrl={
          korisnik.slika_profila && korisnik.slika_profila !== ""
            ? `http://localhost:3001${korisnik.slika_profila}`
            : null
        }
      />
      {others.map((group) => (
        <StoryBubble
          key={group.email_korisnika}
          label={`${group.ime} ${group.prezime}`}
          hasUnviewed={group.hasUnviewed}
          isMine={false}
          noStory={false}
          onClick={() => onOpenStory(group, 0)}
          avatarUrl={
            group.slika_profila
              ? `http://localhost:3001${group.slika_profila}`
              : null
          }
        />
      ))}
      {storyGroups.length === 0 && (
        <p>Nema aktivnih priča</p>
      )}
    </div>
  );
};

// ─── Testovi: timeAgo ─────────────────────────────────────────────────────────

describe('timeAgo', () => {
  it('vraća "upravo" za timestamp manji od minute', () => {
    const ts = new Date(Date.now() - 30 * 1000).toISOString(); // 30 sekundi
    expect(timeAgo(ts)).toBe('upravo');
  });

  it('vraća minute za timestamp manji od sat vremena', () => {
    const ts = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 minuta
    expect(timeAgo(ts)).toBe('15m');
  });

  it('vraća sate za timestamp veći od sat vremena', () => {
    const ts = new Date(Date.now() - 3 * 3600 * 1000).toISOString(); // 3 sata
    expect(timeAgo(ts)).toBe('3h');
  });

  it('vraća "1h" za točno jedan sat', () => {
    const ts = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(timeAgo(ts)).toBe('1h');
  });

  it('vraća "1m" za točno jednu minutu', () => {
    const ts = new Date(Date.now() - 60 * 1000).toISOString();
    expect(timeAgo(ts)).toBe('1m');
  });
});

// ─── Testovi: StoryBubble ─────────────────────────────────────────────────────

describe('StoryBubble', () => {
  it('prikazuje inicijale kada nema avatarUrl', () => {
    render(
      <StoryBubble label="Ivan Horvat" isMine={false} hasUnviewed={false} noStory={false} onClick={() => {}} />
    );
    expect(screen.getByText('IH')).toBeInTheDocument();
  });

  it('prikazuje sliku kada je avatarUrl postavljen', () => {
    render(
      <StoryBubble
        label="Ivan Horvat"
        isMine={false}
        hasUnviewed={false}
        noStory={false}
        onClick={() => {}}
        avatarUrl="http://localhost:3001/uploads/avatar_123.jpg"
      />
    );
    const img = screen.getByAltText('Ivan Horvat');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'http://localhost:3001/uploads/avatar_123.jpg');
  });

  it('ne prikazuje sliku kada avatarUrl nije postavljen', () => {
    render(
      <StoryBubble label="Ivan Horvat" isMine={false} hasUnviewed={false} noStory={false} onClick={() => {}} />
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('prikazuje + gumb kada korisnik nema priče', () => {
    render(
      <StoryBubble label="Ivan Horvat" isMine={true} hasUnviewed={false} noStory={true} onClick={() => {}} />
    );
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('ne prikazuje + gumb kada korisnik ima priče', () => {
    render(
      <StoryBubble label="Ivan Horvat" isMine={true} hasUnviewed={false} noStory={false} onClick={() => {}} />
    );
    expect(screen.queryByText('+')).not.toBeInTheDocument();
  });

  it('prikazuje samo ime u labeli ispod avatara', () => {
    render(
      <StoryBubble label="Diego Banovac" isMine={false} hasUnviewed={false} noStory={false} onClick={() => {}} />
    );
    expect(screen.getByText('Diego')).toBeInTheDocument();
    expect(screen.queryByText('Diego Banovac')).not.toBeInTheDocument();
  });

  it('poziva onClick kada se klikne na bubble', () => {
    const handleClick = vi.fn();
    render(
      <StoryBubble label="Ivan Horvat" isMine={false} hasUnviewed={false} noStory={false} onClick={handleClick} />
    );
    fireEvent.click(screen.getByText('Ivan'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('generira ispravne inicijale za jedno ime', () => {
    render(
      <StoryBubble label="Marko" isMine={false} hasUnviewed={false} noStory={false} onClick={() => {}} />
    );
    expect(screen.getByText('MA')).toBeInTheDocument();
  });
});

// ─── Testovi: StoriesStrip ────────────────────────────────────────────────────

describe('StoriesStrip', () => {
  const mockKorisnik = {
    ime_korisnika: 'Ivan',
    prezime_korisnika: 'Horvat',
    email_korisnika: 'ivan@test.com',
    slika_profila: '',
  };

  const mockKorisnikSSlikom = {
    ...mockKorisnik,
    slika_profila: '/uploads/avatar_123.jpg',
  };

  it('prikazuje inicijale korisnika kada nema slike profila', () => {
    render(
      <StoriesStrip
        korisnik={mockKorisnik}
        storyGroups={[]}
        onOpenStory={() => {}}
        onAddStory={() => {}}
      />
    );
    expect(screen.getByText('IH')).toBeInTheDocument();
  });

  it('prikazuje sliku profila kada postoji slika_profila', () => {
    render(
      <StoriesStrip
        korisnik={mockKorisnikSSlikom}
        storyGroups={[]}
        onOpenStory={() => {}}
        onAddStory={() => {}}
      />
    );
    const img = screen.getByAltText('Ivan Horvat');
    expect(img).toHaveAttribute('src', 'http://localhost:3001/uploads/avatar_123.jpg');
  });

  it('prikazuje poruku kada nema priča', () => {
    render(
      <StoriesStrip
        korisnik={mockKorisnik}
        storyGroups={[]}
        onOpenStory={() => {}}
        onAddStory={() => {}}
      />
    );
    expect(screen.getByText('Nema aktivnih priča')).toBeInTheDocument();
  });

  it('ne prikazuje poruku "Nema aktivnih priča" kada postoje priče', () => {
    const storyGroups = [
      {
        email_korisnika: 'marko@test.com',
        ime: 'Marko',
        prezime: 'Marić',
        isMine: false,
        hasUnviewed: true,
        slika_profila: null,
        price: [],
      },
    ];
    render(
      <StoriesStrip
        korisnik={mockKorisnik}
        storyGroups={storyGroups}
        onOpenStory={() => {}}
        onAddStory={() => {}}
      />
    );
    expect(screen.queryByText('Nema aktivnih priča')).not.toBeInTheDocument();
  });

  it('prikazuje bubble za svakog korisnika s pričom', () => {
    const storyGroups = [
      { email_korisnika: 'a@test.com', ime: 'Ana', prezime: 'Anić', isMine: false, hasUnviewed: false, slika_profila: null, price: [] },
      { email_korisnika: 'b@test.com', ime: 'Pero', prezime: 'Perić', isMine: false, hasUnviewed: false, slika_profila: null, price: [] },
    ];
    render(
      <StoriesStrip
        korisnik={mockKorisnik}
        storyGroups={storyGroups}
        onOpenStory={() => {}}
        onAddStory={() => {}}
      />
    );
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Pero')).toBeInTheDocument();
  });

  it('poziva onAddStory kada korisnik klikne svoj bubble bez priče', () => {
    const onAddStory = vi.fn();
    render(
      <StoriesStrip
        korisnik={mockKorisnik}
        storyGroups={[]}
        onOpenStory={() => {}}
        onAddStory={onAddStory}
      />
    );
    fireEvent.click(screen.getByText('Ivan'));
    expect(onAddStory).toHaveBeenCalledTimes(1);
  });

  it('poziva onOpenStory kada korisnik klikne tuđu priču', () => {
    const onOpenStory = vi.fn();
    const storyGroups = [
      { email_korisnika: 'marko@test.com', ime: 'Marko', prezime: 'Marić', isMine: false, hasUnviewed: false, slika_profila: null, price: [] },
    ];
    render(
      <StoriesStrip
        korisnik={mockKorisnik}
        storyGroups={storyGroups}
        onOpenStory={onOpenStory}
        onAddStory={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Marko'));
    expect(onOpenStory).toHaveBeenCalledTimes(1);
  });

  it('prikazuje sliku profila za druge korisnike', () => {
    const storyGroups = [
      {
        email_korisnika: 'marko@test.com',
        ime: 'Marko',
        prezime: 'Marić',
        isMine: false,
        hasUnviewed: false,
        slika_profila: '/uploads/avatar_marko.jpg',
        price: [],
      },
    ];
    render(
      <StoriesStrip
        korisnik={mockKorisnik}
        storyGroups={storyGroups}
        onOpenStory={() => {}}
        onAddStory={() => {}}
      />
    );
    const img = screen.getByAltText('Marko Marić');
    expect(img).toHaveAttribute('src', 'http://localhost:3001/uploads/avatar_marko.jpg');
  });
});