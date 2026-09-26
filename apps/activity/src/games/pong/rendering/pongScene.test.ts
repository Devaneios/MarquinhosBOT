import { describe, expect, it, mock } from 'bun:test';

const applications: Array<{
  initCalls: number;
  destroyCalls: number;
  addedTicks: Array<() => void>;
  removedTicks: Array<() => void>;
}> = [];

mock.module('pixi.js', () => {
  class Graphics {
    position = { set() {} };
    scale = { set() {} };
    clear() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    stroke() {
      return this;
    }
    rect() {
      return this;
    }
    fill() {
      return this;
    }
    roundRect() {
      return this;
    }
    circle() {
      return this;
    }
  }
  class BlurFilter {}
  class Application {
    stage = { addChild() {}, position: { set() {} } };
    renderer = { resize() {} };
    record = {
      initCalls: 0,
      destroyCalls: 0,
      addedTicks: [] as Array<() => void>,
      removedTicks: [] as Array<() => void>,
    };
    ticker = {
      deltaMS: 16,
      add: (callback: () => void) => this.record.addedTicks.push(callback),
      remove: (callback: () => void) => this.record.removedTicks.push(callback),
      start() {},
      stop() {},
    };
    constructor() {
      applications.push(this.record);
    }
    async init() {
      this.record.initCalls += 1;
    }
    destroy() {
      this.record.destroyCalls += 1;
    }
  }
  return { Application, BlurFilter, Graphics };
});

describe('Pong scene lifecycle', () => {
  it('cancels the StrictMode mount before init and disposes the remount', async () => {
    const { createPongScene, DEFAULT_CONFIG } = await import('./pongScene');
    const options = {
      canvas: document.createElement('canvas'),
      getTimer: () => null,
      getFrame: () => ({
        config: DEFAULT_CONFIG,
        state: null,
        leftY: null,
        rightY: null,
        elapsedMs: null,
      }),
      onResume: () => {},
    };

    const firstMount = createPongScene(options);
    firstMount.dispose();
    const secondMount = createPongScene(options);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(applications).toHaveLength(2);
    expect(applications[0]?.initCalls).toBe(0);
    expect(applications[0]?.destroyCalls).toBe(0);
    expect(applications[1]?.initCalls).toBe(1);
    expect(applications[1]?.addedTicks).toHaveLength(1);

    secondMount.dispose();
    expect(applications[1]?.removedTicks).toHaveLength(1);
    expect(applications[1]?.destroyCalls).toBe(1);
  });
});
