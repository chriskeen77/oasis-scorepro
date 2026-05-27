import { sma, ema, rsi, macd, bollingerBands, atr } from './indicators.js';

const INITIAL_CAPITAL = 100_000;
const POSITION_PCT    = 0.20;   // risk 20% of capital per trade
const COMMISSION      = 0.0008; // 0.08% each side

export const STRATEGIES = {
  GOLDEN_CROSS: {
    key:         'GOLDEN_CROSS',
    name:        'Golden Cross / Death Cross',
    description: 'Buy when 20-SMA crosses above 50-SMA; exit when it crosses below.',
    type:        'Trend Following',
    timeframe:   'Medium-Long (weeks to months)',
    color:       '#3b82f6',
  },
  RSI_DIP_BUY: {
    key:         'RSI_DIP_BUY',
    name:        'RSI Quality Dip Buy',
    description: 'In confirmed uptrend (above 200-SMA), buy when RSI dips below 40; exit above 65.',
    type:        'Mean Reversion in Trend',
    timeframe:   'Short-Medium (days to weeks)',
    color:       '#10b981',
  },
  MACD_MOMENTUM: {
    key:         'MACD_MOMENTUM',
    name:        'MACD Momentum Crossover',
    description: 'Enter on MACD-signal bullish crossover above zero line; exit on bearish crossover.',
    type:        'Momentum',
    timeframe:   'Medium (1-4 weeks)',
    color:       '#f59e0b',
  },
  TREND_PULLBACK: {
    key:         'TREND_PULLBACK',
    name:        'Trend + Pullback Entry',
    description: 'All 3 MAs aligned bullishly; buy pullbacks to 20-SMA with RSI 38-55.  Exit RSI > 68 or price breaks 50-SMA.',
    type:        'Trend + Pullback',
    timeframe:   'Medium-Long (weeks)',
    color:       '#8b5cf6',
  },
};

// ─── Signal generators ────────────────────────────────────────────────────────

function signalsGoldenCross(candles) {
  const closes = candles.map(c => c.close);
  const s20    = sma(closes, 20);
  const s50    = sma(closes, 50);
  return candles.map((c, i) => {
    if (i < 51) return null;
    const buy  = s20[i] > s50[i] && s20[i-1] <= s50[i-1];
    const sell = s20[i] < s50[i] && s20[i-1] >= s50[i-1];
    return buy ? 'BUY' : sell ? 'SELL' : null;
  });
}

function signalsRSIDipBuy(candles) {
  const closes  = candles.map(c => c.close);
  const s200    = sma(closes, 200);
  const rsiVals = rsi(closes, 14);
  return candles.map((c, i) => {
    if (i < 202 || !s200[i] || !rsiVals[i]) return null;
    const uptrend = closes[i] > s200[i];
    const buy     = uptrend && rsiVals[i] < 40 && rsiVals[i-1] < 42;
    const sell    = rsiVals[i] > 65;
    return buy ? 'BUY' : sell ? 'SELL' : null;
  });
}

function signalsMACDMomentum(candles) {
  const closes = candles.map(c => c.close);
  const { macd: mLine, signal: sLine } = macd(closes);
  return candles.map((c, i) => {
    if (i < 35 || !mLine[i] || !sLine[i] || !mLine[i-1] || !sLine[i-1]) return null;
    const aboveZero  = mLine[i] > 0;
    const buy  = aboveZero && mLine[i] > sLine[i] && mLine[i-1] <= sLine[i-1];
    const sell = mLine[i] < sLine[i] && mLine[i-1] >= sLine[i-1];
    return buy ? 'BUY' : sell ? 'SELL' : null;
  });
}

function signalsTrendPullback(candles) {
  const closes  = candles.map(c => c.close);
  const s20     = sma(closes, 20);
  const s50     = sma(closes, 50);
  const s200    = sma(closes, 200);
  const rsiVals = rsi(closes, 14);
  return candles.map((c, i) => {
    if (i < 202 || !s20[i] || !s50[i] || !s200[i] || !rsiVals[i]) return null;
    const strongUp = closes[i] > s50[i] && s20[i] > s50[i] && s50[i] > s200[i];
    const pullback = closes[i] <= s20[i] * 1.015 && rsiVals[i] >= 38 && rsiVals[i] <= 55;
    const buy      = strongUp && pullback;
    const sell     = rsiVals[i] > 68 || closes[i] < s50[i];
    return buy ? 'BUY' : sell ? 'SELL' : null;
  });
}

// ─── Trade simulator ──────────────────────────────────────────────────────────

