import { NextResponse } from 'next/server';
import {
  getReflections,
  addReflectionEntry,
  updateReflectionEntry,
  deleteReflectionEntry,
} from '@/lib/storage';
import { EXCESS_REASONS } from '@/lib/mapping';

// 入力エントリを検証して整形する。問題があれば { error } を返す。
// 反省点・改善点は必須。超過支出フラグが立っているときは金額（1以上の整数）と
// 理由タグ（EXCESS_REASONS のいずれか）も必須にする。
function parseEntry(entry) {
  const major = String(entry?.major || '').trim();
  const minor = String(entry?.minor || '').trim();
  const reflection = String(entry?.reflection ?? '').trim();
  const improvement = String(entry?.improvement ?? '').trim();
  const itemName = String(entry?.itemName ?? '').trim(); // 品名（任意）
  const isExcess = entry?.isExcess === true;

  if (!major) return { error: 'カテゴリ（大分類）を選択してください' };
  if (!reflection) return { error: '反省点を入力してください' };
  if (!improvement) return { error: '改善点を入力してください' };

  // 超過でなければ金額・理由は保存しない（0 と空文字に正規化する）。
  let excessAmount = 0;
  let excessReason = '';
  if (isExcess) {
    const amount = Number(entry?.excessAmount);
    // 0・負数・小数・非数はすべて弾く（1以上の整数のみ許可）。
    if (!Number.isInteger(amount) || amount < 1) {
      return { error: '超過額は1以上の整数で入力してください' };
    }
    excessAmount = amount;
    excessReason = String(entry?.excessReason ?? '').trim();
    if (!EXCESS_REASONS.includes(excessReason)) {
      return { error: '超過の理由タグを選択してください' };
    }
  }

  return {
    value: { major, minor, isExcess, excessAmount, excessReason, itemName, reflection, improvement },
  };
}

// 全月の反省を返す。
export async function GET() {
  const all = await getReflections();
  return NextResponse.json({ reflections: all });
}

// 反省エントリを1件追加する。
// body: { month, entry: { major, minor, reflection, improvement, result } }
export async function POST(request) {
  const body = await request.json();
  const month = String(body?.month || '').trim();
  if (!month) {
    return NextResponse.json({ ok: false, error: 'month is required' }, { status: 400 });
  }
  const parsed = parseEntry(body?.entry);
  if (parsed.error) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const all = await addReflectionEntry(month, parsed.value);
  return NextResponse.json({ ok: true, reflections: all });
}

// 反省エントリを1件更新する（編集）。
// body: { month, id, entry: { ... } }
export async function PUT(request) {
  const body = await request.json();
  const month = String(body?.month || '').trim();
  const id = String(body?.id || '').trim();
  if (!month || !id) {
    return NextResponse.json({ ok: false, error: 'month and id are required' }, { status: 400 });
  }
  const parsed = parseEntry(body?.entry);
  if (parsed.error) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const all = await updateReflectionEntry(month, id, parsed.value);
  return NextResponse.json({ ok: true, reflections: all });
}

// 反省エントリを1件削除する。
// body: { month, id }
export async function DELETE(request) {
  const body = await request.json();
  const month = String(body?.month || '').trim();
  const id = String(body?.id || '').trim();
  if (!month || !id) {
    return NextResponse.json({ ok: false, error: 'month and id are required' }, { status: 400 });
  }
  const all = await deleteReflectionEntry(month, id);
  return NextResponse.json({ ok: true, reflections: all });
}
