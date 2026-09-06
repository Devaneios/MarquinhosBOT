import type { Database } from 'bun:sqlite';
import { db as defaultDb } from 'database/sqlite';
import { nanoid } from 'nanoid';
import {
  PongCompetitionService,
  type PongRatingPool,
} from 'services/activity/pong/PongCompetitionService';
import {
  doubleElimination,
  roundRobin,
  swissRound,
  topFourPlayoff,
  type PongTournamentPairing,
  type PongTournamentPlayer,
} from 'services/activity/pong/PongTournamentFormats';

export type PongTournamentFormat =
  'round-robin' | 'double-elimination' | 'swiss-playoff';

export interface CreatePongTournamentInput {
  guildId: string;
  name: string;
  format: PongTournamentFormat;
  pool: PongRatingPool;
  createdBy: string;
  playerIds: string[];
  swissRounds?: number;
}

interface TournamentRow {
  id: string;
  guild_id: string;
  name: string;
  format: PongTournamentFormat;
  pool: PongRatingPool;
  status: 'registration' | 'active' | 'complete';
  config_json: string;
  created_by: string;
  created_at: number;
}

interface MatchRow {
  id: string;
  tournament_id: string;
  bracket: PongTournamentPairing['bracket'];
  round: number;
  position: number;
  player_a: string | null;
  player_b: string | null;
  winner_id: string | null;
  source_a: string | null;
  source_b: string | null;
  status: 'pending' | 'ready' | 'complete';
}

export class PongTournamentService {
  private competition: PongCompetitionService;

  constructor(private database: Database = defaultDb) {
    this.competition = new PongCompetitionService(database);
  }

