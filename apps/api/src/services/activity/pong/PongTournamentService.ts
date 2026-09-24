import type {
  PongRatingPool,
  PongTournament,
  PongTournamentFormat,
} from '@marquinhos/contracts/http/routes/activity';
import {
  db as defaultDb,
  type Db,
  type DbExecutor,
} from '@marquinhos/database/client';
import {
  pongTournamentEntries,
  pongTournamentMatches,
  pongTournaments,
} from '@marquinhos/database/schema';
import {
  doubleElimination,
  roundRobin,
  swissRound,
  topFourPlayoff,
  type PongTournamentPairing,
  type PongTournamentPlayer,
} from '@marquinhos/domain/games/pong/PongTournamentFormats';
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { PongCompetitionService } from 'services/activity/pong/PongCompetitionService';
import { z } from 'zod';

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

const tournamentConfigSchema = z.object({ swissRounds: z.number() });

const TOURNAMENT_LIST_LIMIT = 50;

const bracketOrder = sql`CASE ${pongTournamentMatches.bracket}
  WHEN 'upper' THEN 1 WHEN 'lower' THEN 2 WHEN 'grand-final' THEN 3
  WHEN 'swiss' THEN 1 WHEN 'playoff' THEN 2 ELSE 1 END`;

async function findTournament(
  exec: DbExecutor,
  id: string,
): Promise<TournamentRow | undefined> {
  const [row] = await exec
    .select()
    .from(pongTournaments)
    .where(eq(pongTournaments.id, id));
  return row as TournamentRow | undefined;
}

export class PongTournamentService {
  private competition: PongCompetitionService;

  constructor(private database: Db = defaultDb) {
    this.competition = new PongCompetitionService(database);
  }

  async create(input: CreatePongTournamentInput) {
    const unique = [...new Set(input.playerIds)];
    const min = input.format === 'double-elimination' ? 4 : 2;
    if (unique.length < min)
      throw new Error(`Tournament requires at least ${min} players`);
    if (input.format === 'double-elimination' && unique.length > 16) {
      throw new Error('Double elimination supports at most 16 players');
    }
    // Seeding reads ratings once; a ranked match finishing mid-create only
    // shifts a seed, which the tournament tolerates.
    const players = await Promise.all(
      unique.map(async (userId) => {
        const current = await this.competition.getRating(
          userId,
          input.guildId,
          input.pool,
        );
        return { userId, rating: current.rating };
      }),
    );
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
    await this.database.transaction(async (tx) => {
      await tx.insert(pongTournaments).values({
        id,
        guild_id: input.guildId,
        name: input.name,
        format: input.format,
        pool: input.pool,
        status: 'active',
        config_json: JSON.stringify(config),
        created_by: input.createdBy,
        created_at: Date.now(),
      });
      const seeded = [...players].sort((a, b) => b.rating - a.rating);
      await tx.insert(pongTournamentEntries).values(
        seeded.map((player, index) => ({
          tournament_id: id,
          user_id: player.userId,
          seed: index + 1,
          rating: player.rating,
          score: 0,
          eliminated: false,
        })),
      );
      await this.insertPairings(tx, id, pairings);
      await this.advanceByes(tx, id);
    });
    return this.snapshot(id);
  }

  private async snapshot(id: string): Promise<PongTournament> {
    const tournament = await findTournament(this.database, id);
    if (!tournament) throw new Error('Tournament not found');
    const entries = await this.database
      .select({
        userId: pongTournamentEntries.user_id,
        seed: pongTournamentEntries.seed,
        rating: pongTournamentEntries.rating,
        score: pongTournamentEntries.score,
        eliminated: pongTournamentEntries.eliminated,
      })
      .from(pongTournamentEntries)
      .where(eq(pongTournamentEntries.tournament_id, id))
      .orderBy(asc(pongTournamentEntries.seed));
    const matches = await this.database
      .select({
        id: pongTournamentMatches.id,
        bracket: pongTournamentMatches.bracket,
        round: pongTournamentMatches.round,
        position: pongTournamentMatches.position,
        playerA: pongTournamentMatches.player_a,
        playerB: pongTournamentMatches.player_b,
        winnerId: pongTournamentMatches.winner_id,
        status: pongTournamentMatches.status,
      })
      .from(pongTournamentMatches)
      .where(eq(pongTournamentMatches.tournament_id, id))
      .orderBy(
        bracketOrder,
        asc(pongTournamentMatches.round),
        asc(pongTournamentMatches.position),
      );
    return {
      id: tournament.id,
      guildId: tournament.guild_id,
      name: tournament.name,
      format: tournament.format,
      pool: tournament.pool,
      status: tournament.status,
      config: tournamentConfigSchema.parse(JSON.parse(tournament.config_json)),
      createdBy: tournament.created_by,
      createdAt: tournament.created_at,
      // The wire contract predates boolean columns and carries 0/1.
      entries: entries.map((entry) => ({
        ...entry,
        eliminated: entry.eliminated ? 1 : 0,
      })),
      matches: matches as PongTournament['matches'],
    };
  }

