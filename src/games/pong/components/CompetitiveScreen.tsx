import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiscordIdentity } from '../../../hooks/useDiscordIdentity';
import { apiUrl } from '../../../lib/apiBase';
import { cn } from '../../../lib/cn';
import { errorMessage, postJson } from '../../../lib/http';

type Pool = 'classic-1v1' | 'quad-elimination';
type Format = 'round-robin' | 'double-elimination' | 'swiss-playoff';

interface RatingEntry {
  userId: string;
  rating: number;
  deviation: number;
  matches: number;
  wins: number;
}

interface Tournament {
  id: string;
  name: string;
  format: Format;
  pool: Pool;
  status: string;
  createdBy: string;
  entries: {
    userId: string;
    seed: number;
    rating: number;
    score: number;
  }[];
  matches: {
    id: string;
    bracket: string;
    round: number;
    playerA: string | null;
    playerB: string | null;
    winnerId: string | null;
    status: string;
  }[];
}

export function CompetitiveScreen({
  identity,
  onBack,
}: {
  identity: DiscordIdentity;
  onBack: () => void;
}) {
  const { t } = useTranslation(['pong', 'common']);
  const [tab, setTab] = useState<'ladder' | 'tournaments'>('ladder');
  const [pool, setPool] = useState<Pool>('classic-1v1');
  const [leaderboard, setLeaderboard] = useState<RatingEntry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<string[]>([identity.userId]);
  const [name, setName] = useState('Pong Night');
  const [format, setFormat] = useState<Format>('round-robin');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ratings, events] = await Promise.all([
        postJson<RatingEntry[]>(apiUrl('/activities/pong/leaderboard'), {
          accessToken: identity.accessToken,
          guildId: identity.guildId,
          pool,
          limit: 50,
        }),
        postJson<Tournament[]>(apiUrl('/activities/pong/tournaments/list'), {
          accessToken: identity.accessToken,
          guildId: identity.guildId,
        }),
      ]);
      setLeaderboard(ratings);
      setTournaments(events);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [identity.accessToken, identity.guildId, pool]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTournament() {
    setError(null);
    try {
      await postJson(apiUrl('/activities/pong/tournaments/create'), {
        accessToken: identity.accessToken,
        guildId: identity.guildId,
        name,
        format,
        pool,
        playerIds: selected,
      });
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function report(matchId: string, winnerId: string) {
    setError(null);
    try {
      await postJson(apiUrl('/activities/pong/tournaments/report'), {
        accessToken: identity.accessToken,
        matchId,
        winnerId,
      });
      await load();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  const candidates = [
    ...leaderboard,
    ...(leaderboard.some((entry) => entry.userId === identity.userId)
      ? []
      : [
          {
            userId: identity.userId,
            rating: 1500,
            deviation: 350,
            matches: 0,
            wins: 0,
          },
        ]),
  ];

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="notch-8 flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col border border-marquinhos-border bg-marquinhos-panel p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-pixel text-xl text-marquinhos-text">
            {t('competitive')}
          </h1>
          <button
            type="button"
            className="border border-marquinhos-border px-3 py-2 font-pixel text-[10px] text-marquinhos-text"
            onClick={onBack}
          >
            {t('common:back')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-b border-marquinhos-border pb-3">
          {(['ladder', 'tournaments'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'border px-4 py-2 font-pixel text-[10px]',
                tab === value
                  ? 'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg'
                  : 'border-marquinhos-border text-marquinhos-text',
              )}
            >
              {t(value)}
            </button>
          ))}
          <select
            value={pool}
            onChange={(event) => setPool(event.target.value as Pool)}
            className="ml-auto border border-marquinhos-border bg-marquinhos-bg px-3 font-mono text-sm text-marquinhos-text"
          >
            <option value="classic-1v1">1V1</option>
            <option value="quad-elimination">QUADRAPONG</option>
          </select>
        </div>

        {error && (
          <div className="mt-3 break-all border border-marquinhos-danger/60 px-3 py-2 text-sm text-marquinhos-danger">
            {error}
          </div>
        )}

        <div className="mt-4 min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="py-12 text-center font-pixel text-xs text-marquinhos-text-dim">
              {t('common:loading')}
            </div>
          ) : tab === 'ladder' ? (
            <div className="grid gap-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.userId}
                  className="grid grid-cols-[48px_1fr_auto_auto] items-center gap-3 border border-marquinhos-border bg-marquinhos-bg px-3 py-2"
                >
                  <span className="font-pixel text-xs text-marquinhos-accent">
                    #{index + 1}
                  </span>
                  <span className="truncate font-mono text-sm text-marquinhos-text">
                    {entry.userId === identity.userId
                      ? t('common:you')
                      : entry.userId}
                  </span>
                  <span className="font-pixel text-xs text-marquinhos-text">
                    {Math.round(entry.rating)} ± {Math.round(entry.deviation)}
                  </span>
                  <span className="text-xs text-marquinhos-text-dim">
                    {entry.wins}/{entry.matches}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="border border-marquinhos-border bg-marquinhos-bg p-4">
                <div className="font-pixel text-xs text-marquinhos-text">
                  {t('createTournament')}
                </div>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-3 w-full border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-sm text-marquinhos-text"
                  aria-label={t('tournamentName')}
                />
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as Format)}
                  className="mt-2 w-full border border-marquinhos-border bg-marquinhos-panel px-3 py-2 text-sm text-marquinhos-text"
                >
                  <option value="round-robin">ROUND ROBIN</option>
                  <option value="double-elimination">DOUBLE ELIMINATION</option>
                  <option value="swiss-playoff">SWISS + TOP 4</option>
                </select>
                <div className="mt-3 grid max-h-44 gap-1 overflow-auto">
                  {candidates.map((entry) => (
                    <label
                      key={entry.userId}
                      className="flex items-center gap-2 text-xs text-marquinhos-text"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(entry.userId)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(entry.userId)
                              ? current.filter((id) => id !== entry.userId)
                              : [...current, entry.userId],
                          )
                        }
                      />
                      <span className="truncate">{entry.userId}</span>
                      <span className="ml-auto text-marquinhos-text-dim">
                        {Math.round(entry.rating)}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={selected.length < 2}
                  onClick={() => void createTournament()}
                  className="mt-4 w-full border border-marquinhos-accent bg-marquinhos-accent px-3 py-2 font-pixel text-[10px] text-marquinhos-bg disabled:opacity-40"
                >
                  {t('createTournament')}
                </button>
              </div>

              <div className="grid gap-3">
                {tournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className="border border-marquinhos-border bg-marquinhos-bg p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-pixel text-xs text-marquinhos-text">
                        {tournament.name}
                      </span>
                      <span className="text-xs uppercase text-marquinhos-text-dim">
                        {tournament.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {tournament.matches
                        .filter((match) => match.status === 'ready')
                        .map((match) => (
                          <div
                            key={match.id}
                            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border border-marquinhos-border px-2 py-2 text-xs text-marquinhos-text"
                          >
                            <button
                              type="button"
                              disabled={
                                tournament.createdBy !== identity.userId &&
                                match.playerA !== identity.userId &&
                                match.playerB !== identity.userId
                              }
                              onClick={() =>
                                match.playerA &&
                                void report(match.id, match.playerA)
                              }
                              className="truncate text-left hover:text-marquinhos-accent disabled:cursor-default disabled:text-marquinhos-text-disabled"
                            >
                              {match.playerA}
                            </button>
                            <span>×</span>
                            <button
                              type="button"
                              disabled={
                                tournament.createdBy !== identity.userId &&
                                match.playerA !== identity.userId &&
                                match.playerB !== identity.userId
                              }
                              onClick={() =>
                                match.playerB &&
                                void report(match.id, match.playerB)
                              }
                              className="truncate text-right hover:text-marquinhos-accent disabled:cursor-default disabled:text-marquinhos-text-disabled"
                            >
                              {match.playerB}
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
