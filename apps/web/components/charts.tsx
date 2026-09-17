'use client';
import { useId, useState } from 'react';
import { evaluation, farmer, money, shortDate } from '../lib/demo';
export function CashChart({
  comparison = false,
  compact = false,
  history = false,
}: {
  comparison?: boolean;
  compact?: boolean;
  history?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replaceAll(':', '');
  const rows = evaluation.plans[2].ledger;
  const values = history
    ? farmer.history.slice(-26).map((r) => r.incomePaise)
    : rows.map((r) => r.closingCashPaise);
  const secondary = history
    ? farmer.history.slice(-26).map((r) => r.essentialsPaise)
    : evaluation.plans[0].ledger.map((r) => r.closingCashPaise);
  const max = history ? 600000 : 1500000;
  const W = 760,
    H = compact ? 210 : 255,
    L = 52,
    R = 12,
    T = 22,
    B = 30;
  const x = (i: number) => L + (i * (W - L - R)) / (values.length - 1),
    y = (v: number) => H - B - (v / max) * (H - T - B);
  const path = (v: number[]) => v.map((n, i) => `${i ? 'L' : 'M'}${x(i)},${y(n)}`).join(' ');
  return (
    <div className="cash-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          history
            ? 'Weekly synthetic income and essential expenses over the last 26 history weeks'
            : 'Saved weekly closing cash: seasonal plan compared with fixed weekly plan'
        }
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3c806c" stopOpacity=".2" />
            <stop offset="100%" stopColor="#3c806c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1={L}
              x2={W - R}
              y1={y((i * max) / 3)}
              y2={y((i * max) / 3)}
              stroke="#e9ece7"
              strokeDasharray={i ? '3 5' : ''}
            />
            <text x={0} y={y((i * max) / 3) + 4} className="chart-label">
              {i === 0 ? '₹0' : `₹${((i * max) / 3 / 100000).toFixed(0)}k`}
            </text>
          </g>
        ))}
        {!history && (
          <>
            <line
              x1={L}
              x2={W - R}
              y1={y(150000)}
              y2={y(150000)}
              stroke="#ba8c44"
              strokeDasharray="5 5"
            />
            <text x={W - R} y={y(150000) - 7} textAnchor="end" className="chart-label buffer-label">
              ₹1,500 protected buffer
            </text>
          </>
        )}
        <path d={`${path(values)} L${x(25)},${H - B} L${L},${H - B} Z`} fill={`url(#${gid})`} />
        {(comparison || history) && (
          <path
            d={path(secondary)}
            fill="none"
            stroke={history ? '#b29a75' : '#ba8264'}
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinejoin="round"
          />
        )}
        <path
          d={path(values)}
          fill="none"
          stroke="#327762"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {[0, 5, 10, 15, 20, 25].map((i) => (
          <text key={i} x={x(i)} y={H - 5} textAnchor="middle" className="chart-label">
            {history ? shortDate(farmer.history.slice(-26)[i].date) : shortDate(rows[i].date)}
          </text>
        ))}
        {values.map((_v, i) => (
          <rect
            key={i}
            x={x(i) - 12}
            y={T}
            width={24}
            height={H - B - T}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#9aafa4" />
            <circle
              cx={x(hover)}
              cy={y(values[hover])}
              r="5"
              fill="#327762"
              stroke="white"
              strokeWidth="3"
            />
            <rect
              x={Math.min(x(hover) - 50, W - 125)}
              y={T}
              width="120"
              height="28"
              rx="6"
              fill="#1d3d32"
            />
            <text
              x={Math.min(x(hover) + 10, W - 65)}
              y={T + 19}
              textAnchor="middle"
              fill="white"
              fontSize="12"
            >
              {money(values[hover])}
            </text>
          </g>
        )}
      </svg>
      <p className="chart-period">
        {history
          ? 'Synthetic income history · 16 Mar to 7 Sep 2026'
          : 'Saved projected cash · 14 Sep 2026 to 8 Mar 2027'}
      </p>
      <div className="chart-legend">
        <span>
          <i className="legend-line" />
          {history ? 'Income' : 'Seasonal surplus'}
        </span>
        {(comparison || history) && (
          <span>
            <i className="legend-line tan" />
            {history ? 'Essential expenses' : 'Fixed weekly'}
          </span>
        )}
        <span className="legend-note">
          {history ? 'Synthetic history · INR / week' : 'Saved v1 example · INR / week'}
        </span>
      </div>
    </div>
  );
}
export function Sparkline({ type = 'seasonal' }: { type?: string }) {
  const values =
    type === 'seasonal'
      ? [2, 2, 3, 2, 3, 15, 18, 16, 3, 2, 2, 4, 18, 20, 15]
      : type === 'irregular'
        ? [4, 15, 5, 18, 9, 5, 17, 8, 16, 4, 18, 8, 13, 5, 12]
        : [18, 17, 18, 16, 15, 12, 13, 10, 9, 7, 5, 7, 4, 3, 2];
  return (
    <svg viewBox="0 0 112 30" className={`sparkline ${type}`} aria-hidden="true">
      <path
        d={values.map((v, i) => `${i ? 'L' : 'M'}${i * 8},${28 - v}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function DominoArt() {
  return (
    <div className="domino-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="art-base" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`domino-tile tile-${i}`}>
          <span className="tile-half">
            <i />
            <i />
          </span>
          <span className="tile-half">
            <i />
            <i />
            <i />
          </span>
        </div>
      ))}
      <span className="art-caption">
        <i /> A better next step.
      </span>
    </div>
  );
}