  async list(guildId: string) {
    const ids = await this.database
      .select({ id: pongTournaments.id })
      .from(pongTournaments)
      .where(eq(pongTournaments.guild_id, guildId))
      .orderBy(desc(pongTournaments.created_at))
      .limit(TOURNAMENT_LIST_LIMIT);
    return Promise.all(ids.map((row) => this.snapshot(row.id)));
  }

  async report(matchId: string, winnerId: string, actorId: string) {
    const tournamentId = await this.database.transaction(async (tx) => {
      // Locked so two reports of the same match can't both see it 'ready'.
      const [matchRow] = await tx
        .select()
        .from(pongTournamentMatches)
        .where(eq(pongTournamentMatches.id, matchId))
        .for('update');
      const match = matchRow as MatchRow | undefined;
      if (!match || match.status !== 'ready')
        throw new Error('Match is not ready');
      // Serialises bracket advancement for the whole tournament: two
      // different matches finishing at once both feed later rounds.
      const [tournamentRow] = await tx
        .select()
        .from(pongTournaments)
        .where(eq(pongTournaments.id, match.tournament_id))
        .for('update');
      const tournament = tournamentRow as TournamentRow | undefined;
      if (!tournament) throw new Error('Tournament not found');
      const participants = [match.player_a, match.player_b].filter(Boolean);
      if (!participants.includes(winnerId))
        throw new Error('Winner is not in the match');
      if (
        actorId !== tournament.created_by &&
        !participants.includes(actorId)
      ) {
        throw new Error('Actor cannot report this match');
      }
      const loserId =
        match.player_a === winnerId ? match.player_b : match.player_a;
      await tx
        .update(pongTournamentMatches)
        .set({ winner_id: winnerId, status: 'complete' })
        .where(eq(pongTournamentMatches.id, matchId));
      await tx
        .update(pongTournamentEntries)
        .set({ score: sql`${pongTournamentEntries.score} + 1` })
        .where(
          and(
            eq(pongTournamentEntries.tournament_id, match.tournament_id),
            eq(pongTournamentEntries.user_id, winnerId),
          ),
        );
      await this.resolveSources(tx, match, winnerId, loserId);
      await this.advanceByes(tx, match.tournament_id);
      await this.advanceSwiss(tx, tournament, match.round);
      await this.finishIfComplete(tx, tournament, match, winnerId);
      return match.tournament_id;
    });
    return this.snapshot(tournamentId);
  }

  private async insertPairings(
    tx: DbExecutor,
    tournamentId: string,
    pairings: PongTournamentPairing[],
  ): Promise<void> {
    if (pairings.length === 0) return;
    await tx.insert(pongTournamentMatches).values(
      pairings.map((pairing) => ({
        id: nanoid(),
        tournament_id: tournamentId,
        bracket: pairing.bracket,
        round: pairing.round,
        position: pairing.position,
        player_a: pairing.playerA,
        player_b: pairing.playerB,
        winner_id: null,
        source_a: pairing.sourceA ?? null,
        source_b: pairing.sourceB ?? null,
        status: pairing.playerA && pairing.playerB ? 'ready' : 'pending',
      })),
    );
  }

