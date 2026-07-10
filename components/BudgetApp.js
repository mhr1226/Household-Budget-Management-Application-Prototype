'use client';

import { useEffect, useMemo, useState } from 'react';
import { listMonths, aggregate } from '@/lib/aggregate';
import { monthLabel } from '@/lib/format';
import CsvImport from './CsvImport';
import SummaryCards from './SummaryCards';
import ExpensePieChart from './ExpensePieChart';
import MinorBreakdownTable from './MinorBreakdownTable';
import ReflectionEditor from './ReflectionEditor';
import DetailTab from './DetailTab';
import Placeholder from './Placeholder';

const TABS = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'detail', label: '明細' },
  { key: 'budget', label: '予算' },
  { key: 'compare', label: '比較' },
];

export default function BudgetApp() {
  const [transactions, setTransactions] = useState([]);
  const [reflections, setReflections] = useState({});
  const [selectedMonth, setSelectedMonth] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [txRes, rfRes] = await Promise.all([
      fetch('/api/transactions').then((r) => r.json()),
      fetch('/api/reflections').then((r) => r.json()),
    ]);
    const tx = txRes.transactions || [];
    setTransactions(tx);
    setReflections(rfRes.reflections || {});
    setSelectedMonth((prev) => {
      const months = listMonths(tx);
      if (prev && months.includes(prev)) return prev;
      return months[0] || '';
    });
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const months = useMemo(() => listMonths(transactions), [transactions]);
  const summary = useMemo(
    () => aggregate(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>家計簿ダッシュボード</h1>
        <p>Zaim / MoneyForward の取引を統合し、月ごとに集計・可視化する（データは外部に送信しません）</p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {(t.key === 'budget' || t.key === 'compare') && <span className="badge">準備中</span>}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <>
          <div className="panel">
            <div className="toolbar">
              <label className="field">
                対象月
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={months.length === 0}
                >
                  {months.length === 0 && <option value="">データなし</option>}
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <CsvImport transactions={transactions} onImported={loadAll} />
            </div>
          </div>

          {loading ? (
            <div className="panel empty">読み込み中…</div>
          ) : transactions.length === 0 ? (
            <div className="panel empty">
              まだデータがありません。上の「CSV取込」から Zaim / MoneyForward の6月分CSVを取り込んでください。
            </div>
          ) : (
            <>
              <SummaryCards summary={summary} />
              {summary.unmapped.count > 0 && (
                <div className="warn">
                  ⚠️ マッピング未該当（未分類）の支出が <strong>{summary.unmapped.count}</strong> 件・
                  合計 <strong>¥{Math.round(summary.unmapped.amount).toLocaleString('ja-JP')}</strong> あります。
                  下の内訳表で内容を確認し、必要なら <code>lib/mapping.js</code> に追記してください。
                </div>
              )}
              <div className="grid-2">
                <div className="panel">
                  <h2>支出の内訳（大分類）</h2>
                  <p className="hint">投資は支出に含めず別集計しています。</p>
                  <ExpensePieChart data={summary.pie} total={summary.expense} />
                </div>
                <div className="panel">
                  <h2>小分類の内訳</h2>
                  <MinorBreakdownTable summary={summary} />
                </div>
              </div>
              <ReflectionEditor
                month={selectedMonth}
                entries={reflections[selectedMonth] || []}
                onChange={(updated) => setReflections(updated)}
              />
            </>
          )}
        </>
      )}

      {tab === 'detail' && (
        <DetailTab transactions={transactions} months={months} defaultMonth={selectedMonth} />
      )}
      {tab === 'budget' && (
        <Placeholder
          title="予算タブ（第2段階）"
          desc="各分類に月次予算を設定し、実績と対比します。"
        />
      )}
      {tab === 'compare' && (
        <Placeholder
          title="比較タブ（第2段階）"
          desc="前月・前年同月との推移を折れ線/棒グラフで表示します。"
        />
      )}
    </div>
  );
}
