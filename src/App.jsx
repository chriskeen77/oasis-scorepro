import { useState, useCallback } from 'react';
import { LayoutDashboard, BarChart2, TrendingUp, FlaskConical, Newspaper, Terminal } from 'lucide-react';
import Header from './components/Header.jsx';
import OverviewPanel      from './components/panels/OverviewPanel.jsx';
import MarketPanel        from './components/panels/MarketPanel.jsx';
import StrategiesPanel    from './components/panels/StrategiesPanel.jsx';
import BacktestPanel      from './components/panels/BacktestPanel.jsx';
import NewsTradingPanel   from './components/panels/NewsTradingPanel.jsx';
import AgentConsolePanel  from './components/panels/AgentConsolePanel.jsx';
import { ALL_STOCK_DATA } from './utils/priceData.js';
import { analyzeAllStocks } from './agents/agents.js';

const TABS = [
  { key: 'overview',    label: 'Overview',         Icon: LayoutDashboard },
  { key: 'market',      label: 'Market Analysis',  Icon: BarChart2 },
  { key: 'strategies',  label: 'Strategies',        Icon: TrendingUp },
  { key: 'backtest',    label: 'Backtesting',       Icon: FlaskConical },
  { key: 'news',        label: 'News Trading',      Icon: Newspaper },
  { key: 'agents',      label: 'Agent Console',     Icon: Terminal },
];

export default function App() {
  const [activeTab,       setActiveTab]       = useState('overview');
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analyzing,       setAnalyzing]       = useState(false);

  const runAgents = useCallback(() => {
    if (analyzing) return;
    setAnalyzing(true);
    // Run in a microtask so the UI can update first
    setTimeout(() => {
      const results = analyzeAllStocks(ALL_STOCK_DATA);
      setAnalysisResults(results);
      setAnalyzing(false);
    }, 50);
  }, [analyzing]);

  const liveSignals = analysisResults
    ? Object.values(analysisResults).filter(r => r.signal === 'STRONG_BUY' || r.signal === 'MODERATE_BUY').length
    : 0;

  return (
    <div className="min-h-screen bg-[#080d18] text-white flex flex-col">
      <Header
        activeAgents={10}
        liveSignals={liveSignals}
        onRunAgents={runAgents}
        analyzing={analyzing}
      />

      {/* Tab bar */}
      <nav className="flex items-center gap-0.5 px-4 border-b border-[#1a2d47] bg-[#0a0f1e] overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'overview'   && <OverviewPanel    analysisResults={analysisResults} />}
        {activeTab === 'market'     && <MarketPanel      analysisResults={analysisResults} />}
        {activeTab === 'strategies' && <StrategiesPanel  stockData={ALL_STOCK_DATA} />}
        {activeTab === 'backtest'   && <BacktestPanel    stockData={ALL_STOCK_DATA} />}
        {activeTab === 'news'       && <NewsTradingPanel analysisResults={analysisResults} />}
        {activeTab === 'agents'     && <AgentConsolePanel analysisResults={analysisResults} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a2d47] px-6 py-2 flex items-center justify-between text-[10px] text-[#475569]">
        <span>Oasis ScorePro · Robin Hood AI Trading · MCP Protocol v1.0</span>
        <span className="text-neutral font-semibold">⚠ SIMULATION ONLY — All trades are paper trades. No live capital is deployed.</span>
        <span>© 2026 — Strategy research &amp; backtesting engine</span>
      </footer>
    </div>
  );
}
