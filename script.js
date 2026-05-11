/* ============================================
   KOOKYTIGER PORTFOLIO — script.js
   Hub interactions, animations, project view
   ============================================ */

/* ════════════════════════════════════════════
   MODULE: PortfolioState
   Central localStorage state. Single namespace.
   Shape: { hasDoneEntryRitual, mode, seenProjects,
            coins, ownedOutfits, wornOutfits, easterEggsFound }
   ════════════════════════════════════════════ */
const PortfolioState = (function () {
  const KEY = 'kookytiger_portfolio_state';
  const DEFAULTS = {
    hasDoneEntryRitual: false,
    mode: null,
    seenProjects: [],
    coins: 0,
    ownedOutfits: [],
    wornOutfits: [],
    easterEggsFound: [],
  };

  function load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
  function get(key) { return load()[key]; }
  function set(key, value) { const d = load(); d[key] = value; save(d); }
  function update(patch) { save({ ...load(), ...patch }); }
  function reset() { localStorage.removeItem(KEY); }

  return { get, set, update, load, reset };
})();

/* ════════════════════════════════════════════
   MODULE: EntryRitual
   First-visit paw + pencil writing screen.

   Interaction model:
   - Paw always follows the cursor (mousemove)
   - Pencil draws ONLY while the mouse button is held (mousedown+move)
   - Lifting the mouse resets the stroke so lines don't connect on re-press
   - cursor:none only on the PAPER, not the whole overlay — system cursor
     stays visible in the instruction area so users know where they are

   Auto-complete timing:
   - If user never moves cursor at all: fires after 6 s from page load
   - Once the user moves their cursor: resets to 2 s of inactivity
   This ensures recruiters aren't gated, but regular users get time to read.
   ════════════════════════════════════════════ */
