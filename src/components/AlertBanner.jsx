import { useState } from 'react';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export default function AlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set());

  const visible = alerts.filter(a => !dismissed.has(a.news_item.id));
  if (visible.length === 0) return null;

  return (
    <div className="alert-banner">
      <div className="alert-banner-header">
        <span className="alert-banner-title">🚨 TRADE ALERTS</span>
        <span className="alert-count">{visible.length}</span>
      </div>
      <div className="alert-list">
        {visible.slice(0, 5).map(a => (
          <div key={a.news_item.id} className="alert-item">
            <div className="alert-item-score">{Math.round(a.news_item.confidence_score)}</div>
            <div className="alert-item-body">
              <div className="alert-item-top">
                {a.news_item.ticker && (
                  <span className="alert-ticker">{a.news_item.ticker}</span>
                )}
                <span className="alert-item-source">{a.news_item.source}</span>
                <span className="alert-item-time">{timeAgo(a.triggered_at)}</span>
              </div>
              <a
                href={a.news_item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="alert-item-title"
              >
                {a.news_item.title}
              </a>
              {a.news_item.regimen_details?.catalyst && (
                <span className="alert-catalyst">
                  ⚡ {a.news_item.regimen_details.catalyst}
                </span>
              )}
            </div>
            <button
              className="alert-dismiss"
              onClick={() => setDismissed(s => new Set([...s, a.news_item.id]))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
