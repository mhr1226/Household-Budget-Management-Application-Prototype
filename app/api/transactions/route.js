import { NextResponse } from 'next/server';
import { getTransactions, saveTransactions } from '@/lib/storage';
import { mergeTransactions } from '@/lib/transform';

// 保存済みの全明細を返す。
export async function GET() {
  const list = await getTransactions();
  return NextResponse.json({ transactions: list });
}

// クライアントで変換済みの明細配列を受け取り、重複排除して保存する。
// 既存と同一とみなされた取引は新規（新しく取り込んだ方）で上書きされる。
// body: { transactions: [...] }
export async function POST(request) {
  const body = await request.json();
  const incoming = Array.isArray(body?.transactions) ? body.transactions : [];
  const existing = await getTransactions();
  const before = existing.length;
  const merged = mergeTransactions(existing, incoming);
  await saveTransactions(merged);
  // 件数が増えなかった分＝既存を上書きした分。
  const added = merged.length - before;
  return NextResponse.json({
    ok: true,
    added,
    updated: incoming.length - added,
    received: incoming.length,
    total: merged.length,
  });
}

// 指定月の明細を削除（マッピング修正後の再取込などのやり直し用）。
// DELETE /api/transactions?month=2026-06
export async function DELETE(request) {
  const month = new URL(request.url).searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { ok: false, error: 'month（YYYY-MM）を指定してください。' },
      { status: 400 }
    );
  }
  const existing = await getTransactions();
  const remaining = existing.filter((t) => !(t.date || '').startsWith(month));
  await saveTransactions(remaining);
  return NextResponse.json({
    ok: true,
    deleted: existing.length - remaining.length,
    total: remaining.length,
  });
}
