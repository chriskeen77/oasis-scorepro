import { computeRelativeFactors, marketDirection } from '../utils/indicators.js';
import { runAllBacktests, STRATEGIES } from '../utils/backtest.js';

// ─── Simulated news database ──────────────────────────────────────────────────
const NEWS_DB = [
  { id: 1, headline: 'NVDA Posts Record Data-Center Revenue, Beats by 18%',        symbols: ['NVDA'],       sentiment: 0.92, impact: 'HIGH',   date: '2026-05-20' },
  { id: 2, headline: 'Fed Holds Rates; Signals Two Cuts Before Year-End',           symbols: ['ALL'],        sentiment: 0.70, impact: 'HIGH',   date: '2026-05-21' },
  { id: 3, headline: 'AAPL Services Revenue Reaches All-Time High in Q2',           symbols: ['AAPL'],       sentiment: 0.78, impact: 'MEDIUM', date: '2026-05-22' },
  { id: 4, headline: 'MSFT Azure Cloud Growth Accelerates to 34% YoY',             symbols: ['MSFT'],       sentiment: 0.82, impact: 'HIGH',   date: '2026-05-22' },
  { id: 5, headline: 'TSLA Misses Q1 Deliveries; Raises FY Guidance On Cybertruck', symbols: ['TSLA'],      sentiment: 0.35, impact: 'HIGH',   date: '2026-05-18' },
  { id: 6, headline: 'JPM Raises Dividend 10%; $30B Buyback Announced',            symbols: ['JPM'],        sentiment: 0.85, impact: 'HIGH',   date: '2026-05-19' },
  { id: 7, headline: 'META AI Advertising Suite Lifts ARPU 22% in Q2',             symbols: ['META'],       sentiment: 0.88, impact: 'HIGH',   date: '2026-05-23' },
  { id: 8, headline: 'AMZN AWS Wins $6B DoD Cloud Contract',                       symbols: ['AMZN'],       sentiment: 0.80, impact: 'MEDIUM', date: '2026-05-21' },
  { id: 9, headline: 'GOOGL Gemini 2.5 Integration Boosts Search Monetization',    symbols: ['GOOGL'],      sentiment: 0.75, impact: 'MEDIUM', date: '2026-05-20' },
  { id:10, headline: 'V Merchant Volume Rises 14% as Consumer Spending Holds Firm',symbols: ['V'],          sentiment: 0.72, impact: 'MEDIUM', date: '2026-05-19' },
  { id:11, headline: 'BRK.B Warren Buffett Increases AAPL Stake by 5%',            symbols: ['BRK.B','AAPL'],sentiment:0.68, impact: 'MEDIUM', date: '2026-05-17' },
  { id:12, headline: 'U.S. CPI Cools to 2.3%; Soft-Landing Narrative Strengthens', symbols: ['ALL'],       sentiment: 0.78, impact: 'HIGH',   date: '2026-05-15' },
  { id:13, headline: 'NVDA Announces Next-Gen Blackwell Ultra GPU at GTC',          symbols: ['NVDA'],      sentiment: 0.90, impact: 'HIGH',   date: '2026-05-16' },
  { id:14, headline: 'TSLA Full Self-Driving v14 Regulatory Approval Delayed',      symbols: ['TSLA'],      sentiment: 0.25, impact: 'HIGH',   date: '2026-05-14' },
  { id:15, headline: 'MSFT GitHub Copilot Enterprise Reaches 2M Paying Seats',      symbols: ['MSFT'],      sentiment: 0.74, impact: 'MEDIUM', date: '2026-05-13' },
  { id:16, headline: 'AMZN Prime Membership Surpasses 300M Globally',              symbols: ['AMZN'],       sentiment: 0.76, impact: 'MEDIUM', date: '2026-05-12' },
  { id:17, headline: 'Sector Rotation: Money Moving Into Mega-Cap Tech',            symbols: ['ALL'],        sentiment: 0.65, impact: 'MEDIUM', date: '2026-05-24' },
  { id:18, headline: 'AAPL iPhone 17 Pro Pre-Orders Break First-Weekend Record',    symbols: ['AAPL'],       sentiment: 0.87, impact: 'HIGH',   date: '2026-05-25' },
  { id:19, headline: 'JPM Warns of Commercial Real-Estate Headwinds',               symbols: ['JPM'],        sentiment: 0.35, impact: 'MEDIUM', date: '2026-05-11' },
  { id:20, headline: 'GOOGL Faces EU Antitrust Fine Over Search Advertising',       symbols: ['GOOGL'],      sentiment: 0.28, impact: 'HIGH',   date: '2026-05-10' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newsForSymbol(symbol) {
  return NEWS_DB.filter(n => n.symbols.includes(symbol) || n.symbols.includes('ALL'));
}

function avgSentiment(items) {
  if (!items.length) return 0.5;
  return items.reduce((s, n) => s + n.sentiment, 0) / items.length;
}

function sentimentLabel(score) {
  if (score >= 0.70) return { label: 'POSITIVE', color: '#10b981' };
  if (score >= 0.45) return { label: 'NEUTRAL',  color: '#f59e0b' };
  return                    { label: 'NEGATIVE', color: '#ef4444' };
}

// ─── Agent: MarketDirectionAgent ─────────────────────────────────────────────
export function runMarketDirectionAgent(symbol, candles) {
  const factors = computeRelativeFactors(candles);
  const dir     = marketDirection(candles);

  const logs = [
    `[MarketDirectionAgent] Analyzing ${symbol} — ${candles.length} trading days of data`,
    `[MarketDirectionAgent] Price: $${factors.price} | 20-SMA: $${factors.sma20} | 50-SMA: $${factors.sma50} | 200-SMA: $${factors.sma200}`,
    `[MarketDirectionAgent] RSI(14): ${factors.rsi} | MACD Histogram: ${factors.macdHist}`,
    `[MarketDirectionAgent] 20d change: ${factors.change20d > 0 ? '+' : ''}${factors.change20d}% | 52w position: ${factors.priceIn52w}%`,
    `[MarketDirectionAgent] Direction → ${dir.direction} (Confidence: ${dir.confidence}%)`,
  ];

  return { symbol, direction: dir, factors, logs };
}

// ─── Agent: StrategyResearchAgent ────────────────────────────────────────────
export function runStrategyAgent(symbol, candles, backtestResults) {
  const factors = computeRelativeFactors(candles);
  const dir     = marketDirection(candles);

  // Pick best strategy by sharpe
  let bestKey = null, bestSharpe = -Infinity;
  Object.entries(backtestResults).forEach(([k, r]) => {
    if (r && r.sharpe > bestSharpe) { bestSharpe = r.sharpe; bestKey = k; }
  });

  const best = bestKey ? backtestResults[bestKey] : null;
  const stratName = bestKey ? STRATEGIES[bestKey].name : 'N/A';

  const logs = [
    `[StrategyAgent] Running strategy fitness analysis for ${symbol}`,
    `[StrategyAgent] Evaluating 4 strategies on 2Y of data...`,
    ...Object.entries(backtestResults).map(([k, r]) =>
      r ? `[StrategyAgent] ${STRATEGIES[k].name}: WR=${r.winRate}% | Sharpe=${r.sharpe} | DD=${r.maxDrawdown}%`
        : `[StrategyAgent] ${STRATEGIES[k].name}: Insufficient trades`
    ),
    `[StrategyAgent] Best fit → ${stratName} (Sharpe: ${bestSharpe.toFixed(2)})`,
    `[StrategyAgent] Market regime: ${dir.label} — strategy alignment: ${dir.direction === 'UP' ? 'HIGH' : dir.direction === 'SIDEWAYS' ? 'MEDIUM' : 'LOW'}`,
  ];

  return { symbol, bestStrategyKey: bestKey, bestStrategy: best, stratName, logs };
}

// ─── Agent: NewsAgent ─────────────────────────────────────────────────────────
export function runNewsAgent(symbol) {
  const items    = newsForSymbol(symbol);
  const recent   = items.slice(0, 6);
  const avgSent  = avgSentiment(recent);
  const sentInfo = sentimentLabel(avgSent);

  const logs = [
    `[NewsAgent] Scanning news corpus for ${symbol}...`,
    `[NewsAgent] Found ${items.length} relevant articles`,
    ...recent.map(n => `[NewsAgent] [${n.date}] "${n.headline}" → sentiment ${(n.sentiment * 100).toFixed(0)}%`),
    `[NewsAgent] Avg sentiment: ${(avgSent * 100).toFixed(0)}% — ${sentInfo.label}`,
  ];

  return { symbol, items: recent, avgSentiment: avgSent, sentimentLabel: sentInfo.label, sentimentColor: sentInfo.color, logs };
}

// ─── Agent: BacktestAgent ─────────────────────────────────────────────────────
export function runBacktestAgent(symbol, candles) {
  const results = runAllBacktests(candles);
  const logs = [
    `[BacktestAgent] Running 4-strategy backtest suite on ${symbol} (${candles.length} bars)`,
    `[BacktestAgent] Initial capital: $100,000 | Position size: 20% | Commission: 0.08%`,
    ...Object.entries(results).map(([k, r]) =>
      r
        ? `[BacktestAgent] ${STRATEGIES[k].name}: ${r.totalTrades} trades | WR ${r.winRate}% | Return ${r.totalReturn > 0 ? '+' : ''}${r.totalReturn}% | MaxDD ${r.maxDrawdown}%`
        : `[BacktestAgent] ${STRATEGIES[k].name}: Not enough signals`
    ),
    `[BacktestAgent] Backtest suite complete — no live capital at risk`,
  ];
  return { symbol, results, logs };
}

// ─── ConsensusEngine ──────────────────────────────────────────────────────────
export function runConsensusEngine(symbol, candles) {
  const dirResult   = runMarketDirectionAgent(symbol, candles);
  const btResult    = runBacktestAgent(symbol, candles);
  const newsResult  = runNewsAgent(symbol);
  const stratResult = runStrategyAgent(symbol, candles, btResult.results);

  const factors = dirResult.factors;

  // Individual agent votes (0–1)
  const dirScore    = dirResult.direction.score || 0;
  const newsScore   = newsResult.avgSentiment;
  const stratScore  = stratResult.bestStrategy
    ? Math.min(1, (stratResult.bestStrategy.winRate / 100) * 1.2)
    : 0.4;
  const techScore   = (() => {
    // Scoring based on technical setup quality
    let s = 0;
    if (factors.rsi !== null) {
      if (factors.rsi >= 38 && factors.rsi <= 55) s += 0.30; // sweet spot dip
      else if (factors.rsi >= 55 && factors.rsi <= 65) s += 0.15;
    }
    if (factors.macdHist !== null && factors.macdHist > 0) s += 0.25;
    if (factors.price > factors.sma50) s += 0.25;
    if (factors.change5d > 0) s += 0.20;
    return Math.min(s, 1);
  })();

  // Weighted composite confidence
  const confidence = Math.round(
    dirScore  * 30 +
    newsScore * 25 +
    stratScore* 25 +
    techScore * 20
  );

  // Require >= 3 agents agreeing bull
  const bullVotes = [
    dirResult.direction.direction === 'UP',
    newsResult.avgSentiment >= 0.60,
    (stratResult.bestStrategy?.winRate || 0) >= 55,
    techScore >= 0.45,
  ].filter(Boolean).length;

  const signal = confidence >= 72 && bullVotes >= 3
    ? 'STRONG_BUY'
    : confidence >= 60 && bullVotes >= 2
      ? 'MODERATE_BUY'
      : confidence <= 35
        ? 'AVOID'
        : 'NEUTRAL';

  // Risk levels from best backtest
  const bt   = stratResult.bestStrategy;
  const atrV = factors.atr || factors.price * 0.02;
  const stopLoss  = +(factors.price - atrV * 1.5).toFixed(2);
  const target    = +(factors.price + atrV * 3.0).toFixed(2);
  const riskReward = atrV > 0 ? +((target - factors.price) / (factors.price - stopLoss)).toFixed(2) : null;

  const logs = [
    `[ConsensusEngine] ── Starting multi-agent consensus for ${symbol} ──`,
    `[ConsensusEngine] MarketDirection vote: ${dirResult.direction.direction} (score: ${(dirScore*100).toFixed(0)}%)`,
    `[ConsensusEngine] News Sentiment vote: ${newsResult.sentimentLabel} (score: ${(newsScore*100).toFixed(0)}%)`,
    `[ConsensusEngine] Strategy Quality vote: ${(stratScore*100).toFixed(0)}% (${stratResult.stratName})`,
    `[ConsensusEngine] Technical Setup vote: ${(techScore*100).toFixed(0)}%`,
    `[ConsensusEngine] Bullish votes: ${bullVotes}/4 agents agree`,
    `[ConsensusEngine] ── COMPOSITE CONFIDENCE: ${confidence}% ──`,
    `[ConsensusEngine] SIGNAL: ${signal} | Stop: $${stopLoss} | Target: $${target} | R:R = 1:${riskReward}`,
  ];

  return {
    symbol,
    confidence,
    signal,
    bullVotes,
    scores: { direction: +(dirScore*100).toFixed(0), news: +(newsScore*100).toFixed(0), strategy: +(stratScore*100).toFixed(0), technical: +(techScore*100).toFixed(0) },
    entry:  factors.price,
    stopLoss,
    target,
    riskReward,
    strategy: stratResult.stratName,
    direction: dirResult.direction,
    factors,
    logs,
    allLogs: [
      ...dirResult.logs,
      ...btResult.logs,
      ...newsResult.logs,
      ...stratResult.logs,
      ...logs,
    ],
  };
}

// ─── Run full analysis on all stocks ─────────────────────────────────────────
export function analyzeAllStocks(stockData) {
  const results = {};
  Object.keys(stockData).forEach(sym => {
    results[sym] = runConsensusEngine(sym, stockData[sym]);
  });
  return results;
}
