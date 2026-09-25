// ─────────────────────────────────────────────────────────────
// KookyTiger — content & tuning config (data-driven, like Léo's)
// Everything the page shows or animates reads from here.
// ─────────────────────────────────────────────────────────────

export const WELL = { cols: 11, rows: 12 };

// Tetromino cell maps (x right, y down) in their FINAL orientation.
export const SHAPES = {
  I:  [[0,0],[1,0],[2,0],[3,0]],
  O:  [[0,0],[1,0],[0,1],[1,1]],
  T:  [[0,0],[1,0],[2,0],[1,1]],
  Tu: [[1,0],[0,1],[1,1],[2,1]],
  Lf: [[0,0],[1,0],[2,0],[0,1]],
  Lb: [[2,0],[0,1],[1,1],[2,1]],
  Jf: [[0,0],[0,1],[1,1],[2,1]],
};

// Verified drop sequence: two towers, a 3-wide canyon in the middle,
// and the 12th piece — a T — falls through it and completes rows 7+8.
// [shape, x, finalRow] in an 11-wide, 9-row board (row 8 = floor).
export const LAYOUT = [
  ['I',0,8], ['I',5,8], ['Jf',0,6], ['O',9,7], ['Jf',6,6], ['O',1,5],
  ['I',7,6], ['Lf',0,4], ['Lb',6,4], ['O',9,4], ['Tu',0,2], ['T',3,7],
];
export const BOARD_ROWS = 9;           // rows used by LAYOUT
export const CLEAR_ROWS = [7, 8];      // rows completed by the T

export const CATS = {
  product:   { name: 'Product design', color: '#2E9AA3', tint: '#12333A' },
  game:      { name: 'Games',          color: '#7B57C2', tint: '#241A3A' },
  film:      { name: 'Film',           color: '#D9702F', tint: '#3A2014' },
  analytics: { name: 'Analytics',      color: '#4A72C9', tint: '#16223F' },
  me:        { name: 'Kay Tu',         color: '#F28C28', tint: '#3A2A10' },
};

// 11 pieces of work + 1 piece of work.
export const PIECES = [
  { name: 'LevelUp',               cat: 'product',   desc: 'A bubble level, redesigned for one-handed use.',            meta: ['DTC', 'prototype'],            take: 'The first thing I built that a stranger picked up without instructions.', quip: 'clean drop.' },
  { name: 'Austin Vaccine Siting', cat: 'analytics', desc: 'Facility optimization on social-vulnerability data.',       meta: ['IEMS', 'optimization'],        take: 'The map was the argument. The model just proved it.',                    quip: 'that one has numbers in it.' },
  { name: 'No-Tip-Clip',           cat: 'product',   desc: 'A clip so halo traction wheels stop tipping.',              meta: ['DTC', 'clinical'],             take: 'Clinicians don’t want clever. They want it to not fall.',                 quip: 'it holds. told you.' },
  { name: 'CASE × Ama La Vida',    cat: 'analytics', desc: 'Pricing strategy for a coaching company.',                  meta: ['consulting', 'pricing'],       take: 'Price is a story customers tell themselves about you.',                    quip: 'expensive-looking piece.' },
  { name: 'Neighbors',             cat: 'film',      desc: 'A VR film. You cannot cut. You can only wait.',             meta: ['RTVF', 'VR'],                  take: 'In VR the edit is the viewer.',                                            quip: 'don’t look directly at it.' },
  { name: 'Slide Master',          cat: 'product',   desc: 'Transfer board for Shirley Ryan AbilityLab patients.',      meta: ['DSGN 308'],                    take: 'Friction is the whole product.',                                           quip: 'smooth. suspiciously smooth.' },
  { name: 'CASE × Yello',          cat: 'analytics', desc: 'Market sizing for a recruiting platform.',                  meta: ['consulting', 'market sizing'], take: 'Top-down and bottom-up disagree. That gap is the insight.',               quip: 'yellow. as advertised.' },
  { name: 'Candell Handles',       cat: 'game',      desc: 'Narrative horror game, Northwestern Game Jam 2026.',        meta: ['game jam', 'unity'],           take: 'A jam is a deadline pretending to be a genre.',                            quip: 'something moved in there.' },
  { name: 'Running',               cat: 'film',      desc: 'AI-assisted short, RTVF 376.',                              meta: ['RTVF 376', 'storyboard'],      take: 'The storyboard survived. The model didn’t.',                               quip: 'it kept running.' },
  { name: 'AMG-786',               cat: 'analytics', desc: 'Drug pricing analysis.',                                    meta: ['analysis', 'pricing'],         take: 'Half of pricing is deciding what not to count.',                           quip: 'mostly water and a little pricing.' },
  { name: 'One Birth Too Many',    cat: 'game',      desc: 'Twine game set in 1983 rural China.',                       meta: ['interactive fiction'],         take: 'Branching is a way to say the same thing twice, differently.',           quip: 'careful. that one’s personal.' },
  { name: 'Kay Tu',                cat: 'me',        desc: 'T-piece. Wide on top, deep in the stem. Fits sideways into the gap nothing else does.', meta: ['MaDE + RTVF', 'Northwestern ’27', 'Wuhan'], take: 'The missing piece is a person.', quip: 'watch this.' },
];

