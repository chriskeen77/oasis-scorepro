// Lightweight SVG chart primitives — no external deps
import { useState } from 'react';

function useDimensions(data, width = 560, height = 180, padLeft = 50, padRight = 10, padTop = 10, padBottom = 24) {
  if (!data?.length) return null;
  const xs = data.map((_, i) => i);
  const ys = data.map(d => d.value ?? d.drawdown ?? 0);
  const xMin = 0, xMax = data.length - 1;
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yRange = yMax - yMin || 1;
  const toX = i => padLeft + ((i - xMin) / (xMax - xMin || 1)) * (width - padLeft - padRight);
  const toY = v => padTop + (1 - (v - yMin) / yRange) * (height - padTop - padBottom);
  return { width, height, padLeft, padRight, padTop, padBottom, xs, ys, xMin, xMax, yMin, yMax, toX, toY };
}

function xLabels(data, toX, height, padBottom, count = 6) {
  if (!data?.length) return null;
  const step = Math.floor(data.length / count);
  const pts = [];
  for (let i = 0; i < data.length; i += step) pts.push(i);
  if (pts[pts.length - 1] !== data.length - 1) pts.push(data.length - 1);
  return pts.map(i => {
    const d = data[i].date || '';
    const [, m, day, y] = d.match(/(\d{4})-(\d{2})-(\d{2})/) || [];
    const lbl = m && day && y ? `${m}/${day}/${y.slice(2)}` : '';
    return (
      <text key={i} x={toX(i)} y={height - padBottom + 14} fontSize={9} fill="#475569" textAnchor="middle">{lbl}</text>
    );
  });
}

function yLabels(toY, yMin, yMax, padLeft, fmt, count = 4) {
  const step = (yMax - yMin) / count;
  return Array.from({ length: count + 1 }, (_, i) => {
    const v = yMin + step * i;
    return (
      <text key={i} x={padLeft - 4} y={toY(v) + 3} fontSize={9} fill="#475569" textAnchor="end">{fmt(v)}</text>
    );
  });
}

function gridLines(toX, toY, data, yMin, yMax, width, padLeft, padRight, padTop, padBottom) {
  const hLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const y = toY(yMin + f * (yMax - yMin));
    return <line key={f} x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#1a2d47" strokeWidth={0.5} />;
  });
  return hLines;
}

export function EquityChart({ data, width = 560, height = 200 }) {
  const [tooltip, setTooltip] = useState(null);
  const dim = useDimensions(data, width, height);
  if (!dim) return null;
  const { padLeft, padRight, padTop, padBottom, toX, toY, yMin, yMax, xMin, xMax } = dim;

  const pts = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');
  const areaPath = `M${toX(0)},${toY(data[0].value)} ` +
    data.slice(1).map((d, i) => `L${toX(i+1)},${toY(d.value)}`).join(' ') +
    ` L${toX(data.length-1)},${toY(yMin)+padBottom-10} L${toX(0)},${toY(yMin)+padBottom-10} Z`;

  const linePath = `M${toX(0)},${toY(data[0].value)} ` +
    data.slice(1).map((d, i) => `L${toX(i+1)},${toY(d.value)}`).join(' ');

  const handleMove = e => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round(((mx - padLeft) / (width - padLeft - padRight)) * (data.length - 1));
    const i = Math.max(0, Math.min(data.length - 1, idx));
    setTooltip({ i, x: toX(i), y: toY(data[i].value), d: data[i] });
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}>
      <defs>
        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="eqClip"><rect x={padLeft} y={padTop} width={width-padLeft-padRight} height={height-padTop-padBottom} /></clipPath>
      </defs>
      {gridLines(toX, toY, data, yMin, yMax, width, padLeft, padRight, padTop, padBottom)}
      {yLabels(toY, yMin, yMax, padLeft, v => `$${(v/1000).toFixed(0)}k`)}
      {xLabels(data, toX, height, padBottom)}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={height-padBottom} stroke="#1a2d47" strokeWidth={1}/>
      <line x1={padLeft} x2={width-padRight} y1={height-padBottom} y2={height-padBottom} stroke="#1a2d47" strokeWidth={1}/>
      {/* Reference line at $100k */}
      <line x1={padLeft} x2={width-padRight} y1={toY(100000)} y2={toY(100000)} stroke="#1a2d47" strokeDasharray="4 4" strokeWidth={0.8} />
      <path d={areaPath} fill="url(#eqGrad)" clipPath="url(#eqClip)" />
      <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2} strokeLinejoin="round" clipPath="url(#eqClip)" />
      {tooltip && (
        <>
          <line x1={tooltip.x} x2={tooltip.x} y1={padTop} y2={height-padBottom} stroke="#64748b" strokeWidth={0.8} strokeDasharray="3 3" />
          <circle cx={tooltip.x} cy={tooltip.y} r={4} fill="#10b981" />
          <rect x={Math.min(tooltip.x+6, width-105)} y={tooltip.y-22} width={98} height={30} fill="#0d1526" stroke="#1a2d47" rx={4}/>
          <text x={Math.min(tooltip.x+10, width-101)} y={tooltip.y-8} fontSize={9} fill="#64748b">{tooltip.d.date}</text>
          <text x={Math.min(tooltip.x+10, width-101)} y={tooltip.y+5} fontSize={10} fill="#10b981" fontWeight="bold">${tooltip.d.value?.toLocaleString()}</text>
        </>
      )}
    </svg>
  );
}

