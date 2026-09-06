import { describe, expect, it } from 'bun:test';
import { AGENT_CAPABILITIES } from 'services/aiChat/capabilities';
import { AGENT_TOOLS } from 'services/aiChat/tools/registry';

describe('AGENT_CAPABILITIES', () => {
  it('lists every registered tool, so the block cannot drift from the registry', () => {
    for (const tool of AGENT_TOOLS) {
      expect(AGENT_CAPABILITIES).toContain(tool.name);
    }
  });

  it('states that the sandbox has no network and fetch_url is the way out', () => {
    const lower = AGENT_CAPABILITIES.toLowerCase();
    expect(lower).toContain('rede');
    expect(lower).toContain('fetch_url');
  });

  it('names the network binaries that do not exist, since the bot used to offer them', () => {
    for (const binary of ['curl', 'wget', 'traceroute', 'ping']) {
      expect(AGENT_CAPABILITIES).toContain(binary);
    }
  });

  it('documents the languages actually installed in the sandbox image', () => {
    for (const runtime of ['python3', 'bun', 'bash']) {
      expect(AGENT_CAPABILITIES).toContain(runtime);
    }
  });

  it('says the repo mirror is read-only and tracks the last main commit', () => {
    expect(AGENT_CAPABILITIES).toContain('/repo');
    expect(AGENT_CAPABILITIES.toLowerCase()).toMatch(
      /somente leitura|read-only/,
    );
    expect(AGENT_CAPABILITIES).toContain('main');
  });

  it('forbids claiming capabilities outside the list', () => {
    expect(AGENT_CAPABILITIES.toLowerCase()).toContain('nunca');
  });
});