(function EntryRitual() {
  const ritualEl = document.getElementById('entry-ritual');
  if (!ritualEl) return;

  // Returning visitor — remove overlay synchronously and bail
  if (PortfolioState.get('hasDoneEntryRitual')) {
    ritualEl.remove();
    return;
  }

  const paper     = document.getElementById('ritual-paper');
  const canvas    = document.getElementById('ritual-canvas');
  const ghostText = document.getElementById('ritual-ghost-text');
  const pawEl     = document.getElementById('ritual-paw');
  const skipBtn   = document.getElementById('ritual-skip');

  // Pencil tip offset within the 80×130 SVG element (after the -25° rotation).
  // Placing the SVG at (cursorX - TIP_X, cursorY - TIP_Y) puts the graphite
  // tip exactly at the cursor position.
  const TIP_X = 58;
  const TIP_Y = 104;

  let ctx           = null;
  let coverageGrid  = null;
  let coveredCount  = 0;
  let totalCells    = 0;
  let completed     = false;
  let autoCompleting= false;
  let isDrawing     = false;   // true while mouse button is held
  let lastPos       = null;    // last canvas-relative {x,y} of pencil stroke
  let idleTimer     = null;
  let hasMovedOnce  = false;   // tracks first-ever cursor movement

  /* ── Canvas ───────────────────────────────── */

  function initCanvas() {
    const r = paper.getBoundingClientRect();
    canvas.width  = Math.round(r.width);
    canvas.height = Math.round(r.height);
    ctx = canvas.getContext('2d');
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = 'rgba(38, 28, 18, 0.65)';
    ctx.lineWidth   = 3;
  }

  /* ── Coverage grid ────────────────────────── */
  // Ghost-text area split into COLS×ROWS cells.
  // 70% coverage → completion.

  function initCoverageGrid() {
    const pr = paper.getBoundingClientRect();
    const tr = ghostText.getBoundingClientRect();
    const COLS = 18, ROWS = 3;
    const pad  = 14;
    coverageGrid = {
      left:  tr.left - pr.left,
      top:   tr.top  - pr.top - pad,
      cols:  COLS,
      rows:  ROWS,
      cellW: tr.width / COLS,
      cellH: (tr.height + pad * 2) / ROWS,
      hit:   new Set(),
    };
    totalCells = COLS * ROWS;
  }

  function recordCoverage(cx, cy) {
    if (!coverageGrid) return;
    const g   = coverageGrid;
    const col = Math.floor((cx - g.left) / g.cellW);
    const row = Math.floor((cy - g.top)  / g.cellH);
    if (col >= 0 && col < g.cols && row >= 0 && row < g.rows) {
      const key = col + ',' + row;
      if (!g.hit.has(key)) { g.hit.add(key); coveredCount++; }
      if (!completed && coveredCount / totalCells >= 0.70) triggerComplete();
    }
  }

  /* ── Paw positioning ──────────────────────── */

  function placePaw(screenX, screenY) {
    pawEl.style.left = (screenX - TIP_X) + 'px';
    pawEl.style.top  = (screenY - TIP_Y) + 'px';
  }

  /* ── Drawing stroke ───────────────────────── */
  // Only called while mouse button is held. Draws on the canvas at the
  // cursor position and records coverage if cursor is over the paper.

  function strokeAt(screenX, screenY) {
    if (!ctx) return;
    const pr = paper.getBoundingClientRect();
    const cx = screenX - pr.left;
    const cy = screenY - pr.top;
    const onPaper = cx >= 0 && cy >= 0 && cx <= canvas.width && cy <= canvas.height;

    if (!onPaper) { lastPos = null; return; }

    ctx.beginPath();
    if (lastPos) { ctx.moveTo(lastPos.x, lastPos.y); }
    else         { ctx.moveTo(cx, cy); }
    ctx.lineTo(cx, cy);
    ctx.stroke();
    lastPos = { x: cx, y: cy };
    recordCoverage(cx, cy);
  }

  /* ── Mouse events ─────────────────────────── */

  function onMouseMove(e) {
    if (completed || autoCompleting) return;

    // On first-ever cursor movement: switch from 6 s to 2 s idle timeout
    if (!hasMovedOnce) {
      hasMovedOnce = true;
      scheduleIdle(2000);
    } else {
      scheduleIdle(2000);
    }

    placePaw(e.clientX, e.clientY);
    if (isDrawing) strokeAt(e.clientX, e.clientY);
  }

  function onMouseDown(e) {
    if (completed || autoCompleting) return;
    if (e.button !== 0) return; // left button only
    isDrawing = true;
    lastPos   = null; // start a fresh stroke
    placePaw(e.clientX, e.clientY);
    strokeAt(e.clientX, e.clientY);
  }

  function onMouseUp() { isDrawing = false; lastPos = null; }

  function onMouseLeave() { isDrawing = false; lastPos = null; }

  /* ── Idle / auto-complete ─────────────────── */

  function scheduleIdle(ms) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!completed && !autoCompleting) autoComplete();
    }, ms);
  }

  function autoComplete() {
    if (autoCompleting || completed) return;
    autoCompleting = true;
    isDrawing      = false;
    lastPos        = null;

    const tr       = ghostText.getBoundingClientRect();
    const startX   = tr.left  - 6;
    const endX     = tr.right + 6;
    const baseY    = tr.top   + tr.height * 0.62;
    const duration = 2000;
    const t0       = performance.now();

    function tick(now) {
      if (completed) return;
      const raw = Math.min((now - t0) / duration, 1);
      const t   = raw < 0.5 ? 4*raw*raw*raw : 1 - Math.pow(-2*raw+2,3)/2;
      const x   = startX + (endX - startX) * t;
      const y   = baseY  + Math.sin(t * Math.PI * 3) * 6;

      placePaw(x, y);
      isDrawing = true;
      strokeAt(x, y);
      isDrawing = false;

      if (raw < 1) { requestAnimationFrame(tick); }
      else { completed = true; triggerComplete(); }
    }
    requestAnimationFrame(tick);
  }

  /* ── Completion ───────────────────────────── */

  function triggerComplete() {
    completed = true;
    document.removeEventListener('mousemove',  onMouseMove);
    document.removeEventListener('mousedown',  onMouseDown);
    document.removeEventListener('mouseup',    onMouseUp);
    document.removeEventListener('mouseleave', onMouseLeave);
    clearTimeout(idleTimer);

    ghostText.classList.add('glow');

    // Paw bounce: up → overshoot down → settle
    const baseTop = parseFloat(pawEl.style.top) || 0;
    pawEl.style.transition = 'top 0.13s ease-out';
    pawEl.style.top = (baseTop - 22) + 'px';
    setTimeout(() => {
      pawEl.style.top = (baseTop + 9) + 'px';
      setTimeout(() => {
        pawEl.style.top = baseTop + 'px';
        setTimeout(() => {
          PortfolioState.set('hasDoneEntryRitual', true);
          ritualEl.classList.add('fade-out');
          setTimeout(() => ritualEl.remove(), 850);
        }, 650);
      }, 140);
    }, 140);
  }

  /* ── Skip ─────────────────────────────────── */

  skipBtn.addEventListener('click', () => {
    if (completed) return;
    completed = true;
    clearTimeout(idleTimer);
    document.removeEventListener('mousemove',  onMouseMove);
    document.removeEventListener('mousedown',  onMouseDown);
    document.removeEventListener('mouseup',    onMouseUp);
    document.removeEventListener('mouseleave', onMouseLeave);
    PortfolioState.set('hasDoneEntryRitual', true);
    ritualEl.classList.add('fade-out');
    setTimeout(() => ritualEl.remove(), 400);
  });

  /* ── Init ─────────────────────────────────── */

  requestAnimationFrame(() => {
    initCanvas();
    initCoverageGrid();

    // Park paw above paper center before any mouse movement
    const pr = paper.getBoundingClientRect();
    placePaw(pr.left + pr.width / 2, pr.top + pr.height * 0.5);

    document.addEventListener('mousemove',  onMouseMove);
    document.addEventListener('mousedown',  onMouseDown);
    document.addEventListener('mouseup',    onMouseUp);
    document.addEventListener('mouseleave', onMouseLeave);

    // 6 s fallback if cursor never moves at all (recruiter shortcut)
    scheduleIdle(6000);
  });
})();

