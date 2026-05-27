import { useState } from 'react';
import ScoreBreakdown from './ScoreBreakdown';

function scoreColor(score) {
  if (score >= 80) return '#00ff88';
  if (score >= 66) return '#3b82f6';
  if (score >= 41) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score) {
  if (score >= 80) return 'ALERT';
  if (score >= 66) return 'HIGH';
  if (score >= 41) return 'MOD';
  return 'LOW';
}

function timeAgo(iso) {
  if (!iso) return '';
  try {
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
  } catch (_) {
    return '';
  }
}

export default function NewsCard({ item }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const color = scoreColor(item.confidence_score);
  const isAlert = item.is_alert;

  return (
    <div className={`news-card ${isAlert ? 'news-card--alert' : ''}`}>
      <div className="nc-header">
        <div className="nc-meta">
          {item.ticker && <span className="nc-ticker">{item.ticker}</span>}
          <span className="nc-source">{item.source}</span>
          <span className="nc-time">{timeAgo(item.published)}</span>
        </div>
        <div className="nc-score-wrap" style={{ color }}>
          <span className="nc-score-num">{Math.round(item.confidence_score)}</span>
          <span className="nc-score-label" style={{ background: color }}>{scoreLabel(item.confidence_score)}</span>
        </div>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="nc-title"
      >
        {item.title}
      </a>

      <div className="nc-footer">
        {item.regimen_passed && (
          <span className="nc-catalyst-badge">
            ⚡ {item.regimen_details?.catalyst || 'Catalyst'}
          </span>
        )}
        <button
          className="nc-breakdown-btn"
          onClick={() => setShowBreakdown(v => !v)}
        >
          {showBreakdown ? '▲ Hide Score' : '▼ Score Breakdown'}
        </button>
      </div>

      <ScoreBreakdown breakdown={item.score_breakdown} visible={showBreakdown} />
    </div>
  );
}
