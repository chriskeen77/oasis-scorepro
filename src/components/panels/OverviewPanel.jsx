import { TrendingUp, TrendingDown, Minus, BarChart2, AlertTriangle, CheckCircle } from 'lucide-react';
import { STOCK_UNIVERSE } from '../../utils/priceData.js';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4">
      <p className="text-[11px] text-[#64748b] uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#64748b] mt-1">{sub}</p>}
    </div>
  );
}

function DirectionBadge({ dir }) {
  if (dir === 'UP')       return <span className="flex items-center gap-1 text-bull text-xs font-semibold"><TrendingUp size={13}/> UP</span>;
  if (dir === 'DOWN')     return <span className="flex items-center gap-1 text-bear text-xs font-semibold"><TrendingDown size={13}/> DOWN</span>;
  return                         <span className="flex items-center gap-1 text-neutral text-xs font-semibold"><Minus size={13}/> SIDE</span>;
}

function SignalBadge({ signal }) {
  const map = {
    STRONG_BUY:   { label: 'STRONG BUY',   cls: 'bg-bull/20 text-bull border border-bull/40' },
    MODERATE_BUY: { label: 'MODERATE BUY', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/40' },
    NEUTRAL:      { label: 'NEUTRAL',       cls: 'bg-neutral/20 text-neutral border border-neutral/40' },
    AVOID:        { label: 'AVOID',         cls: 'bg-bear/20 text-bear border border-bear/40' },
  };
  const { label, cls } = map[signal] || map.NEUTRAL;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${cls}`}>{label}</span>;
}

export default function OverviewPanel({ analysisResults }) {
  if (!analysisResults) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748b]">
        Click <span className="mx-1 text-blue-400 font-semibold">Run Agents</span> to start analysis
      </div>
    );
  }

  const symbols    = Object.keys(analysisResults);
  const signals    = symbols.map(s => analysisResults[s]);
  const strongBuys = signals.filter(s => s.signal === 'STRONG_BUY');
  const modBuys    = signals.filter(s => s.signal === 'MODERATE_BUY');
  const avgConf    = Math.round(signals.reduce((s, r) => s + r.confidence, 0) / signals.length);
  const bullCount  = signals.filter(s => s.direction.direction === 'UP').length;

  const topSignals = [...signals]
    .filter(s => s.signal === 'STRONG_BUY' || s.signal === 'MODERATE_BUY')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  return (
    <div className="p-5 space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Agents Active"    value="10"           sub="All systems nominal"   accent="text-bull" />
        <StatCard label="Strong Buy Signals" value={strongBuys.length} sub={`+ ${modBuys.length} moderate buys`} accent="text-bull" />
        <StatCard label="Avg Confidence"   value={`${avgConf}%`} sub="Multi-agent composite" accent="text-blue-400" />
        <StatCard label="Bullish Stocks"   value={`${bullCount}/${symbols.length}`} sub="Trending upward" accent="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Market Watchlist */}
        <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2d47] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">Market Watchlist</h2>
            <BarChart2 size={14} className="text-[#475569]" />
          </div>
          <div className="divide-y divide-[#1a2d47]">
            {symbols.map(sym => {
              const r = analysisResults[sym];
              const f = r.factors;
              return (
                <div key={sym} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#111f35] transition-colors">
                  <div>
                    <span className="text-sm font-bold text-white">{sym}</span>
                    <span className="text-[10px] text-[#64748b] ml-2">{STOCK_UNIVERSE[sym].name.split(' ').slice(0,2).join(' ')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">${f.price.toLocaleString()}</div>
                      <div className={`text-[10px] font-medium ${f.change1d >= 0 ? 'text-bull' : 'text-bear'}`}>
                        {f.change1d >= 0 ? '+' : ''}{f.change1d}% 1d
                      </div>
                    </div>
                    <DirectionBadge dir={r.direction.direction} />
                    <div className="text-[10px] text-[#64748b] w-12 text-right">RSI {f.rsi}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Trade Signals */}
        <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2d47] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">Top Consensus Signals</h2>
            <CheckCircle size={14} className="text-bull" />
          </div>
          {topSignals.length === 0 ? (
            <div className="p-6 text-center text-[#64748b] text-sm">No high-confidence signals at this time</div>
          ) : (
            <div className="divide-y divide-[#1a2d47]">
              {topSignals.map(r => (
                <div key={r.symbol} className="px-4 py-3 hover:bg-[#111f35] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{r.symbol}</span>
                      <SignalBadge signal={r.signal} />
                    </div>
                    <div className="text-xs text-[#94a3b8]">
                      {r.bullVotes}/4 agents agree
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#1a2d47] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full confidence-bar bg-gradient-to-r from-blue-600 to-bull"
                        style={{ width: `${r.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-bull">{r.confidence}%</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#64748b]">
                    <span>Entry: <span className="text-white">${r.entry}</span></span>
                    <span>Stop: <span className="text-bear">${r.stopLoss}</span></span>
                    <span>Target: <span className="text-bull">${r.target}</span></span>
                    {r.riskReward && <span>R:R <span className="text-blue-400">1:{r.riskReward}</span></span>}
                  </div>
                  <div className="mt-1 text-[10px] text-[#475569]">{r.strategy}</div>
                </div>
              ))}
            </div>
          )}

          {/* No naked trades notice */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0a1220] border-t border-[#1a2d47]">
            <AlertTriangle size={11} className="text-neutral flex-shrink-0" />
            <p className="text-[10px] text-[#64748b]">Paper-trade simulation only. No live capital deployed. Requires 3/4 agent consensus minimum.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
