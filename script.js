/* ============================================
   KOOKYTIGER PORTFOLIO — script.js
   All systems: entry, modes, tokens, pet care,
   tiger behavior, chat, overlays
   ============================================ */

/* ════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════ */
const State = (function () {
  const KEY = 'kookytiger_state';
  const DEFAULTS = {
    visitorName: '',
    mode: null,
    tokens: 0,
    multiplier: 1.0,
    exploredPct: 0,
    exploredItems: {},
    unlockedChat: false,
    unlockedFridge: false,
    unlockedWardrobe: false,
    inventoryFood: [],
    inventoryClothes: [],
    wornClothes: [],
    tigerMood: 'happy',
    easterEggsFound: [],
    chatLog: [],
    lastVisit: null,
  };

  function load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function get(k) { return load()[k]; }
  function set(k, v) { const d = load(); d[k] = v; save(d); }
  function update(patch) { save({ ...load(), ...patch }); }
  function all() { return load(); }
  function reset() { localStorage.removeItem(KEY); location.reload(); }

  return { get, set, update, all, reset };
})();

/* ════════════════════════════════════════════
   DATA LOADER
   ════════════════════════════════════════════ */
let PROJECTS = [];
let ABOUT = {};
let SKILLS = {};

async function loadData() {
  try {
    const [pRes, aRes, sRes] = await Promise.all([
      fetch('data/projects.json'),
      fetch('data/about.json'),
      fetch('data/skills.json'),
    ]);
    PROJECTS = await pRes.json();
    ABOUT = await aRes.json();
    SKILLS = await sRes.json();
  } catch (e) {
    console.warn('Data load failed, using empty defaults', e);
    PROJECTS = [];
    ABOUT = {};
    SKILLS = {};
  }
}

/* ════════════════════════════════════════════
   TOKEN ENGINE
   ════════════════════════════════════════════ */
const TokenEngine = (function () {
  let running = false;
  let interval = null;

  function start() {
    if (running) return;
    running = true;
    interval = setInterval(() => {
      if (document.hidden) return;
      const s = State.all();
      const gain = Math.round(1000 * s.multiplier);
      State.set('tokens', s.tokens + gain);
      updateTokenDisplay(s.tokens + gain);
    }, 1000);
  }

  function addReward(amount) {
    const cur = State.get('tokens');
    State.set('tokens', cur + amount);
    updateTokenDisplay(cur + amount);
  }

  function addMultiplier(amount) {
    const cur = State.get('multiplier');
    State.set('multiplier', cur + amount);
  }

  function spend(amount) {
    const cur = State.get('tokens');
    if (cur < amount) return false;
    State.set('tokens', cur - amount);
    updateTokenDisplay(cur - amount);
    return true;
  }

  function stop() { running = false; clearInterval(interval); }

  return { start, addReward, addMultiplier, spend, stop };
})();

function updateTokenDisplay(val) {
  const el = document.getElementById('token-value');
  if (el) el.textContent = val.toLocaleString();
}

/* ════════════════════════════════════════════
   EXPLORED TRACKER
   ════════════════════════════════════════════ */
const ExploreTracker = (function () {
  const WEIGHTS = {
    project: 5,
    section: 2,
    about: 5,
    contact: 2,
    blackboard: 5,
    easter: 2,
    fridge_open: 1,
    wardrobe_open: 1,
  };

  function markExplored(key, type) {
    const items = State.get('exploredItems') || {};
    if (items[key]) return;
    items[key] = true;
    State.set('exploredItems', items);
    recalc();

    if (type === 'project') {
      TokenEngine.addReward(10000);
      TokenEngine.addMultiplier(0.1);
    } else if (type === 'section') {
      TokenEngine.addReward(50000);
      TokenEngine.addMultiplier(0.5);
    } else if (type === 'easter') {
      TokenEngine.addReward(100000);
      TokenEngine.addMultiplier(1.0);
    } else if (type === 'about') {
      TokenEngine.addReward(10000);
      TokenEngine.addMultiplier(0.3);
    } else if (type === 'contact') {
      TokenEngine.addReward(10000);
    } else if (type === 'blackboard') {
      TokenEngine.addReward(250000);
    }
  }

  function recalc() {
    const items = State.get('exploredItems') || {};
    let total = 0;
    for (const key in items) {
      const type = key.split(':')[0];
      total += WEIGHTS[type] || 1;
    }
    const pct = Math.min(100, total);
    State.set('exploredPct', pct);
    updateExploredUI(pct);
    checkUnlocks(pct);
  }

  function checkUnlocks(pct) {
    if (pct >= 10 && !State.get('unlockedChat')) {
      State.set('unlockedChat', true);
      unlockIcon('btn-chat');
    }
    if (pct >= 30 && !State.get('unlockedFridge')) {
      State.set('unlockedFridge', true);
      unlockIcon('btn-fridge');
    }
    if (pct >= 50 && !State.get('unlockedWardrobe')) {
      State.set('unlockedWardrobe', true);
      unlockIcon('btn-wardrobe');
    }
  }

  function unlockIcon(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('locked');
    el.classList.add('unlocking');
    setTimeout(() => el.classList.remove('unlocking'), 600);
  }

  function init() {
    recalc();
  }

  return { markExplored, init };
})();

