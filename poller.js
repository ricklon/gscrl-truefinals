require('dotenv').config();
const https = require('https');

const BASE_URL = 'https://truefinals.com/api';
const HEADERS = {
  'x-api-user-id': process.env.TRUEFINALS_USER_ID,
  'x-api-key': process.env.TRUEFINALS_API_KEY,
};

// Rate limit: 10 req / 60s window.
// Strategy: full tournament fetch once at startup (title + players + games),
// then games-only every 8s (7.5 req/min). Re-fetch players every 10 min.
const GAMES_POLL_MS = 8000;
const PLAYERS_TTL_MS = 2 * 60 * 1000; // ~1 match cycle; leaves headroom within 10 req/min rate limit

function apiFetch(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const req = https.get({ hostname: url.hostname, path: url.pathname + url.search, headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON parse error')); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(new Error('Request timeout')); });
  });
}

// Per-tournament static data (title + players) — primed on first fetch, refreshed periodically
const staticCache = {}; // { [id]: { title, players: {id->name}, fetchedAt } }

async function getStatic(tournamentId) {
  const entry = staticCache[tournamentId];
  if (entry && Date.now() - entry.fetchedAt < PLAYERS_TTL_MS) return entry;

  // Full fetch — only happens at startup and every 10 min
  const t = await apiFetch(`/v1/tournaments/${tournamentId}`);
  const players = Object.fromEntries(t.players.map(p => [p.id, p.name]));
  const fresh = { title: t.title, players, fetchedAt: Date.now() };
  staticCache[tournamentId] = fresh;
  console.log(`[poller] primed static cache for "${t.title}" (${t.players.length} players)`);
  return fresh;
}

function buildStory(games, players) {
  function slotName(slot) {
    return slot?.playerID ? (players[slot.playerID] ?? 'Unknown') : 'TBD';
  }

  function gameMatchup(game) {
    return {
      id: game.id,
      name: game.name,
      player1: slotName(game.slots[0]),
      player2: slotName(game.slots[1]),
      score1: game.slots[0]?.score ?? 0,
      score2: game.slots[1]?.score ?? 0,
      checkedIn1: !!game.slots[0]?.checkInTime,
      checkedIn2: !!game.slots[1]?.checkInTime,
      locationID: game.locationID,
      resultAnnotation: game.resultAnnotation ?? null,
      winnerPlacement: game.winnerPlacement ?? null,
      loserPlacement: game.loserPlacement ?? null,
    };
  }

  const nowFighting = games.filter(g => g.state === 'active').map(gameMatchup);
  const upNext = games.filter(g => g.state === 'called').map(gameMatchup);

  const done = games
    .filter(g => g.state === 'done' && g.endTime)
    .sort((a, b) => b.endTime - a.endTime);

  const result = done.slice(0, 3).map(game => {
    const winnerSlot = game.slots.find(s => s.slotState === 'winner');
    const winner = winnerSlot ? (players[winnerSlot.playerID] ?? null) : null;
    return { ...gameMatchup(game), winner };
  });

  return { nowFighting, upNext, result, updatedAt: Date.now() };
}

let cache = null;
let rawCache = {}; // { [tournamentId]: { games, players } } — for matchlog
let lastFetch = 0;

async function poll(tournamentIds) {
  const now = Date.now();
  if (cache && now - lastFetch < GAMES_POLL_MS) return cache;

  try {
    const stories = await Promise.all(
      tournamentIds.map(async (id) => {
        const { title, players } = await getStatic(id);
        const games = await apiFetch(`/v1/tournaments/${id}/games`);
        rawCache[id] = { games, players };
        return { tournamentId: id, tournamentTitle: title, ...buildStory(games, players) };
      })
    );
    cache = { ok: true, tournaments: stories, fetchedAt: Date.now() };
    lastFetch = Date.now();
  } catch (err) {
    console.error('[poller] fetch error:', err.message);
    cache = cache ?? { ok: false, error: err.message, tournaments: [] };
  }

  return cache;
}

function buildMatchLog(tournamentIds) {
  const entries = [];

  for (const id of tournamentIds) {
    const raw = rawCache[id];
    if (!raw) continue;
    const { games, players } = raw;
    const { title } = staticCache[id] ?? {};

    for (const g of games) {
      if (!g.activeSince) continue; // never fought (bye, unavailable)
      const isBye = g.resultAnnotation === 'BY';
      if (isBye) continue;

      const winnerSlot = g.slots.find(s => s.slotState === 'winner');
      const winner = winnerSlot ? (players[winnerSlot.playerID] ?? null) : null;
      const m = g.name && g.name.match(/^([WL]):(\d+)-/);
      const bracket = m ? (m[1] === 'W' ? 'Winners' : 'Losers') : '';
      const round = m ? `Round ${m[2]}` : g.name;

      entries.push({
        tournamentId: id,
        tournamentTitle: title ?? id,
        gameId: g.id,
        name: g.name,
        bracket,
        round,
        player1: players[g.slots[0]?.playerID] ?? 'TBD',
        player2: players[g.slots[1]?.playerID] ?? 'TBD',
        winner,
        method: g.resultAnnotation ?? null,
        state: g.state,
        activeSince: g.activeSince,  // ms epoch — match started
        endTime: g.endTime ?? null,  // ms epoch — match ended (null if still active)
      });
    }
  }

  entries.sort((a, b) => a.activeSince - b.activeSince);
  return entries;
}

module.exports = { poll, buildMatchLog };
