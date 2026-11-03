import { expect, it } from 'bun:test';
import { buildWordleConversation } from './termoConversation';

it('asks only about an already closed day without mentioning the answer', () => {
  expect(buildWordleConversation('2026-11-02', '2026-11-02')).toBe(
    '💬 Sobre o Terminhos de 02/11/2026: qual tentativa surpreendeu você?',
  );
  expect(buildWordleConversation('2026-11-03', '2026-11-02')).toBeNull();
  expect(buildWordleConversation('2026-02-30', '2026-11-02')).toBeNull();
});