function updateExploredUI(pct) {
  const fill = document.getElementById('explored-fill');
  const label = document.getElementById('explored-pct');
  if (fill) {
    const circumference = 2 * Math.PI * 20;
    fill.style.strokeDashoffset = circumference * (1 - pct / 100);
  }
  if (label) label.textContent = Math.round(pct) + '%';
}

/* ════════════════════════════════════════════
   SECTION MAP
   ════════════════════════════════════════════ */
const SECTION_MAP = {
  product: { label: 'Product Design', bodyPart: 'paws' },
  visual: { label: 'Visual Design', bodyPart: 'left-eye' },
  film: { label: 'Film', bodyPart: 'right-eye' },
  experience: { label: 'Experience Design', bodyPart: 'brain' },
  philosophy: { label: 'Design Philosophy', bodyPart: 'heart' },
};

const ZONE_TO_SECTION = {
  paws: 'product',
  'left-eye': 'visual',
  'right-eye': 'film',
  brain: 'experience',
  heart: 'philosophy',
};

/* ════════════════════════════════════════════
   ENTRY FLOW
   ════════════════════════════════════════════ */
function initEntry() {
  const overlay = document.getElementById('entry-overlay');
  if (!overlay) return;

  const name = State.get('visitorName');
  if (name) {
    overlay.remove();
    startHub();
    return;
  }

  const input = document.getElementById('name-input');
  const helloStep = document.getElementById('entry-hello');
  const greetingStep = document.getElementById('entry-greeting');

  let fallbackTimer = setTimeout(() => submitName('friend'), 8000);

  input.addEventListener('focus', () => {
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (!input.value.trim()) submitName('friend');
    }, 3000);
  });

  input.addEventListener('input', () => {
    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      if (!input.value.trim()) submitName('friend');
    }, 3000);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      clearTimeout(fallbackTimer);
      submitName(input.value.trim());
    }
  });

  function submitName(n) {
    clearTimeout(fallbackTimer);
    State.set('visitorName', n);
    State.set('lastVisit', new Date().toISOString());

    helloStep.classList.remove('active');
    greetingStep.classList.add('active');
    document.getElementById('greeting-text').textContent = `Nice to meet u, ${n}.`;

    document.getElementById('mode-quick').addEventListener('click', () => pickMode('quick'));
    document.getElementById('mode-hangout').addEventListener('click', () => pickMode('hangout'));
  }

  function pickMode(mode) {
    State.set('mode', mode);
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.remove();
      startHub(mode);
    }, 600);
  }
}

/* ════════════════════════════════════════════
   HUB INIT
   ════════════════════════════════════════════ */
function startHub(mode) {
  const m = mode || State.get('mode') || 'hangout';
  TokenEngine.start();
  ExploreTracker.init();
  initTigerBehavior();
  initHUD(m);

  if (m === 'quick') {
    openBlackboard();
  } else {
    initMode2();
  }

  const s = State.all();
  updateTokenDisplay(s.tokens);

  if (s.unlockedChat) document.getElementById('btn-chat')?.classList.remove('locked');
  if (s.unlockedFridge) document.getElementById('btn-fridge')?.classList.remove('locked');
  if (s.unlockedWardrobe) document.getElementById('btn-wardrobe')?.classList.remove('locked');

  const returnName = State.get('visitorName');
  if (returnName && State.get('lastVisit')) {
    TokenEngine.addReward(50000);
  }
}

