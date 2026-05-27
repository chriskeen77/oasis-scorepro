import { useState, useMemo } from 'react';
import { useNewsFeed } from '../hooks/useNewsFeed';
import NewsCard from './NewsCard';
import AgentPanel from './AgentPanel';
import AlertBanner from './AlertBanner';
import SettingsPanel from './SettingsPanel';

function Clock() {
  const [time, setTime] = useState(new Date());
  useState(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  });
  return (
    <span className="header-clock">
      {time.toLocaleTimeString('en-US', { hour12: false })}
    </span>
  );
}

function LastRefreshed({ iso }) {
  if (!iso) return null;
  const t = new Date(iso);
  return (
    <span className="header-refresh-time">
      Last refresh: {t.toLocaleTimeString('en-US', { hour12: false })}
    </span>
  );
}

export default function Dashboard() {
  const {
    news, alerts, agentStats, settings, lastUpdated,
    loading, error, isRefreshing,
    manualRefresh, saveSettings,
  } = useNewsFeed();

  const [filter, setFilter] = useState('all');
  const [tickerSearch, setTickerSearch] = useState('');

  const filteredNews = useMemo(() => {
    let items = news;
    if (filter === 'alerts') items = items.filter(i => i.is_alert);
    else if (filter === 'catalyst') items = items.filter(i => i.regimen_passed);
    if (tickerSearch) {
      const q = tickerSearch.toUpperCase();
      items = items.filter(i => i.ticker?.toUpperCase().includes(q) || i.title.toUpperCase().includes(q));
    }
    return items;
  }, [news, filter, tickerSearch]);

  const alertCount = alerts.length;

  return (
    <div className="dashboard">
      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-brand">
          <span className="header-logo">◈</span>
          <span className="header-title">OASIS ScorePro</span>
          <span className="header-subtitle">Trading Intelligence Platform</span>
        </div>
        <div className="header-right">
          <LastRefreshed iso={lastUpdated} />
          <Clock />
          <button
            className={`refresh-btn ${isRefreshing ? 'refresh-btn--spinning' : ''}`}
            onClick={manualRefresh}
            disabled={isRefreshing}
            title="Force refresh feeds"
          >
            ↻ {isRefreshing ? 'Fetching…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* ── Alert Banner ── */}
      <AlertBanner alerts={alerts} />

      {/* ── Main Layout ── */}
      <div className="dashboard-body">
        {/* ── News Feed Column ── */}
        <main className="news-column">
          {/* Toolbar */}
          <div className="news-toolbar">
            <div className="filter-tabs">
              {[
                { key: 'all', label: `All (${news.length})` },
                { key: 'alerts', label: `🚨 Alerts (${alertCount})` },
                { key: 'catalyst', label: '⚡ Catalysts' },
              ].map(f => (
                <button
                  key={f.key}
                  className={`filter-tab ${filter === f.key ? 'filter-tab--active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="ticker-search"
              placeholder="Filter ticker / keyword…"
              value={tickerSearch}
              onChange={e => setTickerSearch(e.target.value)}
            />
          </div>

          {/* Feed */}
          <div className="news-feed">
            {loading && !news.length && (
              <div className="feed-loading">
                <div className="spinner" />
                <span>Agents fetching live news…</span>
              </div>
            )}
            {error && (
              <div className="feed-error">
                <span>⚠ Backend unreachable: {error}</span>
                <p className="feed-error-hint">
                  Start the backend: <code>cd backend && uvicorn main:app --reload</code>
                </p>
              </div>
            )}
            {!loading && !error && filteredNews.length === 0 && (
              <div className="feed-empty">No headlines match the current filter.</div>
            )}
            {filteredNews.map(item => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </main>

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <AgentPanel agentStats={agentStats} />
          <SettingsPanel settings={settings} onSave={saveSettings} />
        </aside>
      </div>
    </div>
  );
}
