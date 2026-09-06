import { createHash } from 'crypto';
import {
  AGENT_TASK_SYSTEM_PROMPT,
  GUARDRAIL_ROAST_PROMPT,
  MAIN_CLASSIFY_SYSTEM_PROMPT,
  SUB_CLASSIFIERS,
  THREAD_ASK_SYSTEM_PROMPT,
  THREAD_COMPACTION_PROMPT,
} from 'services/aiChat/prompts';

export interface PromptRef {
  promptId: string;
  sha1: string;
  chars: number;
}

const STATIC_PROMPTS: Record<string, string> = {
  MAIN_CLASSIFY_SYSTEM_PROMPT,
  GUARDRAIL_ROAST_PROMPT,
  AGENT_TASK_SYSTEM_PROMPT,
  THREAD_ASK_SYSTEM_PROMPT,
  THREAD_COMPACTION_PROMPT,
  ...Object.fromEntries(
    Object.entries(SUB_CLASSIFIERS).map(([category, config]) => [
      `SUB_CLASSIFY_${category.toUpperCase()}`,
      config.prompt,
    ]),
  ),
};

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 12);
}

const BY_CONTENT = new Map<string, PromptRef>(
  Object.entries(STATIC_PROMPTS).map(([promptId, prompt]) => [
    prompt,
    { promptId, sha1: sha1(prompt), chars: prompt.length },
  ]),
);

export function describeStaticPrompts(): PromptRef[] {
  return [...BY_CONTENT.values()];
}

export function staticPromptText(): Record<string, string> {
  return STATIC_PROMPTS;
}

/**
 * Static system prompts are constant per deploy, so tracing their full text on
 * every request would drown the dynamic parts we actually need. Exact matches
 * collapse to a reference; anything else (built prompts carrying chat history,
 * user content, tool results) is kept verbatim.
 */
export function summarizeMessages(messages: unknown): unknown {
  if (!Array.isArray(messages)) return messages;
  return messages.map((message) => {
    if (
      typeof message !== 'object' ||
      message === null ||
      typeof (message as { content?: unknown }).content !== 'string'
    ) {
      return message;
    }
    const ref = BY_CONTENT.get((message as { content: string }).content);
    if (!ref) return message;
    return { ...message, content: undefined, promptRef: ref };
  });
}
