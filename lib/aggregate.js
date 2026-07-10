// ============================================================================
// 保存済み明細から、指定月の集計値を都度計算する。
// ============================================================================

import { MAJOR_CATEGORIES, UNMAPPED } from './mapping.js';

// "2026-06-01" -> "2026-06"
export function monthOf(dateStr) {
  return (dateStr || '').slice(0, 7);
}

// 明細全体に含まれる月の一覧（新しい順）。
export function listMonths(transactions) {
  const set = new Set();
  for (const t of transactions) {
    const m = monthOf(t.date);
    if (m) set.add(m);
  }
  return Array.from(set).sort().reverse();
}

// 指定月の集計。month が falsy なら全明細を対象にする。
export function aggregate(transactions, month) {
  const rows = transactions.filter((t) => {
    if (!t.included) return false; // 「集計に含めない」等は除外
    if (!month) return true;
    return monthOf(t.date) === month;
  });

  let income = 0;
  let expense = 0;
  let investment = 0;

  // 大分類ごとの支出（円グラフ用）。5大分類 + 未分類。
  const majorTotals = {};
  for (const c of MAJOR_CATEGORIES) majorTotals[c] = 0;
  majorTotals[UNMAPPED] = 0;

  // 小分類ごとの内訳（表用）。key: "大分類|小分類"
  const minorTotals = new Map();

  let unmappedCount = 0;

  for (const t of rows) {
    if (t.type === 'income') {
      income += t.amount;
      continue;
    }
    if (t.type === 'investment') {
      investment += t.amount;
      continue;
    }
    // expense
    expense += t.amount;
    const major = majorTotals[t.major] != null ? t.major : UNMAPPED;
    majorTotals[major] += t.amount;
    if (!t.matched) unmappedCount += 1;

    const key = `${t.major}|${t.minor}`;
    const cur = minorTotals.get(key) || { major: t.major, minor: t.minor, amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    minorTotals.set(key, cur);
  }

  const netBalance = income - expense; // 収支 = 収入 − 支出（投資は含めない）
  const savingsRate = income ? netBalance / income : 0; // 暫定貯蓄率
  const investmentRate = income ? investment / income : 0; // 投資比率
  const cashSavingsRate = savingsRate - investmentRate; // 現金貯蓄率

  // 円グラフ用データ（0のスライスは除外）。
  const pie = Object.entries(majorTotals)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);

  // 小分類表（大分類グループの合計の降順 → グループ内は金額の降順）。
  const minorRows = Array.from(minorTotals.values()).sort((a, b) => {
    const ma = majorTotals[a.major] ?? 0;
    const mb = majorTotals[b.major] ?? 0;
    if (ma !== mb) return mb - ma;
    if (a.major !== b.major) return a.major < b.major ? -1 : 1;
    return b.amount - a.amount;
  });

  const unmapped = {
    count: unmappedCount,
    amount: majorTotals[UNMAPPED],
  };

  return {
    month: month || 'all',
    income,
    expense,
    investment,
    netBalance,
    savingsRate,
    investmentRate,
    cashSavingsRate,
    majorTotals,
    pie,
    minorRows,
    unmapped,
    txCount: rows.length,
  };
}
