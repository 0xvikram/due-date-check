// The project-level view: how well does this team keep its dates, which kinds of work
// slip, and which open tickets are likely to miss. Built on the same engine as the panel.

import { businessDaysBetween } from './dates.js';
import { durationOf, estimate, metDue, percentile } from './estimate.js';

const median = (xs) => percentile([...xs].sort((a, b) => a - b), 0.5);

/** The kind of work a ticket is: its first component, else its type. */
export const kindOf = (item) => (item.components && item.components[0]) || item.type || 'Other';

/** On-time rate per calendar month the work finished in, oldest first. */
export function promiseByMonth(history) {
  const months = new Map();
  for (const h of history) {
    if (!h.resolved || !h.due) continue;
    const m = String(h.resolved).slice(0, 7);
    const row = months.get(m) || { month: m, kept: 0, total: 0 };
    row.total++;
    if (metDue(h)) row.kept++;
    months.set(m, row);
  }
  return [...months.values()].sort((a, b) => (a.month < b.month ? -1 : 1)).map((r) => ({ ...r, rate: r.kept / r.total }));
}

/**
 * Per kind of work: how many finished, how often the date was met, how long it really
 * takes and how long people usually promise. `gap` is the typical shortfall in working days.
 */
export function byKind(history) {
  const groups = new Map();
  for (const h of history) {
    if (!h.resolved) continue;
    const k = kindOf(h);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(h);
  }
  return [...groups.entries()]
    .map(([kind, items]) => {
      const dated = items.filter((h) => h.due);
      const kept = dated.filter(metDue).length;
      const takes = median(items.map(durationOf));
      const promised = dated.length ? median(dated.map((h) => businessDaysBetween(h.started || h.created, h.due))) : null;
      return {
        kind,
        finished: items.length,
        dated: dated.length,
        rate: dated.length ? kept / dated.length : null,
        takes,
        promised,
        gap: promised === null ? null : takes - promised,
      };
    })
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1) || b.finished - a.finished);
}

/** Every open ticket with a due date, with its estimate, the least likely to land first. */
export function atRisk(open, history, today) {
  return open
    .filter((o) => o.due && !o.resolved)
    .map((o) => ({ item: o, est: estimate(o, history, today) }))
    .filter((r) => r.est.ok)
    .map(({ item, est }) => ({
      key: item.key,
      summary: item.summary,
      kind: kindOf(item),
      due: item.due,
      realisticDate: est.realisticDate,
      chance: est.chance,
      verdict: est.verdict,
      overdue: item.due < today,
    }))
    .sort((a, b) => a.chance - b.chance || (a.due < b.due ? -1 : 1));
}

/** Everything the project page and the Rovo report need, in one object. */
export function projectReport(history, open, today) {
  const dated = history.filter((h) => h.resolved && h.due);
  const kept = dated.filter(metDue).length;
  const risk = atRisk(open, history, today);
  return {
    finished: history.filter((h) => h.resolved).length,
    promise: dated.length ? { kept, total: dated.length, rate: kept / dated.length } : null,
    months: promiseByMonth(history),
    kinds: byKind(history),
    atRisk: risk,
    counts: {
      likely: risk.filter((r) => r.verdict === 'likely').length,
      tight: risk.filter((r) => r.verdict === 'tight').length,
      unlikely: risk.filter((r) => r.verdict === 'unlikely').length,
    },
  };
}
