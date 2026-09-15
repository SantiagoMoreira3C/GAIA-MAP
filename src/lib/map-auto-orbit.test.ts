import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { createAutoOrbit } from './map-auto-orbit';

function fixture() {
  const listeners = new Map<string, Set<(...a: never[]) => void>>();
  let bearing = 0;
  let pitch = 0;
  const map = {
    getBearing: () => bearing,
    getPitch: () => pitch,
    setBearing: vi.fn((b: number) => { bearing = b; }),
    setPitch: vi.fn((p: number) => { pitch = p; }),
    isMoving: () => false,
    isZooming: () => false,
    on: vi.fn((type: string, fn: (...a: never[]) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    off: vi.fn((type: string, fn: (...a: never[]) => void) => listeners.get(type)?.delete(fn)),
  };
  return { map, listeners };
}

describe('map auto orbit 3D', () => {
  let rafCb: FrameRequestCallback | null = null;
  let now = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1000;
    rafCb = null;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    (globalThis as unknown as Record<string, unknown>).requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    };
    (globalThis as unknown as Record<string, unknown>).cancelAnimationFrame = () => { rafCb = null; };
    (globalThis as unknown as Record<string, unknown>).document = { hidden: false };
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete (globalThis as unknown as Record<string, unknown>).document;
  });

  const tick = (ms: number) => {
    now += ms;
    const cb = rafCb;
    rafCb = null;
    cb?.(now);
  };

  it('rota el bearing y fija el pitch 3D', () => {
    const f = fixture();
    const orbit = createAutoOrbit(f.map as unknown as MapLibreMap, {
      speedDegPerSec: 10,
      pitch: 55,
      reducedMotion: () => false,
    });
    tick(1000);
    expect(f.map.setBearing).toHaveBeenCalled();
    expect(f.map.setPitch).toHaveBeenCalledWith(55);
    orbit.dispose();
  });

  it('respeta reduced-motion y no gira', () => {
    const f = fixture();
    const orbit = createAutoOrbit(f.map as unknown as MapLibreMap, {
      reducedMotion: () => true,
    });
    tick(1000);
    expect(f.map.setBearing).not.toHaveBeenCalled();
    orbit.dispose();
  });

  it('setEnabled(false) detiene la órbita', () => {
    const f = fixture();
    const orbit = createAutoOrbit(f.map as unknown as MapLibreMap, {
      reducedMotion: () => false,
    });
    orbit.setEnabled(false);
    tick(1000);
    expect(f.map.setBearing).not.toHaveBeenCalled();
    orbit.dispose();
  });
});
