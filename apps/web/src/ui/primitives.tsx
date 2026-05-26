import Link from "next/link";
import type { ReactNode } from "react";
import { formatTimestamp } from "./format";
import { getStatusTone } from "./status";

type ActionLink = {
  href: string;
  label: string;
};

export function PageShell({ children }: { children: ReactNode }): ReactNode {
  return <main className="dashboard-shell">{children}</main>;
}

export function PageHero({
  eyebrow,
  title,
  copy,
  actions,
  compact = true
}: {
  eyebrow: string;
  title: ReactNode;
  copy: string;
  actions?: readonly ActionLink[];
  compact?: boolean;
}): ReactNode {
  return (
    <section className={`hero-panel${compact ? " hero-panel-compact" : ""}`}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-copy">{copy}</p>
      </div>
      {actions && actions.length > 0 ? (
        <div className="hero-actions">
          {actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className="action-link"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function Section({
  kicker,
  title,
  action,
  children
}: {
  kicker?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="section-block">
      {title || action ? (
        <div className="section-heading">
          <div>
            {kicker ? <p className="section-kicker">{kicker}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageMeta({
  loadedAt = new Date()
}: {
  loadedAt?: Date;
}): ReactNode {
  return (
    <div className="page-meta">
      <span>Loaded at {formatTimestamp(loadedAt.toISOString())}</span>
    </div>
  );
}

export function DebugLink({
  href,
  children = "View API"
}: {
  href: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <Link href={href} className="debug-link">
      {children}
    </Link>
  );
}

export function TextLink({
  href,
  children
}: {
  href: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Link href={href} className="text-link">
      {children}
    </Link>
  );
}

export function InlineLink({
  href,
  children
}: {
  href: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Link href={href} className="action-link action-link-inline">
      {children}
    </Link>
  );
}

export function MetricGrid({
  items
}: {
  items: readonly (readonly [string, ReactNode])[];
}): ReactNode {
  return (
    <div className="card-grid">
      {items.map(([label, value]) => (
        <article key={label} className="metric-card">
          <p className="metric-label">{label}</p>
          <p className="metric-value metric-value-compact">{value}</p>
        </article>
      ))}
    </div>
  );
}

export function DetailGrid({
  children,
  tight = false
}: {
  children: ReactNode;
  tight?: boolean;
}): ReactNode {
  return (
    <div className={`detail-grid${tight ? " detail-grid-tight" : ""}`}>
      {children}
    </div>
  );
}

export function DetailCard({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <article className="detail-card">
      <p className="metric-label">{title}</p>
      {children}
    </article>
  );
}

export function DetailList({
  rows
}: {
  rows: readonly (readonly [string, ReactNode])[];
}): ReactNode {
  return (
    <dl className="detail-list">
      {rows.map(([label, value]) => (
        <div key={label} className="detail-list-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonPre({ value }: { value: unknown }): ReactNode {
  return <pre className="detail-pre">{JSON.stringify(value, null, 2)}</pre>;
}

export function JsonDisclosure({
  title,
  value
}: {
  title: string;
  value: unknown;
}): ReactNode {
  return (
    <details className="json-disclosure">
      <summary>{title}</summary>
      <JsonPre value={value} />
    </details>
  );
}

export function StatusPill({ value }: { value: string }): ReactNode {
  return (
    <span className={`status-pill status-${getStatusTone(value)}`}>{value}</span>
  );
}

export function TableEmptyState({
  children,
  colSpan
}: {
  children: ReactNode;
  colSpan: number;
}): ReactNode {
  return (
    <tr>
      <td colSpan={colSpan} className="empty-cell">
        {children}
      </td>
    </tr>
  );
}

export function BlockEmptyState({ children }: { children: ReactNode }): ReactNode {
  return <p className="empty-cell">{children}</p>;
}

export function DataTable({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="table-wrap">
      <table className="data-table">{children}</table>
    </div>
  );
}