  private async resolveSources(
    tx: DbExecutor,
    match: MatchRow,
    winnerId: string | null,
    loserId: string | null,
  ): Promise<void> {
    const winnerSource = `winner:${match.bracket}:${match.round}:${match.position}`;
    const loserSource = `loser:${match.bracket}:${match.round}:${match.position}`;
    const sources = [winnerSource, loserSource];
    const pending = (await tx
      .select()
      .from(pongTournamentMatches)
      .where(
        and(
          eq(pongTournamentMatches.tournament_id, match.tournament_id),
          eq(pongTournamentMatches.status, 'pending'),
          or(
            inArray(pongTournamentMatches.source_a, sources),
            inArray(pongTournamentMatches.source_b, sources),
          ),
        ),
      )) as MatchRow[];
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
      await tx
        .update(pongTournamentMatches)
        .set({
          player_a: playerA,
          player_b: playerB,
          source_a: sourceA,
          source_b: sourceB,
          status: playerA && playerB ? 'ready' : 'pending',
        })
        .where(eq(pongTournamentMatches.id, target.id));
    }
  }

  // A bracket sized for a non-power-of-2 field seeds "ghost" byes into
  // upper-round-1 wherever a seed has no real player. A bye has no real
  // loser, so a lower-bracket slot fed by two such byes (both sources
  // resolving to a null loser) ends up with no real player on either
  // side — there was never anyone who could have played there. Treating
  // that as a dead, winner-less match and propagating the null onward
  // (instead of leaving it permanently 'pending' with no source left to
  // ever fill it) lets the cascade keep resolving until it reaches a
  // round where a real survivor is waiting on the other side, exactly
  // like a normal bye.
  private async advanceByes(
    tx: DbExecutor,
    tournamentId: string,
  ): Promise<void> {
    while (true) {
      // status='pending' with both sources already cleared means this slot
      // will never receive another player from elsewhere — it's either a
      // one-sided bye (one real player waiting, normal case) or a dead
      // match (both sides empty, see the comment above) — either way it's
      // final as-is and should resolve now.
      const [bye] = (await tx
        .select()
        .from(pongTournamentMatches)
        .where(
          and(
            eq(pongTournamentMatches.tournament_id, tournamentId),
            eq(pongTournamentMatches.status, 'pending'),
            isNull(pongTournamentMatches.source_a),
            isNull(pongTournamentMatches.source_b),
          ),
        )
        .limit(1)) as MatchRow[];
      if (!bye) return;
      const winner = bye.player_a ?? bye.player_b ?? null;
      await tx
        .update(pongTournamentMatches)
        .set({ winner_id: winner, status: 'complete' })
        .where(eq(pongTournamentMatches.id, bye.id));
      await this.resolveSources(tx, bye, winner, null);
    }
  }

  private async advanceSwiss(
    tx: DbExecutor,
    tournament: TournamentRow,
    completedRound: number,
  ): Promise<void> {
    if (tournament.format !== 'swiss-playoff') return;
    const [incomplete] = await tx
      .select({ id: pongTournamentMatches.id })
      .from(pongTournamentMatches)
      .where(
        and(
          eq(pongTournamentMatches.tournament_id, tournament.id),
          eq(pongTournamentMatches.bracket, 'swiss'),
          eq(pongTournamentMatches.round, completedRound),
          ne(pongTournamentMatches.status, 'complete'),
        ),
      )
      .limit(1);
    if (incomplete) return;
    const config = tournamentConfigSchema.parse(
      JSON.parse(tournament.config_json),
    );
    const players = await this.swissPlayers(tx, tournament.id);
    if (completedRound < config.swissRounds) {
      await this.insertPairings(
        tx,
        tournament.id,
        swissRound(players, completedRound + 1),
      );
    } else {
      await this.insertPairings(tx, tournament.id, topFourPlayoff(players));
    }
  }

  private async swissPlayers(
    tx: DbExecutor,
    tournamentId: string,
  ): Promise<PongTournamentPlayer[]> {
    const entries = await tx
      .select({
        user_id: pongTournamentEntries.user_id,
        rating: pongTournamentEntries.rating,
        score: pongTournamentEntries.score,
      })
      .from(pongTournamentEntries)
      .where(eq(pongTournamentEntries.tournament_id, tournamentId));
    const matches = await tx
      .select({
        player_a: pongTournamentMatches.player_a,
        player_b: pongTournamentMatches.player_b,
      })
      .from(pongTournamentMatches)
      .where(
        and(
          eq(pongTournamentMatches.tournament_id, tournamentId),
          eq(pongTournamentMatches.bracket, 'swiss'),
          eq(pongTournamentMatches.status, 'complete'),
        ),
      );
    return entries.map((entry) => ({
      userId: entry.user_id,
      rating: entry.rating,
      score: entry.score,
      opponents: matches.flatMap((match) =>
        match.player_a === entry.user_id
          ? [match.player_b!]
          : match.player_b === entry.user_id
            ? [match.player_a!]
            : [],
      ),
    }));
  }

  private async finishIfComplete(
    tx: DbExecutor,
    tournament: TournamentRow,
    match: MatchRow,
    winnerId: string,
  ): Promise<void> {
    if (
      tournament.format === 'double-elimination' &&
      match.bracket === 'grand-final' &&
      match.round === 1 &&
      winnerId === match.player_b
    ) {
      await this.insertPairings(tx, tournament.id, [
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
    const [remaining] = await tx
      .select({ id: pongTournamentMatches.id })
      .from(pongTournamentMatches)
      .where(
        and(
          eq(pongTournamentMatches.tournament_id, tournament.id),
          ne(pongTournamentMatches.status, 'complete'),
        ),
      )
      .limit(1);
    if (terminal || (tournament.format === 'round-robin' && !remaining)) {
      await tx
        .update(pongTournaments)
        .set({ status: 'complete' })
        .where(eq(pongTournaments.id, tournament.id));
    }
  }
}
