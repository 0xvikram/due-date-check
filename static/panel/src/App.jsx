import React, { useCallback, useEffect, useState } from 'react';
import { events, invoke, view } from '@forge/bridge';
import { Button, C, ErrorBox, FONT, Skeleton, TicketLink, VERDICT, pct } from './ui.jsx';

// The ticket panel: the realistic date, the chance of hitting the promised one, and the
// past tickets the numbers come from. Changing the due date always asks first and can be
// undone, because it edits a ticket other people rely on.

const pretty = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
// Jira reloads this panel after view.refresh(), so the last change is kept for a few
// minutes in the iframe's own storage to keep the Undo offer on screen.
const MEMO = 'ddc:lastChange';
const remember = (c) => { try { localStorage.setItem(MEMO, JSON.stringify({ ...c, at: Date.now() })); } catch {} };
const forget = () => { try { localStorage.removeItem(MEMO); } catch {} };
const recall = (key, due) => {
  try {
    const c = JSON.parse(localStorage.getItem(MEMO) || 'null');
    return c && c.key === key && c.to === due && Date.now() - c.at < 5 * 60 * 1000 ? c : null;
  } catch {
    return null;
  }
};
const days = (n) => `${n} working ${n === 1 ? 'day' : 'days'}`;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // idle -> confirm -> saving -> saved (with the old date kept for Undo)
  const [change, setChange] = useState({ step: 'idle' });

  const load = useCallback(() => {
    setError(null);
    return invoke('estimate')
      .then((d) => {
        setData(d);
        const c = recall(d.key, d.due);
        if (c) setChange({ step: 'saved', from: c.from, to: c.to });
      })
      .catch((e) => setError(e?.message || 'Could not load the estimate.'));
  }, []);

  useEffect(() => {
    load();
    const sub = events.on('JIRA_ISSUE_CHANGED', load);
    return () => {
      sub.then((s) => s.unsubscribe());
    };
  }, [load]);

  const setDue = async (date, then) => {
    setChange((c) => ({ ...c, step: 'saving' }));
    try {
      await invoke('useRealisticDate', { date });
      if (then.step === 'saved') remember({ key: data.key, from: then.from, to: then.to });
      else forget();
      setChange(then);
      await load();
      // Ask Jira to redraw the ticket so its own Due date field shows the change.
      view.refresh().catch(() => {});
    } catch (e) {
      setChange({ step: 'idle' });
      setError(e?.message || 'Could not change the due date.');
    }
  };

  const wrap = (child) => <div style={{ color: C.text, font: FONT }}>{child}</div>;
  if (error) return wrap(<ErrorBox message={error} onRetry={load} />);
  if (!data) return wrap(<Skeleton />);
  if (!data.ok) return wrap(<p style={{ color: C.subtle, margin: 0 }}>{data.reason}</p>);

  const v = VERDICT[data.verdict];
  const later = data.due && data.realisticDate > data.due;

  return wrap(
    <>
      {data.due ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: v.color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{v.label}</span>
          <span style={{ color: C.subtle }}>
            Due {pretty(data.due)} · realistic {pretty(data.realisticDate)}
          </span>
        </div>
      ) : (
        <div style={{ color: C.subtle }}>No due date yet. Realistic: {pretty(data.realisticDate)}</div>
      )}

      <div style={{ display: 'flex', gap: 24, margin: '12px 0', flexWrap: 'wrap' }}>
        {data.chance !== null ? <Stat big={pct(data.chance)} small="of similar work finished in time" color={v.color} /> : null}
        <Stat big={days(data.realisticDays)} small="7 in 10 similar tickets finished within this" />
        {data.promise ? <Stat big={pct(data.promise.rate)} small={`of this project's due dates were met (${data.promise.kept} of ${data.promise.total})`} /> : null}
      </div>

      {change.step === 'saved' ? (
        <div role="status" style={{ background: C.successBg, borderRadius: 4, padding: '8px 12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 160 }}>Due date changed to {pretty(change.to)}.</span>
          <Button kind="subtle" onClick={() => setDue(change.from, { step: 'idle' })}>Undo</Button>
        </div>
      ) : later && change.step === 'idle' ? (
        <Button onClick={() => setChange({ step: 'confirm' })}>Use the realistic date ({pretty(data.realisticDate)})</Button>
      ) : later ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ marginBottom: 8 }}>
            Change the due date from <strong>{pretty(data.due)}</strong> to <strong>{pretty(data.realisticDate)}</strong>? Everyone watching this ticket will see the new date.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button disabled={change.step === 'saving'} onClick={() => setDue(data.realisticDate, { step: 'saved', from: data.due, to: data.realisticDate })}>
              {change.step === 'saving' ? 'Saving…' : 'Change due date'}
            </Button>
            <Button kind="subtle" disabled={change.step === 'saving'} onClick={() => setChange({ step: 'idle' })}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: C.subtle, marginBottom: 6 }}>
          Based on {data.sample} finished {data.basis === 'similar' ? 'similar tickets' : data.basis === 'type' ? `${data.sample === 1 ? 'ticket' : 'tickets'} of the same type` : 'tickets in this project'} · {data.confidence} confidence
        </div>
        {data.evidence.map((e) => (
          <div key={e.key} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '3px 0' }}>
            <TicketLink id={e.key} style={{ minWidth: 56 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.why.join(', ')}>{e.summary}</span>
            <span style={{ color: e.metDue === false ? C.red : C.subtle, whiteSpace: 'nowrap' }}>{days(e.days)}{e.metDue === false ? ' · late' : ''}</span>
          </div>
        ))}
      </div>
    </>,
  );
}

function Stat({ big, small, color }) {
  return (
    <div style={{ minWidth: 120, flex: '1 1 0' }}>
      <div style={{ fontSize: 22, fontWeight: 650, color: color || C.text }}>{big}</div>
      <div style={{ fontSize: 12, color: C.subtle }}>{small}</div>
    </div>
  );
}