function simulateTrades(candles, signals) {
  const trades = [];
  let inPos = false, entryIdx = 0, entryPx = 0;

  for (let i = 0; i < signals.length; i++) {
    const sig = signals[i];
    if (!inPos && sig === 'BUY') {
      inPos = true; entryIdx = i; entryPx = candles[i].close;
    } else if (inPos && sig === 'SELL') {
      const exitPx  = candles[i].close;
      const ret     = (exitPx - entryPx) / entryPx - 2 * COMMISSION;
      trades.push({ entryDate: candles[entryIdx].date, exitDate: candles[i].date,
                    entryPx, exitPx, return: ret, holdDays: i - entryIdx, open: false });
      inPos = false;
    }
  }
  // Force-close open position at last bar
  if (inPos) {
    const i = candles.length - 1;
    const exitPx = candles[i].close;
    const ret    = (exitPx - entryPx) / entryPx - 2 * COMMISSION;
    trades.push({ entryDate: candles[entryIdx].date, exitDate: candles[i].date,
                  entryPx, exitPx, return: ret, holdDays: i - entryIdx, open: true });
  }
  return trades;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

function buildEquity(trades, candles) {
  // Map exit dates → trade
  const exitMap = {};
  trades.forEach(t => { exitMap[t.exitDate] = (exitMap[t.exitDate] || []).concat(t); });

  let capital = INITIAL_CAPITAL;
  const curve = [];
  for (let i = 0; i < candles.length; i += 4) {  // sample every 4 days
    const date = candles[i].date;
    // Apply any exits on or before this sample
    curve.push({ date, value: +capital.toFixed(2) });
  }
  // Rebuild properly with sequential trade application
  capital = INITIAL_CAPITAL;
  const full = [{ date: candles[0].date, value: capital }];
  let trIdx  = 0;
  for (let i = 1; i < candles.length; i++) {
    while (trIdx < trades.length && trades[trIdx].exitDate === candles[i].date) {
      capital += INITIAL_CAPITAL * POSITION_PCT * trades[trIdx].return;
      trIdx++;
    }
    if (i % 5 === 0 || i === candles.length - 1) {
      full.push({ date: candles[i].date, value: +capital.toFixed(2) });
    }
  }
  return { finalCapital: capital, curve: full };
}

function calcMetrics(trades, candles) {
  if (trades.length === 0) return null;

  const { finalCapital, curve } = buildEquity(trades, candles);
  const totalReturn = (finalCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL;

  // Drawdown curve
  let peak = INITIAL_CAPITAL;
  let maxDD = 0, maxDDPoints = 0;
  const ddCurve = curve.map(pt => {
    if (pt.value > peak) peak = pt.value;
    const dd = (pt.value - peak) / peak;
    const ddPts = pt.value - peak;
    if (dd < maxDD) { maxDD = dd; maxDDPoints = ddPts; }
    return { date: pt.date, drawdown: +(dd * 100).toFixed(2), points: +ddPts.toFixed(0) };
  });

  const wins   = trades.filter(t => t.return > 0);
  const losses = trades.filter(t => t.return <= 0);
  const winRate = wins.length / trades.length;
  const avgWin  = wins.length  ? wins.reduce((s, t)   => s + t.return, 0) / wins.length   : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.return, 0) / losses.length : 0;
  const gp = wins.reduce((s, t)   => s + t.return, 0);
  const gl = losses.reduce((s, t) => s + Math.abs(t.return), 0);
  const pf = gl > 0 ? gp / gl : gp > 0 ? 99 : 0;
  const avgHold = trades.reduce((s, t) => s + t.holdDays, 0) / trades.length;

  // Annualised Sharpe (using trade returns, scaled by avg hold)
  const rets    = trades.map(t => t.return);
  const mean    = rets.reduce((a, b) => a + b, 0) / rets.length;
  const stddev  = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length);
  const sharpe  = stddev > 0 ? (mean / stddev) * Math.sqrt(252 / Math.max(avgHold, 1)) : 0;

  return {
    totalTrades:       trades.length,
    wins:              wins.length,
    losses:            losses.length,
    winRate:           +(winRate * 100).toFixed(1),
    totalReturn:       +(totalReturn * 100).toFixed(1),
    totalReturnDollar: +(finalCapital - INITIAL_CAPITAL).toFixed(0),
    finalCapital:      +finalCapital.toFixed(0),
    maxDrawdown:       +(maxDD * 100).toFixed(1),
    maxDrawdownPoints: +maxDDPoints.toFixed(0),
    sharpe:            +sharpe.toFixed(2),
    profitFactor:      +pf.toFixed(2),
    avgWin:            +(avgWin * 100).toFixed(2),
    avgLoss:           +(avgLoss * 100).toFixed(2),
    avgHoldDays:       +avgHold.toFixed(0),
    equityCurve:       curve,
    drawdownCurve:     ddCurve,
    trades,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const signalFns = {
  GOLDEN_CROSS:   signalsGoldenCross,
  RSI_DIP_BUY:    signalsRSIDipBuy,
  MACD_MOMENTUM:  signalsMACDMomentum,
  TREND_PULLBACK: signalsTrendPullback,
};

export function runBacktest(strategyKey, candles) {
  const fn = signalFns[strategyKey];
  if (!fn) return null;
  const signals = fn(candles);
  const trades  = simulateTrades(candles, signals);
  return calcMetrics(trades, candles);
}

export function runAllBacktests(candles) {
  const results = {};
  Object.keys(STRATEGIES).forEach(k => { results[k] = runBacktest(k, candles); });
  return results;
}
