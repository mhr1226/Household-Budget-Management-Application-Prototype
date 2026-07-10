'use client';

import { MAJOR_COLORS } from '@/lib/mapping';
import { yen, percent } from '@/lib/format';

export default function MinorBreakdownTable({ summary }) {
  const { minorRows, majorTotals, expense } = summary;
  if (!minorRows || minorRows.length === 0) {
    return <div className="empty">支出データがありません。</div>;
  }

  // 大分類ごとにグループ化して、大分類の見出し行 → 小分類行 の順で描画。
  const groups = [];
  const order = [];
  for (const row of minorRows) {
    if (!order.includes(row.major)) order.push(row.major);
  }
  for (const major of order) {
    groups.push({ major, rows: minorRows.filter((r) => r.major === major) });
  }

  return (
    <table className="breakdown">
      <thead>
        <tr>
          <th>分類</th>
          <th className="num">件数</th>
          <th className="num">金額</th>
          <th className="num">構成比</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <MajorGroup
            key={g.major}
            group={g}
            majorTotal={majorTotals[g.major] || 0}
            expense={expense}
          />
        ))}
      </tbody>
    </table>
  );
}

function MajorGroup({ group, majorTotal, expense }) {
  return (
    <>
      <tr className="major-row">
        <td>
          <span className="swatch" style={{ background: MAJOR_COLORS[group.major] || '#999' }} />
          {group.major}
        </td>
        <td className="num">{group.rows.reduce((s, r) => s + r.count, 0)}</td>
        <td className="num">{yen(majorTotal)}</td>
        <td className="num">{expense ? percent(majorTotal / expense) : '—'}</td>
      </tr>
      {group.rows.map((r) => (
        <tr key={`${r.major}|${r.minor}`}>
          <td style={{ paddingLeft: 24 }}>{r.minor}</td>
          <td className="num">{r.count}</td>
          <td className="num">{yen(r.amount)}</td>
          <td className="num">{expense ? percent(r.amount / expense) : '—'}</td>
        </tr>
      ))}
    </>
  );
}
