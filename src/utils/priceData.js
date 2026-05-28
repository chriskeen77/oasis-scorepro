// Seeded Linear Congruential Generator for reproducible results
function lcg(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Box-Muller transform: uniform → standard normal
function normalRand(rand) {
  const u1 = rand() || 1e-10;
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export const STOCK_UNIVERSE = {
  AAPL:  { name: 'Apple Inc.',          sector: 'Technology',     px0: 155,  mu: 0.18, sigma: 0.28, seed: 42  },
  MSFT:  { name: 'Microsoft Corp.',     sector: 'Technology',     px0: 385,  mu: 0.22, sigma: 0.25, seed: 137 },
  NVDA:  { name: 'NVIDIA Corp.',        sector: 'Semiconductors', px0: 550,  mu: 0.55, sigma: 0.60, seed: 256 },
  GOOGL: { name: 'Alphabet Inc.',       sector: 'Technology',     px0: 142,  mu: 0.15, sigma: 0.27, seed: 89  },
  AMZN:  { name: 'Amazon.com Inc.',     sector: 'Consumer Disc.', px0: 178,  mu: 0.20, sigma: 0.32, seed: 333 },
  META:  { name: 'Meta Platforms',      sector: 'Technology',     px0: 455,  mu: 0.38, sigma: 0.38, seed: 512 },
  TSLA:  { name: 'Tesla Inc.',          sector: 'Consumer Disc.', px0: 215,  mu: 0.10, sigma: 0.68, seed: 777 },
  JPM:   { name: 'JPMorgan Chase',      sector: 'Financials',     px0: 198,  mu: 0.14, sigma: 0.22, seed: 101 },
  V:     { name: 'Visa Inc.',           sector: 'Financials',     px0: 272,  mu: 0.12, sigma: 0.18, seed: 444 },
  'BRK.B': { name: 'Berkshire Hathaway', sector: 'Financials',   px0: 372,  mu: 0.10, sigma: 0.17, seed: 999 },
};

// Generate 504 trading days (~2 years) starting 2024-01-02
function tradingDates(n) {
  const dates = [];
  const d = new Date('2024-01-02');
  while (dates.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export const NUM_DAYS = 504;
export const TRADING_DATES = tradingDates(NUM_DAYS);

export function generateOHLCV(symbol) {
  const cfg = STOCK_UNIVERSE[symbol];
  const rand = lcg(cfg.seed);
  const dt = 1 / 252;
  const drift = (cfg.mu - 0.5 * cfg.sigma * cfg.sigma) * dt;
  const vol   = cfg.sigma * Math.sqrt(dt);

  const candles = [];
  let prevClose = cfg.px0;

  for (let i = 0; i < NUM_DAYS; i++) {
    const open  = i === 0 ? prevClose : prevClose * (1 + normalRand(rand) * 0.004);
    const close = open * Math.exp(drift + vol * normalRand(rand));
    const range = Math.abs(close - open) * 0.6 + prevClose * 0.004;
    const high  = Math.max(open, close) + Math.abs(normalRand(rand)) * range;
    const low   = Math.min(open, close) - Math.abs(normalRand(rand)) * range;
    const volume = Math.floor(800_000 + rand() * 4_200_000);

    candles.push({
      date:   TRADING_DATES[i],
      open:   +open.toFixed(2),
      high:   +high.toFixed(2),
      low:    +low.toFixed(2),
      close:  +close.toFixed(2),
      volume,
    });
    prevClose = close;
  }
  return candles;
}

// Pre-generate all stock data once at module load
export const ALL_STOCK_DATA = {};
Object.keys(STOCK_UNIVERSE).forEach(sym => {
  ALL_STOCK_DATA[sym] = generateOHLCV(sym);
});
