import {
  gameIdSchema,
  type GameId,
} from '@marquinhos/contracts/activity/gameId';
import * as battleship from '@marquinhos/contracts/activity/games/battleship';
import * as bingoSpeed from '@marquinhos/contracts/activity/games/bingoSpeed';
import * as boggle from '@marquinhos/contracts/activity/games/boggleWordRace';
import * as cards from '@marquinhos/contracts/activity/games/cards';
import * as checkers from '@marquinhos/contracts/activity/games/checkers';
import * as connectFour from '@marquinhos/contracts/activity/games/connectFour';
import * as dominoes from '@marquinhos/contracts/activity/games/dominoesBlock';
import * as hangman from '@marquinhos/contracts/activity/games/hangman';
import * as minesweeper from '@marquinhos/contracts/activity/games/minesweeperVersus';
import * as pong from '@marquinhos/contracts/activity/games/pong';
import * as rockPaperScissors from '@marquinhos/contracts/activity/games/rockPaperScissors';
import * as snake from '@marquinhos/contracts/activity/games/snakeGame';
import * as ticTacToe from '@marquinhos/contracts/activity/games/ticTacToe';
import * as tower from '@marquinhos/contracts/activity/games/towerUnstable';
import * as trivia from '@marquinhos/contracts/activity/games/triviaQuiz';
import * as wordChain from '@marquinhos/contracts/activity/games/wordChain';
import * as wordSearchRace from '@marquinhos/contracts/activity/games/wordSearchRace';
import * as wordle from '@marquinhos/contracts/activity/games/wordle';
import * as wordleRace from '@marquinhos/contracts/activity/games/wordleRace';
import {
  PONG_BALL_BYTES,
  PONG_BRICK_BYTES,
  PONG_PADDLE_BYTES,
  PONG_POWERUP_BYTES,
  PONG_PROTOCOL_VERSION,
  PONG_SNAPSHOT_HEADER_BYTES,
} from '@marquinhos/contracts/activity/pong/codec';
import {
  roomClientMessageSchema,
  roomServerMessageSchema,
} from '@marquinhos/contracts/activity/room';
import { z } from 'zod';
import { cardGameRegistry } from '../../src/modules/activity/games/cards/card-game-registry';
import { writeValidatedSpec } from './write-validated-spec';

interface Protocol {
  clientMessageSchema: { options: readonly z.ZodType[] };
  serverMessageSchema: { options: readonly z.ZodType[] };
}

const gameProtocols = {
  battleship,
  'bingo-speed': bingoSpeed,
  'boggle-word-race': boggle,
  cards,
  checkers,
  'connect-four': connectFour,
  'dominoes-block': dominoes,
  hangman,
  'minesweeper-versus': minesweeper,
  pong,
  'rock-paper-scissors': rockPaperScissors,
  'snake-game': snake,
  'tic-tac-toe': ticTacToe,
  'tower-unstable': tower,
  'trivia-quiz': trivia,
  'word-chain': wordChain,
  'word-search-race': wordSearchRace,
  wordle,
  'wordle-race': wordleRace,
} satisfies Record<GameId, Protocol>;

type Action = 'receive' | 'send';
type Reference = { $ref: string };

const roomDescriptions: Record<string, string> = {
  switch_game:
    'The current host requests another game in the same multiplayer room between matches.',
  toggle_queue: 'The current host enables or disables the waiting queue.',
  rotate_seat:
    'A seated player gives their seat to the first queued player between matches.',
  room_state:
    'Current game, host, match status, and public seat and queue assignments.',
  action_rejected:
    'A client action failed a room, permission, or gameplay check.',
};

