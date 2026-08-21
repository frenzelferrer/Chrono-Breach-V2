# CHRONO//BREACH — AI Project Handout

> Use this file as the source of truth when asking an AI to write portfolio copy, a case study, project captions, interview talking points, or social posts about CHRONO//BREACH. Do not invent facts that are not documented here.

## Quick identity

- **Project name:** CHRONO//BREACH V2
- **Project type:** Browser-based, high-speed arena roguelite / arcade shooter
- **Platform:** Desktop and mobile web
- **Core fantasy:** Pilot an evolving ship through an unstable time breach, using movement, gunplay, dashes, parries, and time-bending abilities to survive escalating enemy waves and large boss encounters.
- **Tagline:** **BEND TIME. BREAK LIMITS. SURVIVE THE BREACH.**
- **Current repository shape:** A single-page HTML5 Canvas game with a separate TypeScript/Express cloud API and browser-based admin console.
- **Live demo URL:** `[ADD LIVE URL]`
- **Repository URL:** `[ADD REPOSITORY URL, OR REMOVE IF PRIVATE]`
- **Creator/role:** `[ADD YOUR NAME AND EXACT ROLE]`
- **Project period:** `[ADD START DATE–END DATE OR “ONGOING”]`

## One-sentence summary

CHRONO//BREACH is a neon sci-fi arena roguelite built for the browser, combining fast twin-stick-style combat, time-manipulation abilities, randomized run upgrades, persistent loadouts, multi-stage boss progression, and optional offline-first cloud saves and global leaderboards.

## Portfolio-ready short description

CHRONO//BREACH is a responsive HTML5 Canvas arena roguelite in which players dash through projectile-heavy encounters, reflect attacks, slow time, evolve their ship, and assemble increasingly powerful builds. Its five-sector campaign expands into Titan, Endless, Paradox, Eternal Breach, and New Game+ progression, while an optional TypeScript/Express and PostgreSQL backend adds recoverable pilot profiles, conflict-aware cloud saves, leaderboards, announcements, and an audited admin CMS. The game remains playable offline and queues cloud writes until connectivity returns.

## What the player does

The normal play loop is:

1. Choose an unlocked sector and configure a pre-run loadout.
2. Fight four escalating enemy waves in a real-time Canvas arena.
3. Move, aim, fire, phase-dash, use a tactical skill, and spend a full energy bar on a Chrono skill.
4. Collect XP to level up during the run and select randomized upgrades with rarity tiers.
5. Evolve the ship through five visual/power tiers: Scout, Hunter, Vanguard, Sentinel, and Apex.
6. Defeat the sector boss to earn currencies, record the run, and unlock further progression.
7. Spend Credits on permanent modules, active skills, and passive Augment Shards before the next run.

On desktop, the main controls are WASD to move, mouse to aim and fire, Space to dash, E for the equipped Tactical Skill, Q for the equipped Chrono Skill, and Escape to pause. Touch devices use landscape-oriented twin-stick controls.

## Main content and progression

### Five-sector campaign

| Sector | Environment | Difficulty | Boss |
|---|---|---:|---|
| Outer Rim | Drone-patrolled edge of the breach | Easy | Sentinel MK-I |
| Forgotten Belt | Asteroid-filled debris field | Normal | Hydra Prime |
| Void Fields | Gravity anomalies and elite forces | Hard | Void Reaper |
| Time Ripple | Teleporting temporal distortion | Very Hard | Oblivion Core |
| Chronos Rift | Combined gravity and dimensional instability | Extreme | Chronos Titan |

The sectors introduce environmental and encounter modifiers such as asteroids, gravity, and teleportation.

### Endgame structure

- **Titan victory:** Defeating Chronos Titan awards Titan Core status and unlocks Endless Mode.
- **Build continuation:** A Titan-winning build can be saved and resumed into Endless Mode.
- **Endless Mode:** Escalating staged boss chains preserve the player’s completed build.
- **Convergence:** The five Ascended campaign bosses are fought together.
- **Paradox Sovereign:** A true-endgame boss formed from the merged boss cores.
- **Paradox victory:** Awards Paradox Conqueror status and unlocks New Game+.
- **Eternal Breach:** Preserves the winning build and scales difficulty and modified boss encounters indefinitely.
- **New Game+:** Replays the campaign with empowered enemies and bosses.
- **Boss retry checkpoints:** Players can retry supported boss phases from a captured pre-fight build state.

## Combat and build systems

- Real-time aiming and shooting with enemy projectiles that can be avoided, intercepted, cleared, or reflected.
- Phase dash with brief invulnerability.
- Energy-based time manipulation and offensive/recovery powers.
- Four enemy archetypes: Drone, Strafer, Juggernaut, and shielded Elite Warden.
- Six named bosses, including the Paradox Sovereign, with distinct ability sets and presentation.
- Five in-run upgrade categories: Offense, Defense, Utility, Mobility, and Special.
- 26 randomized in-run upgrades and four explicit upgrade synergies.
- Four rarity tiers: Common, Rare, Epic, and Legendary.
- 16 permanent Hangar modules, each with five levels.
- Eight purchasable passive Augment Shards; up to three can be equipped.
- Four Tactical Skills: Zero Parry, Aegis Pulse, Repulsor Burst, and Phase Blink.
- Four Chrono Skills: Time Fracture, Chrono Nova, Overclock, and Rewind Protocol.
- Persistent currencies and progression include Credits, Chrono Shards, Titan Cores, sector unlocks, best scores, and endgame records.
- Score tracking includes wave, sector, ship level, kills, boss kills, clear time, Titan status, Paradox status, and Eternal level.

