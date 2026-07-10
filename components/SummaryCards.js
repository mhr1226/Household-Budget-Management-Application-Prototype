'use client';

import { yen, percent } from '@/lib/format';

export default function SummaryCards({ summary }) {
  const netClass = summary.netBalance >= 0 ? 'pos' : 'neg';
  return (
    <div className="cards">
      <div className="card">
        <div className="label">収入</div>
        <div className="value income">{yen(summary.income)}</div>
      </div>
      <div className="card">
        <div className="label">支出（投資除く）</div>
        <div className="value expense">{yen(summary.expense)}</div>
        <div className="sub">投資: {yen(summary.investment)}</div>
      </div>
      <div className="card">
        <div className="label">収支</div>
        <div className={`value ${netClass}`}>{yen(summary.netBalance)}</div>
        <div className="sub">収入 − 支出</div>
      </div>
      <div className="card">
        <div className="label">貯蓄率</div>
        <div className={`value ${netClass}`}>{percent(summary.savingsRate)}</div>
        <div className="sub">
          現金貯蓄率 {percent(summary.cashSavingsRate)}（投資比率 {percent(summary.investmentRate)}）
        </div>
      </div>
    </div>
  );
}