/* ════════════════════════════════════════════
   HUD
   ════════════════════════════════════════════ */
function initHUD(mode) {
  document.getElementById('btn-fridge')?.addEventListener('click', () => {
    if (State.get('unlockedFridge')) openModal('fridge-modal');
  });
  document.getElementById('btn-wardrobe')?.addEventListener('click', () => {
    if (State.get('unlockedWardrobe')) openModal('wardrobe-modal');
  });
  document.getElementById('btn-chat')?.addEventListener('click', () => {
    if (State.get('unlockedChat')) openModal('chat-modal');
  });

  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.overlay;
      if (target === 'skills') openSkills();
      else if (target === 'about') openAbout();
      else if (target === 'contact') openContact();
    });
  });

  if (mode === 'hangout') buildChecklist();
}

function buildChecklist() {
  const el = document.getElementById('checklist');
  if (!el) return;
  const tasks = [
    { id: 'meet-sections', label: 'Meet all 5 sections' },
    { id: 'pet-tiger', label: 'Pet the tiger 3x' },
    { id: 'find-easter', label: 'Find an easter egg' },
    { id: 'feed-tiger', label: 'Feed the tiger' },
    { id: 'chat-tiger', label: 'Chat with kookytiger' },
  ];
  el.innerHTML = tasks.map(t =>
    `<div class="checklist-item" id="quest-${t.id}">${t.label}</div>`
  ).join('');
}

function completeQuest(id) {
  const el = document.getElementById('quest-' + id);
  if (el && !el.classList.contains('done')) {
    el.classList.add('done');
    TokenEngine.addReward(25000);
  }
}

/* ════════════════════════════════════════════
   MODE 1: BLACKBOARD
   ════════════════════════════════════════════ */
function openBlackboard() {
  const overlay = document.getElementById('blackboard-overlay');
  const content = document.getElementById('bb-content');
  const checklist = document.getElementById('bb-checklist');

  const heroLine = document.getElementById('bb-hero-line');
  heroLine.textContent = `${ABOUT.name || 'Kay'} — ${ABOUT.program || 'Northwestern Design Engineering + Film'}`;

  const heroProjects = PROJECTS.filter(p => p.isHero && !p.isHidden);
  const projContainer = document.getElementById('bb-projects');
  projContainer.innerHTML = heroProjects.map(p => `
    <div class="bb-project" data-slug="${p.slug}">
      <div class="bb-project-img">[ ${p.title} cover image ]</div>
      <h3>${p.title}</h3>
      <p>${p.logline}</p>
    </div>
  `).join('');

  projContainer.querySelectorAll('.bb-project').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => openProject(el.dataset.slug));
  });

  const skillsGrid = document.getElementById('bb-skills');
  skillsGrid.innerHTML = '<div class="bb-skills-grid">' +
    Object.entries(SKILLS).map(([k, v]) =>
      `<div class="bb-skill-box">${v.label}</div>`
    ).join('') + '</div>';

  const aboutSection = document.getElementById('bb-about');
  aboutSection.innerHTML = `<h3 style="font-family:var(--font-display);margin:24px 0 8px">About</h3><p style="font-size:14px;opacity:0.7;line-height:1.6">${(ABOUT.bio || '').split('\n')[0]}</p>`;

  const contactSection = document.getElementById('bb-contact');
  contactSection.innerHTML = `<h3 style="font-family:var(--font-display);margin:24px 0 8px">Contact</h3>
    <p style="font-size:14px;opacity:0.7">${ABOUT.contact?.email || ''}</p>`;

  const bbItems = ['Hero line', 'Projects', 'Skills', 'About', 'Contact'];
  checklist.innerHTML = bbItems.map((item, i) =>
    `<div class="checklist-item" id="bb-check-${i}">${item}</div>`
  ).join('');

  const bb = document.getElementById('blackboard');
  let scrollItems = [0.05, 0.25, 0.5, 0.7, 0.9];
  bb.addEventListener('scroll', () => {
    const pct = bb.scrollTop / (bb.scrollHeight - bb.clientHeight);
    scrollItems.forEach((threshold, i) => {
      if (pct >= threshold) {
        const el = document.getElementById(`bb-check-${i}`);
        if (el) el.classList.add('done');
      }
    });

    if (scrollItems.every((t) => {
      const el = document.getElementById(`bb-check-${scrollItems.indexOf(t)}`);
      return el?.classList.contains('done');
    })) {
      ExploreTracker.markExplored('blackboard:complete', 'blackboard');
    }
  });

  document.getElementById('bb-switch').addEventListener('click', () => {
    closeOverlay('blackboard-overlay');
    State.set('mode', 'hangout');
    initMode2();
    buildChecklist();
  });

  overlay.classList.add('active');
  ExploreTracker.markExplored('blackboard:view', 'section');
}

