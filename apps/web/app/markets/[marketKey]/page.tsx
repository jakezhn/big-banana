'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '../../../src/components/layout/main-layout';
import { StatusPill } from '../../../src/components/shared/status-pill';
import { MetricCard } from '../../../src/components/shared/metric-card';
import { useParams } from 'next/navigation';

const MOCK_PIPELINE = {
  pipelineStatus: 'success',
  marketState: { tickerid: 'BTCUSDT', timeframe: '15m' },
  currentPosition: { positionSide: 'LONG', signedQty: 1.5, avgEntryPrice: 45000 },
  tradePlanVersion: { version: 1, action: 'LONG', reasoningSummary: 'Market showing strong uptrend with bullish signals' },
  riskVerdict: { verdict: 'approved' },
  latestOrder: { status: 'filled', submittedAt: new Date().toISOString() },
  latestFill: { price: 45100 },
  latestPostPlanReview: { outcomeSummary: 'Plan executed successfully', createdAt: new Date().toISOString() },
  latestPlanRevisionSuggestion: null,
  memoryLessonCandidates: [],
  executionIntent: null,
};

export default function MarketDetailPage() {
  const params = useParams();
  const marketKey = Array.isArray(params?.marketKey) 
    ? params.marketKey[0] 
    : (params?.marketKey || '');
  const decodedMarketKey = decodeURIComponent(marketKey as string);
  
  const [pipeline, setPipeline] = useState<any>(MOCK_PIPELINE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        const res = await fetch(
          `/api/market-pipeline?market_key=${encodeURIComponent(decodedMarketKey)}`
        );
        if (res.ok) {
          const data = await res.json();
          setPipeline(data);
        }
      } catch (error) {
        console.log('Using mock pipeline - API not available');
      }
    };

    fetchPipeline();
  }, [decodedMarketKey]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin text-cyber-cyan mb-4">⟳</div>
            <p className="text-muted">Loading market detail...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!pipeline) {
    return (
      <MainLayout>
        <div className="card-base p-8 border-l-4 border-l-neon-red">
          <h2 className="text-xl font-bold text-neon-red">Pipeline Not Found</h2>
          <p className="text-muted mt-2">No data available for {decodedMarketKey}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold text-off-white">{decodedMarketKey}</h1>
          <StatusPill status={pipeline.pipelineStatus || 'neutral'} />
        </div>
        <p className="text-muted">Single-market execution trace and plan lifecycle monitoring</p>
      </div>

      {/* Execution Checklist */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-off-white mb-4">Execution Checklist</h2>
        <div className="detail-grid">
          {/* Left: Checklist */}
          <div className="card-base p-6">
            <div className="space-y-3">
              {[
                ['Trade Plan', !!pipeline.tradePlanVersion],
                ['Risk Verdict', !!pipeline.riskVerdict],
                ['Execution Intent', !!pipeline.executionIntent],
                ['Order Submitted', !!pipeline.latestOrder],
                ['Fill Recorded', !!pipeline.latestFill],
              ].map(([item, isReady]) => (
                <div key={item} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <span className="text-off-white">{item}</span>
                  <StatusPill 
                    status={isReady ? 'success' : 'warning'}
                    label={isReady ? '✓' : '−'}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Right: Lifecycle Timestamps */}
          <div className="card-base p-6">
            <div className="space-y-3">
              {[
                ['Plan', pipeline.tradePlanVersion?.createdAt],
                ['Revision', pipeline.latestPlanRevisionSuggestion?.createdAt],
                ['Review', pipeline.latestPostPlanReview?.createdAt],
                ['Order', pipeline.latestOrder?.submittedAt],
              ].map(([label, timestamp]: any) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <span className="text-muted text-sm">{label}</span>
                  <span className="text-off-white font-mono text-xs">
                    {timestamp ? new Date(timestamp).toLocaleString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Current State Metrics */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-off-white mb-4">Current Execution State</h2>
        <div className="metrics-grid-6">
          <MetricCard 
            label="Status"
            value={pipeline.pipelineStatus || '—'}
            icon="📊"
          />
          <MetricCard 
            label="Ticker"
            value={pipeline.marketState?.tickerid || '—'}
            icon="📈"
          />
          <MetricCard 
            label="Timeframe"
            value={pipeline.marketState?.timeframe || '—'}
            icon="⏱"
          />
          <MetricCard 
            label="Position"
            value={pipeline.currentPosition?.positionSide || 'flat'}
            icon="💰"
          />
          <MetricCard 
            label="Qty"
            value={pipeline.currentPosition?.signedQty || 0}
            icon="📦"
          />
          <MetricCard 
            label="Entry Price"
            value={pipeline.currentPosition?.avgEntryPrice ? formatNumber(pipeline.currentPosition.avgEntryPrice) : '—'}
            icon="💹"
          />
        </div>
      </section>

      {/* Overview & Reasoning */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-off-white mb-4">Plan & Reasoning</h2>
        <div className="detail-grid">
          {/* Summary */}
          <div className="card-base p-6 space-y-4">
            <h3 className="text-sm font-mono text-cyber-cyan uppercase tracking-widest">Summary</h3>
            {[
              ['Plan Version', pipeline.tradePlanVersion?.version || '—'],
              ['Plan Action', pipeline.tradePlanVersion?.action || '—'],
              ['Risk Verdict', pipeline.riskVerdict?.verdict || '—'],
              ['Order Status', pipeline.latestOrder?.status || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-line last:border-0">
                <span className="text-muted text-sm">{label}</span>
                <span className="text-off-white font-semibold">{value}</span>
              </div>
            ))}
          </div>

          {/* Reasoning Summary */}
          <div className="card-base p-6 space-y-4">
            <h3 className="text-sm font-mono text-cyber-cyan uppercase tracking-widest">Reasoning</h3>
            {[
              ['Trade Plan', pipeline.tradePlanVersion?.reasoningSummary],
              ['Latest Revision', pipeline.latestPlanRevisionSuggestion?.reason],
              ['Latest Review', pipeline.latestPostPlanReview?.outcomeSummary],
            ].map(([title, text]: any) => (
              <div key={title} className="py-2 border-b border-line last:border-0">
                <p className="text-xs text-muted mb-1 font-mono">{title}</p>
                <p className="text-sm text-off-white line-clamp-2">
                  {text ? truncate(text, 180) : 'No data recorded'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lesson Candidates */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-off-white mb-4">Lesson Candidates</h2>
        {pipeline.memoryLessonCandidates?.length === 0 ? (
          <div className="card-base p-6 text-center">
            <p className="text-muted">No lesson candidates recorded yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {(pipeline.memoryLessonCandidates || []).slice(0, 4).map((candidate: any) => (
              <div key={candidate.id} className="card-base p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-off-white font-semibold">{candidate.lesson}</p>
                    <p className="text-xs text-muted mt-1">{candidate.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-cyber-cyan">
                      confidence {formatNumber(candidate.confidence)}
                    </p>
                    <p className="text-xs text-muted mt-1">n={candidate.sampleSize}</p>
                  </div>
                </div>
                <details className="group">
                  <summary className="cursor-pointer text-xs font-mono text-muted hover:text-cyber-cyan">
                    Details →
                  </summary>
                  <pre className="mt-3 text-xs font-mono bg-graphite p-3 rounded overflow-auto max-h-40 text-muted">
{JSON.stringify(
  {
    scope: {
      market: candidate.scopeMarket,
      timeframe: candidate.scopeTimeframe,
    },
    confidence: candidate.confidence,
    sampleSize: candidate.sampleSize,
  },
  null,
  2
)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Raw Debug Data */}
      <section>
        <h2 className="text-xl font-bold text-off-white mb-4">Raw Debug Data</h2>
        <details className="group">
          <summary className="cursor-pointer px-6 py-4 card-base font-mono text-sm text-cyber-cyan hover:text-opacity-80">
            Expand all pipeline records →
          </summary>
          <div className="grid gap-4 mt-4">
            {[
              ['Market State', pipeline.marketState],
              ['Trade Plan', pipeline.tradePlanVersion],
              ['Risk Verdict', pipeline.riskVerdict],
              ['Execution Intent', pipeline.executionIntent],
              ['Latest Order', pipeline.latestOrder],
              ['Current Position', pipeline.currentPosition],
            ].map(([title, data]: any) => (
              <div key={title} className="card-base p-4">
                <p className="text-xs font-mono text-muted mb-3">{title}</p>
                <pre className="text-xs font-mono bg-graphite/70 p-3 rounded overflow-auto max-h-80 text-muted">
{JSON.stringify(data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </details>
      </section>
    </MainLayout>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 8,
  }).format(value);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