## UX, presentation, and accessibility

- Neon sci-fi visual direction rendered primarily with Canvas drawing and CSS UI.
- Responsive desktop and mobile layouts.
- Landscape rotation guidance and twin-stick touch input for phones and tablets.
- Synthesized sound effects using the Web Audio API rather than bundled audio assets.
- Configurable master volume, screen shake, particle density, and reduced motion.
- Pause, how-to-play, sector map, loadout, shop, victory, and leaderboard interfaces.
- Cached leaderboard data and local progression support continued use when offline.

## Technical architecture

```text
Browser client (index.html + config.js)
├── Canvas rendering, game loop, input, audio, UI, and gameplay data
├── localStorage progression, settings, cached boards, and cloud outbox
└── Optional HTTPS calls to the cloud API
        │
        ▼
TypeScript + Express API (server/)
├── Zod request validation
├── Session and recovery credential hashing
├── Rate limiting, Helmet, and configured CORS
├── Pilot profiles, save revisions, run submission, and leaderboards
├── Live announcements
└── Admin API and static admin console
        │
        ▼
PostgreSQL via Drizzle ORM
├── pilots and sessions
├── runs and per-category leaderboard entries
├── announcements
└── immutable admin audit log
```

### Frontend

- HTML, CSS, and vanilla JavaScript
- HTML5 Canvas 2D rendering
- `requestAnimationFrame` game loop
- Pointer, keyboard, mouse, and touch input
- Web Audio API synthesis
- `localStorage` persistence
- Static deployment configuration for Vercel

The game client is intentionally concentrated in `index.html` (roughly 3,000 lines / 228 KB in the current repository), making it deployable as a static site without a frontend build step.

### Backend

- Node.js 20+
- TypeScript
- Express 5
- PostgreSQL
- Drizzle ORM and SQL migrations
- Zod validation
- Helmet, CORS, and Express rate limiting
- Node Crypto for random tokens, hashes, HMAC-signed admin sessions, and timing-safe comparisons
- Render deployment blueprint with a database health check

### Cloud and offline behavior

- The backend is optional; local play does not depend on API availability.
- Players may create an anonymous callsign-based cloud pilot without email or social login.
- A one-time recovery code restores a pilot and is rotated after recovery.
- Session tokens and recovery codes are stored server-side only as hashes.
- The browser stores unsent saves and run records in an outbox and replays them after reconnecting.
- Save revisions provide optimistic concurrency control. Stale saves receive the current server profile instead of overwriting newer state.
- Submitted runs use client event UUIDs for idempotency and basic plausibility validation.
- Global boards cover top scores, Titan Champions, and Paradox Conquerors; local cached boards remain available offline.

### Admin CMS

The Render-hosted admin console can:

- Search pilots and inspect profiles and recent runs.
- Grant or remove Credits, Chrono Shards, and Titan Cores with a required reason.
- Update callsigns, progression, suspension, and leaderboard visibility.
- Revoke a pilot’s sessions.
- Schedule, categorize, publish, and unpublish in-game announcements.
- Review an immutable audit trail of administrative actions.

Administrative progression changes increment the pilot revision so a stale offline save cannot silently erase a grant or moderation update.

## Engineering points worth highlighting in a portfolio

1. **A complete game without a framework:** The project implements rendering, input, collision-driven combat, enemy and boss behaviors, progression, menus, audio, persistence, and responsive controls using browser-native APIs.
2. **Offline-first rather than merely offline-capable:** Local play is the default-safe path, while an outbox synchronizes saves and run events once the network returns.
3. **Conflict-aware state synchronization:** Profile revisions prevent older browser state from overwriting newer cloud or administrator changes.
4. **Endgame as a connected progression system:** Campaign completion flows into saved-build Endless Mode, Convergence, the Paradox Sovereign, Eternal Breach, and New Game+.
5. **Cross-input design:** The same combat model supports keyboard/mouse and landscape twin-stick touch controls.
6. **Operational tooling:** The project includes database migrations, deployment configuration, health checking, announcements, moderation controls, and an audit log—not only player-facing gameplay.
7. **Layered validation and abuse resistance:** The API validates data shape and ranges, rate-limits sensitive endpoints, checks run plausibility, uses idempotent event IDs, and filters suspended or hidden pilots from boards.

## Challenges an AI may discuss—only if confirmed by the creator

The code suggests these likely engineering challenges, but they should be phrased as implementation topics rather than personal claims until the creator confirms them:

- Balancing projectile-heavy combat while keeping Canvas rendering responsive on desktop and mobile.
- Designing bosses that remain readable as multiple encounters are combined in Endless and Convergence modes.
- Preserving a complex run build across victory transitions and boss retry checkpoints.
- Reconciling local-first progression with cloud revisions, recovery, idempotent run submission, and administrator updates.
- Keeping a large single-file client maintainable while retaining zero-build static deployment.
- Making touch controls feel viable for a fast mouse-oriented shooter.

## Suggested portfolio case-study outline

1. **Hero:** Project name, one-line pitch, gameplay screenshot or clip, live demo, and repository link.
2. **Overview:** What the game is, the intended experience, your role, and the project timeline.
3. **Gameplay:** Core combat loop, time abilities, build crafting, campaign, and endgame.
4. **System design:** A compact version of the client/API/database architecture above.
5. **Key challenge:** Pick one verified challenge and show the problem, constraints, implementation, and result.
6. **Technical highlights:** Offline outbox, save conflict handling, cross-input support, boss director, and admin operations.
7. **Outcome:** Add only measured results—playtest count, performance, retention, deployment uptime, or lessons learned.
8. **Reflection:** What you would refactor, improve, or add next.

## Ready-to-use portfolio bullets

Edit these to match your actual role and contribution:

- Built a browser-based arena roguelite with Canvas-rendered combat, randomized upgrades, persistent progression, six major bosses, and multiple post-campaign modes.
- Designed responsive keyboard/mouse and landscape twin-stick touch controls for the same high-speed combat system.
- Implemented an optional offline-first cloud layer using TypeScript, Express, PostgreSQL, Drizzle, and Zod, including recoverable anonymous profiles and conflict-aware save revisions.
- Created idempotent run submission and three global leaderboard categories with offline caching and basic server-side plausibility checks.
- Developed an authenticated admin console for pilot support, moderation, live announcements, economy adjustments, session revocation, and audited actions.
- Configured static frontend and cloud API deployment using Vercel, Render, PostgreSQL migrations, and a health-check endpoint.

## Honest wording and claim rules for AI

When generating public-facing material from this handout:

- Use **“built,” “designed,” or “implemented”** only for contributions the creator confirms personally.
- Do not claim that the project was solo-made, commercially released, production-scale, or used by a specific number of people unless the creator supplies evidence.
- Do not invent performance numbers, users, revenue, completion rates, awards, dates, or development duration.
- Do not call the API authoritative anti-cheat. It applies validation, rate limits, idempotency, and plausibility checks, but the game simulation runs on the client.
- Do not describe the cloud system as required. CHRONO//BREACH is fully playable using local browser storage when the API is unavailable.
- Do not imply email/password authentication. Cloud pilots use an anonymous callsign, a session token, and a rotating recovery code.
- Treat the counts and features in this document as repository-derived facts as of **August 15, 2026**; re-check the code if the project changes.
- Ask the creator for missing portfolio facts: role, timeline, motivation, audience, live URL, repository URL, measurable results, screenshots, and future plans.

## Repository map

| Path | Purpose |
|---|---|
| `index.html` | Complete game client: UI, styles, Canvas renderer, game loop, content, input, audio, saves, and cloud integration |
| `config.js` | Public API base URL configuration |
| `server/src/app.ts` | Public API routes for announcements, pilots, saves, recovery, runs, and leaderboards |
| `server/src/admin.ts` | Admin authentication, pilot operations, announcements, and audit endpoints |
| `server/src/db/schema.ts` | Drizzle/PostgreSQL data model |
| `server/src/validation.ts` | Zod schemas and run plausibility rules |
| `server/src/security.ts` | Tokens, recovery codes, hashing, signed admin sessions, and safe comparison |
| `server/public/` | Browser-based admin console |
| `server/drizzle/` | SQL migrations |
| `server/test/` | Logic and API integration tests |
| `vercel.json` | Static frontend deployment and security headers |
| `render.yaml` | API deployment blueprint and environment configuration |

## Facts still needed from the creator

Complete these before asking an AI for final portfolio copy:

- **My name:**
- **My exact role and responsibilities:**
- **Solo or team project (and collaborators):**
- **Why I created CHRONO//BREACH:**
- **Project start/end dates:**
- **Live demo URL:**
- **Public repository URL (if any):**
- **Tools or AI assistance used, if I want to disclose them:**
- **Most difficult problem I personally solved:**
- **A design decision I am proud of:**
- **Measured results or playtest feedback:**
- **What I would improve next:**
- **Preferred screenshots/GIFs/video:**

LIVE SITE: https://chrono-breach-v2.vercel.app/

## Reusable prompt for another AI

Copy the prompt below and attach this file:

> Read the attached CHRONO//BREACH project handout as the factual source of truth. Help me create `[a portfolio case study / project card / resume bullets / interview explanation]` for `[target audience]`. Preserve the project’s neon sci-fi arena-roguelite identity, explain the gameplay and engineering clearly, and prioritize my confirmed contributions. Do not invent metrics, authorship, dates, motivations, or outcomes. If a required personal fact is missing, ask me for it before writing the final copy. Keep the tone `[professional / playful / technical / concise]` and the length around `[target length]`.