/* ════════════════════════════════════════════
   MODE 2: FULL HUB
   ════════════════════════════════════════════ */
function initMode2() {
  const zones = document.querySelectorAll('.tiger-zone');
  const tooltip = document.getElementById('tooltip');

  zones.forEach(zone => {
    const id = zone.id;
    const section = zone.dataset.section;
    const easter = zone.dataset.easter;

    if (section) {
      const sectionInfo = SECTION_MAP[section];
      zone.addEventListener('mouseenter', (e) => {
        showTooltip(sectionInfo?.label || section, e);
        showPreviewCards(section, zone);
      });
      zone.addEventListener('mousemove', moveTooltip);
      zone.addEventListener('mouseleave', () => {
        hideTooltip();
        hidePreviewCards();
      });
      zone.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePreviewCards();
        openSection(section);
      });
    }

    if (easter === 'music') {
      zone.addEventListener('click', (e) => {
        e.stopPropagation();
        spawnMusicNotes(zone);
        if (!State.get('easterEggsFound').includes('music')) {
          const found = [...State.get('easterEggsFound'), 'music'];
          State.set('easterEggsFound', found);
          ExploreTracker.markExplored('easter:music', 'easter');
          completeQuest('find-easter');
        }
      });
    }

    if (id === 'tail') {
      zone.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerDontTouch(zone);
        if (!State.get('easterEggsFound').includes('tail')) {
          const found = [...State.get('easterEggsFound'), 'tail'];
          State.set('easterEggsFound', found);
          ExploreTracker.markExplored('easter:tail', 'easter');
          completeQuest('find-easter');
        }
      });
    }
  });
}

/* ── Tooltip ── */
function showTooltip(text, e) {
  const t = document.getElementById('tooltip');
  t.textContent = text;
  t.classList.add('visible');
  moveTooltip(e);
}

function moveTooltip(e) {
  const t = document.getElementById('tooltip');
  t.style.left = (e.clientX + 14) + 'px';
  t.style.top = (e.clientY - 36) + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').classList.remove('visible');
}

/* ── Preview Cards ── */
function showPreviewCards(section, zone) {
  const container = document.getElementById('preview-cards');
  const projects = PROJECTS.filter(p => p.section === section && !p.isHidden);
  if (!projects.length) return;

  const rect = zone.getBoundingClientRect();
  const tigerRect = document.getElementById('tiger-container').getBoundingClientRect();
  const isLeft = rect.left < tigerRect.left + tigerRect.width / 2;

  container.innerHTML = '';
  container.style.left = isLeft ? '-200px' : (tigerRect.width + 20) + 'px';
  container.style.top = (rect.top - tigerRect.top - 20) + 'px';

  projects.slice(0, 3).forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.innerHTML = `<div class="preview-card-title">${p.title}</div><div class="preview-card-logline">${p.logline}</div>`;
    card.style.top = (i * 80) + 'px';
    card.addEventListener('click', () => {
      hidePreviewCards();
      openProject(p.slug);
    });
    container.appendChild(card);
    setTimeout(() => card.classList.add('visible'), i * 80);
  });
}

function hidePreviewCards() {
  const container = document.getElementById('preview-cards');
  container.innerHTML = '';
}

