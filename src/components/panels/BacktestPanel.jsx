import { useState, useMemo } from 'react';
import { EquityChart, DrawdownChart } from '../Charts.jsx';
import { runBacktest, STRATEGIES } from '../../utils/backtest.js';
import { STOCK_UNIVERSE } from '../../utils/priceData.js';

const STRATEGY_KEYS = Object.keys(STRATEGIES);

function fmtDate(d) {
  const [y, m, day] = (d || '').split('-');
  return `${m}/${day}/${y?.slice(2)}`;
}

function fmtCurrency(v) {
  return '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0 });
}

export default function BacktestPanel({ stockData }) {
  const [stock,    setStock]    = useState('NVDA');
  const [strategy, setStrategy] = useState('TREND_PULLBACK');

  const result = useMemo(() => runBacktest(strategy, stockData[stock]), [stock, strategy]);

  const visibleTrades = result?.trades.slice().reverse().slice(0, 30) || [];

  return (
    <div className="p-5 space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[#64748b]">Stock:</label>
          <select
            value={stock}
            onChange={e => setStock(e.target.value)}
            className="bg-[#0d1526] border border-[#1a2d47] text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
          >
            {Object.keys(stockData).map(s => (
              <option key={s} value={s}>{s} — {STOCK_UNIVERSE[s].name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[#64748b]">Strategy:</label>
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value)}
            className="bg-[#0d1526] border border-[#1a2d47] text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
          >
            {STRATEGY_KEYS.map(k => (
              <option key={k} value={k}>{STRATEGIES[k].name}</option>
            ))}
          </select>
        </div>
        <div className="text-[10px] text-[#475569]">Initial capital: $100,000 · Position: 20% · Commission: 0.08%</div>
      </div>

      {result ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { l: 'Total Return',    v: `${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn}%`,     c: result.totalReturn >= 0 ? 'text-bull' : 'text-bear' },
              { l: 'Net P&L',         v: fmtCurrency(result.totalReturnDollar),     c: result.totalReturnDollar >= 0 ? 'text-bull' : 'text-bear' },
              { l: 'Win Rate',        v: `${result.winRate}%`,                       c: result.winRate >= 55 ? 'text-bull' : 'text-bear' },
              { l: 'Max Drawdown',    v: `${result.maxDrawdown}%`,                   c: result.maxDrawdown < -15 ? 'text-bear' : 'text-neutral' },
              { l: 'Max DD Points',   v: `$${Math.abs(result.maxDrawdownPoints).toLocaleString()}`, c: 'text-bear' },
              { l: 'Sharpe Ratio',    v: result.sharpe,                              c: result.sharpe >= 1 ? 'text-bull' : 'text-neutral' },
              { l: 'Profit Factor',   v: result.profitFactor,                        c: result.profitFactor >= 1.5 ? 'text-bull' : 'text-neutral' },
              { l: 'Total Trades',    v: result.totalTrades,                         c: 'text-white' },
            ].map(({ l, v, c }) => (
              <div key={l} className="bg-[#0d1526] border border-[#1a2d47] rounded p-2.5 text-center">
                <p className={`text-sm font-bold font-mono ${c}`}>{v}</p>
                <p className="text-[10px] text-[#64748b] mt-0.5">{l}</p>
              </div>
            ))}
          </div>

          {/* Equity Curve */}
          <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] text-[#94a3b8] uppercase tracking-widest">Equity Curve — $100k Starting Capital</h3>
              <span className="text-xs text-[#64748b]">2-Year Backtest · {stock} · {STRATEGIES[strategy].name}</span>
            </div>
            <EquityChart data={result.equityCurve} width={900} height={200} />
          </div>

          {/* Drawdown Chart */}
          <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] text-[#94a3b8] uppercase tracking-widest">Drawdown — Short Point Drawdown</h3>
              <span className="text-xs text-bear font-semibold">Max DD: {result.maxDrawdown}% (${Math.abs(result.maxDrawdownPoints).toLocaleString()} pts)</span>
            </div>
            <DrawdownChart data={result.drawdownCurve} width={900} height={160} />
          </div>

          {/* Trade Log */}
          <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a2d47]">
              <h3 className="text-[11px] text-[#94a3b8] uppercase tracking-widest">
                Trade Log — {result.totalTrades} Total Trades
                <span className="ml-2 text-bull">{result.wins}W</span>
                <span className="mx-1 text-[#64748b]">/</span>
                <span className="text-bear">{result.losses}L</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a2d47] text-[#475569] text-[10px] uppercase tracking-wider">
                    {['#', 'Entry Date', 'Exit Date', 'Entry $', 'Exit $', 'Hold Days', 'Return %', 'P&L'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2d47]">
                  {visibleTrades.map((t, i) => {
                    const retPct = (t.return * 100).toFixed(2);
                    const pnl    = (20000 * t.return).toFixed(0);
                    const win    = t.return > 0;
                    return (
                      <tr key={i} className={`hover:bg-[#111f35] transition-colors ${t.open ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2 text-[#475569]">{result.totalTrades - i}</td>
                        <td className="px-3 py-2 font-mono">{fmtDate(t.entryDate)}</td>
                        <td className="px-3 py-2 font-mono">{fmtDate(t.exitDate)} {t.open && <span className="text-neutral ml-1">(open)</span>}</td>
                        <td className="px-3 py-2 font-mono">${t.entryPx?.toFixed(2)}</td>
                        <td className="px-3 py-2 font-mono">${t.exitPx?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-[#94a3b8]">{t.holdDays}d</td>
                        <td className={`px-3 py-2 font-bold font-mono ${win ? 'text-bull' : 'text-bear'}`}>{win ? '+' : ''}{retPct}%</td>
                        <td className={`px-3 py-2 font-bold font-mono ${win ? 'text-bull' : 'text-bear'}`}>{win ? '+' : '-'}${Math.abs(pnl).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-[#0a1220] border-t border-[#1a2d47] flex items-center justify-between text-[10px] text-[#475569]">
              <span>Showing most recent {Math.min(30, result.totalTrades)} of {result.totalTrades} trades · Avg hold: {result.avgHoldDays} days</span>
              <span className="text-neutral">SIMULATION — No live capital deployed</span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-[#64748b]">No backtest results — strategy generated too few signals for this stock</div>
      )}
    </div>
  );
}
