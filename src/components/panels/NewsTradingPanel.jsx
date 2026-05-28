import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, MinusCircle, Newspaper, Users } from 'lucide-react';
import { STOCK_UNIVERSE } from '../../utils/priceData.js';

function SentimentDot({ score }) {
  if (score >= 0.70) return <span className="w-2 h-2 rounded-full bg-bull inline-block" />;
  if (score >= 0.45) return <span className="w-2 h-2 rounded-full bg-neutral inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-bear inline-block" />;
}

function ImpactBadge({ impact }) {
  const cls = impact === 'HIGH' ? 'text-bear border-bear/40 bg-bear/10' : 'text-neutral border-neutral/40 bg-neutral/10';
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>{impact}</span>;
}

function AgentVote({ name, vote, score }) {
  const Icon = vote ? CheckCircle : XCircle;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1a2d47] last:border-0">
      <div className="flex items-center gap-2">
        <Icon size={14} className={vote ? 'text-bull' : 'text-bear'} />
        <span className="text-xs text-[#94a3b8]">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-20 h-1 bg-[#1a2d47] rounded-full">
          <div className={`h-full rounded-full ${vote ? 'bg-bull' : 'bg-bear'}`} style={{ width: `${score}%` }} />
        </div>
        <span className={`text-xs font-bold w-8 text-right ${vote ? 'text-bull' : 'text-bear'}`}>{score}%</span>
      </div>
    </div>
  );
}

