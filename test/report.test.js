import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atRisk, byKind, kindOf, projectReport, promiseByMonth } from '../src/engine/report.js';
import { describeProject, describeTicket } from '../src/engine/words.js';

const mk = (key, summary, comp, created, resolved, due) => ({ key, summary, type: 'Task', components: comp ? [comp] : [], labels: [], created, resolved, due });
const history = [
  mk('L-1', 'Review supplier contract', 'Legal', '2026-09-01', '2026-09-08', '2026-09-04'),
  mk('L-2', 'Review partner contract', 'Legal', '2026-09-07', '2026-09-14', '2026-09-10'),
  mk('L-3', 'Review vendor contract', 'Legal', '2026-10-05', '2026-10-09', '2026-10-09'),
  mk('L-4', 'Review NDA contract', 'Legal', '2026-10-12', '2026-10-20', '2026-10-15'),
  mk('L-5', 'Review agency contract', 'Legal', '2026-10-19', '2026-10-26', '2026-10-22'),
  mk('B-1', 'Write blog post on pricing', 'Content', '2026-09-01', '2026-09-03', '2026-09-04'),
  mk('B-2', 'Write blog post on hiring', 'Content', '2026-09-08', '2026-09-10', '2026-09-11'),
  mk('B-3', 'Write blog post on launch', 'Content', '2026-10-05', '2026-10-06', '2026-10-08'),
  mk('B-4', 'Write blog post on events', 'Content', '2026-10-12', '2026-10-14', '2026-10-15'),
  mk('B-5', 'Write blog post on roadmap', 'Content', '2026-10-19', '2026-10-21', '2026-10-22'),
];
const open = [
  mk('L-9', 'Review distributor contract', 'Legal', '2026-11-16', null, '2026-11-18'),
  mk('B-9', 'Write blog post on customers', 'Content', '2026-11-16', null, '2026-11-20'),
  mk('X-1', 'No date', 'Content', '2026-11-16', null, null),
];

test('kind is the first component, then the type', () => {
  assert.equal(kindOf(history[0]), 'Legal');
  assert.equal(kindOf({ type: 'Bug', components: [] }), 'Bug');
});

test('on-time rate per month', () => {
  const m = promiseByMonth(history);
  assert.deepEqual(m.map((r) => r.month), ['2026-09', '2026-10']);
  assert.equal(m[0].kept, 2); // B-1, B-2
  assert.equal(m[0].total, 4);
});

test('kinds are ranked worst first, with the promise gap', () => {
  const k = byKind(history);
  assert.equal(k[0].kind, 'Legal');
  assert.equal(k[0].rate, 0.2);
  assert.ok(k[0].gap > 0);
  assert.equal(k[1].kind, 'Content');
  assert.equal(k[1].rate, 1);
});

test('at-risk lists only open dated work, least likely first', () => {
  const r = atRisk(open, history, '2026-11-16');
  assert.deepEqual(r.map((x) => x.key), ['L-9', 'B-9']);
  assert.equal(r[0].verdict, 'unlikely');
  assert.equal(r[1].verdict, 'likely');
});

test('project report adds it up', () => {
  const p = projectReport(history, open, '2026-11-16');
  assert.equal(p.finished, 10);
  assert.equal(p.promise.total, 10);
  assert.equal(p.counts.unlikely + p.counts.tight + p.counts.likely, 2);
});

test('the agent gets exact numbers and ticket keys', () => {
  const t = describeTicket(open[0], history, '2026-11-16');
  assert.match(t, /L-9/);
  assert.match(t, /likely to slip/);
  assert.match(t, /Realistic finish: 2026-11-2/);
  const proposed = describeTicket(open[0], history, '2026-11-16', '2026-12-04');
  assert.match(proposed, /proposed date 2026-12-04: on track/);
  const p = describeProject('DEMO', projectReport(history, open, '2026-11-16'));
  assert.match(p, /DEMO: 60% of due dates met/);
  assert.match(p, /Legal: 20% on time/);
  assert.match(p, /L-9/);
});
