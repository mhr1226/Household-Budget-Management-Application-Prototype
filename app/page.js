import BudgetApp from '@/components/BudgetApp';
import { getTransactions, getReflections } from '@/lib/storage';

// data/ 配下のJSONは起動後も更新されるため、ビルド時の静的化を禁止して
// リクエストごとに最新のファイルを読む（これがないと本番ビルドに古いデータが焼き込まれる）。
export const dynamic = 'force-dynamic';

// サーバー側で初期データを読み込んで渡す。
// クライアントで「ハイドレーション完了 → fetch開始」と直列に待つ往復をなくし、初回表示を速くする。
export default async function Home() {
  const [transactions, reflections] = await Promise.all([getTransactions(), getReflections()]);
  return <BudgetApp initialTransactions={transactions} initialReflections={reflections} />;
}
