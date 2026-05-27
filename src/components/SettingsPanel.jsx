import { useState } from 'react';

export default function SettingsPanel({ settings, onSave }) {
  const [threshold, setThreshold] = useState(settings?.alert_threshold ?? 80);
  const [interval, setInterval_] = useState(settings?.refresh_interval ?? 300);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave({ alert_threshold: threshold, refresh_interval: interval, max_items: 60 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings-panel">
      <h3 className="panel-title">Settings</h3>

      <div className="setting-row">
        <label className="setting-label">
          Alert Threshold
          <span className="setting-val">{threshold}/100</span>
        </label>
        <input
          type="range"
          min="50"
          max="95"
          step="5"
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
          className="setting-slider"
        />
        <div className="slider-ticks">
          <span>50</span><span>65</span><span>80</span><span>95</span>
        </div>
      </div>

      <div className="setting-row">
        <label className="setting-label">
          Auto-Refresh
          <span className="setting-val">{interval >= 60 ? `${interval / 60}m` : `${interval}s`}</span>
        </label>
        <select
          className="setting-select"
          value={interval}
          onChange={e => setInterval_(Number(e.target.value))}
        >
          <option value={60}>1 minute</option>
          <option value={120}>2 minutes</option>
          <option value={300}>5 minutes</option>
          <option value={600}>10 minutes</option>
          <option value={1800}>30 minutes</option>
        </select>
      </div>

      <button className="save-btn" onClick={handleSave}>
        {saved ? '✓ Saved' : 'Apply Settings'}
      </button>

      <div className="score-legend">
        <div className="legend-title">Score Legend</div>
        {[
          { color: '#00ff88', label: '80–100', desc: 'ALERT — Immediate action' },
          { color: '#3b82f6', label: '66–79', desc: 'HIGH — Strong signal' },
          { color: '#f59e0b', label: '41–65', desc: 'MOD — Watch closely' },
          { color: '#ef4444', label: '0–40', desc: 'LOW — Noise / ignore' },
        ].map(r => (
          <div key={r.label} className="legend-row">
            <span className="legend-dot" style={{ background: r.color }} />
            <span className="legend-range" style={{ color: r.color }}>{r.label}</span>
            <span className="legend-desc">{r.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
