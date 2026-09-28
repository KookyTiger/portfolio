// ─────────────────────────────────────────────────────────────
// KookyTiger — LANTERNS × SNOW. Content & tuning config.
// A tiger walks a snowy night, lighting one lantern per project.
// Behind it, footprints. The path is a T. The last lantern stays dark.
// ─────────────────────────────────────────────────────────────

export const CATS = {
  product:   { name: 'Product design', color: '#3FB6BF', tint: '#0F2A30' },
  game:      { name: 'Games',          color: '#9B7BE0', tint: '#231A3A' },
  film:      { name: 'Film',           color: '#F08A3C', tint: '#3A2012' },
  analytics: { name: 'Analytics',      color: '#6C93E8', tint: '#16223F' },
  you:       { name: 'You',            color: '#F2A93B', tint: '#3A2A10' },
};

// 11 projects = 11 lanterns. The 12th lantern is the reader's.
export const PIECES = [
  { name: 'LevelUp',               cat: 'product',   desc: 'A clip-on bubble level for barbells, iterated from 70 sketches down to one $1.30 part.',   meta: ['DTC', 'prototype'],            take: '80% of testers picked it over the two competing concepts. It still failed three specs, and the report says which.', quip: 'level. obviously.' },
  { name: 'Austin Vaccine Siting', cat: 'analytics', desc: 'Clustered 42 Austin ZIP areas to site vaccine distribution: k-medoids first, then two Gurobi integer programs.', meta: ['IEMS 313', 'optimization'], take: 'We handed back two answers and said which one to pick depending on what you care about.', quip: 'that one has numbers in it.' },
  { name: 'No-Tip-Clip',           cat: 'product',   desc: 'An anti-tip caster for wheelchairs carrying halo-traction patients at Shriners Children’s.', meta: ['DTC', 'clinical'],           take: 'Proxy testing killed the obvious counterweight idea exactly where patients needed it most. $62.26, printed.', quip: 'it holds. told you.' },
  { name: 'CASE × Ama La Vida',    cat: 'analytics', desc: 'Pricing and retention strategy for a virtual career-coaching company, from five years of churn data.', meta: ['consulting', 'pricing'],   take: '43% of cancellations said “goal achieved.” The product was working. That’s an argument for charging more.', quip: 'pricey glow.' },
  { name: 'Neighbors',             cat: 'film',      desc: 'A VR film. You cannot cut. You can only wait.',                                              meta: ['RTVF', 'VR'],                  take: 'In VR the edit is the viewer.', quip: 'don’t look directly at it.' },
  { name: 'Slide Master',          cat: 'product',   desc: 'A wheelchair-to-shower transfer board built around friction, stability and pinching.', meta: ['DSGN 308', 'wood'], take: 'The plywood mockup cracked under a person. That failure, not a calculation, is why the final board is pine.', quip: 'smooth. suspiciously smooth.' },
  { name: 'CASE × Yello',          cat: 'analytics', desc: 'Mapped the HR-tech landscape for a talent-acquisition platform and found the public-sector opening.', meta: ['consulting', 'market sizing'], take: '98.8% of the Fortune 500 already run an ATS. The opening isn’t displacement, it’s adjacency.', quip: 'yellow. as advertised.' },
  { name: 'Northwestern Game Jam', cat: 'game',      desc: 'A Taoist exorcist hired to cleanse a haunted show-home, and the grandmother who refused to leave.', meta: ['game jam', 'Godot'],      take: 'The concept pivoted three times. The question never changed: who has more claim to a home.', quip: 'something moved in there.' },
  { name: 'Running',               cat: 'film',      desc: 'AI-assisted short, RTVF 376.',                                                                meta: ['RTVF 376', 'storyboard'],      take: 'The storyboard survived. The model didn’t.', quip: 'it kept running.' },
  { name: 'AMG-786',               cat: 'analytics', desc: 'Financial analysis of a drug candidate: 10-year revenue forecast, risk-adjusted NPV.',           meta: ['CIV_ENV 205', 'Excel'],        take: '“Proceed, but wary of Phase II.” Half of pricing is deciding what not to count.', quip: 'mostly water and a little pricing.' },
  { name: 'One Birth Too Many',    cat: 'game',      desc: 'A Twine game set in a 1983 Chinese village under the One-Child Policy. One Friday morning, six perspectives, one dinner table.', meta: ['RTVF 360', 'Twine'], take: 'Choices in one character’s morning silently change another’s. You find out at dinner.', quip: 'careful. that one’s personal.' },
  { name: 'Your project',          cat: 'you',       desc: 'Unlit. Eleven lanterns took me from Wuhan to here. The twelfth is the one we light together.', meta: ['open for work', '2027'], take: 'This one’s yours.', quip: 'this one’s yours.' },
];

