'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MainLayout } from '../../src/components/layout/main-layout';
import { MetricCard } from '../../src/components/shared/metric-card';
import { StatusPill } from '../../src/components/shared/status-pill';
import { DataTable } from '../../src/components/shared/data-table';

interface AgentRun {
  id: string;
  marketKey: string;
  status: string;
  executionEligible: boolean | null;
  operation: string;
  skillName?: string;
  runnerKind: string;
  modelProvider?: string;
  model?: string;
  promptVersion?: string;
  latencyMs: number;
  tradePlanVersionId?: string;
  errorMessage?: string;
  startedAt: string;
  tokenUsageJson?: any;
}

const MOCK_AGENT_RUNS = [
  {
    id: '1',
    marketKey: 'BINANCE:BTCUSDT',
    status: 'success',
    executionEligible: true,
    operation: 'plan',
    skillName: 'PlanSkill',
    runnerKind: 'openai',
    modelProvider: 'OpenAI',
    model: 'gpt-4',
    promptVersion: 'v1.0',
    latencyMs: 450,
    tradePlanVersionId: 'plan_abc123',
    startedAt: new Date().toISOString(),
  },
  {
    id: '2',
    marketKey: 'BINANCE:ETHUSDT',
    status: 'failed',
    executionEligible: false,
    operation: 'plan',
    skillName: 'PlanSkill',
    runnerKind: 'openai',
    model: 'gpt-4',
    promptVersion: 'v1.0',
    latencyMs: 3200,
    errorMessage: 'Model timeout after 3000ms',
    startedAt: new Date(Date.now() - 60000).toISOString(),
  },
];

