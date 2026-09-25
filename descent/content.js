// ─────────────────────────────────────────────────────────────
// KookyTiger — THE DESCENT. Content & tuning config.
// Eleven floors down. A monster on each. The grass on the other shore at the bottom.
// Camera grammar copied from the two reference sites (see CAMERA + MOUSE).
// ─────────────────────────────────────────────────────────────

export const CATS = {
  product:   { name: 'Product design', color: '#3FB6BF', tint: '#0F2A30' },
  game:      { name: 'Games',          color: '#9B7BE0', tint: '#231A3A' },
  film:      { name: 'Film',           color: '#F08A3C', tint: '#3A2012' },
  analytics: { name: 'Analytics',      color: '#6C93E8', tint: '#16223F' },
};

// 11 projects = 11 floors = 11 monsters. `monster.kind` picks a body plan (app.js), `line` is what it says when it pops.
export const PIECES = [
  { name: 'LevelUp',               cat: 'product',   desc: 'A clip-on bubble level for barbells, iterated from 70 sketches down to one $1.30 part.',   meta: ['DTC', 'prototype'],            take: '80% of testers picked it over the two competing concepts. It still failed three specs, and the report says which.', monster: { kind: 'slime',   name: 'Wobble',      line: 'never once level.' } },
  { name: 'Austin Vaccine Siting', cat: 'analytics', desc: 'Clustered 42 Austin ZIP areas to site vaccine distribution: k-medoids first, then two Gurobi integer programs.', meta: ['IEMS 313', 'optimization'], take: 'We handed back two answers and said which one to pick depending on what you care about.', monster: { kind: 'golem',   name: 'The 42',      line: 'forty-two ZIP codes of attitude.' } },
  { name: 'No-Tip-Clip',           cat: 'product',   desc: 'An anti-tip caster for wheelchairs carrying halo-traction patients at Shriners Children’s.', meta: ['DTC', 'clinical'],           take: 'Proxy testing killed the obvious counterweight idea exactly where patients needed it most. $62.26, printed.', monster: { kind: 'tower',   name: 'Tippy',       line: 'kept tipping. not anymore.' } },
  { name: 'CASE × Ama La Vida',    cat: 'analytics', desc: 'Pricing and retention strategy for a virtual career-coaching company, from five years of churn data.', meta: ['consulting', 'pricing'],   take: '43% of cancellations said “goal achieved.” The product was working. That’s an argument for charging more.', monster: { kind: 'piggy',   name: 'Churn',       line: 'ate the members who’d finished.' } },
  { name: 'Neighbors',             cat: 'film',      desc: 'A VR film. You cannot cut. You can only wait.',                                              meta: ['RTVF', 'VR'],                  take: 'In VR the edit is the viewer.', monster: { kind: 'eye',     name: 'The Watcher', line: 'you can’t cut away from it.' } },
  { name: 'Slide Master',          cat: 'product',   desc: 'A wheelchair-to-shower transfer board for Shirley Ryan AbilityLab, built around friction, stability and pinching.', meta: ['DSGN 308', 'wood'], take: 'The plywood mockup cracked under a person. That failure, not a calculation, is why the final board is pine.', monster: { kind: 'slug',    name: 'Friction',    line: 'wouldn’t slide. now it does.' } },
  { name: 'CASE × Yello',          cat: 'analytics', desc: 'Mapped the HR-tech landscape for a talent-acquisition platform and found the public-sector opening.', meta: ['consulting', 'market sizing'], take: '98.8% of the Fortune 500 already run an ATS. The opening isn’t displacement, it’s adjacency.', monster: { kind: 'bee',     name: 'The ATS',     line: '98.8% of the Fortune 500 keep one.' } },
  { name: 'Northwestern Game Jam', cat: 'game',      desc: 'A Taoist exorcist hired to cleanse a haunted show-home, and the grandmother who refused to leave.', meta: ['game jam', 'Godot'],      take: 'The concept pivoted three times. The question never changed: who has more claim to a home.', monster: { kind: 'ghost',   name: 'Grandma',     line: 'refused to leave. fair.' } },
  { name: 'Running',               cat: 'film',      desc: 'AI-assisted short, RTVF 376.',                                                                meta: ['RTVF 376', 'storyboard'],      take: 'The storyboard survived. The model didn’t.', monster: { kind: 'reel',    name: 'The Take',    line: 'kept running. the storyboard survived.' } },
  { name: 'AMG-786',               cat: 'analytics', desc: 'Financial analysis of a drug candidate: 10-year revenue forecast, risk-adjusted NPV.',           meta: ['CIV_ENV 205', 'Excel'],        take: '“Proceed, but wary of Phase II.” Half of pricing is deciding what not to count.', monster: { kind: 'capsule', name: 'Phase II',    line: 'proceed. but wary.' } },
  { name: 'One Birth Too Many',    cat: 'game',      desc: 'A Twine game set in a 1983 Chinese village under the One-Child Policy. One Friday morning, six perspectives, one dinner table.', meta: ['RTVF 360', 'Twine'], take: 'Choices in one character’s morning silently change another’s. You find out at dinner.', monster: { kind: 'knot',    name: 'Friday',      line: 'six mornings. one dinner.' } },
];

