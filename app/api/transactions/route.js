import { NextResponse } from 'next/server';
import { getTransactions, saveTransactions } from '@/lib/storage';
import { mergeTransactions } from '@/lib/transform';

// 保存済みの全明細を返す。
export async function GET() {
  const list = await getTransactions();
  return NextResponse.json({ transactions: list });
}

// クライアントで変換済みの明細配列を受け取り、id で重複排除して保存する。
// body: { transactions: [...] }
export async function POST(request) {
  const body = await request.json();
  const incoming = Array.isArray(body?.transactions) ? body.transactions : [];
  const existing = await getTransactions();
  const before = existing.length;
  const merged = mergeTransactions(existing, incoming);
  await saveTransactions(merged);
  return NextResponse.json({
    ok: true,
    added: merged.length - before,
    received: incoming.length,
    total: merged.length,
  });
}

// 全明細を削除（やり直し用）。
export async function DELETE() {
  await saveTransactions([]);
  return NextResponse.json({ ok: true, total: 0 });
}
