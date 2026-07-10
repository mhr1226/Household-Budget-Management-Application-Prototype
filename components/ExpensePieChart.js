'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { MAJOR_COLORS } from '@/lib/mapping';
import { yen } from '@/lib/format';

const RADIAN = Math.PI / 180;

// スライスの内側（ドーナツの帯の中央）に構成比を描く。
// 外側ラベルは列幅が狭いと見切れたり hover 時に隠れたりするため、内側に置く。
// 分類名は凡例（Legend）、金額は hover 時のツールチップで確認できる。
function renderInnerLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null; // 小さすぎるスライスは省略（内訳表で確認できる）
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#1f2933"
      fontSize={12}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export default function ExpensePieChart({ data, total }) {
  if (!data || data.length === 0) {
    return <div className="empty">支出データがありません。</div>;
  }

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            // 半径は割合指定にして、コンテナ幅の測定誤差があってもドーナツが枠内に収まるようにする。
            innerRadius="45%"
            outerRadius="72%"
            paddingAngle={1}
            label={renderInnerLabel}
            labelLine={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={MAJOR_COLORS[d.name] || '#999'} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [yen(value), name]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
        支出合計 {yen(total)}
      </div>
    </div>
  );
}
