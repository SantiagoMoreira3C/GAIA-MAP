import type { Map as MapLibreMap } from 'maplibre-gl';

export interface AutoOrbitOptions {
  /** Grados por segundo del giro de bearing. Default 5. */
  speedDegPerSec?: number;
  /** Pitch 3D objetivo. Default 55. */
  pitch?: number;
  /** Ms de espera tras interacción antes de retomar. Default 3000. */
  resumeDelayMs?: number;
  /** Cuando true, no gira (respeta prefers-reduced-motion). */
  reducedMotion?: () => boolean;
  /** Cuando true, pausa la órbita (navegando, follow, dibujo, etc). */
  shouldPause?: () => boolean;
  /** Llamado al pausar/retomar, para sincronizar UI. */
  onStateChange?: (orbiting: boolean) => void;
}

export const MANTA_FOCUS = { lat: -0.963, lng: -80.712, zoom: 13.5, pitch: 55 } as const;

/**
 * Órbita 3D automática: rota el bearing con requestAnimationFrame y mantiene
 * el pitch inclinado. Se pausa ante cualquier gesto del usuario y retoma solo
 * tras `resumeDelayMs`. No usa flyTo/easeTo en loop para no pelear con la
 * cámara (solo setBearing/setPitch directos por frame).
 */
export function createAutoOrbit(map: MapLibreMap, opts: AutoOrbitOptions = {}) {
  const {
    speedDegPerSec = 5,
    pitch = 55,
    resumeDelayMs = 3000,
    reducedMotion = () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    shouldPause = () => false,
    onStateChange,
  } = opts;

  let enabled = true;
  let userHold = false;
  let raf: number | undefined;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  let lastTime = 0;
  let disposed = false;
  let orbiting = false;

  const setOrbiting = (v: boolean) => {
    if (orbiting === v) return;
    orbiting = v;
    onStateChange?.(v);
  };

  const frame = (time: number) => {
    if (disposed || !enabled) return;
    raf = requestAnimationFrame(frame);
    if (userHold || document.hidden || reducedMotion() || shouldPause()) {
      setOrbiting(false);
      lastTime = time;
      return;
    }
    // No girar mientras el mapa está en una animación propia (flyTo/easeTo).
    try {
      if (map.isMoving() || map.isZooming()) {
        lastTime = time;
        setOrbiting(false);
        return;
      }
    } catch { /* mapa aún no listo */ }
    const dt = Math.min(100, time - (lastTime || time));
    lastTime = time;
    try {
      const next = (map.getBearing() + (speedDegPerSec * dt) / 1000) % 360;
      map.setBearing(next);
      if (Math.abs(map.getPitch() - pitch) > 0.5) map.setPitch(pitch);
      setOrbiting(true);
    } catch {
      setOrbiting(false);
    }
  };

  const pauseForInteraction = () => {
    userHold = true;
    setOrbiting(false);
    if (resumeTimer) clearTimeout(resumeTimer);
  };

  const scheduleResume = () => {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      userHold = false;
      lastTime = performance.now();
    }, resumeDelayMs);
  };

  const onInteractStart = () => pauseForInteraction();
  const onInteractEnd = () => scheduleResume();

  // Gestos reales del usuario (con originalEvent). Las animaciones propias
  // (flyTo con essential:true) no traen originalEvent y no pausan de más.
  const events: Array<[string, (...a: never[]) => void]> = [
    ['dragstart', onInteractStart as (...a: never[]) => void],
    ['dragend', onInteractEnd as (...a: never[]) => void],
    ['pitchstart', onInteractStart as (...a: never[]) => void],
    ['pitchend', onInteractEnd as (...a: never[]) => void],
    ['rotatestart', onInteractStart as (...a: never[]) => void],
    ['rotateend', onInteractEnd as (...a: never[]) => void],
    ['wheel', onInteractStart as (...a: never[]) => void],
  ];
  // `wheel` no tiene fin claro: programa retoma en cada tick.
  const onWheel = () => {
    pauseForInteraction();
    scheduleResume();
  };

  for (const [ev] of events) {
    try {
      if (ev === 'wheel') map.on(ev as 'wheel', onWheel as never);
      else map.on(ev as 'dragstart', (ev === 'dragend' ? onInteractEnd : onInteractStart) as never);
    } catch { /* evento no soportado en esta versión */ }
  }
  const onContext = () => {
    pauseForInteraction();
    scheduleResume();
  };
  try {
    map.on('contextmenu', onContext as never);
  } catch { /* noop */ }

  lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  raf = requestAnimationFrame(frame);

  return {
    /** Activa/desactiva el giro sin desmontar listeners. */
    setEnabled(v: boolean) {
      enabled = v;
      if (!v) {
        setOrbiting(false);
        if (raf) cancelAnimationFrame(raf);
        raf = undefined;
      } else if (raf === undefined && !disposed) {
        lastTime = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    get orbiting() {
      return orbiting;
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (resumeTimer) clearTimeout(resumeTimer);
      try {
        map.off('dragstart', onInteractStart as never);
        map.off('dragend', onInteractEnd as never);
        map.off('pitchstart', onInteractStart as never);
        map.off('pitchend', onInteractEnd as never);
        map.off('rotatestart', onInteractStart as never);
        map.off('rotateend', onInteractEnd as never);
        map.off('wheel', onWheel as never);
        map.off('contextmenu', onContext as never);
      } catch { /* noop */ }
    },
  };
}

export type AutoOrbit = ReturnType<typeof createAutoOrbit>;
