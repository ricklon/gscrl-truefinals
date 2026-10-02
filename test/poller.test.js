const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');

test('four divisions share a request budget, concurrent polls, cache and failure backoff', async () => {
  let now = 1000000;
  let fail = false;
  const requests = [];
  const https = { get(options, callback) {
    requests.push(now);
    queueMicrotask(() => {
      const res = new EventEmitter();
      res.statusCode = fail ? 503 : 200;
      callback(res);
      const payload = options.path.endsWith('/games') ? [] : { title: 'Test', players: [] };
      res.emit('data', JSON.stringify(payload));
      res.emit('end');
    });
    const req = new EventEmitter();
    req.setTimeout = () => {};
    return req;
  } };
  const context = {
    require: name => name === 'https' ? https : { config() {} },
    process: { env: {} }, module: { exports: {} }, URL,
    Date: { now: () => now }, console: { log() {}, error() {} },
    setTimeout: (fn, delay) => { now += delay; queueMicrotask(fn); },
  };
  vm.runInNewContext(fs.readFileSync('poller.js', 'utf8'), context);
  const { poll } = context.module.exports;
  const ids = ['a', 'b', 'c', 'd'];
  const [first, concurrent] = await Promise.all([poll(ids), poll(ids)]);
  assert.equal(first.ok, true);
  assert.equal(first.tournaments.length, 4);
  assert.equal(first, concurrent);
  assert.equal(requests.length, 8);
  assert.equal(await poll(ids), first);
  assert.equal(requests.length, 8);
  now += 600001; // include periodic player refresh in the same request budget
  await poll(ids);
  assert.equal(requests.length, 16);
  now += 26001;
  fail = true;
  const stale = await poll(ids);
  assert.equal(stale.ok, true);
  const count = requests.length;
  await poll(ids);
  assert.equal(requests.length, count);
  for (let i = 1; i < requests.length; i++) {
    assert.ok(requests[i] - requests[i - 1] >= 6500);
  }
});

test('browser inline scripts parse', () => {
  for (const file of ['overlay', 'matchbar', 'matchlog']) {
    const html = fs.readFileSync(`public/${file}.html`, 'utf8');
    for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      new vm.Script(script, { filename: file });
    }
  }
});
