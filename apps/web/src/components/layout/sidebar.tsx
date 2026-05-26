'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/pipelines', label: 'Pipelines', icon: '🔄' },
  { href: '/agent-runs', label: 'Agent Runs', icon: '🤖' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:block w-64 border-r border-line bg-graphite min-h-screen fixed left-0 top-16">
      <nav className="flex flex-col gap-2 p-6">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${
                  isActive
                    ? 'bg-slate border border-cyber-cyan text-cyber-cyan'
                    : 'text-muted hover:text-off-white hover:bg-slate'
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="absolute bottom-6 left-6 right-6 p-4 rounded-lg bg-slate/50 border border-line">
        <p className="text-xs text-muted mb-2">System Status</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse-glow"></div>
          <span className="text-xs text-cyber-cyan font-mono">Operational</span>
        </div>
      </div>
    </aside>
  );
}