export default function AgentRunsPage() {
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>(MOCK_AGENT_RUNS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'failed' | 'eligible'>('all');

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const res = await fetch('/api/dashboard/agent-runs?limit=100');
        if (res.ok) {
          const data = await res.json();
          setAgentRuns(data);
        }
      } catch (error) {
        console.log('Using mock agent runs - API not available');
      }
    };

    fetchRuns();
  }, []);

  const latestFailedRun = agentRuns.find((run) => run.status !== 'success') || null;
  const latestEligibleRun = agentRuns.find((run) => run.executionEligible === true) || null;

  const successCount = agentRuns.filter((run) => run.status === 'success').length;
  const failureCount = agentRuns.filter((run) => run.status !== 'success').length;
  const eligibleCount = agentRuns.filter((run) => run.executionEligible === true).length;
  const avgLatency =
    agentRuns.length > 0
      ? Math.round(agentRuns.reduce((sum, run) => sum + run.latencyMs, 0) / agentRuns.length)
      : 0;

  let filteredRuns = agentRuns;
  if (filter === 'failed') {
    filteredRuns = agentRuns.filter((run) => run.status !== 'success');
  } else if (filter === 'eligible') {
    filteredRuns = agentRuns.filter((run) => run.executionEligible === true);
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-off-white mb-2">Planner Audit Console</h1>
        <p className="text-muted">
          Monitoring AI agent runs, execution eligibility, and plan generation health
        </p>
      </div>

      {/* Summary Cards */}
      <div className="metrics-grid mb-8">
        <MetricCard label="Total Runs" value={agentRuns.length} icon="🔄" />
        <MetricCard
          label="Successful"
          value={successCount}
          changeType="positive"
          icon="✓"
        />
        <MetricCard
          label="Failed"
          value={failureCount}
          changeType="negative"
          icon="✕"
        />
        <MetricCard
          label="Execution Ready"
          value={eligibleCount}
          changeType="positive"
          icon="🎯"
        />
      </div>

      {/* Focus Areas */}
      <div className="detail-grid mb-8">
        {/* Latest Failure */}
        <div className="card-base p-6 border-l-4 border-l-neon-red">
          <h3 className="text-sm font-mono text-neon-red uppercase tracking-widest mb-3">
            Latest Failure Focus
          </h3>
          {latestFailedRun ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted mb-1">{latestFailedRun.marketKey}</p>
                <p className="text-off-white font-semibold">{latestFailedRun.status}</p>
              </div>
              <div className="p-3 rounded bg-neon-red/10 border border-neon-red/20">
                <p className="text-xs text-neon-red mb-2 font-mono">Error</p>
                <p className="text-sm text-off-white line-clamp-3">
                  {latestFailedRun.errorMessage || 'Unknown error'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted mb-1">Skill</p>
                  <p className="text-off-white">{latestFailedRun.skillName || latestFailedRun.operation}</p>
                </div>
                <div>
                  <p className="text-muted mb-1">Prompt</p>
                  <p className="text-off-white">{latestFailedRun.promptVersion || '—'}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">No failed runs in current sample</p>
          )}
        </div>

        {/* Latest Execution Ready */}
        <div className="card-base p-6 border-l-4 border-l-cyber-cyan">
          <h3 className="text-sm font-mono text-cyber-cyan uppercase tracking-widest mb-3">
            Latest Execution-Ready Plan
          </h3>
          {latestEligibleRun ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted mb-1">{latestEligibleRun.marketKey}</p>
                <p className="text-off-white font-semibold flex items-center gap-2">
                  <StatusPill status="success" label="" />
                  Execution Ready
                </p>
              </div>
              <div className="p-3 rounded bg-cyber-cyan/10 border border-cyber-cyan/20">
                <p className="text-xs text-cyber-cyan mb-2 font-mono">Model & Runner</p>
                <p className="text-sm text-off-white font-mono">
                  {latestEligibleRun.model
                    ? `${latestEligibleRun.modelProvider || latestEligibleRun.runnerKind}:${latestEligibleRun.model}`
                    : latestEligibleRun.runnerKind}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted mb-1">Latency</p>
                  <p className="text-off-white font-mono">{latestEligibleRun.latencyMs}ms</p>
                </div>
                <div>
                  <p className="text-muted mb-1">Plan Version</p>
                  <p className="text-off-white font-mono">
                    {latestEligibleRun.tradePlanVersionId
                      ? latestEligibleRun.tradePlanVersionId.slice(0, 8)
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">No execution-eligible runs available</p>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 flex gap-2">
        {(['all', 'failed', 'eligible'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-mono transition-all ${
              filter === f
                ? 'bg-cyber-cyan text-void-black'
                : 'bg-graphite text-muted hover:text-off-white'
            }`}
          >
            {f === 'all' ? 'All Runs' : f === 'failed' ? 'Failed' : 'Execution Ready'}
          </button>
        ))}
        <div className="ml-auto text-sm text-muted font-mono">
          {filteredRuns.length} runs
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={[
          { key: 'marketKey', label: 'Market' },
          { key: 'operation', label: 'Operation' },
          { key: 'skillName', label: 'Skill', render: (v) => v || '—' },
          {
            key: 'runnerKind',
            label: 'Runner',
            render: (_, row) => (
              <span className="font-mono text-xs">
                {row.model ? `${row.modelProvider || row.runnerKind}:${row.model}` : row.runnerKind}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (value) => <StatusPill status={value} />,
          },
          {
            key: 'executionEligible',
            label: 'Eligible',
            render: (v) => (
              <StatusPill status={v === true ? 'success' : v === false ? 'error' : 'neutral'} label={v === true ? 'YES' : v === false ? 'NO' : '—'} />
            ),
          },
          {
            key: 'latencyMs',
            label: 'Latency',
            render: (v) => <span className="font-mono text-xs">{v}ms</span>,
          },
          {
            key: 'startedAt',
            label: 'Started',
            render: (v) => new Date(v).toLocaleString(),
          },
        ]}
        data={filteredRuns}
        rowKey="id"
        onRowClick={(row) => {
          window.location.href = `/markets/${encodeURIComponent(row.marketKey)}`;
        }}
      />
    </MainLayout>
  );
}
