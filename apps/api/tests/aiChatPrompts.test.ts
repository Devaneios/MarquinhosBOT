import { describe, expect, it } from 'bun:test';
import { AGENT_CAPABILITIES } from 'services/aiChat/capabilities';
import {
  AGENT_TASK_SYSTEM_PROMPT,
  buildResponsePrompt,
  buildRevisionInput,
  buildRevisionPrompt,
  FALLBACK_FORMAT,
  GUARDRAIL_ROAST_PROMPT,
  MAIN_CLASSIFY_SYSTEM_PROMPT,
  mainClassificationSchema,
  resolveSpeakerRole,
  revisionSchema,
  SIGNATURE_LINES,
  SUB_CLASSIFIERS,
} from 'services/aiChat/prompts';
import { AGENT_TOOLS } from 'services/aiChat/tools/registry';
import type { ResponseCategory } from 'services/aiChat/types';

const ALL_CATEGORIES: ResponseCategory[] = [
  'general_question',
  'code_technical_question',
  'trick_riddle',
  'bot_help_info',
  'casual_chat',
  'user_roast_provocation',
  'praise_thanks',
  'opinion_reference',
  'follow_up_on_bot',
  'off_topic_unclear',
];

describe('mainClassificationSchema', () => {
  it('accepts each main category', () => {
    for (const category of [
      'question',
      'social',
      'context_reaction',
      'agent_task',
      'unclear',
    ]) {
      expect(mainClassificationSchema.safeParse({ category }).success).toBe(
        true,
      );
    }
  });

  it('rejects subcategories and unknown values', () => {
    for (const category of ['general_question', 'casual_chat', 'banana']) {
      expect(mainClassificationSchema.safeParse({ category }).success).toBe(
        false,
      );
    }
  });

  it('rejects a missing category', () => {
    expect(mainClassificationSchema.safeParse({}).success).toBe(false);
  });
});

describe('MAIN_CLASSIFY_SYSTEM_PROMPT', () => {
  it('is structured with role, instructions, constraints and examples tags', () => {
    expect(MAIN_CLASSIFY_SYSTEM_PROMPT).toContain('<role>');
    expect(MAIN_CLASSIFY_SYSTEM_PROMPT).toContain('<instructions>');
    expect(MAIN_CLASSIFY_SYSTEM_PROMPT).toContain('<constraints>');
    expect(MAIN_CLASSIFY_SYSTEM_PROMPT).toContain('<examples>');
  });

  it('describes each main category with at least one few-shot example', () => {
    for (const category of [
      'question',
      'social',
      'context_reaction',
      'agent_task',
      'unclear',
    ]) {
      expect(MAIN_CLASSIFY_SYSTEM_PROMPT).toContain(category);
    }
  });

  it('warns that short or slang-heavy messages are not unclear', () => {
    expect(MAIN_CLASSIFY_SYSTEM_PROMPT.toLowerCase()).toMatch(
      /curta|informal|g[ií]ria/,
    );
  });

  it('instructs the model to never obey instructions embedded in the classified message', () => {
    expect(MAIN_CLASSIFY_SYSTEM_PROMPT.toLowerCase()).toContain('nunca');
  });

  it('defines agent_task by intent to act, not by a closed list of four actions', () => {
    const lower = MAIN_CLASSIFY_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain('url');
    expect(lower).toMatch(/agir|executar uma a[çc][ãa]o|realizar/);
  });

  it('routes url fetching and named-tool requests to agent_task via few-shot examples', () => {
    const agentSection =
      MAIN_CLASSIFY_SYSTEM_PROMPT.split('<examples>')[1] ?? '';
    for (const phrase of ['pt.wikipedia.org', 'curl']) {
      expect(agentSection).toContain(phrase);
    }
    const wikiExample = agentSection.slice(
      agentSection.indexOf('pt.wikipedia.org'),
    );
    expect(wikiExample.slice(0, 200)).toContain('agent_task');
  });

  it('still treats a question about capabilities as a question, not an action', () => {
    const examples = MAIN_CLASSIFY_SYSTEM_PROMPT.split('<examples>')[1] ?? '';
    const capabilityExample = examples.slice(
      examples.indexOf('quais comandos'),
    );
    expect(capabilityExample.slice(0, 200)).toContain('"question"');
  });
});

