// ============================================================================
// データ保存（サーバ側）。DBは使わず /data のJSONファイルに蓄積する。
//  - transactions.json : 取引明細を1件ずつ格納した配列
//  - reflections.json  : { "2026-06": "反省テキスト", ... }
// 個人利用・ローカル起動が前提。家計データは外部に送信しない。
// ============================================================================

import { promises as fs } from 'fs';
import path from 'path';

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

export async function getReflections() {
  return readJson(REFLECTION_FILE, {});
}

export async function saveReflection(month, text) {
  const all = await getReflections();
  all[month] = text;
  await writeJson(REFLECTION_FILE, all);
  return all;
}
