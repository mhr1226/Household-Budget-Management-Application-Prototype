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

// 1件のエントリを現行スキーマに正規化する。
//  現行: { id, major, minor, isExcess, excessAmount, excessReason, reflection, improvement, createdAt, updatedAt }
//  旧:   category / subCategory を major / minor として引き継ぐ。旧 result は破棄する。
//  超過フラグが立っていないエントリでは金額を 0・理由を空文字に落とす（不整合を残さない）。
function normalizeEntry(e) {
  const isExcess = e.isExcess === true;
  const amount = Number(e.excessAmount);
  return {
    id: e.id || randomUUID(),
    major: e.major ?? e.category ?? '',
    minor: e.minor ?? e.subCategory ?? '',
    isExcess,
    excessAmount: isExcess && Number.isInteger(amount) && amount > 0 ? amount : 0,
    excessReason: isExcess ? e.excessReason ?? '' : '',
    itemName: e.itemName ?? '', // 品名（任意）。超過支出の対象品などを記録する。
    reflection: e.reflection ?? '',
    improvement: e.improvement ?? '',
    createdAt: e.createdAt ?? null,
    updatedAt: e.updatedAt ?? null,
  };
}

// 月の値を「エントリ配列」へ正規化する。
//  - すでに配列 → 各要素を正規化
//  - 旧形式の文字列 → 反省点として1件のエントリに変換
function normalizeMonthEntries(val) {
  if (Array.isArray(val)) return val.map(normalizeEntry);
  if (typeof val === 'string' && val.trim()) {
    return [
      normalizeEntry({
        id: 'legacy-' + randomUUID(),
        major: 'メモ',
        reflection: val,
        createdAt: null, // 旧データは登録日時が不明
      }),
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
  const newEntry = normalizeEntry({
    id: randomUUID(),
    major: entry.major || '',
    minor: entry.minor || '',
    isExcess: entry.isExcess === true,
    excessAmount: entry.excessAmount || 0,
    excessReason: entry.excessReason || '',
    itemName: entry.itemName || '',
    reflection: entry.reflection || '',
    improvement: entry.improvement || '',
    createdAt: new Date().toISOString(),
  });
  all[month] = [...list, newEntry];
  await writeJson(REFLECTION_FILE, all);
  return all;
}

// 反省エントリを1件更新する（編集）。
export async function updateReflectionEntry(month, id, patch) {
  const all = await getReflections();
  const list = all[month] || [];
  // patch は API 側で検証済みの全フィールドが入ってくる前提。normalizeEntry を通して
  // 超過フラグと金額・理由の整合を取り直す（チェックを外した編集で 0/空文字へ戻す）。
  all[month] = list.map((e) =>
    e.id === id
      ? normalizeEntry({
          ...e,
          major: patch.major ?? e.major,
          minor: patch.minor ?? e.minor,
          isExcess: patch.isExcess,
          excessAmount: patch.excessAmount,
          excessReason: patch.excessReason,
          itemName: patch.itemName ?? e.itemName,
          reflection: patch.reflection ?? e.reflection,
          improvement: patch.improvement ?? e.improvement,
          updatedAt: new Date().toISOString(),
        })
      : e
  );
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
