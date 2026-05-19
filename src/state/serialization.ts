import type { GearDesignState } from '../core/gearTypes';

export function serializeState(state: GearDesignState): string {
  return btoa(JSON.stringify(state));
}

export function deserializeState(hash: string): GearDesignState | null {
  if (!hash) return null;
  try {
    const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
    return JSON.parse(atob(cleaned)) as GearDesignState;
  } catch {
    return null;
  }
}

export function syncToUrl(state: GearDesignState): void {
  window.location.hash = serializeState(state);
}

export function loadFromUrl(): GearDesignState | null {
  return deserializeState(window.location.hash);
}
