// 6月の実CSVを取り込み、集計結果をコンソールに出す検証スクリプト。
//   node scripts/verify-june.mjs "<Zaim.csv>" "<MoneyForward.csv>"
// 引数を省略すると既定のサンプルパスを使う。
import fs from 'fs';
import Papa from 'papaparse';
import { transformZaim, transformMf, mergeTransactions } from '../lib/transform.js';
import { aggregate } from '../lib/aggregate.js';
import { yen, percent } from '../lib/format.js';

const zaimPath =
  process.argv[2] || 'C:/Users/user/Downloads/Zaim.2026.6月分.csv';
const mfPath =
  process.argv[3] || 'C:/Users/user/Downloads/moneyFoward.2026.6月分.csv';

function readSjis(p) {
  const fd = fs.openSync(p, 'r');
  const buf = fs.readFileSync(fd);
  fs.closeSync(fd);
  return new TextDecoder('shift_jis').decode(buf);
}

function parse(text) {
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  }).data;
}

const zaimTx = transformZaim(parse(readSjis(zaimPath)));
const mfTx = transformMf(parse(readSjis(mfPath)));
const all = mergeTransactions([], zaimTx.concat(mfTx));

console.log(`取込: Zaim ${zaimTx.length}件 / MF ${mfTx.length}件 / 合計 ${all.length}件\n`);

const s = aggregate(all, '2026-06');

console.log('===== 2026年6月 サマリー =====');
console.log('収入        :', yen(s.income));
console.log('支出(投資除):', yen(s.expense));
console.log('投資        :', yen(s.investment));
console.log('収支        :', yen(s.netBalance));
console.log('暫定貯蓄率  :', percent(s.savingsRate));
console.log('投資比率    :', percent(s.investmentRate));
console.log('現金貯蓄率  :', percent(s.cashSavingsRate));

console.log('\n===== 大分類別 支出 =====');
for (const [k, v] of Object.entries(s.majorTotals)) {
  if (v !== 0) console.log(k.padEnd(6), yen(v));
}

console.log('\n===== 小分類別 支出 =====');
for (const r of s.minorRows) {
  console.log(`${r.major} / ${r.minor}`.padEnd(22), yen(r.amount).padStart(12), `(${r.count}件)`);
}

console.log('\n未分類:', s.unmapped.count, '件 /', yen(s.unmapped.amount));