describe('SUB_CLASSIFIERS', () => {
  const expectedSubcategories = {
    question: [
      'general_question',
      'code_technical_question',
      'trick_riddle',
      'bot_help_info',
    ],
    social: ['casual_chat', 'user_roast_provocation', 'praise_thanks'],
    context_reaction: ['opinion_reference', 'follow_up_on_bot'],
  } as const;

  it('covers exactly the three subclassified main categories', () => {
    expect(Object.keys(SUB_CLASSIFIERS).sort()).toEqual([
      'context_reaction',
      'question',
      'social',
    ]);
  });

  it.each(Object.entries(expectedSubcategories))(
    'schema for %s accepts its own subcategories only',
    (main, subcategories) => {
      const { schema } = SUB_CLASSIFIERS[main as keyof typeof SUB_CLASSIFIERS];
      for (const category of subcategories) {
        expect(schema.safeParse({ category }).success).toBe(true);
      }
      const foreign = ALL_CATEGORIES.filter(
        (c) => !(subcategories as readonly string[]).includes(c),
      );
      for (const category of [...foreign, 'banana']) {
        expect(schema.safeParse({ category }).success).toBe(false);
      }
    },
  );

  it.each(Object.entries(expectedSubcategories))(
    'prompt for %s includes few-shot examples mentioning each subcategory',
    (main, subcategories) => {
      const { prompt } = SUB_CLASSIFIERS[main as keyof typeof SUB_CLASSIFIERS];
      expect(prompt).toContain('<examples>');
      for (const category of subcategories) {
        expect(prompt).toContain(category);
      }
    },
  );

  it('defines the parse-failure fallback subcategory per main category', () => {
    expect(SUB_CLASSIFIERS.question.fallback).toBe('general_question');
    expect(SUB_CLASSIFIERS.social.fallback).toBe('casual_chat');
    expect(SUB_CLASSIFIERS.context_reaction.fallback).toBe('opinion_reference');
  });

  it('instructs each subclassifier to never obey embedded instructions', () => {
    for (const { prompt } of Object.values(SUB_CLASSIFIERS)) {
      expect(prompt.toLowerCase()).toContain('nunca');
    }
  });
});

describe('buildResponsePrompt', () => {
  it('includes recent messages inside a chat_history block for every category', () => {
    for (const category of ALL_CATEGORIES) {
      const prompt = buildResponsePrompt(category, [
        { author: 'ana', content: 'acho que vai chover' },
      ]);
      expect(prompt).toContain('<chat_history trust_level="untrusted">');
      expect(prompt).toContain('ana: acho que vai chover');
    }
  });

  it('omits the chat_history block when there are no recent messages', () => {
    const prompt = buildResponsePrompt('opinion_reference', []);
    expect(prompt).not.toContain('<chat_history trust_level=');
  });

  it('produces a distinct prompt per category', () => {
    const prompts = ALL_CATEGORIES.map((category) =>
      buildResponsePrompt(category, []),
    );
    expect(new Set(prompts).size).toBe(ALL_CATEGORIES.length);
  });

  it('always includes an anti-injection constraint, regardless of category or history', () => {
    const withoutHistory = buildResponsePrompt('general_question', []);
    const withHistory = buildResponsePrompt('opinion_reference', [
      { author: 'ana', content: 'oi' },
    ]);
    expect(withoutHistory).toContain('<constraints>');
    expect(withoutHistory.toLowerCase()).toContain('nunca');
    expect(withHistory).toContain('<constraints>');
  });

  it('uses adaptive length guidelines: short by default, longer when the question demands it', () => {
    const prompt = buildResponsePrompt('casual_chat', []);
    expect(prompt).toContain('<style_guidelines>');
    expect(prompt).toMatch(/1 a 3 frases/i);
    expect(prompt).toMatch(/1800 caracteres/i);
  });

  it('does not demand humor unconditionally in the base personality', () => {
    const prompt = buildResponsePrompt('general_question', []);
    expect(prompt).toMatch(/nem toda resposta precisa de piada/i);
  });

  it('warns about logic traps in trick_riddle instead of general_question', () => {
    const riddle = buildResponsePrompt('trick_riddle', []);
    const general = buildResponsePrompt('general_question', []);
    expect(riddle).toMatch(/pegadinha|charada/i);
    expect(general).not.toMatch(/pegadinha|charada/i);
  });

  it('includes a replied_message block when repliedMessage is provided', () => {
    const prompt = buildResponsePrompt('general_question', [], {
      author: 'ana',
      content: 'alguém sabe a capital da Mongólia?',
    });
    expect(prompt).toContain('<replied_message trust_level="untrusted">');
    expect(prompt).toContain('ana: alguém sabe a capital da Mongólia?');
  });

  it('omits the replied_message block when repliedMessage is not provided', () => {
    const prompt = buildResponsePrompt('general_question', []);
    expect(prompt).not.toContain('<replied_message');
  });

  it('includes a server_knowledge block when knowledgeBaseContext is provided', () => {
    const prompt = buildResponsePrompt(
      'general_question',
      [],
      undefined,
      undefined,
      'fazendeiro é o mantenedor atual do Marquinhos',
    );
    expect(prompt).toContain('<server_knowledge trust_level="untrusted">');
    expect(prompt).toContain('fazendeiro é o mantenedor atual do Marquinhos');
  });

  it('omits the server_knowledge block when knowledgeBaseContext is not provided', () => {
    const prompt = buildResponsePrompt('general_question', []);
    expect(prompt).not.toContain('<server_knowledge');
  });
});