const gameDescriptions: Record<GameId, string> = {
  battleship:
    'Players place fleets and fire at coordinates. The server sends each viewer a board with hidden ships masked.',
  'bingo-speed':
    'The server broadcasts called numbers. Clients can claim Bingo and receive the result of the server’s claim check.',
  'boggle-word-race':
    'Players submit words from a shared letter board. The server tracks found words and round scores.',
  cards:
    'The active ruleset defines legal moves. State views are masked per recipient so only allowed card information is sent.',
  checkers:
    'Players send one move at a time. The server reports board positions and whether the active piece must continue capturing.',
  'connect-four':
    'Players select a column. The server updates the board and turn after checking the move.',
  'dominoes-block':
    'Players place a tile at an end of the chain or pass. The server sends per-player views and resolves the round.',
  hangman:
    'Players guess letters. The server tracks the revealed word, used letters, and match outcome.',
  'minesweeper-versus':
    'Players request cell reveals. The server sends board snapshots, reveal results, or rejection details.',
  pong: 'Clients send sequenced input and lobby controls. The server sends binary game snapshots and structured lobby and connection messages.',
  'rock-paper-scissors':
    'The server collects player choices and publishes a round result after both choices are in.',
  'snake-game':
    'Clients send direction changes. The server owns movement, collisions, and the match clock.',
  'tic-tac-toe':
    'Players select a cell. The server validates turns and publishes the authoritative board.',
  'tower-unstable':
    'Players pull blocks from the shared tower. Server updates record the last pull, player order, and any eliminations.',
  'trivia-quiz':
    'The server sends questions and reveals results. Clients submit answer selections for the active question.',
  'word-chain':
    'Players submit words under the active chain rule. The server controls the turn and validates the submission.',
  'word-search-race':
    'Players submit candidate word selections from the puzzle grid. The server tracks found words and scores.',
  wordle:
    'The daily round is persisted by the API. The client requests a fresh snapshot with wordle_sync at join and after reconnect. A dropped seat is reserved for 30 seconds.',
  'wordle-race':
    'Players submit guesses in a shared race. Server messages communicate progress and settle the race.',
};

function cardMoves() {
  const rulesets = cardGameRegistry.list().sort();
  return rulesets.map((id) => {
    if (id !== 'truco' && id !== 'truco-1v1')
      throw new Error(`Missing card view schema for ${id}`);
    const definition = cardGameRegistry.get(id);
    if (!definition) throw new Error(`Unregistered card ruleset ${id}`);
    return {
      ruleset: id,
      variants: Object.entries(definition.moves).map(([move, details]) =>
        details.argsSchema
          ? z.object({ move: z.literal(move), args: details.argsSchema })
          : z.object({ move: z.literal(move) }),
      ),
    };
  });
}

function payloadSchema(schema: z.ZodType, action: Action) {
  const { $schema: dialect, ...shape } = z.toJSONSchema(schema, {
    target: 'draft-07',
    io: action === 'receive' ? 'input' : 'output',
    reused: 'inline',
    override: ({ zodSchema, jsonSchema, path }) => {
      if (!(zodSchema instanceof z.ZodUnknown)) return;
      if (path.includes('props')) {
        jsonSchema.$ref = '#/components/schemas/CardPropertyValue';
        return;
      }
      throw new Error(`Unspecified payload shape at ${path.join('.')}`);
    },
  });
  void dialect;
  return shape;
}

function messageFor(channel: string, action: Action, variant: z.ZodType) {
  if (
    !(variant instanceof z.ZodObject) ||
    !(variant.shape.type instanceof z.ZodLiteral)
  )
    throw new Error(`${channel} has a message without a literal type`);
  const name = variant.shape.type.value;
  if (typeof name !== 'string')
    throw new Error(`${channel} has a non-string message type`);
  const payload = variant.shape.payload;
  if (channel === 'pong' && action === 'send' && name === 'state') {
    return {
      name,
      title: 'Pong binary snapshot',
      description:
        'Decode the Colyseus byte payload with decodeStateSnapshot from @marquinhos/contracts/activity/pong/codec. The versioned little-endian layout starts with a fixed header and includes counted collections.',
      contentType: 'application/octet-stream',
      payload: { type: 'string', format: 'binary' },
      'x-pong-codec': {
        version: PONG_PROTOCOL_VERSION,
        headerBytes: PONG_SNAPSHOT_HEADER_BYTES,
        paddleBytes: PONG_PADDLE_BYTES,
        ballBytes: PONG_BALL_BYTES,
        brickBytes: PONG_BRICK_BYTES,
        powerUpBytes: PONG_POWERUP_BYTES,
      },
    };
  }

  if (channel === 'cards' && (name === 'move' || name === 'state')) {
    const rulesets = cardMoves();
    const moves = z.union(rulesets.flatMap(({ variants }) => variants));
    const wire =
      name === 'move'
        ? moves
        : cards.trucoViewSchema.extend({ legalMoves: z.array(moves) });
    return {
      name,
      description:
        name === 'move'
          ? 'Submit a move defined by the active ruleset. The room also checks seat and turn state.'
          : 'Per-client Truco state including the moves available to the current viewer.',
      payload: payloadSchema(wire, action),
      'x-rulesets': rulesets.map(({ ruleset }) => ruleset),
    };
  }

  return {
    name,
    ...(channel === 'room' && { description: roomDescriptions[name] }),
    ...(payload instanceof z.ZodType && {
      payload: payloadSchema(payload, action),
    }),
  };
}

