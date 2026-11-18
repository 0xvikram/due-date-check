import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessDays, businessDaysBetween } from '../src/engine/dates.js';
import { estimate, findSimilar, percentile, promiseRate, similarity, words } from '../src/engine/estimate.js';

test('working days skip weekends', () => {
  assert.equal(businessDaysBetween('2026-11-16', '2026-11-18'), 2); // Mon -> Wed
  assert.equal(businessDaysBetween('2026-11-20', '2026-11-23'), 1); // Fri -> Mon
  assert.equal(businessDaysBetween('2026-11-16', '2026-11-16'), 0);
  assert.equal(businessDaysBetween('2026-11-18', '2026-11-16'), 0); // backwards is 0, not negative
  assert.equal(addBusinessDays('2026-11-19', 2), '2026-11-23'); // Thu + 2 -> Mon
  assert.equal(addBusinessDays('2026-11-21', 1), '2026-11-24'); // Sat counts from Mon
  assert.equal(addBusinessDays('2026-11-16', 0), '2026-11-16');
});

test('timestamps are read as their UTC day', () => {
  assert.equal(businessDaysBetween('2026-11-16T23:59:00.000+0000', '2026-11-17T00:01:00.000+0000'), 1);
});

test('title words ignore filler', () => {
  assert.deepEqual([...words('Please update the Q4 launch landing page!')].sort(), ['landing', 'launch', 'page']);
});

test('percentile is nearest-rank and returns a real value', () => {
  const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(s, 0.5), 5);
  assert.equal(percentile(s, 0.7), 7);
  assert.equal(percentile([4], 0.7), 4);
  assert.equal(percentile([], 0.7), null);
});

test('similarity explains itself', () => {
  const s = similarity(
    { type: 'Task', summary: 'Legal review of partner contract', components: ['Legal'], labels: ['contracts'] },
    { type: 'Task', summary: 'Partner contract legal review', components: ['Legal'], labels: ['contracts'] },
  );
  assert.ok(s.score > 8);
  assert.equal(s.why.length, 4);
});

// A small project: contract reviews take ~5 days, blog posts ~2.
const mk = (key, summary, created, resolved, due, extra = {}) => ({ key, summary, type: 'Task', created, resolved, due, components: [], labels: [], ...extra });
const history = [
  mk('L-1', 'Review supplier contract', '2026-09-01', '2026-09-08', '2026-09-04', { components: ['Legal'] }),
  mk('L-2', 'Review partner contract', '2026-09-07', '2026-09-14', '2026-09-10', { components: ['Legal'] }),
  mk('L-3', 'Review vendor contract renewal', '2026-09-14', '2026-09-18', '2026-09-18', { components: ['Legal'] }),
  mk('L-4', 'Review NDA contract', '2026-09-21', '2026-09-29', '2026-09-24', { components: ['Legal'] }),
  mk('L-5', 'Review reseller contract', '2026-10-05', '2026-10-12', '2026-10-09', { components: ['Legal'] }),
  mk('L-6', 'Review agency contract', '2026-10-12', '2026-10-16', '2026-10-16', { components: ['Legal'] }),
  mk('B-1', 'Write blog post on pricing', '2026-09-01', '2026-09-03', '2026-09-03', { components: ['Content'] }),
  mk('B-2', 'Write blog post on hiring', '2026-09-08', '2026-09-10', '2026-09-10', { components: ['Content'] }),
  mk('B-3', 'Write blog post on launch', '2026-09-15', '2026-09-16', '2026-09-17', { components: ['Content'] }),
  mk('O-1', 'Open item', '2026-11-02', null, '2026-11-20'),
];

test('promise rate counts only finished, dated work', () => {
  const p = promiseRate(history);
  assert.equal(p.total, 9);
  assert.equal(p.kept, 5); // L-3, L-6, B-1, B-2, B-3
});

test('similar work is preferred over the whole project', () => {
  const r = findSimilar({ key: 'X', type: 'Task', summary: 'Review distributor contract', components: ['Legal'] }, history);
  assert.equal(r.basis, 'similar');
  assert.ok(r.matches.every((m) => m.item.components.includes('Legal')));
});

test('a 3-day promise on a contract review is flagged as unlikely', () => {
  const r = estimate(
    { key: 'L-9', type: 'Task', summary: 'Review distributor contract', components: ['Legal'], created: '2026-11-16', due: '2026-11-19' },
    history,
    '2026-11-16',
  );
  assert.equal(r.ok, true);
  assert.equal(r.basis, 'similar');
  assert.equal(r.realisticDays, 5);
  assert.equal(r.realisticDate, '2026-11-23');
  assert.equal(r.verdict, 'unlikely');
  assert.ok(r.chance < 0.4);
  assert.equal(r.evidence.length, 5);
  assert.ok(r.evidence[0].why.length > 0);
});

test('a blog post due in 3 days is likely', () => {
  const small = history.concat(
    mk('B-4', 'Write blog post on events', '2026-10-01', '2026-10-02', '2026-10-02', { components: ['Content'] }),
    mk('B-5', 'Write blog post on roadmap', '2026-10-05', '2026-10-07', '2026-10-07', { components: ['Content'] }),
  );
  const r = estimate({ key: 'B-9', type: 'Task', summary: 'Write blog post on customers', components: ['Content'], created: '2026-11-16', due: '2026-11-19' }, small, '2026-11-16');
  assert.equal(r.verdict, 'likely');
});

test('the clock starts at the request, and the realistic date is never in the past', () => {
  const r = estimate({ key: 'L-9', type: 'Task', summary: 'Review distributor contract', components: ['Legal'], created: '2026-10-01' }, history, '2026-11-16');
  assert.equal(r.from, '2026-10-01');
  assert.equal(r.verdict, 'no-due');
  assert.ok(r.realisticDate >= '2026-11-16');
});

test('a ticket already open for a while is compared with tickets that ran as long', () => {
  // Opened Mon 16 Nov, now Thu 19 Nov (3 days in). Legal reviews that took 3+ days run 4-6.
  const r = estimate(
    { key: 'L-9', type: 'Task', summary: 'Review distributor contract', components: ['Legal'], created: '2026-11-16', due: '2026-11-20' },
    history,
    '2026-11-19',
  );
  assert.equal(r.elapsed, 3);
  assert.ok(r.realisticDays >= 3);
  assert.ok(r.chance < 0.5);
});

test('too little history says so instead of guessing', () => {
  const r = estimate({ key: 'N-1', type: 'Task', summary: 'x', created: '2026-11-16' }, history.slice(0, 2), '2026-11-16');
  assert.equal(r.ok, false);
  assert.match(r.reason, /at least 3/);
});
