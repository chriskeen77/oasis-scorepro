function Dot({ active }) {
  return <span className={`agent-dot ${active ? 'agent-dot--active' : ''}`} />;
}

function AgentCard({ name, icon, status, stats }) {
  const active = status !== 'idle';
  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <span className="agent-icon">{icon}</span>
        <span className="agent-name">{name}</span>
        <Dot active={active} />
        <span className="agent-status">{status}</span>
      </div>
      <div className="agent-stats">
        {stats.map(s => (
          <div key={s.label} className="agent-stat">
            <span className="agent-stat-label">{s.label}</span>
            <span className="agent-stat-val" style={{ color: s.color || '#9ca3af' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentPanel({ agentStats }) {
  const nf = agentStats?.news_fetcher || {};
  const sa = agentStats?.sentiment || {};
  const ra = agentStats?.regimen || {};

  return (
    <div className="agent-panel">
      <h3 className="panel-title">Active Agents</h3>
      <AgentCard
        name="News Fetcher"
        icon="📡"
        status={nf.status || 'idle'}
        stats={[
          { label: 'Headlines', value: nf.processed ?? '—' },
          { label: 'Feeds', value: '7' },
        ]}
      />
      <AgentCard
        name="Sentiment Agent"
        icon="🧠"
        status={sa.status || 'idle'}
        stats={[
          { label: 'Positive', value: sa.positive ?? '—', color: '#00ff88' },
          { label: 'Negative', value: sa.negative ?? '—', color: '#ef4444' },
          { label: 'Neutral', value: sa.neutral ?? '—', color: '#9ca3af' },
        ]}
      />
      <AgentCard
        name="Regimen Agent"
        icon="🔬"
        status={ra.status || 'idle'}
        stats={[
          { label: 'Passed', value: ra.passed ?? '—', color: '#00ff88' },
          { label: 'Failed', value: ra.failed ?? '—', color: '#ef4444' },
        ]}
      />
    </div>
  );
}
