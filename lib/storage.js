// ============================================================================
// データ保存（サーバ側）。DBは使わず /data のJSONファイルに蓄積する。
//  - transactions.json : 取引明細を1件ずつ格納した配列
//  - reflections.json  : { "2026-06": [ {id, category, reflection, improvement, createdAt}, ... ] }
//      月ごとに反省エントリを配列で蓄積する（カテゴリ・反省点・改善点付き）。
//      旧形式（月 → 文字列）は読み込み時に1件のエントリへ変換する。
// 個人利用・ローカル起動が前提。家計データは外部に送信しない。
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const TX_FILE = path.join(DATA_DIR, 'transactions.json');
const REFLECTION_FILE = path.join(DATA_DIR, 'reflections.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await ensureDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getTransactions() {
  return readJson(TX_FILE, []);
}

export async function saveTransactions(list) {
  await writeJson(TX_FILE, list);
}

// 月の値を「エントリ配列」へ正規化する。
//  - すでに配列 → そのまま
//  - 旧形式の文字列 → 反省点として1件のエントリに変換
function normalizeMonthEntries(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    return [
      {
        id: 'legacy-' + randomUUID(),
        category: 'メモ',
        reflection: val,
        improvement: '',
        createdAt: null, // 旧データは登録日時が不明
      },
    ];
  }
  return [];
}

export async function getReflections() {
  const all = await readJson(REFLECTION_FILE, {});
  const out = {};
  for (const [month, val] of Object.entries(all)) {
    out[month] = normalizeMonthEntries(val);
  }
  return out;
}

// 反省エントリを1件追加する。返り値は全月の反省。
export async function addReflectionEntry(month, entry) {
  const all = await getReflections(); // 正規化済み
  const list = all[month] || [];
  const newEntry = {
    id: randomUUID(),
    category: entry.category || '',
    reflection: entry.reflection || '',
    improvement: entry.improvement || '',
    createdAt: new Date().toISOString(),
  };
  all[month] = [...list, newEntry];
  await writeJson(REFLECTION_FILE, all);
  return all;
}

// 反省エントリを1件削除する。
export async function deleteReflectionEntry(month, id) {
  const all = await getReflections();
  if (all[month]) {
    all[month] = all[month].filter((e) => e.id !== id);
  }
  await writeJson(REFLECTION_FILE, all);
  return all;
}
