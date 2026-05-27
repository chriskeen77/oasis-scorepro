export default function ScoreBreakdown({ breakdown, visible }) {
  if (!visible || !breakdown) return null;

  const rows = [
    { label: 'Sentiment', value: breakdown.sentiment, max: 30 },
    { label: 'Catalyst', value: breakdown.catalyst, max: 35 },
    { label: 'Volume Signal', value: breakdown.volume_signal, max: 20 },
    { label: 'Ticker ID', value: breakdown.ticker_id, max: 10 },
    { label: 'Recency', value: breakdown.recency, max: 5 },
  ];

  return (
    <div className="score-breakdown">
      {rows.map(row => (
        <div key={row.label} className="sb-row">
          <span className="sb-label">{row.label}</span>
          <div className="sb-bar-track">
            <div
              className="sb-bar-fill"
              style={{ width: `${(row.value / row.max) * 100}%` }}
            />
          </div>
          <span className="sb-pts">{row.value}/{row.max}</span>
        </div>
      ))}
      <div className="sb-total">
        <span>TOTAL</span>
        <span className="sb-total-val">{breakdown.total}/100</span>
      </div>
    </div>
  );
}
