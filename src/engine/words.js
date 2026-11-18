// Plain-English answers for the Rovo agent. The agent rephrases these, so they carry
// the exact numbers and the ticket keys, and never more certainty than the data has.

import { estimate } from './estimate.js';

const pct = (x) => `${Math.round(x * 100)}%`;
const LABEL = { likely: 'on track', tight: 'tight', unlikely: 'likely to slip' };

/** Answer for one ticket, optionally against a date the user proposes. */
export function describeTicket(target, history, today, proposedDate) {
  const t = proposedDate ? { ...target, due: proposedDate } : target;
  const r = estimate(t, history, today);
  if (!r.ok) return `${target.key}: ${r.reason}`;
  const lines = [];
  const asked = proposedDate ? `the proposed date ${proposedDate}` : r.due ? `its due date ${r.due}` : null;
  lines.push(`${target.key} "${target.summary}".`);
  if (asked) {
    lines.push(`Against ${asked}: ${LABEL[r.verdict]}. ${pct(r.chance)} of similar finished tickets would have made it.`);
  } else {
    lines.push('It has no due date yet.');
  }
  lines.push(`Realistic finish: ${r.realisticDate} (7 in 10 similar tickets took ${r.realisticDays} working days or less). A safe date is ${r.safeDate}.`);
  if (r.elapsed) lines.push(`It has been open ${r.elapsed} working days, so only past tickets that ran at least that long were used.`);
  lines.push(`Based on ${r.sample} finished ${r.basis === 'similar' ? 'similar tickets' : r.basis === 'type' ? 'tickets of the same type' : 'tickets in the project'} (${r.confidence} confidence).`);
  if (r.promise) lines.push(`This project met ${pct(r.promise.rate)} of its due dates (${r.promise.kept} of ${r.promise.total}).`);
  lines.push('Closest past tickets:');
  for (const e of r.evidence) lines.push(`- ${e.key} "${e.summary}": ${e.days} working days${e.metDue === false ? ', finished late' : e.metDue ? ', on time' : ''}`);
  return lines.join('\n');
}

/** Answer for a whole project. */
export function describeProject(projectKey, report) {
  if (!report.promise) return `${projectKey} has no finished tickets with due dates yet, so there is nothing to measure.`;
  const lines = [`${projectKey}: ${pct(report.promise.rate)} of due dates met (${report.promise.kept} of ${report.promise.total} finished tickets with a due date).`];
  lines.push('By kind of work (worst first):');
  for (const k of report.kinds.filter((x) => x.rate !== null).slice(0, 6)) {
    const gap = k.gap > 0 ? `, promised about ${k.promised} days but takes about ${k.takes}` : `, takes about ${k.takes} days`;
    lines.push(`- ${k.kind}: ${pct(k.rate)} on time${gap} (${k.dated} tickets)`);
  }
  const risky = report.atRisk.filter((r) => r.verdict !== 'likely');
  lines.push(risky.length ? `${risky.length} open tickets are tight or likely to slip:` : 'No open ticket with a due date looks at risk.');
  for (const r of risky.slice(0, 8)) lines.push(`- ${r.key} "${r.summary}": due ${r.due}, realistic ${r.realisticDate}, ${pct(r.chance)} chance${r.overdue ? ' (already overdue)' : ''}`);
  return lines.join('\n');
}
