# Due Date Check

**Due dates your team can actually keep.** A Jira app that shows, the moment a due date is set, the realistic one, worked out from how long the same kind of work really took your team.

Live site: **https://due-date-check.vercel.app** · Built for Atlassian Codegeist 2026 (Business Teams)

> REQ-201 "Review Globex contract": **Likely to slip.** Due Fri 20 Nov, realistic Thu 26 Nov. 0% of 30 similar tickets finished in time; 7 in 10 took 6 working days; this project met 64% of its due dates (122 of 190).

## What it does

- **Ticket panel**: on track, tight or likely to slip; the realistic and safe dates; the past tickets behind every number; one button to use the realistic date (asks first, with Undo).
- **Project page**: share of due dates met overall and per month, which kinds of work slip and by how much (promised vs real median days), and every open ticket with a due date ranked by its chance.
- **Rovo agent "Due Date Coach"**: ask "can we finish REQ-12 by Friday?" or "which of our work slips?". It calls two actions and only states numbers they return.

No machine learning and no estimates: plain counting over the team's own finished tickets. See [how it works](https://due-date-check.vercel.app/how-it-works.html).

## How it is built

- Atlassian Forge, `nodejs24.x`, eligible for **Runs on Atlassian** (no egress; nothing leaves Atlassian).
- Modules: `jira:issuePanel`, `jira:projectPage` (one Custom UI bundle, Vite + React 18), `rovo:agent` with two `action`s.
- All Jira reads use `asUser()`, so the app sees only what the viewer can see. Scopes: `read:jira-work`, `write:jira-work` (due date only).

```
src/engine/   pure maths, tested without Jira
  dates.js      working days
  estimate.js   similar-ticket matching, percentiles, chance, verdict
  report.js     project report (promise rate, kinds, months, at risk)
  words.js      plain-text answers for Rovo
src/jira.js   Jira REST reads/writes
src/index.js  resolvers + Rovo action handlers
static/panel/ Custom UI (App.jsx = ticket panel, ProjectPage.jsx, ui.jsx)
test/         node:test suites
scripts/make-demo-csv.js   seeded demo data (demo/requests.csv)
site/         the product site (static HTML)
```

## Run it

```bash
npm install && (cd static/panel && npm install && npm run build)
npm test                                   # 18 engine tests
forge register                             # once, gives the app your own id
forge deploy -e development
forge install --site <your-site>.atlassian.net --product jira -e development
```

Demo data: `node scripts/make-demo-csv.js` writes `demo/requests.csv` (202 requests across Legal, Design, Content, Web and Events with backdated dates). Import it with Jira's CSV importer (date format `yyyy-MM-dd HH:mm`).

## License

MIT