function channelFor(id: string, protocol: Protocol, description: string) {
  const messages: Record<string, ReturnType<typeof messageFor>> = {};
  const operations: Record<
    string,
    {
      action: Action;
      channel: Reference;
      messages: Reference[];
      security: Reference[];
      summary: string;
    }
  > = {};
  for (const [action, schemas] of [
    ['receive', protocol.clientMessageSchema.options],
    ['send', protocol.serverMessageSchema.options],
  ] as const) {
    const references: Reference[] = [];
    const names = new Set<string>();
    for (const schema of schemas) {
      const message = messageFor(id, action, schema);
      if (names.has(message.name))
        throw new Error(`Duplicate ${action} message ${id}/${message.name}`);
      names.add(message.name);
      const key = `${action}_${message.name}`;
      messages[key] = message;
      references.push({ $ref: `#/channels/${id}/messages/${key}` });
    }
    operations[`${action}_${id}`] = {
      action,
      channel: { $ref: `#/channels/${id}` },
      messages: references,
      security: [{ $ref: '#/components/securitySchemes/seatReservation' }],
      summary:
        action === 'receive'
          ? `Receive ${id} messages from an Activity client`
          : `Send ${id} messages to Activity clients`,
    };
  }

  return {
    channel: {
      address: '/{processId}/{roomId}',
      title: id === 'room' ? 'Shared match controls' : id,
      description,
      servers: [{ $ref: '#/servers/local' }],
      parameters: {
        processId: {
          description: 'Colyseus process ID from the seat reservation.',
        },
        roomId: {
          description: 'Colyseus transport room ID from the seat reservation.',
        },
      },
      messages,
    },
    operations,
  };
}

export function buildAsyncApi() {
  const room = channelFor(
    'room',
    {
      clientMessageSchema: roomClientMessageSchema,
      serverMessageSchema: roomServerMessageSchema,
    },
    'Room controls share the same connection as the active game. The SDK reserves a seat in the match room. Room admission verifies the signed token and room key.',
  );
  const channels: Record<string, typeof room.channel> = { room: room.channel };
  const operations = { ...room.operations };
  for (const game of [...gameIdSchema.options].sort()) {
    const { channel, operations: gameOperations } = channelFor(
      game,
      gameProtocols[game],
      gameDescriptions[game],
    );
    channels[game] = channel;
    Object.assign(operations, gameOperations);
  }

  return {
    asyncapi: '3.0.0',
    info: {
      title: 'Marquinhos Activity room protocol',
      version: '1.0.0',
      description:
        'Application messages inside Colyseus WebSocket frames. Use the Colyseus SDK to reserve a seat and open the socket. These payloads describe decoded application values.',
    },
    defaultContentType: 'application/msgpack',
    servers: {
      local: {
        host: 'localhost:3000',
        protocol: 'ws',
        description:
          'Direct API listener. The Discord Activity connects through its configured Colyseus proxy prefix.',
      },
    },
    channels,
    operations,
    components: {
      securitySchemes: {
        seatReservation: {
          type: 'httpApiKey',
          in: 'query',
          name: 'sessionId',
          description:
            'Colyseus seat reservation ID supplied by the SDK on WebSocket connect. Matchmaking requires the signed Activity room token and matching room key. The SDK supplies a reconnection token when resuming an eligible connection.',
        },
      },
      schemas: {
        CardPropertyValue: {
          description: 'JSON-compatible ruleset-defined card property.',
          anyOf: [
            { type: ['null', 'boolean', 'number', 'string'] },
            {
              type: 'array',
              items: { $ref: '#/components/schemas/CardPropertyValue' },
            },
            {
              type: 'object',
              additionalProperties: {
                $ref: '#/components/schemas/CardPropertyValue',
              },
            },
          ],
        },
      },
    },
  };
}

if (import.meta.main) {
  await writeValidatedSpec('asyncapi', buildAsyncApi(), process.argv[2]);
}
