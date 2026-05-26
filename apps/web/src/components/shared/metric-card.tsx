'use client';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  className = '',
}: MetricCardProps) {
  const changeColor = {
    positive: 'text-green-500',
    negative: 'text-neon-red',
    neutral: 'text-muted',
  }[changeType];

  return (
    <div className={`card-base p-4 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-mono text-muted uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-off-white mt-2">{value}</p>
        </div>
        {icon && <div className="text-2xl opacity-50">{icon}</div>}
      </div>

      {change && (
        <p className={`text-xs font-mono ${changeColor}`}>
          {change}
        </p>
      )}
    </div>
  );
}