export const COPY = {
  nav:    { name: 'KookyTiger', sub: 'Zishu Kay Tu', links: ['Work', 'About', 'Archives'] },
  loader: { title: 'KookyTiger', sub: 'stacking twelve pieces' },
  header: { statement: ['Eleven things I built.', 'One thing I am.'], scroll: 'Scroll to drop' },
  hero:   { words: ['KOOKY', 'T-SHAPED', 'TIGER'], reveal: ['MADE + RTVF', 'NORTHWESTERN ’27', 'WUHAN → EVANSTON'], indication: '(Click the tiger)' },
  intro:  {
    big:   ['你好.', 'I make products, films, games and spreadsheets — which is either four things or one thing, depending on how you stack them.'],
    small: ['T-shaped, as in wide across and deep in one stem.', 'Also as in Tu. Also as in the one piece that fits sideways into a gap nothing else does.'],
    reel:  'Watch reel',
  },
  well:   { title: 'Selected pieces', hint: 'scroll = gravity', hover: 'click the tiger' },
  clear:  { words: ['LINE', 'CLEAR'], sub: '× 2 · piece of cake', tiger: 'piece of cake.' },
  archives: { title: 'Archives', note: 'everything that fell somewhere' },
  footer: { words: ['LET’S CLEAR', 'A FEW LINES', 'TOGETHER'], sayhi: 'Say hi ↗', email: 'kaytu2027@u.northwestern.edu', bottom: ['Zishu Kay Tu', 'Northwestern MaDE + RTVF', '© 2026'] },
};

export const ARCHIVE = [
  ['WIND × DFA', 'Service design workbook', 'Design for America', '2025'],
  ['GiftMe', 'Wishlist / gifting iOS app', 'Co-founder', '2026'],
  ['Reverie', 'Dream journaling app', 'Personal', '2026'],
  ['隐藏的宝藏', 'Scenic design — mobile reveal wall', 'Theatre', '2025'],
  ['People Like Us', 'Logo animation — morphing gears', 'Client', '2025'],
  ['The Last to Look Away', 'Worldbuilding — Aperture Metropolitan', 'Worldbuilding for Games', '2026'],
  ['MiraclePlus', 'Investment analyst intern', 'Beijing', '2025'],
  ['CISA', 'Board — Chinese International Student Association', 'Northwestern', '2024–'],
];

// Camera rails per phase (world units; well cell = 1, floor y = 0, front z = +).
export const CAMERA = {
  // header: start at the tiger's eye level in the pool of light, dolly out + rise to reveal the empty well
  header: { from: { pos: [0.6, 1.6, 7.2], look: [0, 1.15, 0] }, to: { pos: [0, 5.6, 17.2], look: [0, 3.6, 0] } },
  well:   { pos: [0, 4.4, 16.8], look: [0, 3.4, 0], followStack: 0.55, followX: 0.14, sideShift: -2.4 },
  clear:  { from: { pos: [0, 5.5, 17], look: [0, 4, 0] }, to: { pos: [0, 6.5, 20], look: [0, 4.2, 0] } },
  mouse:  { yaw: 0.028, pitch: 0.03, damping: 0.15 },   // Laurens's numbers
};

export const MOTION = {
  reveal: { ease: '0.4, 0, 0, 1', duration: 1.125, stagger: 0.1, heroStagger: 0.25 },   // Léo's numbers
  hide:   { ease: '0.86, 0, 0.07, 1', duration: 0.75 },
  cursor: { inDuration: 0.65, inEase: 'elastic.out(0.75)', outDuration: 0.3, outEase: 'expo.out' },
  drop:   { rowsPerScreen: 1, holdFraction: 0.62 },   // stepped fall: hold, then snap to the next row
};

export const SKY = { pure: '#0B0C10', projects: '#0E1020', white: '#F1F1EE', flipMs: 800 };

// Stage lighting per sky stage (0 pure / 1 projects / 2 white). Spot = the one theatre light above the well.
export const LIGHT = {
  exposure: 0.9,
  spot:  { color: 0xfff4e4, pos: [0.8, 24, 5.5], intensity: [1000, 2000, 900], angle: [0.13, 0.5, 0.58], penumbra: 0.6 },
  hemi:  { sky: 0x3a4050, ground: 0x05060a, intensity: [0.16, 0.42, 1.5] },
  fill:  { color: 0x8fa3ff, intensity: [0.08, 0.3, 1.1] },
  tint:  { intensity: 7, distance: 9 },
  well:  { dark: { wall: 0x0c0e13, rim: 0x14161d, grid: 0x0b0d12, lines: 0x2b2e38 }, light: { wall: 0xe4e4df, rim: 0xd6d6d1, grid: 0xededea, lines: 0x000000 } },
};