export const FLOOR_H = 7.0;            // world units the lift descends per project block
export const BLOCK_VH = 1.15;          // screens of scroll per project block (one DOM block each, text on the left)
// The lift never stops. Each fight is a function of a = (liftY - ledgeY) / FLOOR_H: +0.5 far above … 0 aligned … -0.5 past.
export const FIGHT = { notice: 0.34, hop: [0.26, 0.09], swipe: [0.09, -0.01], hit: 0.0, pop: [0.0, -0.09], loot: [-0.02, -0.26] };
export const LIFT = { x: 1.7, r: 2.3, tigerX: 0.35, ledgeX: [-9.5, -2.4], monsterX: -4.6, monsterHopX: -3.0 };

export const COPY = {
  nav:    { name: 'KookyTiger', sub: 'Zishu Kay Tu', links: ['Work', 'About', 'Archives'] },
  loader: { title: 'KookyTiger', sub: 'descending eleven floors' },
  header: { statement: ['Eleven floors down.', 'A monster on each.'], scroll: 'Scroll to descend' },   // the lift is already hanging over the shaft
  hero:   { words: ['KOOKY', 'T-SHAPED', 'TIGER'], reveal: ['MADE + RTVF', 'NORTHWESTERN ’27', 'WUHAN → EVANSTON'], indication: '(Click the tiger)' },
  intro:  {
    big:   ['你好.', 'I make products, films, games and spreadsheets — which is either four things or one thing, depending on which floor you catch me on.'],
    small: ['T-shaped, as in wide across and deep in one stem.', 'Also as in Tu. Also as in: every project below was a monster once. I went down and dealt with it.'],
    reel:  'Watch reel',
  },
  descent: { title: 'The descent', hint: 'scroll = descend', hover: 'click the tiger', levelUp: 'LV UP', media: 'images soon' },
  shore:  { words: ['THE OTHER', 'SHORE'], sub: 'eleven floors down · grass, finally', tiger: 'peace. for now.' },
  archives: { title: 'Archives', note: 'monsters too small to mention' },
  footer: { words: ['ELEVEN DOWN.', 'BRING', 'YOUR BOSS'], sayhi: 'Say hi ↗', email: 'kaytu2027@u.northwestern.edu', bottom: ['Zishu Kay Tu', 'Northwestern MaDE + RTVF', '© 2026'] },
};

export const ARCHIVE = [
  ['WIND × DFA', 'Tech-literacy curriculum for justice-impacted women', 'Design for America', '2024'],
  ['Bike caliper', 'Rear brake caliper, 115 g → 60 g, road-tested', 'ME 240', '2025'],
  ['Prosthetic foot', '3D-printed PLA foot, loaded to failure', 'MaDE', '2025'],
  ['GiftMe', 'Wishlist / gifting iOS app', 'Co-founder', '2026'],
  ['Reverie', 'Dream journaling app', 'Personal', '2026'],
  ['隐藏的宝藏', 'Scenic design — mobile reveal wall', 'Theatre', '2025'],
  ['People Like Us', 'Logo animation — morphing gears', 'Client', '2025'],
  ['MiraclePlus', 'Investment analyst intern', 'Beijing', '2025'],
];

// ── Camera grammar (copied):
// Léo: the camera sits on a straight rail; position = linear map of scroll inside each block, clamped —
//      no easing curve of its own, the only smoothing is Lenis' lerp (.1). Header block also drifts back.
// Laurens: the hero stays in frame while the world moves; the camera yaws/pitches with the mouse
//      (maxYaw .028, maxPitch .03, damping .15); the headline tilts (maxX 4, maxY 5, rotY .28, rotX .35, damping .1).
export const CAMERA = {
  x: -2.1, z: 12.5, pitch: -0.11, above: 1.8,              // rides with the lift: 12.5 in front, 1.8 above its deck, tilted 6° down, shifted so the tiger sits right of centre
  header: { rangeZ: 1.4, rangePitch: -0.05 },              // Léo header: the camera backs off 1.4 and tilts down a touch across the 2-screen header (position comes from the lift)
  shore: { rangeY: 0.6, rangeZ: 1.6, pitchTo: -0.03 },     // landing: settle, back off, level out
};
export const MOUSE = { yaw: 0.028, pitch: 0.03, damping: 0.15, headline: { x: 4, y: 5, rotY: 0.28, rotX: 0.35, damping: 0.1 }, blob: { follow: 0.61 } };

export const MOTION = {
  reveal: { ease: '0.4, 0, 0, 1', duration: 1.125, stagger: 0.1, heroStagger: 0.25 },
  hide:   { ease: '0.86, 0, 0.07, 1', duration: 0.75 },
  cursor: { inDuration: 0.65, inEase: 'elastic.out(0.75)', outDuration: 0.3, outEase: 'expo.out' },
  header: { parallax: 800, fadeStart: 0.2, fadeEnd: 0.45 },
};

export const SKY = { pure: '#0B0B12', projects: '#0E0F1C', shore: '#E6EEEA', flipMs: 800 };

export const LIGHT = {
  exposure: 1.0,
  key:   { color: 0x9fb4ff, intensity: [0.5, 0.45, 1.6], colorShore: 0xfff1d6 },
  hemi:  { sky: 0x39446a, ground: 0x0a0b12, intensity: [0.6, 0.62, 1.1], skyShore: 0xcfe6ff, groundShore: 0x5a7a4a },
  torch: { intensity: 22, distance: 12, decay: 2 },
  lamp:  { color: 0xffd9a0, intensity: 20, distance: 14, decay: 2 },   // the lantern on the lift: the light that travels with you
};
