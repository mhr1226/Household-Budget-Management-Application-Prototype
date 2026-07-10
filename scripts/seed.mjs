// 複数のCSV(Zaim/MoneyForward・複数月)を取り込み、data/transactions.json に書き込む。
//   node scripts/seed.mjs "<csv1>" "<csv2>" ...
// ヘッダで Zaim / MoneyForward を自動判別する。UIの「CSV取込」と同じ変換を通す。
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { transformZaim, transformMf, mergeTransactions } from '../lib/transform.js';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('使い方: node scripts/seed.mjs "<csv1>" "<csv2>" ...');
  process.exit(1);
}

function readSjis(p) {
  return new TextDecoder('shift_jis').decode(fs.readFileSync(p));
}
function parse(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() }).data;
}
function detect(rows) {
  const keys = Object.keys(rows[0] || {});
  if (keys.includes('カテゴリの内訳') && keys.includes('集計の設定')) return 'zaim';
  if (keys.includes('大項目') && keys.includes('保有金融機関')) return 'moneyforward';
  return null;
}

let all = [];
for (const f of files) {
  const rows = parse(readSjis(f));
  const src = detect(rows);
  let tx = [];
  if (src === 'zaim') tx = transformZaim(rows);
  else if (src === 'moneyforward') tx = transformMf(rows);
  else {
    console.warn(`判別不可、スキップ: ${f}`);
    continue;
  }
  all = mergeTransactions(all, tx);
  console.log(`${src.padEnd(12)} ${tx.length}件  <- ${path.basename(f)}`);
}

const out = path.join(process.cwd(), 'data', 'transactions.json');
fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf-8');
console.log(`\n合計 ${all.length}件 -> ${out}`);