/* ════════════════════════════════════════════
   OVERLAYS
   ════════════════════════════════════════════ */
function openOverlay(id) {
  document.getElementById(id)?.classList.add('active');
}

function closeOverlay(id) {
  document.getElementById(id)?.classList.remove('active');
}

function openProject(slug) {
  const p = PROJECTS.find(pr => pr.slug === slug);
  if (!p) return;

  document.getElementById('project-title').textContent = p.title;
  document.getElementById('project-hero').textContent = `[ ${p.title} cover ]`;
  document.getElementById('project-section-tag').textContent = SECTION_MAP[p.section]?.label || p.section;
  document.getElementById('project-year').textContent = p.year || '';
  document.getElementById('project-logline').textContent = p.logline;

  const body = document.getElementById('project-body');
  body.innerHTML = (p.description || '').replace(/## (.*)/g, '<h2>$1</h2>').replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>');

  document.getElementById('project-gallery').innerHTML = p.gallery?.length
    ? p.gallery.map(g => `<div style="width:120px;height:80px;background:rgba(0,0,0,0.04);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(0,0,0,0.2)">[ img ]</div>`).join('')
    : '';

  openOverlay('project-overlay');
  ExploreTracker.markExplored('project:' + slug, 'project');
}

function openSection(section) {
  const info = SECTION_MAP[section];
  if (!info) return;

  document.getElementById('section-title').textContent = info.label;
  const projects = PROJECTS.filter(p => p.section === section && !p.isHidden);
  const container = document.getElementById('section-projects');
  container.innerHTML = projects.map(p => `
    <div class="section-project-card" data-slug="${p.slug}">
      <h4>${p.title}</h4>
      <p>${p.logline}</p>
    </div>
  `).join('');

  container.querySelectorAll('.section-project-card').forEach(card => {
    card.addEventListener('click', () => {
      closeOverlay('section-overlay');
      openProject(card.dataset.slug);
    });
  });

  openOverlay('section-overlay');
  ExploreTracker.markExplored('section:' + section, 'section');
}

function openSkills() {
  const grid = document.getElementById('skills-grid');
  grid.innerHTML = Object.entries(SKILLS).map(([key, skill]) => {
    const projectLinks = skill.projects.map(slug => {
      const p = PROJECTS.find(pr => pr.slug === slug);
      return p ? `<span class="skill-project-link" data-slug="${slug}">${p.title}</span>` : '';
    }).join('');
    return `<div class="skill-group"><h3>${skill.label}</h3>${projectLinks}</div>`;
  }).join('');

  grid.querySelectorAll('.skill-project-link').forEach(link => {
    link.addEventListener('click', () => {
      closeOverlay('skills-overlay');
      openProject(link.dataset.slug);
    });
  });

  openOverlay('skills-overlay');
  ExploreTracker.markExplored('about:skills', 'section');
}

function openAbout() {
  document.getElementById('about-name').textContent = ABOUT.name || 'Kay Xia';
  document.getElementById('about-program').textContent = ABOUT.program || '';
  document.getElementById('about-bio').textContent = ABOUT.bio || '';
  document.getElementById('about-philosophy').textContent = ABOUT.philosophy || '';
  openOverlay('about-overlay');
  ExploreTracker.markExplored('about:main', 'about');
}

function openContact() {
  const container = document.getElementById('contact-links');
  const c = ABOUT.contact || {};
  container.innerHTML = '';
  if (c.email) container.innerHTML += `<a class="contact-link" href="mailto:${c.email}"><span class="contact-link-label">Email</span>${c.email}</a>`;
  if (c.linkedin) container.innerHTML += `<a class="contact-link" href="${c.linkedin}" target="_blank"><span class="contact-link-label">LinkedIn</span>${c.linkedin}</a>`;
  if (c.phone) container.innerHTML += `<a class="contact-link" href="tel:${c.phone}"><span class="contact-link-label">Phone</span>${c.phone}</a>`;
  openOverlay('contact-overlay');
  ExploreTracker.markExplored('contact:main', 'contact');
}

/* ── Close buttons ── */
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('close-btn') || e.target.classList.contains('modal-close')) {
    const overlay = e.target.closest('.overlay') || e.target.closest('.modal');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }
  if (e.target.classList.contains('overlay') || e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.active, .modal.active').forEach(el => el.classList.remove('active'));
  }
});

