import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { STOCK_UNIVERSE } from '../../utils/priceData.js';

function FactorRow({ label, value, fmt, bullIf, bearIf }) {
  const cls = bullIf ? 'text-bull' : bearIf ? 'text-bear' : 'text-white';
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1a2d47] last:border-0">
      <span className="text-[11px] text-[#64748b]">{label}</span>
      <span className={`text-[11px] font-semibold font-mono ${cls}`}>{fmt || value}</span>
    </div>
  );
}

function Meter({ value, min, max, label, good }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const isGood = good(value);
  return (
    <div>
      <div className="flex justify-between text-[10px] text-[#64748b] mb-1">
        <span>{label}</span>
        <span className={isGood ? 'text-bull' : 'text-bear'}>{value}</span>
      </div>
      <div className="h-1.5 bg-[#1a2d47] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isGood ? 'bg-bull' : 'bg-bear'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function MarketPanel({ analysisResults }) {
  const [selected, setSelected] = useState('AAPL');

  if (!analysisResults) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748b]">
        Run agents first to see market analysis
      </div>
    );
  }

  const r = analysisResults[selected];
  const f = r.factors;
  const d = r.direction;

  const dirColor = d.direction === 'UP' ? '#10b981' : d.direction === 'DOWN' ? '#ef4444' : '#f59e0b';
  const DirIcon  = d.direction === 'UP' ? TrendingUp : d.direction === 'DOWN' ? TrendingDown : Minus;

  return (
    <div className="p-5 space-y-4">
      {/* Stock selector */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(analysisResults).map(sym => (
          <button
            key={sym}
            onClick={() => setSelected(sym)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              selected === sym
                ? 'bg-blue-600 text-white'
                : 'bg-[#0d1526] border border-[#1a2d47] text-[#94a3b8] hover:border-blue-500/50'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Direction + price */}
        <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4 space-y-4">
          <div>
            <p className="text-[11px] text-[#64748b] uppercase tracking-widest">{STOCK_UNIVERSE[selected].name}</p>
            <p className="text-3xl font-bold text-white mt-1">${f.price.toLocaleString()}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-sm font-semibold ${f.change1d >= 0 ? 'text-bull' : 'text-bear'}`}>
                {f.change1d >= 0 ? '▲' : '▼'} {Math.abs(f.change1d)}% today
              </span>
              <span className="text-xs text-[#64748b]">{STOCK_UNIVERSE[selected].sector}</span>
            </div>
          </div>

          {/* Direction badge */}
          <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: dirColor + '40', background: dirColor + '10' }}>
            <DirIcon size={28} style={{ color: dirColor }} />
            <div>
              <p className="text-lg font-bold" style={{ color: dirColor }}>{d.label}</p>
              <p className="text-[11px] text-[#64748b]">Confidence: {d.confidence}%</p>
            </div>
          </div>

          {/* Price changes */}
          <div className="space-y-1.5">
            {[['1-Day Change', f.change1d], ['5-Day Change', f.change5d], ['20-Day Change', f.change20d]].map(([lbl, val]) => (
              <div key={lbl} className="flex items-center justify-between text-xs">
                <span className="text-[#64748b]">{lbl}</span>
                <span className={`font-semibold ${val >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {val >= 0 ? '+' : ''}{val}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4">
          <h3 className="text-[11px] text-[#64748b] uppercase tracking-widest mb-3">Technical Indicators</h3>
          <div className="space-y-0.5">
            <FactorRow label="Price"    value={`$${f.price}`}  bullIf={f.price > f.sma20} />
            <FactorRow label="20-SMA"   value={`$${f.sma20}`}  bullIf={f.price > f.sma20}  bearIf={f.price < f.sma20} />
            <FactorRow label="50-SMA"   value={`$${f.sma50}`}  bullIf={f.price > f.sma50}  bearIf={f.price < f.sma50} />
            <FactorRow label="200-SMA"  value={`$${f.sma200}`} bullIf={f.price > f.sma200} bearIf={f.price < f.sma200} />
            <FactorRow label="RSI(14)"  value={f.rsi} bullIf={f.rsi >= 40 && f.rsi <= 55} bearIf={f.rsi > 70 || f.rsi < 30} />
            <FactorRow label="MACD"     value={f.macdLine} bullIf={f.macdLine > 0} bearIf={f.macdLine < 0} />
            <FactorRow label="MACD Sig" value={f.macdSignal} />
            <FactorRow label="MACD Hist" value={f.macdHist} bullIf={f.macdHist > 0} bearIf={f.macdHist < 0} />
            <FactorRow label="BB Upper" value={`$${f.bbUpper}`} />
            <FactorRow label="BB Lower" value={`$${f.bbLower}`} />
            <FactorRow label="ATR(14)"  value={`$${f.atr}`} />
            <FactorRow label="Vol Ratio" value={`${f.volRatio}x`} bullIf={f.volRatio > 1.2} />
          </div>
        </div>

        {/* Relative Factors */}
        <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4 space-y-4">
          <h3 className="text-[11px] text-[#64748b] uppercase tracking-widest">Relative Factors</h3>

          <Meter value={f.rsi || 50} min={0}   max={100} label="RSI(14) — Sweet spot: 38-55"   good={v => v >= 38 && v <= 58} />
          <Meter value={f.priceIn52w} min={0}  max={100} label="52-Week Price Range Position %" good={v => v >= 40 && v <= 80} />
          <Meter value={Math.min(3, f.volRatio)} min={0} max={3} label="Volume vs 20-Day Avg"   good={v => v >= 1.1} />
          <Meter value={Math.min(10, Math.max(-10, f.change20d))} min={-10} max={10} label="20-Day Momentum %" good={v => v > 1} />

          <div className="pt-2 space-y-2">
            <h4 className="text-[10px] text-[#475569] uppercase tracking-widest">MA Alignment</h4>
            {[
              ['Price > 20-SMA', f.price > f.sma20],
              ['Price > 50-SMA', f.price > f.sma50],
              ['Price > 200-SMA', f.price > f.sma200],
              ['20-SMA > 50-SMA', f.sma20 > f.sma50],
              ['50-SMA > 200-SMA', f.sma50 > f.sma200],
              ['MACD Histogram +', f.macdHist > 0],
            ].map(([label, pass]) => (
              <div key={label} className="flex items-center justify-between text-[11px]">
                <span className="text-[#64748b]">{label}</span>
                <span className={pass ? 'text-bull font-bold' : 'text-bear font-bold'}>{pass ? '✓ YES' : '✗ NO'}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#1a2d47] grid grid-cols-2 gap-2">
            <div className="bg-[#0a1220] rounded p-2">
              <p className="text-[10px] text-[#64748b]">52W High</p>
              <p className="text-xs font-bold text-white">${f.high52w}</p>
            </div>
            <div className="bg-[#0a1220] rounded p-2">
              <p className="text-[10px] text-[#64748b]">52W Low</p>
              <p className="text-xs font-bold text-white">${f.low52w}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Consensus summary for selected stock */}
      <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4">
        <h3 className="text-[11px] text-[#64748b] uppercase tracking-widest mb-3 flex items-center gap-2">
          <Activity size={12} /> Agent Consensus for {selected}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Market Direction', score: r.scores.direction, icon: '📡' },
            { name: 'News Sentiment',   score: r.scores.news,      icon: '📰' },
            { name: 'Strategy Fit',     score: r.scores.strategy,  icon: '🎯' },
            { name: 'Tech Setup',       score: r.scores.technical,  icon: '📊' },
          ].map(({ name, score, icon }) => (
            <div key={name} className="bg-[#0a1220] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#64748b]">{icon} {name}</span>
                <span className={`text-sm font-bold ${score >= 65 ? 'text-bull' : score >= 45 ? 'text-neutral' : 'text-bear'}`}>{score}%</span>
              </div>
              <div className="h-1 bg-[#1a2d47] rounded-full">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
