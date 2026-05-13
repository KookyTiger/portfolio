let items = [];
let weights = {};
let loaded = false;

export async function loadFlushPool() {
  try {
    const data = await fetch('/data/flush-pool.json').then(r => r.json());
    items = data.items;
    weights = data.weights;
    loaded = true;
  } catch (e) {
    console.warn('Failed to load flush pool:', e);
  }
}

export function getRandomFlush() {
  if (!loaded || items.length === 0) {
    return { id: 'fallback', category: 'note', text: 'The toilet gurgles mysteriously.' };
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;

  let selectedCategory = 'note';
  for (const [cat, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) { selectedCategory = cat; break; }
  }

  const pool = items.filter(i => i.category === selectedCategory);
  if (pool.length === 0) return items[Math.floor(Math.random() * items.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}
