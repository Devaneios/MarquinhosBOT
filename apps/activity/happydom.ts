import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterEach } from 'bun:test';

GlobalRegistrator.register();

// @testing-library/dom's `screen` binds to globalThis.document at module
// EVALUATION time (not lazily) — if @testing-library/react were imported
// with a static top-level import here, ESM hoisting would evaluate it
// before GlobalRegistrator.register() above ever runs, permanently binding
// `screen`'s queries to throwing stubs for the rest of the process. The
// dynamic import below forces it to load only after the DOM is registered.
const { cleanup } = await import('@testing-library/react');

// @testing-library/react's own auto-cleanup only registers itself under
// jest/vitest (it detects those test frameworks specifically), not
// bun:test — without this, every render() in every test file stacks up in
// the same document.body for the life of the process, since nothing ever
// unmounts previous tests' trees.
afterEach(() => {
  cleanup();
});
