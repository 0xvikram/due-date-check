import React from 'react';
import { router } from '@forge/bridge';

// Shared look for the ticket panel and the project page. Colours are Atlassian design
// tokens with light-mode fallbacks, so both screens follow Jira's light and dark themes.

export const C = {
  text: 'var(--ds-text, #172B4D)',
  subtle: 'var(--ds-text-subtle, #44546F)',
  subtlest: 'var(--ds-text-subtlest, #626F86)',
  border: 'var(--ds-border, #091E4224)',
  surface: 'var(--ds-surface-raised, #FFFFFF)',
  sunken: 'var(--ds-background-neutral, #091E420F)',
  green: 'var(--ds-text-success, #216E4E)',
  greenBar: 'var(--ds-background-success-bold, #1F845A)',
  amber: 'var(--ds-text-warning, #A54800)',
  amberBar: 'var(--ds-background-warning-bold, #F5CD47)',
  red: 'var(--ds-text-danger, #AE2E24)',
  redBar: 'var(--ds-background-danger-bold, #C9372C)',
  link: 'var(--ds-link, #0C66E4)',
  brand: 'var(--ds-background-brand-bold, #0C66E4)',
  brandHover: 'var(--ds-background-brand-bold-hovered, #0055CC)',
  onBrand: 'var(--ds-text-inverse, #FFFFFF)',
  successBg: 'var(--ds-background-success, #DCFFF1)',
  dangerBg: 'var(--ds-background-danger, #FFECEB)',
};

export const FONT = '14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, sans-serif';

export const VERDICT = {
  likely: { label: 'On track', color: C.green },
  tight: { label: 'Tight', color: C.amber },
  unlikely: { label: 'Likely to slip', color: C.red },
};

export const pct = (x) => `${Math.round(x * 100)}%`;

/** A ticket key that opens the ticket. A real button, so it works from the keyboard. */
export function TicketLink({ id, style }) {
  return (
    <button
      type="button"
      onClick={() => router.open(`/browse/${id}`)}
      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: C.link, cursor: 'pointer', textAlign: 'left', ...style }}
    >
      {id}
    </button>
  );
}

export function Button({ children, onClick, disabled, kind = 'primary' }) {
  const primary = kind === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: primary ? C.brand : C.sunken,
        color: primary ? C.onBrand : C.text,
        border: 0,
        borderRadius: 3,
        padding: '6px 12px',
        font: 'inherit',
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Grey placeholder shapes while the history loads. */
export function Skeleton({ rows = [['40%', 14], ['100%', 44], ['70%', 12], ['90%', 12], ['80%', 12]] }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 10 }}>
      <style>{'@keyframes ddc-pulse{0%,100%{opacity:1}50%{opacity:.45}}'}</style>
      {rows.map(([w, h], i) => (
        <div key={i} style={{ width: w, height: h, borderRadius: 3, background: C.sunken, animation: 'ddc-pulse 1.4s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div role="alert" style={{ background: C.dangerBg, borderRadius: 4, padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ color: C.red, flex: 1, minWidth: 180 }}>{message}</span>
      {onRetry ? <Button kind="subtle" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}
