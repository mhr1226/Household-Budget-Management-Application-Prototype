import { NextResponse } from 'next/server';
import { getReflections, addReflectionEntry, deleteReflectionEntry } from '@/lib/storage';

// 全月の反省を返す。 { "2026-06": [ {id, category, reflection, improvement, createdAt}, ... ] }
export async function GET() {
  const all = await getReflections();
  return NextResponse.json({ reflections: all });
}

// 反省エントリを1件追加する。
// body: { month: "2026-06", entry: { category, reflection, improvement } }
export async function POST(request) {
  const body = await request.json();
  const month = String(body?.month || '').trim();
  const entry = body?.entry || {};
  const category = String(entry.category || '').trim();
  const reflection = String(entry.reflection ?? '').trim();
  const improvement = String(entry.improvement ?? '').trim();

  if (!month) {
    return NextResponse.json({ ok: false, error: 'month is required' }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ ok: false, error: 'カテゴリを入力してください' }, { status: 400 });
  }
  if (!reflection && !improvement) {
    return NextResponse.json(
      { ok: false, error: '反省点か改善点のどちらかを入力してください' },
      { status: 400 }
    );
  }

  const all = await addReflectionEntry(month, { category, reflection, improvement });
  return NextResponse.json({ ok: true, reflections: all });
}

// 反省エントリを1件削除する。
// body: { month: "2026-06", id: "..." }
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