/* ════════════════════════════════════════════
   MODALS: FRIDGE
   ════════════════════════════════════════════ */
const FOOD_ITEMS = [
  { id: 'sushi', emoji: '🍣', name: 'Sushi', cost: 5000 },
  { id: 'boba', emoji: '🧋', name: 'Boba Tea', cost: 8000 },
  { id: 'ramen', emoji: '🍜', name: 'Ramen', cost: 15000 },
  { id: 'cake', emoji: '🍰', name: 'Strawberry Cake', cost: 25000 },
  { id: 'steak', emoji: '🥩', name: 'Wagyu Steak', cost: 50000 },
];

function openModal(id) {
  if (id === 'fridge-modal') buildFridge();
  if (id === 'wardrobe-modal') buildWardrobe();
  document.getElementById(id)?.classList.add('active');

  if (id === 'fridge-modal') {
    ExploreTracker.markExplored('fridge_open:first', 'fridge_open');
    completeQuest('feed-tiger');
  }
  if (id === 'wardrobe-modal') {
    ExploreTracker.markExplored('wardrobe_open:first', 'wardrobe_open');
  }
  if (id === 'chat-modal') {
    completeQuest('chat-tiger');
  }
}

function buildFridge() {
  const container = document.getElementById('fridge-items');
  const tokens = State.get('tokens');
  container.innerHTML = FOOD_ITEMS.map(f => `
    <div class="shop-item" data-id="${f.id}">
      <span class="shop-item-emoji">${f.emoji}</span>
      <div class="shop-item-info">
        <div class="shop-item-name">${f.name}</div>
        <div class="shop-item-cost">${f.cost.toLocaleString()} tokens</div>
      </div>
      <button class="shop-item-buy" ${tokens < f.cost ? 'disabled' : ''}>Feed</button>
    </div>
  `).join('');

  container.querySelectorAll('.shop-item-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.shop-item');
      const food = FOOD_ITEMS.find(f => f.id === item.dataset.id);
      if (food && TokenEngine.spend(food.cost)) {
        feedTiger(food.emoji);
        buildFridge();
      }
    });
  });
}

function feedTiger(emoji) {
  const food = document.createElement('div');
  food.className = 'food-item';
  food.textContent = emoji;
  food.style.left = '50%';
  food.style.top = '30%';
  document.body.appendChild(food);

  const rect = document.getElementById('tiger-container').getBoundingClientRect();
  requestAnimationFrame(() => {
    food.style.left = (rect.left + rect.width / 2) + 'px';
    food.style.top = (rect.top + rect.height / 2) + 'px';
    food.style.fontSize = '20px';
    food.style.opacity = '0';
  });

  setTimeout(() => {
    food.remove();
    document.getElementById('tiger-container').classList.add('celebrating');
    setTimeout(() => document.getElementById('tiger-container').classList.remove('celebrating'), 1200);
  }, 1300);
}

/* ════════════════════════════════════════════
   MODALS: WARDROBE
   ════════════════════════════════════════════ */
const CLOTHES_ITEMS = [
  { id: 'bow-tie', emoji: '🎀', name: 'Bow Tie', cost: 100000 },
  { id: 'sunglasses', emoji: '🕶️', name: 'Sunglasses', cost: 150000 },
  { id: 'hat', emoji: '🎩', name: 'Top Hat', cost: 200000 },
  { id: 'scarf', emoji: '🧣', name: 'Scarf', cost: 300000 },
  { id: 'rick-owens', emoji: '🖤', name: 'Rick Owens Jacket', cost: 1000000 },
];

