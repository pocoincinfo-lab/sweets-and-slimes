import { GameState } from '../types/game';
import { createInitialGameState } from './world';

const SAVE_KEY = 'sweets_and_slimes_save_v3';

export function saveGameState(state: GameState): boolean {
  try {
    const snapshot: GameState = {
      ...state,
      particles: [],
      floatingTexts: [],
      productionHistory: state.productionHistory.slice(-200),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadGameState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialGameState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || !parsed.tiles || !parsed.buildings || !parsed.rocket) {
      return createInitialGameState();
    }
    if (!parsed.simSpeed) {
      parsed.simSpeed = 1;
    }
    if (typeof parsed.coins !== 'number') {
      parsed.coins = 600;
    }
    return parsed;
  } catch {
    return createInitialGameState();
  }
}

export function clearSavedGameState(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore storage restrictions
  }
}
