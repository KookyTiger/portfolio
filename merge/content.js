// ─────────────────────────────────────────────────────────────
// KookyTiger — MERGED LAYOUT (Léo × Laurens). Content & tuning.
// Paper blocks carry the words (Léo). Windows show the world: the tiger climbing DOWN a ladder on the right,
// its clips scrubbed by scroll (Laurens), project cards rising past it on the left (Laurens). Cards are paper in Léo's project format;
// the picture on each card is the object's silhouette, not a box.
// ─────────────────────────────────────────────────────────────

export const CATS = {
  product:   { name: 'Product design', tint: '#D6D9CF' },
  game:      { name: 'Games',          tint: '#D9D2DC' },
  film:      { name: 'Film',           tint: '#DDD3C8' },
  analytics: { name: 'Analytics',      tint: '#CFD6DE' },
};

// Placeholder silhouettes: flat ink cut-outs of the object each project is about (viewBox 0 0 200 140).
// `p` = paper colour cut-outs (holes) so the shape reads as an object, not a blob.
const PAPER_C = '#F1F1EE';
export const SIL = {
  level:   `<rect x="20" y="104" width="160" height="12" rx="6"/><rect x="66" y="56" width="68" height="46" rx="10"/><rect x="58" y="40" width="84" height="22" rx="11"/><rect x="66" y="45" width="68" height="12" rx="6" fill="${PAPER_C}"/><circle cx="104" cy="51" r="5"/><path d="M60 104 q0 -14 14 -14 h52 q14 0 14 14" fill="none" stroke="#111" stroke-width="8"/>`,
  map:     `<path d="M40 22 h44 v26 l30 -8 l40 14 l16 28 l-20 26 l-30 6 l-26 18 l-22 -14 l-24 -30 l-8 -34 z"/><circle cx="72" cy="52" r="7" fill="${PAPER_C}"/><circle cx="106" cy="70" r="7" fill="${PAPER_C}"/><circle cx="132" cy="90" r="7" fill="${PAPER_C}"/><circle cx="84" cy="98" r="7" fill="${PAPER_C}"/>`,
  caster:  `<rect x="94" y="14" width="30" height="26" rx="6"/><rect x="102" y="38" width="14" height="30"/><path d="M82 66 h54 v12 h-8 v34 h-10 v-34 h-18 v34 h-10 v-34 h-8 z"/><circle cx="109" cy="106" r="24"/><circle cx="109" cy="106" r="7" fill="${PAPER_C}"/><rect x="26" y="112" width="150" height="8" rx="4"/>`,
  ladder:  `<rect x="34" y="86" width="34" height="34" rx="6"/><rect x="82" y="60" width="34" height="60" rx="6"/><rect x="130" y="30" width="34" height="90" rx="6"/><circle cx="51" cy="72" r="8"/><circle cx="99" cy="46" r="8"/><circle cx="147" cy="16" r="8"/>`,
  headset: `<rect x="30" y="44" width="140" height="62" rx="24"/><circle cx="76" cy="75" r="16" fill="${PAPER_C}"/><circle cx="124" cy="75" r="16" fill="${PAPER_C}"/><path d="M40 60 q60 -46 120 0" fill="none" stroke="#111" stroke-width="10"/><rect x="86" y="96" width="28" height="10" rx="5" fill="${PAPER_C}"/>`,
  board:   `<path d="M14 66 l150 -18 q22 -2 22 18 v10 q0 16 -18 18 l-154 6 z"/><rect x="54" y="66" width="84" height="12" rx="6" fill="${PAPER_C}"/><rect x="24" y="96" width="140" height="6" rx="3"/>`,
  funnel:  `<path d="M30 24 h140 l-52 56 v34 l-36 10 v-44 z"/><circle cx="74" cy="12" r="5"/><circle cx="100" cy="8" r="4"/><circle cx="126" cy="14" r="5"/><rect x="82" y="118" width="36" height="6" rx="3"/>`,
  house:   `<path d="M100 18 l72 52 v56 h-144 v-56 z"/><rect x="118" y="86" width="26" height="40" fill="${PAPER_C}"/><rect x="60" y="82" width="26" height="22" fill="${PAPER_C}"/><path d="M64 96 q0 -14 12 -14 q12 0 12 14 v10 q-6 -4 -12 0 q-6 4 -12 0 z" fill="#111"/><circle cx="72" cy="94" r="2" fill="${PAPER_C}"/><circle cx="80" cy="94" r="2" fill="${PAPER_C}"/>`,
  reel:    `<circle cx="84" cy="70" r="50"/><circle cx="84" cy="70" r="9" fill="${PAPER_C}"/><circle cx="84" cy="38" r="9" fill="${PAPER_C}"/><circle cx="84" cy="102" r="9" fill="${PAPER_C}"/><circle cx="56" cy="54" r="9" fill="${PAPER_C}"/><circle cx="112" cy="54" r="9" fill="${PAPER_C}"/><circle cx="56" cy="86" r="9" fill="${PAPER_C}"/><circle cx="112" cy="86" r="9" fill="${PAPER_C}"/><path d="M128 96 q40 -30 60 6 v20 h-60 z"/>`,
  capsule: `<rect x="36" y="58" width="130" height="44" rx="22" transform="rotate(-24 100 80)"/><rect x="36" y="58" width="65" height="44" rx="22" transform="rotate(-24 100 80)" fill="${PAPER_C}" stroke="#111" stroke-width="8"/><rect x="146" y="20" width="18" height="52" rx="4"/><path d="M136 70 h38 l16 44 h-70 z"/>`,
  table:   `<ellipse cx="100" cy="76" rx="58" ry="26"/><ellipse cx="100" cy="76" rx="42" ry="16" fill="${PAPER_C}"/><rect x="92" y="24" width="16" height="16" rx="4"/><rect x="92" y="112" width="16" height="16" rx="4"/><rect x="26" y="68" width="16" height="16" rx="4"/><rect x="158" y="68" width="16" height="16" rx="4"/><rect x="48" y="36" width="16" height="16" rx="4"/><rect x="136" y="36" width="16" height="16" rx="4"/>`,
};

