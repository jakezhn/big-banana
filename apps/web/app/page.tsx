'use client';

import Link from "next/link";
import { use, useState, useEffect } from "react";
import { MainLayout } from "../src/components/layout/main-layout";
import { MetricCard } from "../src/components/shared/metric-card";
import { StatusPill } from "../src/components/shared/status-pill";
import { DataTable } from "../src/components/shared/data-table";

interface DashboardData {
  overview: any;
  pipelines: any[];
}

// Mock data for demo purposes
const MOCK_DATA = {
  overview: {
    signalsTodayCount: 24,
    plansTodayCount: 18,
    riskRejectsTodayCount: 3,
    ordersSubmittedTodayCount: 15,
  },
  pipelines: [
    { marketKey: 'BINANCE:BTCUSDT', timeframe: '15m', pipelineStatus: 'success', tradePlanAction: 'LONG', riskVerdict: 'approved', updatedAt: new Date().toISOString() },
    { marketKey: 'BINANCE:ETHUSDT', timeframe: '1h', pipelineStatus: 'success', tradePlanAction: 'SHORT', riskVerdict: 'approved', updatedAt: new Date().toISOString() },
  ]
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(MOCK_DATA as DashboardData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, pipelinesRes] = await Promise.all([
          fetch('/api/dashboard/overview'),
          fetch('/api/dashboard/pipelines?limit=12'),
        ]);
        
        if (overviewRes.ok && pipelinesRes.ok) {
          const overview = await overviewRes.json();
          const pipelines = await pipelinesRes.json();
          setData({ overview, pipelines });
        }
      } catch (error) {
        console.log('Using mock data - API not available');
      }
    };

    fetchData();
  }, []);

  const overview = data?.overview || {};
  const pipelines = data?.pipelines || [];

  const metrics = [
    { label: 'Signals Today', value: overview.signalsTodayCount || 0, icon: '📡' },
    { label: 'Plans Today', value: overview.plansTodayCount || 0, icon: '📋' },
    { label: 'Risk Rejects', value: overview.riskRejectsTodayCount || 0, icon: '🚫' },
    { label: 'Orders Submitted', value: overview.ordersSubmittedTodayCount || 0, icon: '➤' },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="mb-8">
        <div className="card-base p-8 border-l-4 border-l-cyber-cyan">
          <div className="max-w-3xl">
            <p className="text-xs font-mono text-cyber-cyan uppercase tracking-widest mb-2">
              🤖 AI-Powered Trading Intelligence
            </p>
            <h1 className="text-4xl font-bold text-off-white mb-3">
              Trading Pipeline Visibility
            </h1>
            <p className="text-muted leading-relaxed mb-6">
              Real-time monitoring of the paper execution chain from webhook ingest to order terminal states.
              This console is designed for operator debugging, performance analysis, and intervention readiness.
            </p>
            <div className="flex gap-3">
              <Link
                href="/pipelines"
                className="px-4 py-2 rounded-lg bg-cyber-cyan text-void-black font-semibold hover:bg-opacity-90 transition-all"
              >
                Pipeline Monitor →
              </Link>
              <Link
                href="/agent-runs"
                className="px-4 py-2 rounded-lg border border-cyber-cyan text-cyber-cyan font-semibold hover:bg-cyber-cyan/10 transition-all"
              >
                Agent Runs →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Grid */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-off-white mb-4">Today&apos;s Operating Totals</h2>
        <div className="metrics-grid">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              icon={metric.icon}
            />
          ))}
        </div>
      </section>

      {/* Recent Pipelines */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-off-white">Recent Pipelines</h2>
          <Link href="/pipelines" className="text-cyber-cyan text-sm hover:text-opacity-80">
            View all →
          </Link>
        </div>
        <DataTable
          columns={[
            { key: 'marketKey', label: 'Market' },
            { key: 'timeframe', label: 'Timeframe' },
            {
              key: 'pipelineStatus',
              label: 'Status',
              render: (value) => <StatusPill status={value} />,
            },
            { key: 'tradePlanAction', label: 'Plan', render: (v) => v || '—' },
            { key: 'riskVerdict', label: 'Risk', render: (v) => v || '—' },
            {
              key: 'updatedAt',
              label: 'Updated',
              render: (v) => new Date(v).toLocaleString(),
            },
          ]}
          data={pipelines}
          rowKey="marketKey"
          onRowClick={(row) => {
            // Navigate to market detail
            window.location.href = `/markets/${encodeURIComponent(row.marketKey)}`;
          }}
        />
      </section>
    </MainLayout>
  );
}
