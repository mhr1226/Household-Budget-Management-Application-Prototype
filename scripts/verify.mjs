// data/transactions.json を読み、月ごとに集計結果を出力する。
//   node scripts/verify.mjs
import fs from 'fs';
import path from 'path';
import { aggregate, listMonths } from '../lib/aggregate.js';
import { yen, percent } from '../lib/format.js';

const file = path.join(process.cwd(), 'data', 'transactions.json');
const all = JSON.parse(fs.readFileSync(file, 'utf-8'));
const months = listMonths(all).sort();

for (const m of months) {
  const s = aggregate(all, m);
  console.log(`\n========== ${m} ==========`);
  console.log('収入        :', yen(s.income));
  console.log('支出(投資除):', yen(s.expense));
  console.log('投資        :', yen(s.investment));
  console.log('収支        :', yen(s.netBalance));
  console.log('暫定貯蓄率  :', percent(s.savingsRate), ' / 現金貯蓄率:', percent(s.cashSavingsRate));
  console.log('-- 大分類別 --');
  for (const [k, v] of Object.entries(s.majorTotals)) if (v !== 0) console.log('  ', k.padEnd(6), yen(v));
  if (s.unmapped.count > 0) {
    console.log('  ⚠ 未分類:', s.unmapped.count, '件 /', yen(s.unmapped.amount));
  } else {
    console.log('  未分類: 0件');
  }
}