export const PIECES = [
  { name: 'LevelUp',               cat: 'product',   year: '2025', sil: 'level',   img: 'assets/projects/levelup.webp', silImg: 'assets/projects/levelup-sil.webp', desc: 'A clip-on bubble level for barbells, iterated from 70 sketches down to one $1.30 part.', meta: ['DTC', 'prototype'], take: '80% of testers picked it over the two competing concepts. It still failed three specs, and the report says which.',
    detail: { line: 'Built after watching gym-goers at SPAC misalign bars without ever noticing.', tools: 'AEIOU observational research at SPAC · user and lift-coach interviews · structured ideation (70 sketches → 21 → 3 concepts) · three-setting mockup testing · 3D printing · Colab analysis of time-per-rep data', numbers: 'Against spec: 4.35/5 visibility (goal 4/5), 2.5 s setup (goal < 5 s), $1.30 unit cost (goal < $10), 100% of reps level (goal ≥ 90%). It failed three: it interfered with movement for 1 in 3 users, fit only 28.5 mm bars, and came in at 0.98 s per rep.', one: 'During bench-press testing the bubble hit the tester’s chest and split into several smaller bubbles — the device defeating its own readout. The final surface-tension fix exists because of that.' } },
  { name: 'Austin Vaccine Siting', cat: 'analytics', year: '2025', sil: 'map',     desc: 'Clustered 42 Austin ZIP areas to site vaccine distribution: k-medoids first, then two Gurobi integer programs.', meta: ['IEMS 313', 'optimization'], take: 'We handed back two answers and said which one to pick depending on what you care about.',
    detail: { line: 'Balancing CDC social vulnerability, population-weighted distance and human mobility — first as a custom k-medoids heuristic, then reformulated as two competing integer programs.', tools: 'Python · Gurobi (gurobipy) · pandas, numpy, scikit-learn · integer programming · k-medoids with a population-balance penalty · Haversine distance · CDC SVI, census ZCTA and mobility-visit data · TIGER shapefiles', numbers: 'The all-pairs model at K = 2 splits Austin into clusters within 1% of each other by population, at 15% suboptimality on distance and vulnerability and 10% on connectivity. The medoids model reaches an objective value 15× better — but doesn’t balance population nearly as well. Weights came out of 132 generated cluster maps across 11 weight ratios.', one: 'We didn’t hand back one answer. We handed back two, and said which one to pick depending on whether you care more about serving equal populations or about the number in the objective function.' } },
  { name: 'No-Tip-Clip',           cat: 'product',   year: '2025', sil: 'caster',  desc: 'An anti-tip caster for wheelchairs carrying halo-traction patients at Shriners Children’s.', meta: ['DTC', 'clinical'], take: 'Proxy testing killed the obvious counterweight idea exactly where patients needed it most. $62.26, printed.',
    detail: { line: 'A 3D-printed adjustable clamp and caster that works like a training wheel on a bicycle.', role: 'Ran and documented the mockup user-testing phase — wrote the Mockup Feedback and Testing Summaries, running proxy-user tests on three competing concepts in the Segal Prototyping Lab and outdoors.', tools: 'Client interviews and a site visit to Shriners Children’s Hospital · secondary research on halo traction · proxy-user testing with weighted loads and timed obstacle courses · 3D printing (Cura, 95% infill, ~50 h print) · McMaster-Carr hardware sourcing', numbers: 'Proxy-user testing scored stability 2/10 at 1 kg rising to 8/10 at 5–10 kg against a fixed 7 kg halo load, with flexibility falling 5/10 → 4/10 as weight increased — the data that killed the weight-bag concept. Final clamp assembly bills out at $62.26, with a cutout radius sized ~1.5× standard frame tubing.', one: 'A $62 printed part for a real pediatric hospital safety problem — chosen because proxy testing showed the “obvious” counterweight solution got worse exactly where patients needed it most.' } },
  { name: 'CASE × Ama La Vida',    cat: 'analytics', year: '2025', sil: 'ladder',  desc: 'Pricing and retention strategy for a virtual career-coaching company, from five years of churn data.', meta: ['consulting', 'pricing'], take: '43% of cancellations said “goal achieved.” The product was working. That’s an argument for charging more.',
    detail: { line: 'Built from competitor benchmarking and 2020–2024 membership churn data.', role: 'Pricing & Retention Strategies workstream (with two other analysts), on a six-analyst team under two project managers.', tools: 'Competitor pricing benchmarking · churn and retention cohort analysis · pricing-tier design · implementation planning · client presentation', numbers: 'Recommended raising the ceiling from $189.50 to $250 per session, restructuring the 12-session bundle from $1,933 to $2,550 and the 24-session from $3,638 to $4,800. 12-month retention falls from 14% on the 1×-monthly plan to 4% on 2×-monthly; 43.3% of cancellations cite “goal achieved” rather than price — only 3.9% say they didn’t see value.', one: 'The churn data said the product was working, not failing — people were leaving because they’d finished. That’s an argument for charging more, not less.' } },
  { name: 'Neighbors',             cat: 'film',      year: '2026', sil: 'headset', desc: 'A VR film. You cannot cut. You can only wait.', meta: ['RTVF', 'VR'], take: 'In VR the edit is the viewer.',
    detail: { line: 'A VR film. You cannot cut. You can only wait.', one: 'In VR the edit is the viewer.', todo: 'Kay: add role, tools and a still — nothing verified beyond the card yet.' } },
  { name: 'Slide Master',          cat: 'product',   year: '2025', sil: 'board',   desc: 'A wheelchair-to-shower transfer board for Shirley Ryan AbilityLab, built around friction, stability and pinching.', meta: ['DSGN 308', 'wood'], take: 'The plywood mockup cracked under a person. That failure, not a calculation, is why the final board is pine.',
    detail: { line: 'Redesigned around the three failures of existing boards: skin friction, instability, and finger pinching.', role: 'Co-wrote the Design Concept and Rationale; front matter and references; presented existing solutions and ran the demo at the poster session.', tools: 'User interviews and on-site observation at Shirley Ryan AbilityLab · iterative mockup testing · woodworking (jigsaw, drill press, band saw, sander) · drawer-slide mechanism · orthographic drafting', numbers: 'Final board 29″ × 9″ × 0.75″ with a 23″ × 3″ hollow cavity, a 10° tapered onboarding end chosen after testing multiple mockup angles, and a 10″ × 11″ sliding seat platform on 12″ drawer rails.', one: 'The plywood mockup cracked under a person’s weight during testing. That failure, not a calculation, is why the final board is solid pine.' } },
  { name: 'CASE × Yello',          cat: 'analytics', year: '2024', sil: 'funnel',  desc: 'Mapped the HR-tech landscape for a talent-acquisition platform and found the public-sector opening.', meta: ['consulting', 'market sizing'], take: '98.8% of the Fortune 500 already run an ATS. The opening isn’t displacement, it’s adjacency.',
    detail: { line: 'Competitive landscape, partnership and expansion targets for a talent-acquisition software company — including the federal public-sector opening.', role: 'Partnership Identification & Expansion workstream (with two other analysts).', tools: 'Competitive and SWOT analysis of ATS vendors · market sizing · secondary research synthesis (Gartner, Deloitte, McKinsey, J.P. Morgan) · partnership target identification', numbers: '98.8% of the Fortune 500 already run an ATS, and Workday holds 37.1% of that market to SuccessFactors’ 13.1%. 55% of recruiting executives expect to spend more on recruiting tech; 80% of vendors are expected to embed AI by 2027.', one: 'The opening isn’t displacement, it’s adjacency.' } },
  { name: 'Northwestern Game Jam', cat: 'game',      year: '2026', sil: 'house',   desc: 'A Taoist exorcist hired to cleanse a haunted show-home, and the grandmother who refused to leave.', meta: ['game jam', 'Godot'], take: 'The concept pivoted three times. The question never changed: who has more claim to a home.',
    detail: { line: 'Northwestern Game Jam 2026, theme “Twist of Fate” — a four-person team, showcased May 9.', role: 'Wrote the game design document and the narrative bible.', tools: 'Game design documentation · narrative bible · Godot 4 (2D) · AI-generated character and environment art · asset pipeline organization', one: 'The concept pivoted three times — Airbnb guests in the walls, then a sublet roommate in the walls, then a ghost displaced by gentrification — but the question never changed: who has more claim to a home, the person who owns it or the person who lived in it.' } },
  { name: 'Running',               cat: 'film',      year: '2026', sil: 'reel',    desc: 'AI-assisted short, RTVF 376.', meta: ['RTVF 376', 'storyboard'], take: 'The storyboard survived. The model didn’t.',
    detail: { line: 'AI-assisted short, RTVF 376.', one: 'The storyboard survived. The model didn’t.', todo: 'Kay: add role, tools and a frame — nothing verified beyond the card yet.' } },
  { name: 'AMG-786',               cat: 'analytics', year: '2025', sil: 'capsule', desc: 'Financial analysis of a drug candidate: 10-year revenue forecast, risk-adjusted NPV.', meta: ['CIV_ENV 205', 'Excel'], take: '“Proceed, but wary of Phase II.” Half of pricing is deciding what not to count.',
    detail: { line: 'A go / no-go on a drug candidate, priced against Wegovy, Mounjaro and Ozempic.', role: 'Calculator — the Excel model behind the numbers; authored the mechanism comparison and the pricing table (Wegovy $1,349/mo, Mounjaro $1,100, Ozempic $959.60; inflation-adjusted 2033 average $1,470.41).', tools: 'Excel · revenue forecasting · risk-adjusted NPV · comparable pricing', numbers: '10-year revenue forecast of $3.37B; risk-adjusted NPV positive; recommendation: proceed, but wary of Phase II.', one: 'Half of pricing is deciding what not to count.' } },
  { name: 'One Birth Too Many',    cat: 'game',      year: '2025', sil: 'table',   desc: 'A Twine game set in a 1983 Chinese village under the One-Child Policy. One Friday morning, six perspectives, one dinner table.', meta: ['RTVF 360', 'Twine'], take: 'Choices in one character’s morning silently change another’s. You find out at dinner.',
    detail: { line: 'Replay one Friday morning from up to six perspectives before they all collide at a single dinner table.', role: 'Sole writer and designer (RTVF 360, Writing in Video Games).', tools: 'Twine / SugarCube 2.37.3 · branching narrative design · hub-and-spoke structure · multi-protagonist state tracking · HTML/JS', numbers: 'Over 10 endings across 2 playable protagonists and 6 explorable morning vignettes, converging on a five-round dinner-table confrontation with a government inspector.', one: 'Choices made in one character’s morning silently change the conditions of another’s. You don’t find that out until dinner.' } },
];

