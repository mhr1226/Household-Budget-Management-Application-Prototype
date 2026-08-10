'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { MAJOR_COLORS } from '@/lib/mapping';
import { yen } from '@/lib/format';

const RADIAN = Math.PI / 180;

// 構成比のラベル。大きめのスライスは内側（ドーナツの帯の中央）に、
// 帯に収まらない小さなスライスは外側のすぐ脇に描き、すべてのスライスで数字を出す。
// 分類名は凡例（Legend）、金額は hover 時のツールチップで確認できる。
function renderPercentLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  const inside = percent >= 0.05; // 5%未満は帯の中に収まらないため外側に出す
  const r = inside ? innerRadius + (outerRadius - innerRadius) * 0.5 : outerRadius + 12;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  const pct = percent * 100;
  return (
    <text
      x={x}
      y={y}
      fill="#1f2933"
      fontSize={12}
      fontWeight={600}
      textAnchor={inside ? 'middle' : x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      {pct >= 1 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`}
    </text>
  );
}

// onSelectMajor: スライス（大分類）クリック時に分類名を渡すコールバック。明細タブへの遷移に使う。
export default function ExpensePieChart({ data, total, onSelectMajor }) {
  if (!data || data.length === 0) {
    return <div className="empty">支出データがありません。</div>;
  }

  return (
    <div style={{ width: '100%', height: 400, padding: '8px 4px' }}>
      <ResponsiveContainer height={360}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            // 半径は割合指定にして、コンテナ幅の測定誤差があってもドーナツが枠内に収まるようにする。
            // 外側ラベルの分だけ少し内側に収める。
            innerRadius="42%"
            outerRadius="68%"
            paddingAngle={1}
            label={renderPercentLabel}
            labelLine={false}
            isAnimationActive={false}
            onClick={(d) => {
              const name = d?.name ?? d?.payload?.name;
              if (name) onSelectMajor?.(name);
            }}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={MAJOR_COLORS[d.name] || '#999'} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [yen(value), name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 15, padding: '10px 0 4px' }}>
        支出合計 {yen(total)}
      </div>
    </div>
  );
}
