'use client';

interface StatusPillProps {
  status: string;
  label?: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  success: { color: 'text-green-500', bg: 'bg-green-500/10', icon: '✓' },
  failed: { color: 'text-neon-red', bg: 'bg-neon-red/10', icon: '✕' },
  error: { color: 'text-neon-red', bg: 'bg-neon-red/10', icon: '✕' },
  invalid_output: { color: 'text-neon-red', bg: 'bg-neon-red/10', icon: '!' },
  pending: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: '⟳' },
  active: { color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/10', icon: '●' },
  long: { color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/10', icon: '📈' },
  short: { color: 'text-neon-red', bg: 'bg-neon-red/10', icon: '📉' },
  neutral: { color: 'text-muted-foreground', bg: 'bg-muted/10', icon: '−' },
  watch: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: '👁' },
  armed: { color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/10', icon: '🎯' },
};

export function StatusPill({ status, label }: StatusPillProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.neutral;
  const displayLabel = label || status.replace(/_/g, ' ').toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold ${config.bg} ${config.color} border border-current border-opacity-20`}
    >
      <span className="text-xs">{config.icon}</span>
      {displayLabel}
    </span>
  );
}
