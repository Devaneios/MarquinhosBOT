import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MenuAction,
  MenuPanel,
  MenuScreen,
} from '../../../components/game-shell';
import type { DiscordIdentity } from '../../../discordAuth.ts';
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

const tabBtnBase =
  'notch-4 cursor-pointer border px-4 py-2 font-pixel text-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent motion-safe:transition-colors';
const selectClass =
  'cursor-pointer rounded-sm border border-marquinhos-border bg-marquinhos-bg px-3 py-2 font-mono text-sm text-marquinhos-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';
const inputClass =
  'w-full rounded-sm border border-marquinhos-border bg-marquinhos-bg px-3 py-2 font-mono text-sm text-marquinhos-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marquinhos-accent';
const sectionHeading = 'shrink-0 font-pixel text-xs leading-relaxed sm:text-sm';

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
    <MenuScreen
      titleKey="pong.name"
      titleNs="games"
      headingKey="competitive"
      headingNs="pong"
      onBack={onBack}
    >
      <div className="flex flex-wrap items-center gap-2">
        {(['ladder', 'tournaments'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              tabBtnBase,
              tab === value
                ? 'border-marquinhos-accent bg-marquinhos-accent text-marquinhos-bg'
                : 'border-marquinhos-border text-marquinhos-text hover:border-marquinhos-accent hover:text-marquinhos-accent',
            )}
          >
            {t(value)}
          </button>
        ))}
        <select
          value={pool}
          onChange={(event) => setPool(event.target.value as Pool)}
          className={cn(selectClass, 'ml-auto')}
        >
          <option value="classic-1v1">1V1</option>
          <option value="quad-elimination">QUADRAPONG</option>
        </select>
      </div>

      {error && (
        <p className="break-all text-sm leading-6 text-marquinhos-danger">
          {error}
        </p>
      )}

      {loading ? (
        <MenuPanel className="px-6 py-10 text-center">
          <span className="font-pixel animate-pong-blink text-sm tracking-[0.28em] text-marquinhos-accent">
            {t('common:loading')}
          </span>
        </MenuPanel>
      ) : tab === 'ladder' ? (
        <MenuPanel className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <h2 className={sectionHeading}>{t('ladder')}</h2>
            <div
              aria-hidden="true"
              className="h-px flex-1 bg-marquinhos-border"
            />
          </div>
          <div className="grid gap-2">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.userId}
                className="notch-4 grid grid-cols-[48px_1fr_auto_auto] items-center gap-3 border border-marquinhos-border bg-marquinhos-bg px-3 py-2"
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
        </MenuPanel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <MenuPanel className="flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <h2 className={sectionHeading}>{t('createTournament')}</h2>
              <div
                aria-hidden="true"
                className="h-px flex-1 bg-marquinhos-border"
              />
            </div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              aria-label={t('tournamentName')}
            />
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as Format)}
              className={cn(selectClass, 'w-full')}
            >
              <option value="round-robin">ROUND ROBIN</option>
              <option value="double-elimination">DOUBLE ELIMINATION</option>
              <option value="swiss-playoff">SWISS + TOP 4</option>
            </select>
            <div className="grid max-h-44 gap-1 overflow-auto">
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
            <MenuAction
              variant="primary"
              disabled={selected.length < 2}
              label={t('createTournament')}
              onSelect={() => void createTournament()}
            />
          </MenuPanel>

          <div className="grid gap-4">
            {tournaments.map((tournament) => (
              <MenuPanel
                key={tournament.id}
                className="flex flex-col gap-3 p-5 sm:p-6"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className={sectionHeading}>{tournament.name}</h2>
                  <span className="text-xs uppercase text-marquinhos-text-dim">
                    {tournament.status}
                  </span>
                </div>
                <div className="grid gap-2">
                  {tournament.matches
                    .filter((match) => match.status === 'ready')
                    .map((match) => (
                      <div
                        key={match.id}
                        className="notch-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border border-marquinhos-border bg-marquinhos-bg px-2 py-2 text-xs text-marquinhos-text"
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
                          className="cursor-pointer truncate text-left hover:text-marquinhos-accent disabled:cursor-default disabled:text-marquinhos-text-disabled"
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
                          className="cursor-pointer truncate text-right hover:text-marquinhos-accent disabled:cursor-default disabled:text-marquinhos-text-disabled"
                        >
                          {match.playerB}
                        </button>
                      </div>
                    ))}
                </div>
              </MenuPanel>
            ))}
          </div>
        </div>
      )}
    </MenuScreen>
  );
}
