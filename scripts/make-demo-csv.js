// Builds demo/requests.csv: six months of a business team's request history for the
// demo site, imported with Jira's CSV importer (which, unlike the REST API, accepts
// past Created and Resolved dates). Seeded, so the same file comes out every time.
//
// Each kind of work has its own real pace and its own habit of promising too little
// time, which is exactly the pattern Due Date Check is meant to surface.
//   node scripts/make-demo-csv.js

import { writeFileSync, mkdirSync } from 'node:fs';
import { addBusinessDays } from '../src/engine/dates.js';

let seed = 20261118;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (a) => a[Math.floor(rand() * a.length)];
// A rough right-skewed duration: most work near the median, some runs long.
const skewed = (median, spread) => Math.max(1, Math.round(median * Math.exp((rand() + rand() + rand() - 1.5) * spread)));

const KINDS = [
  {
    component: 'Legal', median: 5, spread: 0.6, promise: 4, share: 0.2,
    titles: ['Review {p} contract', 'Legal review of {p} agreement', 'Check terms for {p} partnership', 'Review NDA with {p}', 'Approve data processing terms for {p}'],
  },
  {
    component: 'Design', median: 4, spread: 0.5, promise: 3, share: 0.25,
    titles: ['Design banner for {c}', 'Social graphics for {c}', 'Slide deck design for {c}', 'Email header for {c}', 'One-pager design for {c}'],
  },
  {
    component: 'Content', median: 2, spread: 0.4, promise: 3, share: 0.25,
    titles: ['Write blog post on {t}', 'Newsletter copy for {c}', 'Case study draft: {p}', 'Press release for {c}', 'FAQ copy for {c}'],
  },
  {
    component: 'Web', median: 5, spread: 0.5, promise: 5, share: 0.18,
    titles: ['Landing page for {c}', 'Update pricing page for {c}', 'Add signup form for {c}', 'Fix tracking on {c} page', 'Website banner for {c}'],
  },
  {
    component: 'Events', median: 9, spread: 0.4, promise: 10, share: 0.12,
    titles: ['Book venue for {e}', 'Speaker kit for {e}', 'Booth materials for {e}', 'Run sign-ups for {e}', 'Swag order for {e}'],
  },
];
const PARTNERS = ['Northwind', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Retail', 'Wayne Logistics', 'Acme Foods', 'Soylent', 'Vandelay'];
const CAMPAIGNS = ['Spring launch', 'Q3 webinar', 'Holiday sale', 'Partner week', 'Product update', 'Customer awards', 'Year in review'];
const TOPICS = ['pricing', 'onboarding', 'remote teams', 'customer stories', 'security', 'our roadmap', 'hiring'];
const EVENTS = ['Berlin summit', 'London meetup', 'Sydney roadshow', 'São Paulo expo', 'Toronto workshop', 'Singapore forum'];
const PEOPLE = ['Maria', 'Kenji', 'Amara', 'Lucas', 'Priya', 'Noah'];

const fill = (t) => t.replace('{p}', pick(PARTNERS)).replace('{c}', pick(CAMPAIGNS)).replace('{t}', pick(TOPICS)).replace('{e}', pick(EVENTS));
const kindFor = () => {
  let r = rand();
  for (const k of KINDS) if ((r -= k.share) <= 0) return k;
  return KINDS[0];
};

const TODAY = '2026-11-18';
const rows = [];
// Finished work: about two requests per working day from June to early November.
for (let day = '2026-06-01'; day < '2026-11-06'; day = addBusinessDays(day, 1)) {
  const n = rand() < 0.35 ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const k = kindFor();
    const promised = Math.max(1, k.promise + (rand() < 0.3 ? 1 : 0) - (rand() < 0.2 ? 1 : 0));
    const took = skewed(k.median, k.spread);
    const resolved = addBusinessDays(day, took);
    if (resolved >= TODAY) continue;
    rows.push({ summary: fill(pick(k.titles)), component: k.component, status: 'Done', created: day, resolved, due: addBusinessDays(day, promised), who: pick(PEOPLE) });
  }
}
// Open work with due dates, so the project page has something at risk to show.
for (const [k, created, promised] of [
  [KINDS[0], '2026-11-16', 3], [KINDS[0], '2026-11-12', 4], [KINDS[1], '2026-11-17', 2], [KINDS[1], '2026-11-13', 3],
  [KINDS[2], '2026-11-16', 3], [KINDS[2], '2026-11-18', 2], [KINDS[3], '2026-11-11', 5], [KINDS[3], '2026-11-17', 4],
  [KINDS[4], '2026-11-09', 10], [KINDS[4], '2026-11-16', 7], [KINDS[0], '2026-11-18', 2], [KINDS[1], '2026-11-18', 5],
]) {
  rows.push({ summary: fill(pick(k.titles)), component: k.component, status: 'To Do', created, resolved: '', due: addBusinessDays(created, promised), who: pick(PEOPLE) });
}

const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const at = (d, h) => (d ? `${d} ${h}` : '');
const header = ['Summary', 'Issue Type', 'Status', 'Resolution', 'Component', 'Labels', 'Created', 'Resolved', 'Due Date', 'Description'];
const lines = [header.join(',')].concat(
  rows.map((r) =>
    [r.summary, 'Task', r.status, r.resolved ? 'Done' : '', r.component, r.component.toLowerCase(), at(r.created, '10:00'), at(r.resolved, '16:00'), at(r.due, '12:00'), `Requested by ${r.who}.`]
      .map((v) => esc(String(v)))
      .join(','),
  ),
);
mkdirSync('demo', { recursive: true });
writeFileSync('demo/requests.csv', lines.join('\n') + '\n');

// A quick summary of what was written, per kind, so the demo story can be checked.
const done = rows.filter((r) => r.resolved);
for (const k of KINDS) {
  const mine = done.filter((r) => r.component === k.component);
  const met = mine.filter((r) => r.resolved <= r.due).length;
  console.log(`${k.component.padEnd(8)} ${String(mine.length).padStart(3)} done, due date met ${Math.round((100 * met) / mine.length)}%`);
}
console.log(`total ${rows.length} rows (${done.length} done, ${rows.length - done.length} open), all met ${Math.round((100 * done.filter((r) => r.resolved <= r.due).length) / done.length)}%`);
