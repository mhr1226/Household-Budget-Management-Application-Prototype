import { NextResponse } from 'next/server';
import {
  getReflections,
  addReflectionEntry,
  updateReflectionEntry,
  deleteReflectionEntry,
} from '@/lib/storage';

// 入力エントリを検証して整形する。問題があれば { error } を返す。
function parseEntry(entry) {
  const major = String(entry?.major || '').trim();
  const minor = String(entry?.minor || '').trim();
  const reflection = String(entry?.reflection ?? '').trim();
  const improvement = String(entry?.improvement ?? '').trim();
  const result = String(entry?.result ?? '').trim();
  if (!major) return { error: 'カテゴリ（大分類）を選択してください' };
  if (!reflection && !improvement && !result) {
    return { error: '反省点・改善点・結果のいずれかを入力してください' };
  }
  return { value: { major, minor, reflection, improvement, result } };
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
