// サンプル(6月分)を data/transactions.json に書き込むシード用スクリプト。
//   node scripts/seed-june.mjs
// アプリ起動直後に動作確認できるようにするためのもの。UIの「全消去」で消せる。
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { transformZaim, transformMf, mergeTransactions } from '../lib/transform.js';

const zaimPath = process.argv[2] || 'C:/Users/user/Downloads/Zaim.2026.6月分.csv';
const mfPath = process.argv[3] || 'C:/Users/user/Downloads/moneyFoward.2026.6月分.csv';

function readSjis(p) {
  return new TextDecoder('shift_jis').decode(fs.readFileSync(p));
}
function parse(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() }).data;
}

const all = mergeTransactions(
  [],
  transformZaim(parse(readSjis(zaimPath))).concat(transformMf(parse(readSjis(mfPath))))
);

const out = path.join(process.cwd(), 'data', 'transactions.json');
fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf-8');
console.log(`seeded ${all.length} transactions -> ${out}`);
