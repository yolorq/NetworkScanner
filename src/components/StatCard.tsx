import type { ReactNode } from 'react';
export function StatCard({
  label,
  value,
  meta,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  meta: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{meta}</small>
      </div>
    </div>
  );
}