describe('BASE_PERSONALITY (via buildResponsePrompt)', () => {
  it('anchors identity in the dictator/motel persona, not a generic assistant', () => {
    const prompt = buildResponsePrompt('casual_chat', []);
    expect(prompt).toMatch(/motel/i);
    expect(prompt).toMatch(/autorit[aá]rio|ditador/i);
    expect(prompt).toMatch(/incorrupt[íi]vel/i);
  });

  it('never breaks character to admit being an AI/LLM', () => {
    const prompt = buildResponsePrompt('casual_chat', []);
    expect(prompt.toLowerCase()).toMatch(
      /nunca (diz|revela|admite).{0,40}(ia|intelig[êe]ncia artificial|llm|modelo)/,
    );
  });

  it('forbids apologizing for being rude or offering further help like a support bot', () => {
    const prompt = buildResponsePrompt('casual_chat', []);
    expect(prompt.toLowerCase()).toMatch(/n[aã]o pede desculpa/);
    expect(prompt.toLowerCase()).toMatch(/posso ajudar com mais alguma coisa/);
  });
});

describe('SIGNATURE_LINES', () => {
  it('includes the canonical catchphrases from the persona doc', () => {
    expect(SIGNATURE_LINES).toContain('Trouxa, eu sou filho do Rei');
    expect(SIGNATURE_LINES).toContain(
      'E desde quando preso tem a chave da cela?',
    );
    expect(SIGNATURE_LINES).toContain('é o caralho');
    expect(SIGNATURE_LINES).toContain('quebrei');
  });

  it('instructs sparing, unforced use — never more than once per reply', () => {
    const lower = SIGNATURE_LINES.toLowerCase();
    expect(lower).toMatch(/raramente|com parcim[oô]nia/);
    expect(lower).toMatch(/nunca for[cç]ad[oa]/);
  });

  it('is included in response prompts but not in the revision prompt', () => {
    const responsePrompt = buildResponsePrompt('casual_chat', []);
    const revisionPrompt = buildRevisionPrompt('casual_chat');
    expect(responsePrompt).toContain('Trouxa, eu sou filho do Rei');
    expect(revisionPrompt).not.toContain('Trouxa, eu sou filho do Rei');
  });
});

describe('praise_thanks: inversion pattern', () => {
  it('instructs deflecting the compliment back to the person instead of thanking them', () => {
    const instruction = buildResponsePrompt('praise_thanks', []);
    expect(instruction.toLowerCase()).toMatch(/devolv/);
    expect(instruction.toLowerCase()).not.toMatch(
      /aceite de forma natural e curta/,
    );
  });
});

describe('user_roast_provocation: disdain over generic humor', () => {
  it('leads with dry authoritarian disdain rather than "tirada afiada e bem-humorada"', () => {
    const instruction = buildResponsePrompt('user_roast_provocation', []);
    expect(instruction.toLowerCase()).toMatch(/desd[eé]m/);
  });

  it('keeps the asymmetry: rough with the group, never cruel to the individual', () => {
    const instruction = buildResponsePrompt('user_roast_provocation', []);
    expect(instruction.toLowerCase()).toMatch(/nunca [ée] cruel|nunca cruel/);
  });
});

