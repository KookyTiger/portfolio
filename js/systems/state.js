const KEY = 'kookytiger_v5';

const defaults = {
  visitorName: '',
  tokens: 0,
  multiplier: 1.0,
  plantStages: {},
  fedNutrients: [],
  flushCount: 0,
  hasVisited: false,
};

let state = { ...defaults };

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...defaults, ...saved };
    }
  } catch (e) {
    state = { ...defaults };
  }
  return state;
}

export function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {}
}

export function getState() { return state; }

export function updateState(changes) {
  Object.assign(state, changes);
  saveState();
}
