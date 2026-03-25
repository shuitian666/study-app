import type { ProficiencyLevel } from '@/types';
import { PROFICIENCY_MAP } from '@/types';

export function ProficiencyBadge({ level }: { level: ProficiencyLevel }) {
  const config = PROFICIENCY_MAP[level];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {config.label}
    </span>
  );
}

export function PageHeader({
  title,
  onBack,
  rightAction,
}: {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-12 px-4">
        <div className="w-16">
          {onBack && (
            <button onClick={onBack} className="text-text-secondary text-sm flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              返回
            </button>
          )}
        </div>
        <h1 className="text-base font-semibold text-text-primary">{title}</h1>
        <div className="w-16 flex justify-end">{rightAction}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8">
      <span className="text-5xl mb-4">{icon}</span>
      <p className="text-text-secondary font-medium">{title}</p>
      {description && <p className="text-text-muted text-sm mt-1">{description}</p>}
    </div>
  );
}

export function ProgressBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-border">
      <div className={`text-xl font-bold ${color ?? 'text-primary'}`}>{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
