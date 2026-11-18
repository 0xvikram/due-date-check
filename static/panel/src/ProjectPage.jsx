import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import { C, ErrorBox, FONT, Skeleton, TicketLink, VERDICT, pct } from './ui.jsx';

// The project page: how often this team keeps its dates, which kinds of work slip and
// by how much, and which open tickets are likely to miss. Every number links back to
// real tickets, so a lead can check it before acting on it.

const pretty = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
const barColor = (rate) => (rate >= 0.7 ? C.greenBar : rate >= 0.4 ? C.amberBar : C.redBar);

export default function ProjectPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    invoke('projectReport').then(setData).catch((e) => setError(e?.message || 'Could not load the report.'));
  }, []);
  useEffect(load, [load]);

  const shell = (child) => <div style={{ color: C.text, font: FONT, padding: '8px 4px 32px', maxWidth: 1080 }}>{child}</div>;
  if (error) return shell(<ErrorBox message={error} onRetry={load} />);
  if (!data) return shell(<Skeleton rows={[['55%', 14], ['100%', 72], ['30%', 16], ['100%', 160], ['30%', 16], ['100%', 90]]} />);
  if (!data.promise) return shell(<Empty />);

  const worst = data.kinds.find((k) => k.rate !== null && k.gap > 0);
  const risky = data.atRisk.filter((r) => r.verdict !== 'likely');

  return shell(
    <>
      <p style={{ color: C.subtle, margin: '0 0 20px' }}>
        How often {data.project} keeps its due dates, from its {data.finished} most recent finished tickets.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Card big={pct(data.promise.rate)} small={`of due dates met (${data.promise.kept} of ${data.promise.total})`} color={data.promise.rate >= 0.7 ? C.green : data.promise.rate >= 0.4 ? C.amber : C.red} />
        <Card big={String(risky.length)} small={`open ${risky.length === 1 ? 'ticket is' : 'tickets are'} tight or likely to slip`} color={risky.length ? C.red : C.green} />
        {worst ? <Card big={worst.kind} small={`slips most: promised ~${worst.promised} days, takes ~${worst.takes}`} /> : null}
      </div>

      <Section title="At risk now" note="Open tickets with a due date, least likely to land first.">
        {data.atRisk.length ? (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: C.subtlest, fontSize: 12, textAlign: 'left' }}>
                <Th>Ticket</Th><Th>Kind</Th><Th>Due</Th><Th>Realistic</Th><Th align="right">Chance</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.atRisk.map((r) => {
                const v = VERDICT[r.verdict];
                return (
                  <tr key={r.key} style={{ borderTop: `1px solid ${C.border}` }}>
                    <Td>
                      <TicketLink id={r.key} style={{ marginRight: 8 }} />
                      <span>{r.summary}</span>
                    </Td>
                    <Td muted>{r.kind}</Td>
                    <Td style={{ color: r.overdue ? C.red : undefined }}>{pretty(r.due)}{r.overdue ? ' (overdue)' : ''}</Td>
                    <Td>{pretty(r.realisticDate)}</Td>
                    <Td align="right" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct(r.chance)}</Td>
                    <Td><span style={{ color: v.color, fontWeight: 650, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.3 }}>{v.label}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <p style={{ color: C.subtle, margin: 0 }}>No open tickets have a due date.</p>
        )}
      </Section>

      <Section title="Which work slips" note="Per kind of work: how often the date was met, what people promise and what it really takes (median working days).">
        {data.kinds.filter((k) => k.rate !== null).map((k) => (
          <div key={k.kind} style={{ display: 'flex', flexWrap: 'wrap', columnGap: 12, rowGap: 4, alignItems: 'center', padding: '6px 0' }}>
            <span style={{ fontWeight: 600, width: 110 }}>{k.kind}</span>
            <div style={{ flex: '1 1 200px', background: C.sunken, borderRadius: 3, height: 10, overflow: 'hidden' }} title={`${pct(k.rate)} of ${k.dated} met`}>
              <div style={{ width: pct(k.rate), height: '100%', background: barColor(k.rate) }} />
            </div>
            <span style={{ color: C.subtle, fontSize: 13, flex: '0 1 300px' }}>
              <strong style={{ color: C.text }}>{pct(k.rate)}</strong> on time · promised {k.promised}d, takes {k.takes}d
            </span>
          </div>
        ))}
      </Section>

      <Section title="Promises kept, month by month" note="Share of tickets finished each month that met their due date.">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, paddingTop: 8 }}>
          {data.months.map((m) => (
            <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }} title={`${m.kept} of ${m.total} met`}>
              <span style={{ fontSize: 12, color: C.subtle }}>{pct(m.rate)}</span>
              <div style={{ width: '100%', maxWidth: 48, height: `${Math.max(4, m.rate * 100)}%`, background: barColor(m.rate), borderRadius: '3px 3px 0 0' }} />
              <span style={{ fontSize: 12, color: C.subtlest }}>{monthName(m.month)}</span>
            </div>
          ))}
        </div>
      </Section>

      <p style={{ color: C.subtlest, fontSize: 12, marginTop: 24 }}>
        Numbers come only from this project's own tickets and are worked out inside Atlassian. Ask the Due Date Coach in Rovo "why" for any of them.
      </p>
    </>,
  );
}

function Card({ big, small, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || C.text, lineHeight: 1.15 }}>{big}</div>
      <div style={{ color: C.subtle, fontSize: 13, marginTop: 4 }}>{small}</div>
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 2px' }}>{title}</h2>
      <p style={{ color: C.subtlest, fontSize: 12, margin: '0 0 10px' }}>{note}</p>
      {children}
    </section>
  );
}

const Th = ({ children, align }) => <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: align || 'left' }}>{children}</th>;
const Td = ({ children, align, muted, style }) => <td style={{ padding: '8px', textAlign: align || 'left', color: muted ? C.subtle : undefined, ...style }}>{children}</td>;

function Empty() {
  return (
    <div style={{ padding: '24px 0' }}>
      <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Nothing to measure yet</h1>
      <p style={{ color: C.subtle, maxWidth: 520 }}>
        Due Date Check learns from finished tickets that had a due date. Once a few are done here, this page shows how often the team keeps its dates and which work slips.
      </p>
    </div>
  );
}