describe('buildResponsePrompt speakerRole hierarchy note', () => {
  it('adds a note about the King/creator when speakerRole is "king"', () => {
    const prompt = buildResponsePrompt('casual_chat', [], undefined, 'king');
    expect(prompt).toMatch(/rei|avalonn/i);
  });

  it('adds a note about the dev when speakerRole is "dev"', () => {
    const prompt = buildResponsePrompt('casual_chat', [], undefined, 'dev');
    expect(prompt).toMatch(/fazendeiro|c[oó]digo/i);
  });

  it('adds a note about eriquinho when speakerRole is "eriquinho"', () => {
    const prompt = buildResponsePrompt(
      'casual_chat',
      [],
      undefined,
      'eriquinho',
    );
    expect(prompt).toMatch(/eriquinho|vice-dono/i);
  });

  it('adds a note about chato when speakerRole is "chato"', () => {
    const prompt = buildResponsePrompt('casual_chat', [], undefined, 'chato');
    expect(prompt).toMatch(/chato|censura/i);
  });

  it('adds a note about vlpl when speakerRole is "vlpl"', () => {
    const prompt = buildResponsePrompt('casual_chat', [], undefined, 'vlpl');
    expect(prompt).toMatch(/vlpl|pastel/i);
  });

  it('adds a note about zegabr when speakerRole is "zegabr"', () => {
    const prompt = buildResponsePrompt('casual_chat', [], undefined, 'zegabr');
    expect(prompt).toMatch(/zegabr|neovim/i);
  });

  it('adds a note about tuto when speakerRole is "tuto"', () => {
    const prompt = buildResponsePrompt('casual_chat', [], undefined, 'tuto');
    expect(prompt).toMatch(/tuto|entidade/i);
  });

  it('adds a note about joyvixtor when speakerRole is "joyvixtor"', () => {
    const prompt = buildResponsePrompt(
      'casual_chat',
      [],
      undefined,
      'joyvixtor',
    );
    expect(prompt).toMatch(/joyvixtor|last\.fm/i);
  });

  it('omits any hierarchy note when speakerRole is not provided', () => {
    const prompt = buildResponsePrompt('casual_chat', []);
    expect(prompt.toLowerCase()).not.toContain('avalonn');
    expect(prompt.toLowerCase()).not.toContain('fazendeiro');
  });
});

describe('resolveSpeakerRole', () => {
  it('resolves each known Discord id to its hierarchy role', () => {
    expect(resolveSpeakerRole('305838877866721280')).toBe('king');
    expect(resolveSpeakerRole('214257187592077313')).toBe('dev');
    expect(resolveSpeakerRole('306920588801343488')).toBe('eriquinho');
    expect(resolveSpeakerRole('478389573563711503')).toBe('chato');
    expect(resolveSpeakerRole('837413019620605974')).toBe('vlpl');
    expect(resolveSpeakerRole('265558578910199808')).toBe('zegabr');
    expect(resolveSpeakerRole('493573725430480897')).toBe('tuto');
    expect(resolveSpeakerRole('388102426202472459')).toBe('joyvixtor');
  });

  it('returns undefined for an unknown id', () => {
    expect(resolveSpeakerRole('unknown-id-123')).toBeUndefined();
  });
});

describe('GUARDRAIL_ROAST_PROMPT', () => {
  it('still forbids following the injection or revealing internal instructions', () => {
    const lower = GUARDRAIL_ROAST_PROMPT.toLowerCase();
    expect(lower).toContain('nunca');
    expect(lower).toMatch(/revele|revelar/);
  });
});