// Page rhythm: paper / window / paper / window / paper / window (Léo), three windows share one shaft (Laurens).
// Ledges with torches on the left wall of the shaft (decor behind the cards).
export const LEDGE_X = [-6.0, -2.2];
export const WINDOWS = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10]];   // project indices per window
export const CARD_ART = 'photo';                                     // 'sil' = ink silhouette cut from the photo · 'photo' = the colour cut-out itself
export const SCREEN_PER_CARD = 1.0;                                // vh per card inside a window
export const SHORE_SCREENS = 2.3;                                  // extra screens at the end of the last window (landing, turn, sit)
export const SHORE_TEXT_AT = 4.55;                                  // shore statement centre, in screens from the top of the last window (+0.5)

// The rail (Léo): camera position is a LINEAR function of page scroll, everywhere, paper included. Lenis is the only smoothing.
// Léo's header cameraParams are rangePos (0, 2.4, 4) over the 200vh header: down 2.4, forward 4. We keep those numbers.
export const RATE = 1.0;                                           // world units the camera descends per 100vh (2.0 per 200vh header ≈ ⅓ of the frame)
export const CAMERA = { x: 0, z: 5.2, pitch: -0.12, fov: 34, header: { rangeZ: 4, screens: 2 } };

// The climber (Laurens): the character stays in frame on the right; its CLIPS are scrubbed by scroll (action.time = f(scroll)).
export const TIGER = {
  x: 1.6,                 // world x of the ladder / the tiger (ndc ≈ +0.63)
  glue: 1.08,             // hips sit this far below the camera while climbing (fixed screen position, ndc y ≈ −0.33)
  ledgeY: -2.25,          // top platform (world y); camera starts at y = 0 (hips at the start of the climb sit 0.13 below it)
  ladderZ: 0,             // the ladder plane; hips hang at z = +0.33 (belly to the wall, back to you)
  rung: 0.3,              // rung spacing; each limb steps every other rung
  step: 0.6,              // world units per climb cycle (= 2 rungs) → 2 cycles per 100vh at RATE 1.2
  hipH: 0.72,             // standing hip height
  // scroll phases in screens (s = scroll / 100vh): idle → turnToWall → overEdge → climb → (landing) land → turnAround → sit
  idleEnd: 0.3, turnEnd: 0.7, edgeEnd: 1.3, landLen: 0.35, turnBackLen: 0.4,   // the edge is done before the hero paper covers the tiger
  glance: { yaw: 1.19, pitch: -0.32, turn: 0.15, hold: 0.4, back: 0.35 },   // Laurens headGlance: 68°, 28°, .15 s / .4 / .35
};

