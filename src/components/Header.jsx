import { Activity, Cpu, Shield, Zap } from 'lucide-react';

export default function Header({ activeAgents, liveSignals, onRunAgents, analyzing }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[#1a2d47] bg-[#080d18]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight tracking-wider">OASIS SCOREPRO</h1>
            <p className="text-[10px] text-[#64748b] leading-tight">Robin Hood AI Trading System · MCP Protocol</p>
          </div>
        </div>

        <div className="h-5 w-px bg-[#1a2d47]" />

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${analyzing ? 'bg-yellow-400' : 'bg-bull'}`} />
            <span className="text-[#94a3b8]">{analyzing ? 'Agents Running…' : `${activeAgents} Agents Active`}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu size={11} className="text-blue-400" />
            <span className="text-[#94a3b8]">{liveSignals} Live Signals</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Shield size={11} className="text-bull" />
            <span className="text-bull text-[10px] font-semibold">PAPER TRADE ONLY · NO LIVE CAPITAL</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right text-[10px] text-[#64748b]">
          <div>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div className="text-[#10b981]">Market: SIMULATED</div>
        </div>
        <button
          onClick={onRunAgents}
          disabled={analyzing}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-600 text-white transition-colors"
        >
          <Activity size={12} className={analyzing ? 'animate-spin' : ''} />
          {analyzing ? 'Running…' : 'Run Agents'}
        </button>
      </div>
    </header>
  );
}