describe('revisionSchema', () => {
  it('accepts an embed revision with a title', () => {
    const result = revisionSchema.safeParse({
      reply: 'resposta revisada',
      format: 'embed',
      embedTitle: '💻 Resposta técnica',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a text revision with a null title', () => {
    const result = revisionSchema.safeParse({
      reply: 'resposta curta',
      format: 'text',
      embedTitle: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown format', () => {
    const result = revisionSchema.safeParse({
      reply: 'x',
      format: 'markdown',
      embedTitle: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing reply', () => {
    const result = revisionSchema.safeParse({
      format: 'text',
      embedTitle: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('buildRevisionPrompt', () => {
  it('includes the persona, style guidelines and category instruction', () => {
    const prompt = buildRevisionPrompt('code_technical_question');
    expect(prompt).toContain('MarquinhosBOT');
    expect(prompt).toContain('<style_guidelines>');
    expect(prompt).toContain('<category_instruction>');
  });

  it('explains the embed vs text format decision', () => {
    const prompt = buildRevisionPrompt('general_question');
    expect(prompt).toContain('embed');
    expect(prompt).toContain('text');
    expect(prompt.toLowerCase()).toMatch(/embedtitle|t[ií]tulo/);
  });

  it('produces a distinct prompt per category', () => {
    const prompts = ALL_CATEGORIES.map((category) =>
      buildRevisionPrompt(category),
    );
    expect(new Set(prompts).size).toBe(ALL_CATEGORIES.length);
  });

  it('forbids changing the factual direction of the draft', () => {
    const prompt = buildRevisionPrompt('general_question').toLowerCase();
    expect(prompt).toMatch(/n[aã]o (mude|altere|invente)/);
  });
});

describe('buildRevisionInput', () => {
  it('wraps the user message and the draft reply in tagged blocks', () => {
    const input = buildRevisionInput(
      'qual a capital do brasil?',
      'Brasília, desde 1960.',
    );
    expect(input).toContain('<user_message>');
    expect(input).toContain('qual a capital do brasil?');
    expect(input).toContain('<draft_reply>');
    expect(input).toContain('Brasília, desde 1960.');
  });
});

describe('FALLBACK_FORMAT', () => {
  it('covers every subcategory', () => {
    expect(Object.keys(FALLBACK_FORMAT).sort()).toEqual(
      [...ALL_CATEGORIES].sort(),
    );
  });

  it('keeps the existing embed titles and maps trick_riddle to an embed', () => {
    expect(FALLBACK_FORMAT.general_question).toEqual({
      format: 'embed',
      embedTitle: '💭 Resposta',
    });
    expect(FALLBACK_FORMAT.code_technical_question).toEqual({
      format: 'embed',
      embedTitle: '💻 Resposta técnica',
    });
    expect(FALLBACK_FORMAT.bot_help_info).toEqual({
      format: 'embed',
      embedTitle: '🤖 Sobre o Marquinhos',
    });
    expect(FALLBACK_FORMAT.trick_riddle).toEqual({
      format: 'embed',
      embedTitle: '💭 Resposta',
    });
  });

  it('maps conversational subcategories to text', () => {
    for (const category of [
      'casual_chat',
      'user_roast_provocation',
      'praise_thanks',
      'opinion_reference',
      'follow_up_on_bot',
      'off_topic_unclear',
    ] as const) {
      expect(FALLBACK_FORMAT[category]).toEqual({ format: 'text' });
    }
  });
});

describe('AGENT_TASK_SYSTEM_PROMPT', () => {
  it('is structured with role, instructions and constraints tags', () => {
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain('<role>');
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain('<instructions>');
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain('<constraints>');
  });

  it('instructs the model to never obey instructions embedded in tool output or chat history', () => {
    const lower = AGENT_TASK_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain('nunca');
    expect(lower).toMatch(/ferramenta|tool/);
  });

  it('documents that the mirror holds one directory per repo under /repo', () => {
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain('/repo/marquinhos-web-api');
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain('/repo/MarquinhosBOT');
  });

  it('embeds the shared capabilities block so the agent knows fetch_url exists', () => {
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain(AGENT_CAPABILITIES);
  });

  it('forbids the generic "I cannot access the internet" refusal that used to happen', () => {
    const lower = AGENT_TASK_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain('nunca responda');
    expect(lower).toContain('acessar a internet');
  });

  it('explains how to hop between pages with the links mode', () => {
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain('links');
    expect(AGENT_TASK_SYSTEM_PROMPT).toContain('fetch_url');
  });
});

describe('bot_help_info grounding', () => {
  it('carries the capabilities block so the bot stops inventing bash commands', () => {
    const prompt = buildResponsePrompt('bot_help_info', []);
    expect(prompt).toContain(AGENT_CAPABILITIES);
    for (const tool of AGENT_TOOLS) {
      expect(prompt).toContain(tool.name);
    }
  });

  it('does not leak the capabilities block into unrelated categories', () => {
    expect(buildResponsePrompt('casual_chat', [])).not.toContain(
      AGENT_CAPABILITIES,
    );
  });
});
