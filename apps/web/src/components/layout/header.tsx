'use client';

import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-void-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between h-16 px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 relative">
            <Image
              src="/logo.png"
              alt="Bitpunk"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-lg text-off-white">bitpunk</span>
        </Link>

        {/* Center Nav */}
        <nav className="header-nav">
          <Link
            href="/"
            className="text-sm text-muted hover:text-cyber-cyan transition-colors"
          >
            Overview
          </Link>
          <Link
            href="/pipelines"
            className="text-sm text-muted hover:text-cyber-cyan transition-colors"
          >
            Pipelines
          </Link>
          <Link
            href="/agent-runs"
            className="text-sm text-muted hover:text-cyber-cyan transition-colors"
          >
            Agent Runs
          </Link>
        </nav>

        {/* Right side - Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted">
            <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse-glow"></div>
            <span>Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