function buildWardrobe() {
  const container = document.getElementById('wardrobe-items');
  const tokens = State.get('tokens');
  const owned = State.get('inventoryClothes') || [];

  container.innerHTML = CLOTHES_ITEMS.map(c => {
    const isOwned = owned.includes(c.id);
    return `
    <div class="shop-item ${isOwned ? 'owned' : ''}" data-id="${c.id}">
      <span class="shop-item-emoji">${c.emoji}</span>
      <div class="shop-item-info">
        <div class="shop-item-name">${c.name}</div>
        <div class="shop-item-cost">${isOwned ? 'Owned' : c.cost.toLocaleString() + ' tokens'}</div>
      </div>
      <button class="shop-item-buy" ${isOwned || tokens < c.cost ? 'disabled' : ''}>${isOwned ? '✓' : 'Buy'}</button>
    </div>`;
  }).join('');

  container.querySelectorAll('.shop-item-buy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = btn.closest('.shop-item');
      const cloth = CLOTHES_ITEMS.find(c => c.id === item.dataset.id);
      if (cloth && TokenEngine.spend(cloth.cost)) {
        const owned = [...(State.get('inventoryClothes') || []), cloth.id];
        State.set('inventoryClothes', owned);
        buildWardrobe();
        document.getElementById('tiger-container').classList.add('celebrating');
        setTimeout(() => document.getElementById('tiger-container').classList.remove('celebrating'), 1200);
      }
    });
  });
}

/* ════════════════════════════════════════════
   CHAT
   ════════════════════════════════════════════ */
const CHAT_RESPONSES = [
  "rawr~ thanks for talking to me!",
  "you know what's cool? you're still here. that means a lot.",
  "i've been practicing my handstand... don't tell anyone.",
  "did you check out all my projects yet? the game jam one is my fave.",
  "kay says i need to be more professional. but i'm a tiger.",
  "*purrs* what else do you wanna know?",
  "fun fact: my stripes are actually CSS gradients. don't look too close.",
  "i heard you clicking around. i see everything 👀",
  "wanna feed me? i'm a little peckish...",
  "thanks for hanging out. most people leave after 10 seconds.",
];

function initChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const messages = document.getElementById('chat-messages');

  messages.innerHTML = '<div class="chat-msg tiger">hey! nice to see u here~ ask me anything or just say hi 😊</div>';

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    if (!TokenEngine.spend(1000)) {
      const noTokens = document.createElement('div');
      noTokens.className = 'chat-msg tiger';
      noTokens.textContent = "hmm you're out of tokens... explore more to earn some!";
      messages.appendChild(noTokens);
      messages.scrollTop = messages.scrollHeight;
      return;
    }

    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.textContent = text;
    messages.appendChild(userMsg);
    input.value = '';

    setTimeout(() => {
      const response = document.createElement('div');
      response.className = 'chat-msg tiger';
      response.textContent = CHAT_RESPONSES[Math.floor(Math.random() * CHAT_RESPONSES.length)];
      messages.appendChild(response);
      messages.scrollTop = messages.scrollHeight;
    }, 600 + Math.random() * 800);

    messages.scrollTop = messages.scrollHeight;
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

/* ════════════════════════════════════════════
   TIGER BEHAVIOR
   ════════════════════════════════════════════ */
let petCount = 0;
let lastIdleAction = 0;

function initTigerBehavior() {
  blinkLoop();
  idleWeirdLoop();

  const container = document.getElementById('tiger-container');

  container.addEventListener('click', (e) => {
    if (document.querySelector('.overlay.active, .modal.active')) return;
    petCount++;
    container.classList.add('celebrating');
    setTimeout(() => container.classList.remove('celebrating'), 1200);
    TokenEngine.addReward(5000);

    if (petCount >= 3) completeQuest('pet-tiger');

    showForecast('purrrr~ 🧡');
    setTimeout(() => hideForecast(), 2000);
  });

  container.addEventListener('mouseenter', () => {
    if (!document.querySelector('.tiger-zone:hover')) {
      container.classList.add('flinch');
      setTimeout(() => container.classList.remove('flinch'), 300);
    }
  });

  startEmotionEvents();
}

function blinkLoop() {
  const leftEye = document.querySelector('#left-eye .eye-pupil');
  const rightEye = document.querySelector('#right-eye .eye-pupil');
  [leftEye, rightEye].forEach(eye => {
    if (!eye) return;
    eye.classList.add('tiger-eye-blink');
    setTimeout(() => eye.classList.remove('tiger-eye-blink'), 200);
  });
  setTimeout(blinkLoop, 2000 + Math.random() * 4000);
}