  create(input: CreatePongTournamentInput) {
    const unique = [...new Set(input.playerIds)];
    const min = input.format === 'double-elimination' ? 4 : 2;
    if (unique.length < min)
      throw new Error(`Tournament requires at least ${min} players`);
    if (input.format === 'double-elimination' && unique.length > 16) {
      throw new Error('Double elimination supports at most 16 players');
    }
    const players = unique.map((userId) => {
      const current = this.competition.getRating(
        userId,
        input.guildId,
        input.pool,
      );
      return { userId, rating: current.rating };
    });
    const id = nanoid();
    const config = {
      swissRounds: Math.min(
        Math.max(input.swissRounds ?? Math.ceil(Math.log2(players.length)), 1),
        10,
      ),
    };
    const pairings =
      input.format === 'round-robin'
        ? roundRobin(players)
        : input.format === 'double-elimination'
          ? doubleElimination(players)
          : swissRound(players, 1);
    this.database.transaction(() => {
      this.database
        .query(
          `INSERT INTO pong_tournaments
           (id, guild_id, name, format, pool, status, config_json, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        )
        .run(
          id,
          input.guildId,
          input.name,
          input.format,
          input.pool,
          JSON.stringify(config),
          input.createdBy,
          Date.now(),
        );
      const seeded = [...players].sort((a, b) => b.rating - a.rating);
      seeded.forEach((player, index) => {
        this.database
          .query(
            `INSERT INTO pong_tournament_entries
             (tournament_id, user_id, seed, rating, score, eliminated)
             VALUES (?, ?, ?, ?, 0, 0)`,
          )
          .run(id, player.userId, index + 1, player.rating);
      });
      this.insertPairings(id, pairings);
      this.advanceByes(id);
    })();
    return this.get(id);
  }

  get(id: string) {
    const tournament = this.database
      .query('SELECT * FROM pong_tournaments WHERE id = ?')
      .get(id) as TournamentRow | null;
    if (!tournament) return null;
    const entries = this.database
      .query(
        `SELECT user_id AS userId, seed, rating, score, eliminated
         FROM pong_tournament_entries WHERE tournament_id = ? ORDER BY seed`,
      )
      .all(id);
    const matches = this.database
      .query(
        `SELECT id, bracket, round, position, player_a AS playerA,
         player_b AS playerB, winner_id AS winnerId, status
         FROM pong_tournament_matches WHERE tournament_id = ?
         ORDER BY CASE bracket
           WHEN 'upper' THEN 1 WHEN 'lower' THEN 2 WHEN 'grand-final' THEN 3
           WHEN 'swiss' THEN 1 WHEN 'playoff' THEN 2 ELSE 1 END,
         round, position`,
      )
      .all(id);
    return {
      id: tournament.id,
      guildId: tournament.guild_id,
      name: tournament.name,
      format: tournament.format,
      pool: tournament.pool,
      status: tournament.status,
      config: JSON.parse(tournament.config_json),
      createdBy: tournament.created_by,
      createdAt: tournament.created_at,
      entries,
      matches,
    };
  }

  list(guildId: string) {
    const ids = this.database
      .query(
        `SELECT id FROM pong_tournaments WHERE guild_id = ?
         ORDER BY created_at DESC LIMIT 50`,
      )
      .all(guildId) as { id: string }[];
    return ids.map((row) => this.get(row.id));
  }

  report(matchId: string, winnerId: string, actorId: string) {
    const match = this.database
      .query('SELECT * FROM pong_tournament_matches WHERE id = ?')
      .get(matchId) as MatchRow | null;
    if (!match || match.status !== 'ready')
      throw new Error('Match is not ready');
    const tournament = this.database
      .query('SELECT * FROM pong_tournaments WHERE id = ?')
      .get(match.tournament_id) as TournamentRow;
    const participants = [match.player_a, match.player_b].filter(Boolean);
    if (!participants.includes(winnerId))
      throw new Error('Winner is not in the match');
    if (actorId !== tournament.created_by && !participants.includes(actorId)) {
      throw new Error('Actor cannot report this match');
    }
    const loserId =
      match.player_a === winnerId ? match.player_b : match.player_a;
    this.database.transaction(() => {
      this.database
        .query(
          `UPDATE pong_tournament_matches
           SET winner_id = ?, status = 'complete' WHERE id = ?`,
        )
        .run(winnerId, matchId);
      this.database
        .query(
          `UPDATE pong_tournament_entries SET score = score + 1
           WHERE tournament_id = ? AND user_id = ?`,
        )
        .run(match.tournament_id, winnerId);
      this.resolveSources(match, winnerId, loserId);
      this.advanceByes(match.tournament_id);
      this.advanceSwiss(tournament, match.round);
      this.finishIfComplete(tournament, match, winnerId);
    })();
    return this.get(match.tournament_id);
  }

  private insertPairings(
    tournamentId: string,
    pairings: PongTournamentPairing[],
  ): void {
    for (const pairing of pairings) {
      this.database
        .query(
          `INSERT INTO pong_tournament_matches
           (id, tournament_id, bracket, round, position, player_a, player_b,
            winner_id, source_a, source_b, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        )
        .run(
          nanoid(),
          tournamentId,
          pairing.bracket,
          pairing.round,
          pairing.position,
          pairing.playerA,
          pairing.playerB,
          pairing.sourceA ?? null,
          pairing.sourceB ?? null,
          pairing.playerA && pairing.playerB ? 'ready' : 'pending',
        );
    }
  }

  private resolveSources(
    match: MatchRow,
    winnerId: string,
    loserId: string | null,
  ): void {
    const winnerSource = `winner:${match.bracket}:${match.round}:${match.position}`;
    const loserSource = `loser:${match.bracket}:${match.round}:${match.position}`;
    const pending = this.database
      .query(
        `SELECT * FROM pong_tournament_matches
         WHERE tournament_id = ? AND status = 'pending'
         AND (source_a IN (?, ?) OR source_b IN (?, ?))`,
      )
      .all(
        match.tournament_id,
        winnerSource,
        loserSource,
        winnerSource,
        loserSource,
      ) as MatchRow[];
    for (const target of pending) {
      const value = (source: string | null) =>
        source === winnerSource
          ? winnerId
          : source === loserSource
            ? loserId
            : null;
      const playerA = target.player_a ?? value(target.source_a);
      const playerB = target.player_b ?? value(target.source_b);
      const sourceA =
        target.source_a === winnerSource || target.source_a === loserSource
          ? null
          : target.source_a;
      const sourceB =
        target.source_b === winnerSource || target.source_b === loserSource
          ? null
          : target.source_b;
      this.database
        .query(
          `UPDATE pong_tournament_matches SET player_a = ?, player_b = ?,
           source_a = ?, source_b = ?, status = ? WHERE id = ?`,
        )
        .run(
          playerA,
          playerB,
          sourceA,
          sourceB,
          playerA && playerB ? 'ready' : 'pending',
          target.id,
        );
    }
  }

  private advanceByes(tournamentId: string): void {
    while (true) {
      const bye = this.database
        .query(
          `SELECT * FROM pong_tournament_matches
           WHERE tournament_id = ? AND status = 'pending'
           AND source_a IS NULL AND source_b IS NULL
           AND ((player_a IS NOT NULL AND player_b IS NULL)
             OR (player_a IS NULL AND player_b IS NOT NULL)) LIMIT 1`,
        )
        .get(tournamentId) as MatchRow | null;
      if (!bye) return;
      const winner = bye.player_a ?? bye.player_b!;
      this.database
        .query(
          `UPDATE pong_tournament_matches
           SET winner_id = ?, status = 'complete' WHERE id = ?`,
        )
        .run(winner, bye.id);
      this.resolveSources(bye, winner, null);
    }
  }

  private advanceSwiss(
    tournament: TournamentRow,
    completedRound: number,
  ): void {
    if (tournament.format !== 'swiss-playoff') return;
    const incomplete = this.database
      .query(
        `SELECT 1 FROM pong_tournament_matches
         WHERE tournament_id = ? AND bracket = 'swiss' AND round = ?
         AND status != 'complete' LIMIT 1`,
      )
      .get(tournament.id, completedRound);
    if (incomplete) return;
    const config = JSON.parse(tournament.config_json) as {
      swissRounds: number;
    };
    const players = this.swissPlayers(tournament.id);
    if (completedRound < config.swissRounds) {
      this.insertPairings(
        tournament.id,
        swissRound(players, completedRound + 1),
      );
    } else {
      this.insertPairings(tournament.id, topFourPlayoff(players));
    }
  }

  private swissPlayers(tournamentId: string): PongTournamentPlayer[] {
    const entries = this.database
      .query(
        `SELECT user_id, rating, score FROM pong_tournament_entries
         WHERE tournament_id = ?`,
      )
      .all(tournamentId) as {
      user_id: string;
      rating: number;
      score: number;
    }[];
    const matches = this.database
      .query(
        `SELECT player_a, player_b FROM pong_tournament_matches
         WHERE tournament_id = ? AND bracket = 'swiss' AND status = 'complete'`,
      )
      .all(tournamentId) as { player_a: string; player_b: string }[];
    return entries.map((entry) => ({
      userId: entry.user_id,
      rating: entry.rating,
      score: entry.score,
      opponents: matches.flatMap((match) =>
        match.player_a === entry.user_id
          ? [match.player_b]
          : match.player_b === entry.user_id
            ? [match.player_a]
            : [],
      ),
    }));
  }

  private finishIfComplete(
    tournament: TournamentRow,
    match: MatchRow,
    winnerId: string,
  ): void {
    if (
      tournament.format === 'double-elimination' &&
      match.bracket === 'grand-final' &&
      match.round === 1 &&
      winnerId === match.player_b
    ) {
      this.insertPairings(tournament.id, [
        {
          round: 2,
          position: 0,
          playerA: match.player_a,
          playerB: match.player_b,
          bracket: 'grand-final',
        },
      ]);
      return;
    }
    const terminal =
      (tournament.format === 'double-elimination' &&
        match.bracket === 'grand-final') ||
      (tournament.format === 'swiss-playoff' &&
        match.bracket === 'playoff' &&
        match.round === 2);
    const remaining = this.database
      .query(
        `SELECT 1 FROM pong_tournament_matches
         WHERE tournament_id = ? AND status != 'complete' LIMIT 1`,
      )
      .get(tournament.id);
    if (terminal || (tournament.format === 'round-robin' && !remaining)) {
      this.database
        .query("UPDATE pong_tournaments SET status = 'complete' WHERE id = ?")
        .run(tournament.id);
    }
  }
}
