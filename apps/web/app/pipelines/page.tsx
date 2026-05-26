'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MainLayout } from '../../src/components/layout/main-layout';
import { StatusPill } from '../../src/components/shared/status-pill';
import { DataTable } from '../../src/components/shared/data-table';

const MOCK_PIPELINES = [
  { marketKey: 'BINANCE:BTCUSDT', tickerid: 'BTCUSDT', timeframe: '15m', pipelineStatus: 'success', tradePlanAction: 'LONG', riskVerdict: 'approved', updatedAt: new Date().toISOString() },
  { marketKey: 'BINANCE:ETHUSDT', tickerid: 'ETHUSDT', timeframe: '1h', pipelineStatus: 'success', tradePlanAction: 'SHORT', riskVerdict: 'approved', updatedAt: new Date().toISOString() },
  { marketKey: 'BINANCE:BNBUSDT', tickerid: 'BNBUSDT', timeframe: '4h', pipelineStatus: 'failed', tradePlanAction: null, riskVerdict: null, updatedAt: new Date().toISOString() },
];

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState(MOCK_PIPELINES);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const res = await fetch('/api/dashboard/pipelines?limit=100');
        if (res.ok) {
          const data = await res.json();
          setPipelines(data);
        }
      } catch (error) {
        console.log('Using mock pipelines - API not available');
      }
    };

    fetchPipelines();
  }, []);

  const filteredPipelines = pipelines.filter(
    (p) =>
      p.marketKey?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tickerid?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-off-white mb-2">Pipeline Monitor</h1>
        <p className="text-muted">Real-time view of all market pipelines and their execution states</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search markets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg bg-graphite border border-line text-off-white placeholder-muted focus:outline-none focus:border-cyber-cyan"
        />
        <div className="text-sm text-muted font-mono">
          {filteredPipelines.length} pipelines
        </div>
      </div>

      {/* Pipeline Table */}
      <DataTable
        columns={[
          { key: 'marketKey', label: 'Market Key' },
          { key: 'tickerid', label: 'Ticker' },
          { key: 'timeframe', label: 'TF' },
          {
            key: 'pipelineStatus',
            label: 'Status',
            render: (value) => <StatusPill status={value} />,
          },
          {
            key: 'tradePlanAction',
            label: 'Plan',
            render: (v) => v ? <StatusPill status={v} /> : <span className="text-muted">—</span>,
          },
          {
            key: 'riskVerdict',
            label: 'Risk',
            render: (v) => v ? <StatusPill status={v} /> : <span className="text-muted">—</span>,
          },
          {
            key: 'updatedAt',
            label: 'Updated',
            render: (v) => new Date(v).toLocaleString(),
          },
        ]}
        data={filteredPipelines}
        rowKey="marketKey"
        onRowClick={(row) => {
          window.location.href = `/markets/${encodeURIComponent(row.marketKey)}`;
        }}
      />
    </MainLayout>
  );
}
