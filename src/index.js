// Backend for Due Date Check.
// - `handler`: resolvers for the ticket panel and the project page.
// - `checkDueDate`, `projectHealth`: Rovo actions used by the Due Date Coach agent.
// All the maths lives in ./engine so it can be tested without Jira.

import Resolver from '@forge/resolver';
import { estimate } from './engine/estimate.js';
import { projectReport } from './engine/report.js';
import { describeProject, describeTicket } from './engine/words.js';
import { getHistory, getIssue, getOpenWithDue, setDueDate } from './jira.js';

const today = () => new Date().toISOString().slice(0, 10);
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const PROJECT_KEY = /^[A-Z][A-Z0-9_]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const resolver = new Resolver();

// Ticket panel: the estimate for the ticket being viewed.
resolver.define('estimate', async (req) => {
  const key = req.context.extension.issue.key;
  const t0 = Date.now();
  const target = await getIssue(key);
  const history = await getHistory(target.project);
  const out = { key, summary: target.summary, ...estimate(target, history, today()) };
  console.log(`estimate ${key}: ${history.length} finished tickets read in ${Date.now() - t0} ms`);
  return out;
});

// Ticket panel: "Use the realistic date".
resolver.define('useRealisticDate', async (req) => {
  const key = req.context.extension.issue.key;
  const { date } = req.payload || {};
  if (!DATE.test(String(date))) throw new Error('Bad date');
  await setDueDate(key, date);
  return { ok: true, date };
});

// Project page: the whole report for the project being viewed.
resolver.define('projectReport', async (req) => {
  const project = req.context.extension.project.key;
  const t0 = Date.now();
  const [history, open] = await Promise.all([getHistory(project), getOpenWithDue(project)]);
  const out = { project, today: today(), ...projectReport(history, open, today()) };
  console.log(`projectReport ${project}: ${history.length} finished, ${open.length} open, ${Date.now() - t0} ms`);
  return out;
});

export const handler = resolver.getDefinitions();

// ---------- Rovo actions ----------
// Rovo passes the action inputs and, when chatting from a Jira page, a context object
// with the ticket or project the user is looking at. Each action returns plain text with
// exact numbers and ticket keys; the agent turns it into a reply.

/** Pull "ABC-123" from an input, or from the page the user has open. */
function issueKeyFrom(payload) {
  const typed = String(payload?.issueKey || '').trim().toUpperCase();
  if (ISSUE_KEY.test(typed)) return typed;
  const fromPage = String(payload?.context?.jira?.issueKey || '').toUpperCase();
  return ISSUE_KEY.test(fromPage) ? fromPage : null;
}

function projectKeyFrom(payload) {
  const typed = String(payload?.projectKey || '').trim().toUpperCase();
  if (PROJECT_KEY.test(typed)) return typed;
  const issue = issueKeyFrom(payload);
  if (issue) return issue.split('-')[0];
  const fromPage = String(payload?.context?.jira?.projectKey || '').toUpperCase();
  return PROJECT_KEY.test(fromPage) ? fromPage : null;
}

export async function checkDueDate(payload) {
  try {
    const key = issueKeyFrom(payload);
    if (!key) return 'I need a Jira ticket key, like REQ-12. Ask the user which ticket they mean.';
    const proposed = String(payload?.proposedDate || '').trim();
    if (proposed && !DATE.test(proposed)) return `The proposed date "${proposed}" is not in YYYY-MM-DD form. Ask the user for the date again.`;
    const target = await getIssue(key);
    const history = await getHistory(target.project);
    return describeTicket(target, history, today(), proposed || undefined);
  } catch (e) {
    return `Could not check that ticket: ${e.message}. The user may not have access to it.`;
  }
}

export async function projectHealth(payload) {
  try {
    const project = projectKeyFrom(payload);
    if (!project) return 'I need a Jira project key, like REQ. Ask the user which project they mean.';
    const [history, open] = await Promise.all([getHistory(project), getOpenWithDue(project)]);
    return describeProject(project, projectReport(history, open, today()));
  } catch (e) {
    return `Could not read that project: ${e.message}. The user may not have access to it.`;
  }
}
