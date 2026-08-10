'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { yen } from '@/lib/format';

// 目盛りの刻み幅をキリの良い値（1 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 7.5 / 10 × 10^n）に丸める。
// 候補を細かめに用意して、データの最大値に関わらず常に10分割前後になるようにする。
function niceStep(rough) {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const r = rough / pow;
  const f = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find((c) => r <= c) || 10;
  return f * pow;
}

// データの最小・最大から明示的な目盛り列を作る。Recharts の自動目盛りは
// 系列の最大値によって4〜5分割程度に粗くなることがあるため、常に約10分割に固定する。
function buildTicks(data, series) {
  let min = 0;
  let max = 0;
  for (const d of data) {
    for (const s of series) {
      const v = d[s.key] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (max === min) max = min + 10000;
  const step = niceStep((max - min) / 10);
  const out = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 0.999; t += step) out.push(t);
  return out;
}

// 金額の目盛りラベル。1万未満の刻みでは小数（0.1万など）も出す。
function tickLabel(v) {
  const man = v / 10000;
  return `${man.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}万`;
}

// 推移タブ用の折れ線グラフ。
//   data   … [{ label: '25/8', fullLabel: '2025年8月', <系列名>: 金額, ... }, ...]
//   series … [{ key: '食費', color: '#f5c5ab' }, ...]
// 凡例クリックで系列の表示/非表示を切り替えられる。住宅設備のように突出した系列を
// 一時的に隠すと、Y軸が残りの系列の範囲で細かく引き直され、小さな動きも読み取れる。
export default function TrendLineChart({ data, series }) {
  const [hidden, setHidden] = useState(() => new Set());

  if (!data || data.length === 0 || !series || series.length === 0) {
    return <div className="empty">表示できるデータがありません。</div>;
  }

  const visibleSeries = series.filter((s) => !hidden.has(s.key));
  // 全て隠すと軸が作れないため、その場合は全系列でスケールを出す。
  const ticks = buildTicks(data, visibleSeries.length > 0 ? visibleSeries : series);

  // 収支のようにマイナスへ振れる系列があるときだけ0円の基準線を引く。
  const hasNegative = data.some((d) => visibleSeries.some((s) => (d[s.key] || 0) < 0));

  function toggle(entry) {
    const key = entry?.dataKey ?? entry?.value;
    if (!key) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={12} tickLine={false} />
          <YAxis
            fontSize={12}
            width={64}
            tickLine={false}
            ticks={ticks}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            tickFormatter={tickLabel}
            allowDataOverflow
          />
          {hasNegative && <ReferenceLine y={0} stroke="#9aa1ab" />}
          <Tooltip
            formatter={(value, name) => [yen(value), name]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
          />
          <Legend
            onClick={toggle}
            formatter={(value) => (
              <span
                style={{
                  cursor: 'pointer',
                  color: hidden.has(value) ? '#b0b7c3' : undefined,
                  textDecoration: hidden.has(value) ? 'line-through' : undefined,
                }}
              >
                {value}
              </span>
            )}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
              hide={hidden.has(s.key)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
