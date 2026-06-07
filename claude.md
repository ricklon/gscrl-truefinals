# CLAUDE.md — gscrl-truefinals

Build brief for a live match-flow storyteller for GSCRL broadcasts. Read this
before scaffolding or editing the project.

## Status

**New repo. Nothing is built yet.** Everything below is the spec to build toward,
not a description of existing code.

## Purpose

One job: tell the story of each cage during an event, by reading TrueFinals and
presenting three beats —

- **Up Next** — who is waiting to fight
- **Now Fighting** — who is in the box right now
- **Result** — what just happened in the last match

That's the whole product. Resist feature sprawl; if it doesn't serve those three
beats, it doesn't belong here.

## Relationship to gscrl-obs

- **gscrl-obs** = the static overlay collection (GitHub Pages). Stays as-is.
- **gscrl-truefinals** = this repo. It's separate because it needs a runtime to
  poll the TrueFinals API; gscrl-obs is static-only and can't host it.
- **Theme: this must look like it belongs to gscrl-obs.** gscrl-obs is the source
  of truth for the visual language. Mirror (or import) its tokens — pull from
  `gscrl-obs/shared/styles.css`, and follow the conventions in
  `gscrl-obs/shared/config.js`, `shared/utils.js`, and the `june-jumble`
  overlays. **Do not invent a new look.**
  - NOTE: those styles have not been reviewed yet. Pull them in and match them
    before finalizing any visuals.

## The story (state machine, per cage)

Each location loops: **Up Next → Now Fighting → Result → (back to Up Next)**.

- **Up Next / Waiting:** bots coming to the box — names, weight class,
  bracket/round, and check-in status (have they shown up?).
- **Now Fighting:** the two bots in the box now — the matchup, and the stakes
  (winner advances / loser eliminated) where derivable.
- **Result:** winner, method (from the result annotation — KO / judges' decision
  / tap-out), final score, and what it means for the bracket.

GSCRL runs **three tournaments concurrently** and switches between them. Track
all three; tag each cage's story with its tournament.

## TrueFinals data mapping

The story beats map directly onto TrueFinals data. (Schema below came from the
`amcchord/NHRL-MCP` structs — authoritative but **verify the base URL and the
`state` enum against one live authenticated response** before relying on them.)

- **Base URL:** TBD — confirm with a live call. Candidates seen: `https://truefinals.com/api`
  (NHRL-MCP client) vs `https://api.truefinals.com` (gscrl-obs config, but that
  file currently has merge-conflict markers and is unreliable).
- **Auth headers:** `x-api-user-id`, `x-api-key`.

Per location:
- **Now Fighting** = the game referenced by `location.activeGameID`
- **Up Next** = `location.queue[]` (ordered). `slot.checkInTime` tells you who has
  actually checked in vs. is still being summoned.
- **Result** = the just-finished game (`location.lastCompletedGameID`), read via
  `winnerPlacement` / `loserPlacement`, the result annotation, and slot scores.

Resolve `slot.playerID` → bot name via the players list; `locationID` → cage name
via the locations list. Endpoints: `/v1/tournaments/{id}` (or `/games`,
`/locations`, `/players`, `/games/{gameId}`).

## Runtime (kept deliberately minimal)

This needs *a* backend because static hosting can't poll an API — but don't
over-build it. The minimum:

- A small poller that reads the active tournaments and produces the per-cage
  story as JSON.
- Cache the result for a few seconds so multiple overlay clients don't each hit
  TrueFinals (stay under rate limits).
- An overlay (OBS browser source) that renders the three beats, themed to
  gscrl-obs, transparent background.

**Host choice is deferred and must not block the storyteller work.** Pick it once
the story and theme are right.

## Secrets

TrueFinals credentials (`x-api-user-id`, `x-api-key`) never get committed. Local:
a gitignored dotenv-style file. Production: the host's secret mechanism. Never in
source or committed config.

## Hard rules for agents

- Match the gscrl-obs theme; pull tokens from that repo, don't invent a look.
- Verify the TrueFinals base URL and `state` enum against a live response.
- Keep scope to the three beats — Up Next, Now Fighting, Result. No sprawl.
- Never commit secrets.
