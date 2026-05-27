import { useState } from 'react';
import { STRATEGIES } from '../../utils/backtest.js';
import { STOCK_UNIVERSE } from '../../utils/priceData.js';
import { runBacktest } from '../../utils/backtest.js';

function MetricCell({ label, value, good, bad }) {
  const cls = good ? 'text-bull' : bad ? 'text-bear' : 'text-white';
  return (
    <div className="text-center">
      <p className={`text-base font-bold font-mono ${cls}`}>{value}</p>
      <p className="text-[10px] text-[#64748b] mt-0.5">{label}</p>
    </div>
  );
}

export default function StrategiesPanel({ stockData }) {
  const [selectedStock, setSelectedStock] = useState('AAPL');

  const candles = stockData[selectedStock];
  const results = Object.fromEntries(
    Object.keys(STRATEGIES).map(k => [k, runBacktest(k, candles)])
  );

  return (
    <div className="p-5 space-y-4">
      {/* Stock picker */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[#64748b]">Showing strategies for:</span>
        <div className="flex flex-wrap gap-2">
          {Object.keys(stockData).map(sym => (
            <button
              key={sym}
              onClick={() => setSelectedStock(sym)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                selectedStock === sym
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1526] border border-[#1a2d47] text-[#94a3b8] hover:border-blue-500/50'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(STRATEGIES).map(([key, strat]) => {
          const r = results[key];
          const borderColor = strat.color + '60';
          return (
            <div
              key={key}
              className="bg-[#0d1526] rounded-lg border overflow-hidden"
              style={{ borderColor }}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b" style={{ borderColor, background: strat.color + '10' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: strat.color }}>{strat.name}</h3>
                    <p className="text-[10px] text-[#64748b] mt-0.5">{strat.type} · {strat.timeframe}</p>
                  </div>
                  {r && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${r.totalReturn >= 0 ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'}`}>
                      {r.totalReturn >= 0 ? '+' : ''}{r.totalReturn}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#94a3b8] mt-2">{strat.description}</p>
              </div>

              {r ? (
                <div className="p-4 space-y-4">
                  {/* Key metrics grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-[#0a1220] rounded-lg divide-x divide-[#1a2d47]">
                    <MetricCell label="Win Rate"  value={`${r.winRate}%`}  good={r.winRate >= 55}   bad={r.winRate < 45} />
                    <MetricCell label="Sharpe"    value={r.sharpe}         good={r.sharpe >= 1}      bad={r.sharpe < 0.5} />
                    <MetricCell label="Max DD"    value={`${r.maxDrawdown}%`} bad={r.maxDrawdown < -20} good={r.maxDrawdown > -10} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      {[
                        ['Total Trades',    r.totalTrades, null,  null],
                        ['Winning Trades',  r.wins,        true,  false],
                        ['Losing Trades',   r.losses,      false, true],
                        ['Profit Factor',   r.profitFactor, r.profitFactor >= 1.5, r.profitFactor < 1],
                      ].map(([lbl, val, good, bad]) => (
                        <div key={lbl} className="flex justify-between text-[11px]">
                          <span className="text-[#64748b]">{lbl}</span>
                          <span className={`font-semibold ${good ? 'text-bull' : bad ? 'text-bear' : 'text-white'}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[
                        ['Avg Win',       `+${r.avgWin}%`,  true,  false],
                        ['Avg Loss',      `${r.avgLoss}%`,  false, true],
                        ['Avg Hold Days', `${r.avgHoldDays}d`, r.avgHoldDays >= 5, false],
                        ['Net P&L',       `$${r.totalReturnDollar.toLocaleString()}`, r.totalReturnDollar >= 0, r.totalReturnDollar < 0],
                      ].map(([lbl, val, good, bad]) => (
                        <div key={lbl} className="flex justify-between text-[11px]">
                          <span className="text-[#64748b]">{lbl}</span>
                          <span className={`font-semibold ${good ? 'text-bull' : bad ? 'text-bear' : 'text-white'}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Drawdown highlight */}
                  <div className="p-2.5 rounded bg-bear/10 border border-bear/20">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#94a3b8]">Max Point Drawdown (short-point)</span>
                      <span className="font-bold text-bear">${Math.abs(r.maxDrawdownPoints).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="text-[#94a3b8]">Max % Drawdown</span>
                      <span className="font-bold text-bear">{r.maxDrawdown}%</span>
                    </div>
                  </div>

                  {/* Philosophy note */}
                  {key === 'TREND_PULLBACK' && (
                    <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300">
                      ★ Recommended — matches your quality entry philosophy: enter strong stocks on pullbacks within confirmed uptrends.
                    </div>
                  )}
                  {key === 'RSI_DIP_BUY' && (
                    <div className="p-2.5 rounded bg-bull/10 border border-bull/20 text-[10px] text-bull">
                      ★ High-signal — RSI dip entries in uptrends provide excellent risk/reward for non-scalping positions.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-[#64748b] text-xs">Insufficient trade signals generated for this stock</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
