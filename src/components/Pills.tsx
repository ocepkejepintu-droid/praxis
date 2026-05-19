import type { Risk, Status } from '@/lib/types';

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill status-${status}`}>{status}</span>;
}

export function RiskBadge({ risk }: { risk: Risk }) {
  return <span className={`pill risk-${risk}`}>risk: {risk}</span>;
}

export function ScoreBadge({ label, value }: { label: string; value: number }) {
  return <span className="score"><strong>{value}</strong><em>{label}</em></span>;
}
