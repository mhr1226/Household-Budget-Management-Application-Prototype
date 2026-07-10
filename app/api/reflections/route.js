import { NextResponse } from 'next/server';
import { getReflections, saveReflection } from '@/lib/storage';

// 全月の反省テキストを返す。 { "2026-06": "..." }
export async function GET() {
  const all = await getReflections();
  return NextResponse.json({ reflections: all });
}

// body: { month: "2026-06", text: "..." }
export async function POST(request) {
  const body = await request.json();
  const month = String(body?.month || '').trim();
  const text = String(body?.text ?? '');
  if (!month) {
    return NextResponse.json({ ok: false, error: 'month is required' }, { status: 400 });
  }
  const all = await saveReflection(month, text);
  return NextResponse.json({ ok: true, reflections: all });
}
