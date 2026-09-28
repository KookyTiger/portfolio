# Write-ups — the project case studies

Kay edits them in the **Studio**: online at https://kookytiger.github.io/portfolio/merge/studio/ (signed in with her
GitHub token) or on her Mac (`merge/studio/Open Studio.command` → http://localhost:8010). Claude drafts them from her Drive
(`KAY-PORTFOLIO/`, mounted at `~/Library/CloudStorage/GoogleDrive-kaytu2027@u.northwestern.edu/My Drive/KAY-PORTFOLIO`).

| Where | Repo | Holds |
|---|---|---|
| `merge/writeups-private/` | **private** `KookyTiger/portfolio-studio-private` (cloned here, gitignored by this repo) | everything being worked on: `public/<slug>.json` (public half), `<slug>.json` (private half: drafts, notes, questions, sources, log), `pictures/<slug>/`, `candidates/<slug>/`, `vision/`, `sources/`, `drafts/` |
| `merge/writeups/` | public (this repo) | only what Kay approved: `<slug>.json` + `_studio.json` (floors, templates, classes, software, skills) |
| `assets/projects/<slug>/` | public | the pictures of approved write-ups |

Approving a project (status `approved`, on the site) publishes it: the online Studio commits it straight to this repo and
the `Build site` GitHub Action rebuilds `index.html`; the local Studio writes it here and its Publish button pushes.
Pictures are always named by their published path, `assets/projects/<slug>/<file>`.

## A project (merged form — what the Studio edits and what Claude writes)

```jsonc
{
  "slug": "levelup",                 // file name; also assets/projects/<slug>/ for its pictures
  "name": "LevelUp",
  "floor": "engineering",            // engineering | design | analytics | backlog (backlog = not on the site)
  "onSite": true,
  "template": "engineering",         // stage list the blocks follow (_studio.json → templates)
  "status": "draft",                 // draft | review | approved
  "oneLiner": "…",                   // under 20 words
  "context": { "course": "DSGN 308 · Human-Centered Product Design", "when": "Spring 2025",
               "team": "Team of 4", "partner": "", "role": "What Kay did, one line" },
  "software": ["cura"],              // ids from _studio.json → software (only with evidence)
  "skills": [{ "name": "Observational research", "evidence": "research" }],   // evidence = id of the block that shows it
  "classes": ["dsgn308"],            // ids from _studio.json → classes
  "cover": "assets/projects/levelup.webp",
  "blocks": [{
    "id": "problem", "stage": "problem",
    "title": "A headline that states the thinking (≤ 8 words)",
    "text": "Paragraphs separated by a blank line. **bold**. Lines starting with '- ' become a list.",
    "layout": "text-media",          // text | text-media | media-text | gallery | full | quote | facts
    "media": [{ "src": "assets/projects/levelup/sketch-01.webp", "caption": "…", "kind": "sketch" }],
    // private (stripped from the public file):
    "draft": "Claude's text as first written — kept so we can see what Kay changed",
    "sources": [{ "label": "Final report §2", "file": "Final Deliverables/Final Report.gdoc", "id": "<drive id>" }],
    "questions": [{ "q": "Claude asks Kay…", "a": "Kay answers…" }],
    "note": "Kay tells Claude what she wants here",
    "ok": false                      // Kay approved this block
  }],
  // private:
  "log": [{ "by": "claude", "at": "2026-09-27", "text": "what changed and why" }],
  "drive": { "path": "01_engineering/bubble-level" },
  "vision": { "note": "", "refs": [] }   // Kay's reference images / layout ideas for the whole page
}
```

Public keys: everything above except `draft`, `sources`, `questions`, `note`, `ok` (per block) and `log`, `drive`,
`vision`, `legacy` (per project). The split lives in `merge/studio/server.py` and `merge/studio/backend.js` (keep them identical).

### Layouts
- `text` — a reading column. `quote` — one big sentence (the insight of the stage).
- `text-media` / `media-text` — words beside one or two pictures. `full` — one big picture, words under it.
- `gallery` — words, then a grid of pictures (sketch walls, mockup rounds).
- `facts` — a table: each line `Label | value | value`; a line starting with `!` is the header row; lines without `|` are paragraphs.

### Media kinds
`sketch` · `photo` · `mockup` · `prototype` · `test` · `cad` · `render` · `screen` · `diagram` · `chart` · `still`
A project's pictures live in the private repo's `pictures/<slug>/` (webp, ≤ 1600 px) and are copied to
`assets/projects/<slug>/` when it is published. What Claude pulled from the Drive waits in `candidates/<slug>/` until Kay picks it.

## Rules for drafts (Claude)
1. Truthful: every number, name, quote and outcome comes from a Drive source and is cited in the block's `sources`.
   What the sources don't say becomes a question to Kay, not a sentence.
2. Kay's role is exact: "I" only for what Kay did herself (Individual assignments, RAM chart, author names on sections);
   "we" for the team. Unsure → question.
3. Process over results: each stage says what we knew, what we decided and why. Failures and pivots are the story.
4. No people in pictures unless Kay says so (never patients, users or minors); no private data from clients.
5. Voice: see `writeups-private/_studio.json → voice` (Kay can edit it in the Studio → Notes).