function idleWeirdLoop() {
  const now = Date.now();
  if (now - lastIdleAction > 20000) {
    const weirdClasses = ['weird-tongue', 'weird-handstand'];
    const pick = weirdClasses[Math.floor(Math.random() * weirdClasses.length)];
    const container = document.getElementById('tiger-container');
    container.classList.add(pick);
    setTimeout(() => container.classList.remove(pick), 2500);
    lastIdleAction = now;
  }
  setTimeout(idleWeirdLoop, 15000 + Math.random() * 15000);
}

/* ── Emotion Events ── */
function startEmotionEvents() {
  if (State.get('mode') === 'quick') return;

  setInterval(() => {
    const pct = State.get('exploredPct') || 0;
    const rand = Math.random();

    if (rand < 0.3) {
      showForecast('wants pets...');
      setTimeout(hideForecast, 5000);
    } else if (pct >= 30 && rand < 0.5) {
      showForecast('looks peckish...');
      setTimeout(hideForecast, 5000);
    } else if (pct >= 50 && rand < 0.6) {
      showForecast('looks cold...');
      setTimeout(hideForecast, 5000);
    }
  }, 30000);
}

function showForecast(text) {
  const el = document.getElementById('forecast-bubble');
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.add('visible');
}

function hideForecast() {
  const el = document.getElementById('forecast-bubble');
  el.classList.remove('visible');
}

/* ════════════════════════════════════════════
   EASTER EGGS
   ════════════════════════════════════════════ */
const NOTES = ['♪', '♫', '♬', '♩'];

function spawnMusicNotes(zone) {
  const rect = zone.getBoundingClientRect();
  const containerRect = document.getElementById('tiger-container').getBoundingClientRect();

  for (let i = 0; i < 4; i++) {
    const note = document.createElement('div');
    note.className = 'music-note';
    note.textContent = NOTES[i % NOTES.length];
    note.style.color = i % 2 === 0 ? 'var(--color-accent-secondary)' : 'var(--color-accent)';
    note.style.left = (rect.left - containerRect.left + rect.width / 2 + (Math.random() - 0.5) * 30) + 'px';
    note.style.top = (rect.top - containerRect.top) + 'px';
    note.style.setProperty('--dx', (Math.random() - 0.5) * 60 + 'px');
    note.style.setProperty('--rot', (Math.random() - 0.5) * 40 + 'deg');
    note.style.animationDelay = (i * 0.15) + 's';
    document.getElementById('tiger-container').appendChild(note);
    setTimeout(() => note.remove(), 2000);
  }
}

function triggerDontTouch(zone) {
  const rect = zone.getBoundingClientRect();
  const containerRect = document.getElementById('tiger-container').getBoundingClientRect();

  const label = document.createElement('div');
  label.className = 'dont-touch-label';
  label.textContent = "Don't touch!";
  label.style.left = (rect.left - containerRect.left + rect.width / 2 - 50) + 'px';
  label.style.top = (rect.top - containerRect.top - 10) + 'px';
  document.getElementById('tiger-container').appendChild(label);
  setTimeout(() => label.remove(), 1500);

  const tail = document.getElementById('tiger-tail');
  if (tail) {
    tail.style.animation = 'none';
    void tail.offsetHeight;
    tail.style.animation = 'tailSway 0.3s ease-in-out 4';
    setTimeout(() => { tail.style.animation = 'tailSway 3s ease-in-out infinite'; }, 1200);
  }
}

/* ════════════════════════════════════════════
   BACKGROUND STARS
   ════════════════════════════════════════════ */
function initBackgroundStars() {
  const bg = document.getElementById('hub-bg');
  for (let i = 0; i < 15; i++) {
    const star = document.createElement('div');
    star.className = 'sparkle';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 5 + 's';
    star.style.animationDuration = (2 + Math.random() * 4) + 's';
    bg.appendChild(star);
  }
}

/* ════════════════════════════════════════════
   RESET (Phase 9)
   ════════════════════════════════════════════ */
window.resetPortfolio = function () {
  if (confirm('Reset all progress? This clears your name, tokens, and explored content.')) {
    State.reset();
  }
};

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
async function init() {
  await loadData();
  initBackgroundStars();
  initChat();
  initEntry();
}

init();