// Lantern positions on the ground (x, z). The path is a T: seven across, five deep.
// Walking order = index. The tiger starts at START, walks the bar left→right, runs back to
// the junction, then walks the stem toward the reader. Lantern 11 (the last) stays dark.
export const START = [15.5, -6];
export const LANTERNS = [
  [12, -6], [8, -6], [4, -6], [0, -6], [-4, -6], [-8, -6], [-12, -6],   // the bar, walked right → left (camera sits behind it)
  [0, -2], [0, 2], [0, 6], [0, 10],                                      // the stem
  [0, 14],                                                               // yours
];
export const TURN_SCREEN = 7;          // screen index where the tiger runs back to the junction
export const JUNCTION = [0, -6];
export const REACH = 0.72;             // local progress at which the tiger reaches the lantern

export const COPY = {
  nav:    { name: 'KookyTiger', sub: 'Zishu Kay Tu', links: ['Work', 'About', 'Archives'] },
  loader: { title: 'KookyTiger', sub: 'lighting twelve lanterns' },
  header: { statement: ['Eleven lanterns I lit.', 'One I saved for you.'], scroll: 'Scroll to walk' },
  hero:   { words: ['KOOKY', 'T-SHAPED', 'TIGER'], reveal: ['MADE + RTVF', 'NORTHWESTERN ’27', 'WUHAN → EVANSTON'], indication: '(Click the tiger)' },
  intro:  {
    big:   ['你好.', 'I make products, films, games and spreadsheets — which is either four things or one thing, depending on how far you walk.'],
    small: ['T-shaped, as in wide across and deep in one stem.', 'Also as in Tu. Also as in the path below: seven lanterns wide, then five deep. Look down at the end.'],
    reel:  'Watch reel',
  },
  walk:   { title: 'The walk', hint: 'scroll = walk', hover: 'click the tiger' },
  dawn:   { words: ['ONE', 'LEFT'], sub: 'eleven lit · the last one’s yours', tiger: 'this one’s yours.' },
  archives: { title: 'Archives', note: 'everything else in the snow' },
  footer: { words: ['LET’S LIGHT', 'THE LAST ONE', 'TOGETHER'], sayhi: 'Say hi ↗', email: 'kaytu2027@u.northwestern.edu', bottom: ['Zishu Kay Tu', 'Northwestern MaDE + RTVF', '© 2026'] },
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

// Camera rigs (world units). Offsets are relative to the tiger.
export const CAMERA = {
  header: { from: { off: [-3.4, 1.15, -5.4], look: [-0.3, 0.72, 0] }, to: { off: [-3.2, 3.6, -11.5], look: [-1.4, 0.8, 1] } },
  bar:    { off: [-1.6, 2.7, -8.8], look: [-0.9, 0.8, 0], side: 1.9 },   // camera behind the bar (-z), tiger walks -x = screen right
  stem:   { off: [-8.8, 2.7, 1.6], look: [0, 0.8, 0.9], side: 1.9 },     // camera on the -x side, tiger walks +z = screen right
  dawn:   { pos: [0, 40, 24], look: [0, 0, 2] },                        // the T from above
  mouse:  { yaw: 0.028, pitch: 0.03, damping: 0.15 },
};

export const MOTION = {
  reveal: { ease: '0.4, 0, 0, 1', duration: 1.125, stagger: 0.1, heroStagger: 0.25 },
  hide:   { ease: '0.86, 0, 0.07, 1', duration: 0.75 },
  cursor: { inDuration: 0.65, inEase: 'elastic.out(0.75)', outDuration: 0.3, outEase: 'expo.out' },
};

export const SKY = { night: '#0A0C16', walk: '#0C1020', dawn: '#F1F1EE', flipMs: 900 };

export const LIGHT = {
  exposure: 1.0,
  moon:  { color: 0x9fb4ff, intensity: [0.75, 0.7, 0.0], pos: [-10, 20, 14] },
  hemi:  { sky: 0x2a3350, ground: 0x0a0b12, intensity: [0.5, 0.45, 1.05] },
  fill:  { color: 0xffe9c8, intensity: [0.18, 0.12, 0.7] },
  lantern: { intensity: 15, distance: 11, decay: 2 },
  snow:  { night: 0xcfd6e6, dawn: 0xeeeeea },
};
