import { useState, useEffect, useRef } from 'react';
import { Terminal, Play, RefreshCw } from 'lucide-react';
import { STOCK_UNIVERSE } from '../../utils/priceData.js';

const LOG_COLORS = {
  MarketDirectionAgent: '#3b82f6',
  StrategyAgent:        '#8b5cf6',
  BacktestAgent:        '#f59e0b',
  NewsAgent:            '#ec4899',
  ConsensusEngine:      '#10b981',
};

function getAgentColor(line) {
  for (const [name, color] of Object.entries(LOG_COLORS)) {
    if (line.includes(name)) return color;
  }
  return '#94a3b8';
}

function formatLog(line) {
  const match = line.match(/^\[(\w+)\](.*)/);
  if (!match) return { agent: null, msg: line, color: '#94a3b8' };
  const agent = match[1];
  const msg   = match[2];
  return { agent, msg, color: LOG_COLORS[agent] || '#94a3b8' };
}

export default function AgentConsolePanel({ analysisResults }) {
  const [selected,    setSelected]    = useState('NVDA');
  const [displayed,   setDisplayed]   = useState([]);
  const [running,     setRunning]     = useState(false);
  const [logIdx,      setLogIdx]      = useState(0);
  const bottomRef = useRef(null);

  const allLogs = analysisResults?.[selected]?.allLogs || [];

  useEffect(() => {
    setDisplayed([]);
    setLogIdx(0);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayed]);

  function startStream() {
    if (running || !allLogs.length) return;
    setDisplayed([]);
    setRunning(true);
    setLogIdx(0);
  }

  useEffect(() => {
    if (!running) return;
    if (logIdx >= allLogs.length) { setRunning(false); return; }
    const delay = logIdx === 0 ? 100 : 80 + Math.random() * 120;
    const t = setTimeout(() => {
      setDisplayed(prev => [...prev, allLogs[logIdx]]);
      setLogIdx(i => i + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [running, logIdx, allLogs]);

  if (!analysisResults) {
    return (
      <div className="flex items-center justify-center h-64 text-[#64748b]">
        Run agents first to see the agent console
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-bull" />
          <span className="text-[11px] text-[#64748b] uppercase tracking-widest">Agent Activity Console</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(analysisResults).map(sym => (
            <button
              key={sym}
              onClick={() => setSelected(sym)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                selected === sym
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0d1526] border border-[#1a2d47] text-[#94a3b8] hover:border-blue-500/50'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
        <button
          onClick={startStream}
          disabled={running}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[#0d1526] border border-[#1a2d47] text-[#94a3b8] hover:border-blue-500 hover:text-white transition-colors disabled:opacity-50"
        >
          {running ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
          {running ? 'Running…' : 'Replay Analysis'}
        </button>
      </div>

      {/* Agent legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(LOG_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
            {name}
          </div>
        ))}
      </div>

      {/* Terminal */}
      <div className="bg-[#060b14] border border-[#1a2d47] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2d47] bg-[#0a0f1e]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-bear/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-bull/80" />
          </div>
          <span className="text-[10px] text-[#475569] font-mono">
            oasis-scorepro — agent console — {selected} · {STOCK_UNIVERSE[selected].name}
          </span>
          <span className="text-[10px] text-[#475569]">{displayed.length}/{allLogs.length} lines</span>
        </div>

        <div className="h-[500px] overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
          {displayed.length === 0 && !running && (
            <div className="text-[#475569] mt-4">
              <p>$ oasis-agents run --symbol {selected} --mode consensus</p>
              <p className="mt-2">Press <span className="text-blue-400">Replay Analysis</span> to stream agent reasoning...</p>
            </div>
          )}
          {displayed.map((line, i) => {
            const { agent, msg, color } = formatLog(line);
            return (
              <div key={i} className="agent-log-entry flex gap-2 mb-0.5">
                <span className="text-[#475569] flex-shrink-0 w-4 text-right">{i + 1}</span>
                <span>
                  {agent && (
                    <span className="font-semibold" style={{ color }}>[{agent}]</span>
                  )}
                  <span className="text-[#cbd5e1]">{msg}</span>
                </span>
              </div>
            );
          })}
          {running && (
            <div className="flex items-center gap-2 mt-1 text-[#64748b]">
              <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-bull inline-block" />
              <span>Processing…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Signal summary */}
      {analysisResults[selected] && (
        <div className="bg-[#0d1526] border border-[#1a2d47] rounded-lg p-4">
          <h3 className="text-[11px] text-[#94a3b8] uppercase tracking-widest mb-3">Final Consensus Result for {selected}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Signal',       value: analysisResults[selected].signal.replace('_', ' '),         color: analysisResults[selected].signal === 'STRONG_BUY' ? '#10b981' : analysisResults[selected].signal === 'AVOID' ? '#ef4444' : '#f59e0b' },
              { label: 'Confidence',   value: `${analysisResults[selected].confidence}%`,                  color: '#3b82f6' },
              { label: 'Agents Agree', value: `${analysisResults[selected].bullVotes}/4`,                  color: analysisResults[selected].bullVotes >= 3 ? '#10b981' : '#ef4444' },
              { label: 'Direction',    value: analysisResults[selected].direction.label,                    color: analysisResults[selected].direction.direction === 'UP' ? '#10b981' : '#ef4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#0a1220] rounded p-3 text-center">
                <p className="text-base font-bold font-mono" style={{ color }}>{value}</p>
                <p className="text-[10px] text-[#64748b] mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
