const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadEvent } = require('../config');

function select(tournaments, selector = '') {
  const context = { window: {}, location: { search: selector ? `?tournament=${selector}` : '' }, URLSearchParams };
  vm.runInNewContext(fs.readFileSync('public/event.js', 'utf8'), context);
  return context.window.selectTournament(tournaments);
}

function stories(eventId) {
  return loadEvent(eventId).divisions.map(division => ({
    division, tournamentId: division.tournamentId, nowFighting: [], upNext: [], result: [],
  }));
}

test('opener tracks all four supplied brackets', () => {
  assert.deepEqual(loadEvent('mechanical-mayhem-season-5-opener').divisions.map(d => d.tournamentId), [
    '12d25847dc964a64', '79b98376f28f4dc5', '2c1a522669b34fec', 'f1bacdd759cd41e1',
  ]);
});

test('stable selectors and legacy aliases follow the selected event', () => {
  for (const id of ['mechanical-mayhem-season-5-opener', 'nj-champs']) {
    const tournaments = stories(id);
    for (const t of tournaments) {
      for (const selector of [t.division.key, ...t.division.aliases, t.tournamentId]) {
        assert.equal(select(tournaments, selector), t);
      }
    }
  }
});

test('pinned missing division never displays a different active division', () => {
  const tournaments = stories('nj-champs');
  tournaments[0].nowFighting = [{}];
  assert.equal(select(tournaments, 'fairies'), undefined);
  assert.equal(select(tournaments, 'typo'), undefined);
  assert.equal(select(tournaments), tournaments[0]);
});

test('automatic selection prefers active, called, then latest result', () => {
  const tournaments = stories('mechanical-mayhem-season-5-opener');
  tournaments[1].result = [{ endTime: 10 }];
  tournaments[2].result = [{ endTime: 20 }];
  assert.equal(select(tournaments), tournaments[2]);
  tournaments[3].upNext = [{}];
  assert.equal(select(tournaments), tournaments[3]);
  tournaments[0].nowFighting = [{}];
  assert.equal(select(tournaments), tournaments[0]);
});

test('invalid event and conflicting configuration fail early', () => {
  assert.throws(() => loadEvent('missing'), /unknown event/);
  const event = loadEvent('nj-champs');
  const duplicate = { ...event, divisions: [event.divisions[0], event.divisions[0]] };
  assert.throws(() => loadEvent('bad', { events: { bad: duplicate } }), /duplicate/);
});