function SignalCard({ result }) {
  const signalMap = {
    STRONG_BUY:   { label: 'STRONG BUY',    Icon: CheckCircle,  cls: 'text-bull',     bg: 'bg-bull/10 border-bull/40' },
    MODERATE_BUY: { label: 'MODERATE BUY',  Icon: CheckCircle,  cls: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/40' },
    NEUTRAL:      { label: 'NEUTRAL',        Icon: MinusCircle,  cls: 'text-neutral',  bg: 'bg-neutral/10 border-neutral/40' },
    AVOID:        { label: 'AVOID',          Icon: XCircle,      cls: 'text-bear',     bg: 'bg-bear/10 border-bear/40' },
  };
  const { label, Icon, cls, bg } = signalMap[result.signal] || signalMap.NEUTRAL;

  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">{result.symbol}</span>
            <Icon size={18} className={cls} />
            <span className={`text-sm font-bold ${cls}`}>{label}</span>
          </div>
          <p className="text-[10px] text-[#64748b] mt-0.5">
            {STOCK_UNIVERSE[result.symbol]?.name} · {result.strategy}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${cls}`}>{result.confidence}%</div>
          <div className="text-[10px] text-[#64748b]">Confidence</div>
        </div>
      </div>

      {/* Agent votes */}
      <div className="space-y-0 mb-3">
        <AgentVote name="Market Direction" vote={result.scores.direction >= 55} score={result.scores.direction} />
        <AgentVote name="News Sentiment"   vote={result.scores.news >= 55}       score={result.scores.news} />
        <AgentVote name="Strategy Fit"     vote={result.scores.strategy >= 55}   score={result.scores.strategy} />
        <AgentVote name="Technical Setup"  vote={result.scores.technical >= 45}  score={result.scores.technical} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[#64748b]">Consensus: {result.bullVotes}/4 agents bullish</span>
        <span className="text-[11px] text-[#64748b]">Direction: {result.direction.label}</span>
      </div>

      {/* Risk levels */}
      <div className="grid grid-cols-3 gap-2 p-2 bg-[#0a1220] rounded text-center">
        <div>
          <p className="text-[10px] text-[#64748b]">Entry</p>
          <p className="text-xs font-bold text-white">${result.entry}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#64748b]">Stop Loss</p>
          <p className="text-xs font-bold text-bear">${result.stopLoss}</p>
          <p className="text-[9px] text-bear/70">
            -{(((result.entry - result.stopLoss) / result.entry) * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[#64748b]">Target</p>
          <p className="text-xs font-bold text-bull">${result.target}</p>
          <p className="text-[9px] text-bull/70">
            +{(((result.target - result.entry) / result.entry) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
      {result.riskReward && (
        <p className="text-[10px] text-[#64748b] mt-1.5 text-center">
          Risk/Reward: <span className="text-blue-400 font-semibold">1:{result.riskReward}</span>
        </p>
      )}
    </div>
  );
}

export default function NewsTradingPanel({ analysisResults }) {
  const [tab, setTab] = useState('signals');

  if (!analysisResults) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748b]">
        Run agents first to see news trading analysis
      </div>
    );
  }

  const NEWS_DB = [
    { headline: 'NVDA Posts Record Data-Center Revenue, Beats by 18%', symbols: ['NVDA'],       sentiment: 0.92, impact: 'HIGH',   date: '2026-05-20', body: 'Data center segment revenue reached $22.6B, surpassing estimates by $3.5B. CEO cited unprecedented AI workload demand.' },
    { headline: 'Fed Holds Rates; Signals Two Cuts Before Year-End',    symbols: ['ALL'],        sentiment: 0.70, impact: 'HIGH',   date: '2026-05-21', body: 'FOMC unanimous hold at 4.25–4.50%. Dot plot shows two 25bp cuts projected for H2 2026. Markets interpreted as dovish.' },
    { headline: 'AAPL Services Revenue Reaches All-Time High in Q2',    symbols: ['AAPL'],       sentiment: 0.78, impact: 'MEDIUM', date: '2026-05-22', body: 'Services now 28% of total revenue. App Store, Apple Pay, and iCloud all set records. Analysts raise price targets.' },
    { headline: 'MSFT Azure Cloud Growth Accelerates to 34% YoY',       symbols: ['MSFT'],       sentiment: 0.82, impact: 'HIGH',   date: '2026-05-22', body: 'Azure AI services contribution nearly doubled QoQ. CFO guided 36-37% Azure growth in next quarter.' },
    { headline: 'TSLA Misses Q1 Deliveries; Raises FY Guidance On Cybertruck', symbols: ['TSLA'], sentiment: 0.35, impact: 'HIGH', date: '2026-05-18', body: 'Deliveries came in at 336K vs 377K estimated. Management guided FY EV deliveries up 15% citing Cybertruck ramp.' },
    { headline: 'JPM Raises Dividend 10%; $30B Buyback Announced',      symbols: ['JPM'],        sentiment: 0.85, impact: 'HIGH',   date: '2026-05-19', body: 'JPMorgan posts record Q1 net income of $14.6B. Capital returns program expanded significantly.' },
    { headline: 'META AI Advertising Suite Lifts ARPU 22% in Q2',       symbols: ['META'],       sentiment: 0.88, impact: 'HIGH',   date: '2026-05-23', body: 'Meta AI tools now used by 2B+ users. Ad conversion rates up materially from AI-powered targeting improvements.' },
    { headline: 'AMZN AWS Wins $6B DoD Cloud Contract',                  symbols: ['AMZN'],       sentiment: 0.80, impact: 'MEDIUM', date: '2026-05-21', body: 'Pentagon Joint Warfighting Cloud Capability contract adds to AMZN public sector backlog. Analysts see upside.' },
    { headline: 'GOOGL Faces EU Antitrust Fine Over Search Advertising', symbols: ['GOOGL'],      sentiment: 0.28, impact: 'HIGH',   date: '2026-05-10', body: 'EU DG Comp proposed €8.4B fine for search exclusivity agreements. Alphabet plans to appeal; legal risk noted.' },
    { headline: 'U.S. CPI Cools to 2.3%; Soft-Landing Narrative Strengthens', symbols: ['ALL'], sentiment: 0.78, impact: 'HIGH',   date: '2026-05-15', body: 'Core CPI at 2.3% YoY, below the 2.5% estimate. Shelter costs fell for third consecutive month. Risk-on environment.' },
    { headline: 'AAPL iPhone 17 Pro Pre-Orders Break First-Weekend Record', symbols: ['AAPL'],   sentiment: 0.87, impact: 'HIGH',   date: '2026-05-25', body: 'Pre-order numbers 23% above iPhone 16 Pro cycle at same point. Titanium model sold out in most markets.' },
    { headline: 'Sector Rotation: Money Moving Into Mega-Cap Tech',      symbols: ['ALL'],        sentiment: 0.65, impact: 'MEDIUM', date: '2026-05-24', body: 'Fund flows data shows $4.2B inflows to large-cap tech ETFs in the past week. Breadth improving.' },
    { headline: 'NVDA Announces Next-Gen Blackwell Ultra GPU at GTC',    symbols: ['NVDA'],       sentiment: 0.90, impact: 'HIGH',   date: '2026-05-16', body: '2.5x performance per watt over Blackwell. Pre-orders from hyperscalers reportedly 3x prior cycle.' },
    { headline: 'V Merchant Volume Rises 14% as Consumer Spending Holds Firm', symbols: ['V'],   sentiment: 0.72, impact: 'MEDIUM', date: '2026-05-19', body: 'Cross-border volume up 19% YoY. Management raised FY volume guidance by 1-2 percentage points.' },
    { headline: 'JPM Warns of Commercial Real-Estate Headwinds',         symbols: ['JPM'],        sentiment: 0.35, impact: 'MEDIUM', date: '2026-05-11', body: 'CRE loan loss provisions increased $800M. Office exposure flagged in stress testing scenarios.' },
  ];

  const symbols = Object.keys(analysisResults);
  const allSignals = symbols
    .map(s => analysisResults[s])
    .sort((a, b) => b.confidence - a.confidence);

  const actionableSignals = allSignals.filter(s => s.signal === 'STRONG_BUY' || s.signal === 'MODERATE_BUY');

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-[#1a2d47] pb-3">
        {[
          { key: 'signals', label: `Signals (${actionableSignals.length})`, Icon: Users },
          { key: 'news',    label: `News Feed (${NEWS_DB.length})`,          Icon: Newspaper },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              tab === key ? 'bg-blue-600 text-white' : 'text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[#64748b]">
          <AlertTriangle size={11} className="text-neutral" />
          Requires 3+ agents bullish for actionable signal
        </div>
      </div>

      {tab === 'signals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allSignals.map(r => (
            <SignalCard key={r.symbol} result={r} />
          ))}
        </div>
      )}

      {tab === 'news' && (
        <div className="space-y-3">
          {NEWS_DB.map((n, i) => (
            <div key={i} className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4 hover:border-blue-500/30 transition-colors">
              <div className="flex items-start gap-3">
                <SentimentDot score={n.sentiment} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white leading-snug">{n.headline}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <ImpactBadge impact={n.impact} />
                      <span className="text-[10px] text-[#475569]">{n.date}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-1.5 leading-relaxed">{n.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {n.symbols.map(s => (
                      <span key={s} className="text-[10px] font-bold text-blue-400">{s === 'ALL' ? '🌍 MARKET-WIDE' : `$${s}`}</span>
                    ))}
                    <span className={`text-[10px] font-semibold ml-auto ${n.sentiment >= 0.7 ? 'text-bull' : n.sentiment >= 0.45 ? 'text-neutral' : 'text-bear'}`}>
                      Sentiment: {Math.round(n.sentiment * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
