// The estimate. Plain statistics over the team's own finished work, no AI, so the same
// history always gives the same answer and every number can be traced to real tickets.

import { addBusinessDays, businessDaysBetween, toDay } from './dates.js';

/**
 * A ticket as the engine sees it.
 * @typedef {{ key: string, summary: string, type: string, labels?: string[], components?: string[],
 *   created: string, started?: string|null, resolved?: string|null, due?: string|null }} Item
 */

const STOP = new Set(
  'a an and the of for to in on at by with from new update add fix make set up our we is be it this that please request need needs'.split(' '),
);

/** Lower-case meaningful words of a title. */
export function words(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** When work really began: the first move to "in progress" if known, else when it was opened. */
export const startOf = (item) => item.started || item.created;

/** Working days a finished ticket took. */
export const durationOf = (item) => businessDaysBetween(startOf(item), item.resolved);

/** Did a finished ticket land on or before its due date? */
export const metDue = (item) => !!(item.due && item.resolved && toDay(item.resolved) <= toDay(item.due));

/**
 * How alike two tickets are. Same type matters most, then shared components, shared
 * title words and shared labels. Returns a score and the reasons, so the panel can say why.
 */
export function similarity(target, past) {
  let score = 0;
  const why = [];
  if (target.type && past.type === target.type) {
    score += 3;
    why.push(`same type (${past.type})`);
  }
  const comps = (past.components || []).filter((c) => (target.components || []).includes(c));
  if (comps.length) {
    score += 2 * comps.length;
    why.push(`same component (${comps.join(', ')})`);
  }
  const a = words(target.summary);
  const b = words(past.summary);
  const shared = [...a].filter((w) => b.has(w));
  if (shared.length) {
    const jaccard = shared.length / new Set([...a, ...b]).size;
    score += 4 * jaccard;
    why.push(`similar title (${shared.slice(0, 3).join(', ')})`);
  }
  const labels = (past.labels || []).filter((l) => (target.labels || []).includes(l));
  if (labels.length) {
    score += labels.length;
    why.push(`same label (${labels.join(', ')})`);
  }
  return { score, why };
}

/** Value below which `p` of the sorted numbers fall (nearest-rank, so it is always a real duration). */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

export const MIN_MATCHES = 5;
const MAX_MATCHES = 30;

/**
 * Pick the finished tickets most like the target. Prefers strong matches, but always
 * returns at least MIN_MATCHES when the history has them, widening to the same type and
 * then the whole project, and says which level it used.
 */
export function findSimilar(target, history) {
  const done = history.filter((h) => h.resolved && h.key !== target.key);
  const scored = done
    .map((h) => ({ item: h, ...similarity(target, h) }))
    .sort((x, y) => y.score - x.score || (y.item.resolved > x.item.resolved ? 1 : -1));
  const strong = scored.filter((s) => s.score >= 4);
  if (strong.length >= MIN_MATCHES) return { basis: 'similar', matches: strong.slice(0, MAX_MATCHES) };
  const sameType = scored.filter((s) => s.item.type === target.type);
  if (sameType.length >= MIN_MATCHES) return { basis: 'type', matches: sameType.slice(0, MAX_MATCHES) };
  return { basis: 'project', matches: scored.slice(0, MAX_MATCHES) };
}

/** How often the project's finished, dated tickets met their due date. */
export function promiseRate(history) {
  const dated = history.filter((h) => h.resolved && h.due);
  if (!dated.length) return null;
  const kept = dated.filter(metDue).length;
  return { kept, total: dated.length, rate: kept / dated.length };
}

/**
 * The full answer for one ticket.
 * @param {Item} target the ticket being looked at
 * @param {Item[]} history the project's tickets (finished ones are used)
 * @param {string} today "YYYY-MM-DD", the day work counts from if it has not started
 */
export function estimate(target, history, today) {
  const { basis, matches } = findSimilar(target, history);
  const promise = promiseRate(history);
  if (matches.length < 3) {
    return { ok: false, reason: 'Not enough finished work in this project yet. Due Date Check needs at least 3 finished tickets.', promise };
  }
  const all = matches.map((m) => durationOf(m.item)).sort((a, b) => a - b);

  // The clock starts when the work was requested (or started, if Jira knows). A ticket
  // that has already been open for `elapsed` days is compared only with past tickets that
  // also took at least that long: "given it is still open, how long do these usually run?"
  const from = startOf(target);
  const elapsed = target.resolved ? 0 : businessDaysBetween(from, today);
  const stillRunning = all.filter((d) => d >= elapsed);
  const durations = stillRunning.length >= 3 ? stillRunning : all.map((d) => Math.max(d, elapsed));
  const typical = percentile(durations, 0.5);
  const realisticDays = percentile(durations, 0.7);
  const safeDays = percentile(durations, 0.85);
  const realisticDate = maxDay(addBusinessDays(from, realisticDays), today);
  const safeDate = maxDay(addBusinessDays(from, safeDays), today);

  let chance = null;
  let verdict = 'no-due';
  if (target.due) {
    const allowed = businessDaysBetween(from, target.due);
    chance = durations.filter((d) => d <= allowed).length / durations.length;
    verdict = chance >= 0.7 ? 'likely' : chance >= 0.4 ? 'tight' : 'unlikely';
  }
  const confidence = matches.length >= 15 ? 'high' : matches.length >= 6 ? 'medium' : 'low';
  const similarKept = promiseRate(matches.map((m) => m.item));

  return {
    ok: true,
    from,
    elapsed,
    due: target.due || null,
    typicalDays: typical,
    realisticDays,
    realisticDate,
    safeDate,
    chance,
    verdict,
    confidence,
    basis,
    sample: matches.length,
    promise,
    similarKept,
    evidence: matches.slice(0, 5).map((m) => ({
      key: m.item.key,
      summary: m.item.summary,
      days: durationOf(m.item),
      metDue: m.item.due ? metDue(m.item) : null,
      why: m.why,
    })),
  };
}

const maxDay = (a, b) => (toDay(a) > toDay(b) ? String(a).slice(0, 10) : String(b).slice(0, 10));