/* ════════════════════════════════════════════
   HUB + PROJECT VIEW (original module)
   ════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── State ─────────────────────────────── */

  const state = {
    currentView: 'hub',        // 'hub' | 'project'
    viewed: JSON.parse(localStorage.getItem('kt-viewed') || '{}'),
    tourComplete: JSON.parse(localStorage.getItem('kt-tour-complete') || 'false'),
  };

  // The two must-see projects (body part ids)
  const MUST_SEE = ['paws', 'left-eye'];

  /* ── Zone → section mapping ────────────── */

  const ZONES = {
    'paws':       { label: 'Product Design & Engineering', category: 'Engineering' },
    'left-eye':   { label: 'Visual Design / 2D Art',      category: '2D Art' },
    'right-eye':  { label: 'Film & Motion',                category: 'Motion' },
    'brain':      { label: 'Experience Design & Research',  category: 'Research' },
    'heart':      { label: 'Design Philosophy / About',     category: 'About' },
  };

  const EASTER_EGGS = {
    'ears':  'music',
    'tail':  'dont-touch',
  };

  /* ── Placeholder project content ───────── */

  const PROJECTS = {
    'paws': {
      title: 'Product Design & Engineering',
      content: `
        <h3>Overview</h3>
        <p>A deep dive into end-to-end product design — from user research to shipped code. This section showcases products built from scratch, including design systems, component libraries, and full-stack applications.</p>
        <div class="placeholder-img">[ project screenshot ]</div>
        <h3>Process</h3>
        <p>Every product starts with a problem worth solving. Through user interviews, competitive analysis, and rapid prototyping, the path from idea to MVP is shortened without sacrificing quality.</p>
        <div class="placeholder-img">[ process diagram ]</div>
        <h3>Key Projects</h3>
        <p>Placeholder for featured engineering projects — design systems, web apps, and tools that live at the intersection of design and code.</p>
      `,
    },
    'left-eye': {
      title: 'Visual Design / 2D Art',
      content: `
        <h3>Overview</h3>
        <p>Illustration, branding, and visual identity work. From character design to brand systems, this section explores the visual language behind kookytiger and client projects.</p>
        <div class="placeholder-img">[ illustration samples ]</div>
        <h3>Style</h3>
        <p>Bold colors, clean lines, and a touch of whimsy. Influenced by Japanese illustration, street art, and minimalist aesthetics.</p>
        <div class="placeholder-img">[ style exploration ]</div>
        <h3>Selected Works</h3>
        <p>Placeholder for visual design portfolio — logos, illustrations, brand identities, and experimental art.</p>
      `,
    },
    'right-eye': {
      title: 'Film & Motion',
      content: `
        <h3>Overview</h3>
        <p>Motion graphics, short films, and animation work. Moving images that tell stories and evoke emotion.</p>
        <div class="placeholder-img">[ video thumbnail ]</div>
        <h3>Approach</h3>
        <p>Motion is about timing, rhythm, and surprise. Every frame is intentional — every transition serves the narrative.</p>
        <div class="placeholder-img">[ storyboard ]</div>
      `,
    },
    'brain': {
      title: 'Experience Design & Research',
      content: `
        <h3>Overview</h3>
        <p>UX research and experience design — understanding people to build things that actually work for them.</p>
        <div class="placeholder-img">[ research artifacts ]</div>
        <h3>Methods</h3>
        <p>User interviews, usability testing, journey mapping, and data synthesis. Research isn't a phase — it's a practice woven through the entire design process.</p>
        <div class="placeholder-img">[ journey map ]</div>
      `,
    },
    'heart': {
      title: 'Design Philosophy / About',
      content: `
        <h3>Hi, I'm kookytiger</h3>
        <p>Designer, engineer, and creative who believes the best digital experiences feel alive. I build things that are useful, beautiful, and a little bit weird.</p>
        <div class="placeholder-img">[ portrait / about image ]</div>
        <h3>Philosophy</h3>
        <p>Design should surprise and delight. Technology should feel human. The gap between "functional" and "magical" is smaller than most people think — it just takes care and craft to close it.</p>
      `,
    },
  };

  /* ── DOM refs ──────────────────────────── */

  const tigerContainer = document.getElementById('tiger-container');
  const tooltip = document.getElementById('tooltip');
  const projectOverlay = document.getElementById('project-overlay');
  const projectTitle = document.getElementById('project-title');
  const projectCategory = document.getElementById('project-category');
  const projectContent = document.getElementById('project-content');
  const closeBtn = document.getElementById('close-project');

  /* ── Tooltip ───────────────────────────── */

  function showTooltip(text, e) {
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    moveTooltip(e);
  }

  function moveTooltip(e) {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top = (e.clientY - 36) + 'px';
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
  }

  /* ── Zone interactions ─────────────────── */

  document.querySelectorAll('.tiger-zone').forEach((zone) => {
    const id = zone.id;

    // Tooltip on hover for main zones
    if (ZONES[id]) {
      zone.addEventListener('mouseenter', (e) => showTooltip(ZONES[id].label, e));
      zone.addEventListener('mousemove', moveTooltip);
      zone.addEventListener('mouseleave', hideTooltip);
    }

    // Click — open project or trigger easter egg.
    // stopPropagation prevents the click from bubbling to the tigerContainer
    // handler (which would immediately re-close a project that just opened).
    zone.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ZONES[id]) {
        openProject(id);
      } else if (EASTER_EGGS[id] === 'music') {
        spawnMusicNotes(zone);
      } else if (EASTER_EGGS[id] === 'dont-touch') {
        triggerDontTouch(zone);
      }
    });
  });

  /* ── Open / close project ──────────────── */

  function openProject(id) {
    const proj = PROJECTS[id];
    if (!proj) return;

    hideTooltip();
    state.currentView = 'project';

    // Populate content
    projectTitle.textContent = proj.title;
    projectCategory.textContent = ZONES[id].category;
    projectContent.innerHTML = proj.content;

    // Shrink tiger to corner
    tigerContainer.classList.remove('grow-back');
    tigerContainer.classList.add('shrunk');

    // After tiger finishes shrinking, slide in the project file
    setTimeout(() => {
      projectOverlay.classList.add('active');
    }, 500);

    // Start eye-tracking after transition
    setTimeout(() => startEyeTracking(), 800);

    // Mark as viewed
    markViewed(id);
  }

  function closeProject() {
    state.currentView = 'hub';
    stopEyeTracking();

    // Add closing class for the slide-out rotation
    projectOverlay.classList.add('closing');

    // Wait for file to slide out, then remove overlay
    setTimeout(() => {
      projectOverlay.classList.remove('active');
      projectOverlay.classList.remove('closing');
    }, 500);

    // Grow tiger back with spring overshoot
    setTimeout(() => {
      tigerContainer.classList.remove('shrunk');
      tigerContainer.classList.add('grow-back');
    }, 350);

    // Clean up grow-back class after animation
    setTimeout(() => {
      tigerContainer.classList.remove('grow-back');
    }, 1200);
  }

  /* ── Eye tracking (small tiger watches cursor) ── */

  let eyeTrackingRaf = null;

  function startEyeTracking() {
    document.addEventListener('mousemove', trackEyes);
  }

  function stopEyeTracking() {
    document.removeEventListener('mousemove', trackEyes);
    // Reset eye positions
    const pupils = tigerContainer.querySelectorAll('.eye-pupil');
    pupils.forEach((p) => {
      p.style.transform = '';
    });
  }

  function trackEyes(e) {
    if (eyeTrackingRaf) cancelAnimationFrame(eyeTrackingRaf);
    eyeTrackingRaf = requestAnimationFrame(() => {
      const rect = tigerContainer.getBoundingClientRect();
      const tigerCx = rect.left + rect.width / 2;
      const tigerCy = rect.top + rect.height * 0.35; // eyes are in upper third

      const dx = e.clientX - tigerCx;
      const dy = e.clientY - tigerCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxShift = 3; // pixels the pupil can move
      const nx = (dx / (dist || 1)) * Math.min(maxShift, dist * 0.01);
      const ny = (dy / (dist || 1)) * Math.min(maxShift, dist * 0.01);

      const pupils = tigerContainer.querySelectorAll('.eye-pupil');
      pupils.forEach((p) => {
        p.style.transform = `translate(${nx}px, ${ny}px)`;
      });
    });
  }

  closeBtn.addEventListener('click', closeProject);

  // Clicking the small tiger also returns to hub
  tigerContainer.addEventListener('click', (e) => {
    if (state.currentView === 'project' && tigerContainer.classList.contains('shrunk')) {
      e.stopPropagation();
      closeProject();
    }
  });

  // Also close on overlay background click
  projectOverlay.addEventListener('click', (e) => {
    if (e.target === projectOverlay || e.target === projectOverlay.querySelector('::before')) {
      closeProject();
    }
  });

  // Esc key closes project
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.currentView === 'project') {
      closeProject();
    }
  });

  /* ── Viewed / feeding / tour tracking ──── */

  function markViewed(id) {
    if (state.viewed[id]) return;
    state.viewed[id] = true;
    localStorage.setItem('kt-viewed', JSON.stringify(state.viewed));

    // Remove pulse glow from viewed zone
    const zone = document.getElementById(id);
    if (zone) zone.classList.remove('pulse-glow');

    // Remove click-me badge
    const badge = document.querySelector(`.click-me-badge[data-zone="${id}"]`);
    if (badge) badge.remove();

    // Feeding reward for must-see projects
    if (MUST_SEE.includes(id)) {
      const idx = MUST_SEE.indexOf(id);
      setTimeout(() => {
        if (idx === 0) feedTiger('🍣', id);
        else feedTiger('🧋', id);
      }, 600);
    }

    // Check if tour is complete
    checkTourComplete();
  }

  function feedTiger(emoji, _zoneId) {
    const food = document.createElement('div');
    food.className = 'food-item';
    food.textContent = emoji;
    food.style.left = '50%';
    food.style.top = '30%';
    document.body.appendChild(food);

    // Get tiger position
    const rect = tigerContainer.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    requestAnimationFrame(() => {
      food.style.left = targetX + 'px';
      food.style.top = targetY + 'px';
      food.style.fontSize = '20px';
      food.style.opacity = '0';
    });

    setTimeout(() => {
      food.remove();
      // Happy wiggle on tiger
      tigerContainer.style.animation = 'none';
      void tigerContainer.offsetHeight;
      tigerContainer.classList.add('celebrating');
      setTimeout(() => tigerContainer.classList.remove('celebrating'), 1200);
    }, 1300);
  }

  function checkTourComplete() {
    const allSeen = MUST_SEE.every((id) => state.viewed[id]);
    if (allSeen && !state.tourComplete) {
      state.tourComplete = true;
      localStorage.setItem('kt-tour-complete', 'true');

      // Big celebration after closing project
      setTimeout(() => {
        tigerContainer.classList.add('celebrating');
        spawnCelebrationSparkles();
        setTimeout(() => tigerContainer.classList.remove('celebrating'), 1200);
      }, 1500);
    }
  }

  /* ── Expedited tour: pulse glow + badges ── */

  function initTour() {
    if (state.tourComplete) return;

    MUST_SEE.forEach((id) => {
      if (state.viewed[id]) return;

      const zone = document.getElementById(id);
      if (zone) zone.classList.add('pulse-glow');

      // Add "click me" badge near the zone
      const badge = document.createElement('div');
      badge.className = 'click-me-badge';
      badge.dataset.zone = id;
      badge.textContent = 'click me';
      tigerContainer.appendChild(badge);

      // Position badges relative to tiger container
      if (id === 'paws') {
        badge.style.bottom = '50px';
        badge.style.left = '50%';
        badge.style.transform = 'translateX(-50%)';
      } else if (id === 'left-eye') {
        badge.style.top = '150px';
        badge.style.left = '80px';
      }
    });
  }

  /* ── Easter eggs ───────────────────────── */

  const NOTES = ['♪', '♫', '♬', '♩'];

  function spawnMusicNotes(zone) {
    const rect = zone.getBoundingClientRect();
    const containerRect = tigerContainer.getBoundingClientRect();

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
      tigerContainer.appendChild(note);
      setTimeout(() => note.remove(), 2000);
    }
  }

  function triggerDontTouch(zone) {
    const rect = zone.getBoundingClientRect();
    const containerRect = tigerContainer.getBoundingClientRect();

    const label = document.createElement('div');
    label.className = 'dont-touch-label';
    label.textContent = "Don't touch!";
    label.style.left = (rect.left - containerRect.left + rect.width / 2 - 50) + 'px';
    label.style.top = (rect.top - containerRect.top - 10) + 'px';
    tigerContainer.appendChild(label);
    setTimeout(() => label.remove(), 1500);

    // Tail wiggle burst
    const tail = document.getElementById('tiger-tail');
    if (tail) {
      tail.style.animation = 'none';
      void tail.offsetHeight;
      tail.style.animation = 'tailSway 0.3s ease-in-out 4';
      setTimeout(() => {
        tail.style.animation = 'tailSway 3s ease-in-out infinite';
      }, 1200);
    }
  }

  /* ── Idle: blink ───────────────────────── */

  function blinkEyes() {
    const leftEye = document.querySelector('#left-eye .eye-pupil');
    const rightEye = document.querySelector('#right-eye .eye-pupil');

    [leftEye, rightEye].forEach((eye) => {
      if (!eye) return;
      eye.classList.add('tiger-eye-blink');
      setTimeout(() => eye.classList.remove('tiger-eye-blink'), 200);
    });

    // Random next blink between 2–6 seconds
    setTimeout(blinkEyes, 2000 + Math.random() * 4000);
  }

  setTimeout(blinkEyes, 1500);

  /* ── Celebration sparkles ──────────────── */

  function spawnCelebrationSparkles() {
    const container = tigerContainer;
    for (let i = 0; i < 12; i++) {
      const spark = document.createElement('div');
      spark.className = 'sparkle';
      spark.style.left = Math.random() * 100 + '%';
      spark.style.top = Math.random() * 100 + '%';
      spark.style.animationDelay = Math.random() * 0.5 + 's';
      spark.style.animationDuration = (1 + Math.random()) + 's';
      spark.style.width = spark.style.height = (3 + Math.random() * 5) + 'px';
      spark.style.background = Math.random() > 0.5 ? 'var(--color-accent-secondary)' : 'var(--color-accent)';
      container.appendChild(spark);
      setTimeout(() => spark.remove(), 2500);
    }
  }

  /* ── Background sparkle stars ──────────── */

  function initBackgroundStars() {
    const bg = document.getElementById('hub-bg');
    for (let i = 0; i < 20; i++) {
      const star = document.createElement('div');
      star.className = 'sparkle';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.animationDelay = Math.random() * 5 + 's';
      star.style.animationDuration = (2 + Math.random() * 4) + 's';
      bg.appendChild(star);
    }
  }

  /* ── Init ───────────────────────────────── */

  initBackgroundStars();
  initTour();

})();
