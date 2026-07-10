'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { MAJOR_COLORS } from '@/lib/mapping';
import { yen } from '@/lib/format';

export default function ExpensePieChart({ data, total }) {
  if (!data || data.length === 0) {
    return <div className="empty">支出データがありません。</div>;
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={1}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={MAJOR_COLORS[d.name] || '#999'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [yen(value), name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
        支出合計 {yen(total)}
      </div>
    </div>
  );
}