export const COPY = {
  nav:    { name: 'KookyTiger', sub: 'Zishu Kay Tu', links: ['Work', 'About', 'Archives'] },
  loader: { title: 'KookyTiger', sub: 'eleven floors' },
  header: { statement: ['Eleven floors down.', 'A monster on each.'], scroll: 'Scroll to descend' },
  hero:   { words: ['KOOKY', 'T-SHAPED', 'TIGER'], reveal: ['MADE + RTVF', 'NORTHWESTERN ’27', 'WUHAN → EVANSTON'], indication: '(Click the tiger)' },
  intro:  { big: ['你好.', 'I make products, films, games and spreadsheets — which is either four things or one thing, depending on which floor you catch me on.'], small: ['T-shaped, as in wide across and deep in one stem.', 'Also as in Tu. Also as in: every project below was a monster once. I went down and dealt with it.'], reel: 'Watch reel' },
  statements: [['T-SHAPED.', 'WIDE ACROSS,', 'DEEP IN', 'ONE STEM.'], ['ELEVEN MONSTERS.', 'EVERY ONE', 'HAD A', 'DEADLINE.']],
  shore:  { words: ['THE OTHER', 'SHORE'], sub: 'eleven floors down · grass, finally', sayhi: 'Say hi ↗', tiger: 'peace. for now.' },
  archives: { title: 'Archives', note: 'monsters too small to mention' },
  footer: { words: ['ELEVEN DOWN.', 'BRING', 'YOUR BOSS'], sayhi: 'Say hi ↗', email: 'kaytu2027@u.northwestern.edu', bottom: ['Zishu Kay Tu', 'Northwestern MaDE + RTVF', '© 2026'] },
  cursor: { tiger: 'click the tiger', card: 'open' },
  panel:  { role: 'What I did', tools: 'Tools', numbers: 'Numbers', one: 'The one thing', ask: 'Ask me for the full report ↗', close: 'Close' },
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

// Léo's camera has no mouse orbit (rotation ranges are 0); Laurens's headline tilt stays on the DOM statements.
export const MOUSE = { headline: { x: 4, y: 5, rotY: 0.28, rotX: 0.35, damping: 0.1 } };
export const MOTION = {
  reveal: { ease: '0.4, 0, 0, 1', duration: 1.125, stagger: 0.1, heroStagger: 0.25 },
  hide:   { ease: '0.86, 0, 0.07, 1', duration: 0.75 },
  cursor: { inDuration: 0.65, inEase: 'elastic.out(0.75)', outDuration: 0.3, outEase: 'expo.out' },
  header: { parallax: 800, fadeStart: 0.2, fadeEnd: 0.45 },
  drift:  { from: 4, to: -8 },     // Laurens: a card slides up a little (vh) while it is the active one
};

// Light world (Léo: the world is as light as the paper). Sky top → bottom, and the three stage tints (Laurens's thresholds).
export const SKY = { top: '#C9D3DC', bottom: '#D9D2C3', windowMix: 0.25, shore: '#E6EEEA', flipMs: 800 };
export const LIGHT = {
  exposure: 1.0,
  key:  { color: 0xFFF3E0, intensity: 0.85, intensityShore: 1.6 },
  hemi: { sky: 0xE8EEF4, ground: 0xC9C2B4, intensity: 1.2, skyShore: 0xDFF0FF, groundShore: 0x8FB36F, intensityShore: 1.25 },
  torch: { color: 0xFFE2B8, intensity: 6, distance: 8 },
  lamp:  { color: 0xFFD9A0, intensity: 8, distance: 10 },
};
