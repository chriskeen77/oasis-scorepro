export function sma(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    return sum / period;
  });
}

export function ema(values, period) {
  const k = 2 / (period + 1);
  const result = new Array(values.length).fill(null);
  // Find first valid index
  let start = values.findIndex(v => v !== null && v !== undefined);
  if (start < 0 || start + period > values.length) return result;
  // Seed with SMA
  let sum = 0;
  for (let i = start; i < start + period; i++) sum += values[i];
  result[start + period - 1] = sum / period;
  for (let i = start + period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function rsi(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const fastEMA = ema(closes, fast);
  const slowEMA = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    fastEMA[i] !== null && slowEMA[i] !== null ? fastEMA[i] - slowEMA[i] : null
  );
  const validMacd = macdLine.filter(v => v !== null);
  const sigRaw = ema(validMacd, signal);
  const pad = macdLine.length - validMacd.length;
  const signalLine = [...new Array(pad).fill(null), ...sigRaw];
  const histogram = macdLine.map((m, i) =>
    m !== null && signalLine[i] !== null ? m - signalLine[i] : null
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

export function bollingerBands(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper = [], lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (mid[i] === null) { upper.push(null); lower.push(null); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const sd = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    upper.push(mid[i] + mult * sd);
    lower.push(mid[i] - mult * sd);
  }
  return { upper, middle: mid, lower };
}

export function atr(candles, period = 14) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  });
  return sma(tr, period);
}

export function computeRelativeFactors(candles) {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const n = closes.length - 1;

  const sma20v  = sma(closes, 20);
  const sma50v  = sma(closes, 50);
  const sma200v = sma(closes, 200);
  const rsiVals = rsi(closes, 14);
  const volSma  = sma(volumes, 20);
  const { macd: macdLine, signal: sigLine, histogram } = macd(closes);
  const bb      = bollingerBands(closes, 20);
  const atrVals = atr(candles, 14);

  const price   = closes[n];
  const high52w = Math.max(...closes.slice(Math.max(0, n - 252)));
  const low52w  = Math.min(...closes.slice(Math.max(0, n - 252)));
  const weekRange52 = high52w - low52w;
  const priceIn52w  = weekRange52 > 0 ? ((price - low52w) / weekRange52) * 100 : 50;

  const volRatio = volSma[n] > 0 ? volumes[n] / volSma[n] : 1;

  const priceChange1d  = n >= 1  ? ((closes[n] - closes[n-1]) / closes[n-1]) * 100 : 0;
  const priceChange5d  = n >= 5  ? ((closes[n] - closes[n-5]) / closes[n-5]) * 100 : 0;
  const priceChange20d = n >= 20 ? ((closes[n] - closes[n-20]) / closes[n-20]) * 100 : 0;

  return {
    price:       +price.toFixed(2),
    sma20:       sma20v[n]  ? +sma20v[n].toFixed(2)  : null,
    sma50:       sma50v[n]  ? +sma50v[n].toFixed(2)  : null,
    sma200:      sma200v[n] ? +sma200v[n].toFixed(2) : null,
    rsi:         rsiVals[n] ? +rsiVals[n].toFixed(1)  : null,
    macdLine:    macdLine[n] ? +macdLine[n].toFixed(3) : null,
    macdSignal:  sigLine[n]  ? +sigLine[n].toFixed(3)  : null,
    macdHist:    histogram[n] ? +histogram[n].toFixed(3) : null,
    bbUpper:     bb.upper[n] ? +bb.upper[n].toFixed(2) : null,
    bbLower:     bb.lower[n] ? +bb.lower[n].toFixed(2) : null,
    atr:         atrVals[n]  ? +atrVals[n].toFixed(2)  : null,
    volRatio:    +volRatio.toFixed(2),
    high52w:     +high52w.toFixed(2),
    low52w:      +low52w.toFixed(2),
    priceIn52w:  +priceIn52w.toFixed(1),
    change1d:    +priceChange1d.toFixed(2),
    change5d:    +priceChange5d.toFixed(2),
    change20d:   +priceChange20d.toFixed(2),
  };
}

// Returns UP / DOWN / SIDEWAYS with a confidence score 0-100
export function marketDirection(candles) {
  const f = computeRelativeFactors(candles);
  if (!f.sma200) return { direction: 'SIDEWAYS', confidence: 0, label: 'Insufficient Data' };

  let bull = 0, total = 0;
  const addSignal = (cond) => { total++; if (cond) bull++; };

  addSignal(f.price > f.sma20);
  addSignal(f.price > f.sma50);
  addSignal(f.price > f.sma200);
  addSignal(f.sma20  !== null && f.sma50  !== null && f.sma20 > f.sma50);
  addSignal(f.sma50  !== null && f.sma200 !== null && f.sma50 > f.sma200);
  addSignal(f.rsi !== null && f.rsi > 50);
  addSignal(f.macdHist !== null && f.macdHist > 0);
  addSignal(f.change20d > 0);

  const score = bull / total;
  const conf  = Math.round(Math.abs(score - 0.5) * 200); // 0-100

  if (score >= 0.65) return { direction: 'UP',       confidence: conf, label: 'Bullish',     score };
  if (score <= 0.35) return { direction: 'DOWN',     confidence: conf, label: 'Bearish',     score };
  return              { direction: 'SIDEWAYS', confidence: conf, label: 'Sideways/Mixed', score };
}
