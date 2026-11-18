// Reads a project's tickets from Jira and turns them into the plain items the engine uses.
// Requests go out as the signed-in user (asUser), so the app only ever sees what that
// person is already allowed to see in Jira.

import api, { route } from '@forge/api';

const FIELDS = ['summary', 'issuetype', 'labels', 'components', 'created', 'resolutiondate', 'duedate', 'status', 'project'];

/** Jira issue JSON -> engine item. */
export function toItem(issue) {
  const f = issue.fields || {};
  return {
    key: issue.key,
    summary: f.summary || '',
    type: f.issuetype?.name || '',
    labels: f.labels || [],
    components: (f.components || []).map((c) => c.name),
    created: f.created,
    resolved: f.resolutiondate || null,
    due: f.duedate || null,
    status: f.status?.name || '',
    project: f.project?.key || '',
  };
}

/** One ticket. */
export async function getIssue(key) {
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?fields=${FIELDS.join(',')}`);
  if (!res.ok) throw new Error(`Could not read ${key} (${res.status})`);
  return toItem(await res.json());
}

/**
 * The project's most recent finished tickets, newest first, up to `limit`. No age cut-off,
 * so slow or quiet projects still have history; the newest 500 keep it current.
 * Uses the enhanced JQL search, which pages with nextPageToken.
 */
export async function getHistory(projectKey, limit = 500) {
  const items = [];
  let nextPageToken;
  const jql = `project = "${projectKey}" AND resolutiondate is not EMPTY ORDER BY resolutiondate DESC`;
  do {
    const body = { jql, fields: FIELDS, maxResults: 100, ...(nextPageToken ? { nextPageToken } : {}) };
    const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Could not search ${projectKey} (${res.status})`);
    const page = await res.json();
    items.push(...(page.issues || []).map(toItem));
    nextPageToken = page.nextPageToken;
  } while (nextPageToken && items.length < limit);
  return items.slice(0, limit);
}

/** Open tickets in the project that have a due date, soonest first. */
export async function getOpenWithDue(projectKey, limit = 100) {
  const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jql: `project = "${projectKey}" AND resolution = EMPTY AND duedate is not EMPTY ORDER BY duedate ASC`,
      fields: FIELDS,
      maxResults: limit,
    }),
  });
  if (!res.ok) throw new Error(`Could not search ${projectKey} (${res.status})`);
  return ((await res.json()).issues || []).map(toItem);
}

/** Set a ticket's due date (used by "Use the realistic date"). */
export async function setDueDate(key, date) {
  const res = await api.asUser().requestJira(route`/rest/api/3/issue/${key}`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { duedate: date } }),
  });
  if (!res.ok) throw new Error(`Could not update ${key} (${res.status})`);
}
