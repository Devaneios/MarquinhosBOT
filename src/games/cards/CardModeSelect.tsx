import { useNavigate } from 'react-router-dom';

// Every card ruleset a player can pick from here. Kept as a small hardcoded
// list rather than pulled from the server registry — the client already
// keeps its own copy of ruleset ids in rulesets/presentation.tsx, and a
// third card game means one more entry in both places, same as today.
interface CardModeOption {
  ruleset: string;
  title: string;
  description: string;
  players: string;
}

const CARD_MODES: CardModeOption[] = [
  {
    ruleset: 'truco',
    title: 'Truco Dupla',
    description: 'Duplas de 2, times A e B disputando até 12 pontos.',
    players: '4 jogadores',
  },
  {
    ruleset: 'truco-1v1',
    title: 'Truco 1x1',
    description: 'Cara a cara, sem parceiro, até 12 pontos.',
    players: '2 jogadores',
  },
];

export function CardModeSelect() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="notch-8 flex w-full max-w-[560px] flex-col gap-5 border border-marquinhos-border bg-marquinhos-panel px-8 py-10 shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="font-pixel text-lg tracking-[0.24em] text-marquinhos-accent">
            SELECT A MODE
          </div>
          <div className="text-sm text-marquinhos-text-dim">
            Escolha quantos jogadores vão sentar à mesa.
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {CARD_MODES.map((mode) => (
            <button
              key={mode.ruleset}
              type="button"
              onClick={() => navigate(`/games/cards/${mode.ruleset}`)}
              className="notch-6 flex flex-col gap-1 border border-marquinhos-border bg-marquinhos-bg px-5 py-4 text-left transition hover:border-marquinhos-border-hover hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-pixel text-sm tracking-[0.2em] text-marquinhos-accent">
                  {mode.title}
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-marquinhos-text-dim">
                  {mode.players}
                </div>
              </div>
              <div className="text-sm text-marquinhos-text-dim">
                {mode.description}
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="notch-6 self-center border border-marquinhos-border bg-marquinhos-panel px-4 py-2 text-xs uppercase tracking-[0.22em] text-marquinhos-text-dim transition hover:border-marquinhos-border-hover hover:text-marquinhos-text"
        >
          Back
        </button>
      </div>
    </div>
  );
}
