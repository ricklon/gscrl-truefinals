require('dotenv').config();
const express = require('express');
const path = require('path');
const { poll, buildMatchLog } = require('./poller');

const PORT = process.env.PORT || 3000;
const TOURNAMENT_IDS = (process.env.TRUEFINALS_TOURNAMENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

if (!process.env.TRUEFINALS_USER_ID || !process.env.TRUEFINALS_API_KEY) {
  console.error('Missing TRUEFINALS_USER_ID or TRUEFINALS_API_KEY in .env');
  process.exit(1);
}
if (TOURNAMENT_IDS.length === 0) {
  console.error('Missing TRUEFINALS_TOURNAMENT_IDS in .env');
  process.exit(1);
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/story', async (req, res) => {
  const story = await poll(TOURNAMENT_IDS);
  res.json(story);
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
  console.log(`Overlay: http://localhost:${PORT}/overlay.html`);
  console.log(`Story API: http://localhost:${PORT}/api/story`);
});
