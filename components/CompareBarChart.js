'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { yen } from '@/lib/format';

// 比較タブ用の大分類別グループ棒グラフ。比較元をグレー、比較先をアクセント色で並べる。
export default function CompareBarChart({ data, baseLabel, targetLabel }) {
  if (!data || data.length === 0) {
    return <div className="empty">支出データがありません。</div>;
  }

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" fontSize={12} tickLine={false} />
          <YAxis
            fontSize={12}
            width={56}
            tickLine={false}
            tickFormatter={(v) => `${(v / 10000).toLocaleString('ja-JP')}万`}
          />
          <Tooltip formatter={(value, name) => [yen(value), name]} />
          <Legend />
          <Bar dataKey="base" name={baseLabel} fill="#b3bac4" isAnimationActive={false} />
          <Bar dataKey="target" name={targetLabel} fill="#2f6fed" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
