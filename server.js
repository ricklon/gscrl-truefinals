require('dotenv').config();
const express = require('express');
const path = require('path');
const { poll, buildMatchLog } = require('./poller');
const { loadEvent } = require('./config');

const PORT = process.env.PORT || 3000;
const event = loadEvent();
const TOURNAMENT_IDS = event.divisions.map(d => d.tournamentId);

if (!process.env.TRUEFINALS_USER_ID || !process.env.TRUEFINALS_API_KEY) {
  console.error('Missing TRUEFINALS_USER_ID or TRUEFINALS_API_KEY in .env');
  process.exit(1);
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/event', (req, res) => res.json(event));

app.get('/api/story', async (req, res) => {
  const story = await poll(TOURNAMENT_IDS);
  res.json({ ...story, event, tournaments: story.tournaments.map(t => ({
    ...t, division: event.divisions.find(d => d.tournamentId === t.tournamentId),
  })) });
});

app.get('/api/matchlog', async (req, res) => {
  await poll(TOURNAMENT_IDS); // ensure raw cache is warm
  res.json(buildMatchLog(TOURNAMENT_IDS));
});

// Background poll to keep cache warm
setInterval(() => poll(TOURNAMENT_IDS), 8000);
poll(TOURNAMENT_IDS); // initial fetch

app.listen(PORT, () => {
  console.log(`gscrl-truefinals running on http://localhost:${PORT}`);
  console.log(`Tracking tournaments: ${TOURNAMENT_IDS.join(', ')}`);
  console.log(`Event: ${event.name} (${event.id})`);
  console.log(`Overlay: http://localhost:${PORT}/overlay.html`);
  console.log(`Story API: http://localhost:${PORT}/api/story`);
});