export function DrawdownChart({ data, width = 560, height = 160 }) {
  const [tooltip, setTooltip] = useState(null);
  if (!data?.length) return null;
  const padLeft = 50, padRight = 10, padTop = 10, padBottom = 24;
  const ys = data.map(d => d.drawdown);
  const yMin = Math.min(...ys), yMax = 0;
  const yRange = yMax - yMin || 1;
  const toX = i => padLeft + (i / (data.length - 1)) * (width - padLeft - padRight);
  const toY = v => padTop + (1 - (v - yMin) / yRange) * (height - padTop - padBottom);

  const areaPath = `M${toX(0)},${toY(0)} ` +
    data.slice(1).map((d, i) => `L${toX(i+1)},${toY(d.drawdown)}`).join(' ') +
    ` L${toX(data.length-1)},${toY(0)} Z`;
  const linePath = `M${toX(0)},${toY(0)} ` +
    data.slice(1).map((d, i) => `L${toX(i+1)},${toY(d.drawdown)}`).join(' ');

  const handleMove = e => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const idx = Math.round(((mx - padLeft) / (width - padLeft - padRight)) * (data.length - 1));
    const i = Math.max(0, Math.min(data.length - 1, idx));
    setTooltip({ i, x: toX(i), y: toY(data[i].drawdown), d: data[i] });
  };

  const yLbls = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = yMax + f * (yMin - yMax);
    return <text key={f} x={padLeft-4} y={toY(v)+3} fontSize={9} fill="#475569" textAnchor="end">{v.toFixed(1)}%</text>;
  });
  const hLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = yMax + f * (yMin - yMax);
    const y = toY(v);
    return <line key={f} x1={padLeft} x2={width-padRight} y1={y} y2={y} stroke="#1a2d47" strokeWidth={0.5} />;
  });

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}>
      <defs>
        <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
        </linearGradient>
        <clipPath id="ddClip"><rect x={padLeft} y={padTop} width={width-padLeft-padRight} height={height-padTop-padBottom}/></clipPath>
      </defs>
      {hLines}
      {yLbls}
      {xLabels(data, toX, height, padBottom)}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={height-padBottom} stroke="#1a2d47" strokeWidth={1}/>
      <line x1={padLeft} x2={width-padRight} y1={height-padBottom} y2={height-padBottom} stroke="#1a2d47" strokeWidth={1}/>
      <line x1={padLeft} x2={width-padRight} y1={toY(0)} y2={toY(0)} stroke="#1a2d47" strokeWidth={0.8} />
      <path d={areaPath} fill="url(#ddGrad)" clipPath="url(#ddClip)" />
      <path d={linePath} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinejoin="round" clipPath="url(#ddClip)" />
      {tooltip && (
        <>
          <line x1={tooltip.x} x2={tooltip.x} y1={padTop} y2={height-padBottom} stroke="#64748b" strokeWidth={0.8} strokeDasharray="3 3" />
          <circle cx={tooltip.x} cy={tooltip.y} r={3} fill="#ef4444" />
          <rect x={Math.min(tooltip.x+6, width-95)} y={tooltip.y-22} width={88} height={30} fill="#0d1526" stroke="#1a2d47" rx={4}/>
          <text x={Math.min(tooltip.x+10, width-91)} y={tooltip.y-8} fontSize={9} fill="#64748b">{tooltip.d.date}</text>
          <text x={Math.min(tooltip.x+10, width-91)} y={tooltip.y+5} fontSize={10} fill="#ef4444" fontWeight="bold">{tooltip.d.drawdown}%</text>
        </>
      )}
    </svg>
  );
}
