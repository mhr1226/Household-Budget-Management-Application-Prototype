// ============================================================================
// CSVのパース結果（オブジェクトの配列）→ 保存用の取引明細（1件ずつ）に変換する。
//
// 設計方針（指示書より）: 月ごとの合計ではなく、各取引を1行ずつ全部保存する。
// 集計は保存済み明細から都度計算する（aggregate.js）。
// ============================================================================

import { classifyZaim, classifyMf } from './mapping.js';

// 数値化（カンマや空白を除去）。空・非数値は 0。
function toNumber(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// "2026/06/29" や "2026-6-1" を "2026-06-01" に正規化。
function normalizeDate(raw) {
  if (!raw) return '';
  const m = String(raw).trim().match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return String(raw).trim();
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// 明細の重複防止キーを作る。
//  - MoneyForward: 一意な ID があるのでそれを使う。
//  - Zaim: IDが無いので内容から合成。同一内容の行が複数あっても潰さないよう
//          取り込み内での連番(dupIndex)を付ける。同じファイルを再取込しても
//          同じキーになるので二重登録されない。
function zaimKey(t, dupIndex) {
  return `zaim|${t.date}|${t.originalCategory}|${t.amount}|${t.store}|${t.item}|#${dupIndex}`;
}

// ----------------------------------------------------------------------------
// Zaim
// ヘッダ: 日付,方法,カテゴリ,カテゴリの内訳,支払元,入金先,品目,メモ,お店,通貨,
//         収入,支出,振替,残高調整,通貨変換前の金額,集計の設定
// ----------------------------------------------------------------------------
export function transformZaim(rows) {
  const out = [];
  const seen = new Map(); // content-key -> 出現回数（連番付与用）

  for (const r of rows) {
    const method = (r['方法'] || '').trim(); // payment / income / transfer / balance
    // 振替（口座間移動）と残高調整は取引ではないので取り込まない。
    if (method === 'transfer' || method === 'balance') continue;

    const income = toNumber(r['収入']);
    const expense = toNumber(r['支出']);
    // 収入・支出が別カラム。0でない方がその行の金額。
    let type;
    let amount;
    if (method === 'income' || (income !== 0 && expense === 0)) {
      type = 'income';
      amount = income;
    } else {
      type = 'expense';
      amount = expense; // 割引・ポイントは負値のまま保持（同一カテゴリを相殺する）
    }
    if (amount === 0) continue;

    const category = (r['カテゴリ'] || '').trim();
    const subCategory = (r['カテゴリの内訳'] || '').trim();
    const c = classifyZaim(type, category, subCategory);

    // 集計の設定: 「集計に含めない」の行は保存はするが集計から外す。
    // （クレジットの一括支払い・チャージ・利息など。MF側と二重計上しないため）
    const setting = (r['集計の設定'] || '').trim();
    const included = setting !== '集計に含めない';

    const base = {
      date: normalizeDate(r['日付']),
      amount,
      type: c.type,
      source: 'zaim',
      store: (r['お店'] || '').trim(), // 店名 = お店
      // 内容 = 品目（未記載なら手入力のメモを流用。漏れはそのまま空欄で可）
      item: (r['品目'] || '').trim() || (r['メモ'] || '').trim(),
      originalCategory: `${category}/${subCategory}`,
      major: c.major,
      minor: c.minor,
      matched: c.matched,
      included,
      aggregationSetting: setting,
      memo: (r['メモ'] || '').trim(),
    };

    const ck = `${base.date}|${base.originalCategory}|${base.amount}|${base.store}|${base.item}`;
    const dupIndex = (seen.get(ck) || 0) + 1;
    seen.set(ck, dupIndex);
    base.id = zaimKey(base, dupIndex);
    out.push(base);
  }
  return out;
}

// ----------------------------------------------------------------------------
// MoneyForward
// ヘッダ: 計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID
// ----------------------------------------------------------------------------
export function transformMf(rows) {
  const out = [];
  for (const r of rows) {
    // 振替(=1)の行は口座間移動なので集計から除外。
    if ((r['振替'] || '').trim() === '1') continue;

    const raw = toNumber(r['金額（円）']);
    if (raw === 0) continue;
    // 符号で判定: マイナス=支出 / プラス=収入。金額は正の数で保持。
    const type = raw < 0 ? 'expense' : 'income';
    const amount = Math.abs(raw);

    const major = (r['大項目'] || '').trim();
    const minor = (r['中項目'] || '').trim();
    const c = classifyMf(type, major, minor);

    out.push({
      id: `mf|${(r['ID'] || '').trim()}`,
      date: normalizeDate(r['日付']),
      amount,
      type: c.type,
      source: 'moneyforward',
      store: (r['内容'] || '').trim(), // 店名 = 内容
      item: (r['メモ'] || '').trim(), // 内容 = メモ
      originalCategory: `${major}/${minor}`,
      major: c.major,
      minor: c.minor,
      matched: c.matched,
      included: true, // MFは計算対象=1の実支出/収入のみ想定
      aggregationSetting: '',
      memo: (r['メモ'] || '').trim(),
    });
  }
  return out;
}

// 既存明細と新規明細を id で重複排除してマージ（新しい方で上書き）。
export function mergeTransactions(existing, incoming) {
  const byId = new Map();
  for (const t of existing) byId.set(t.id, t);
  for (const t of incoming) byId.set(t.id, t);
  return Array.from(byId.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
