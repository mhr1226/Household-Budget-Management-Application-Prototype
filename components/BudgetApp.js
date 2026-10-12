'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { listMonths, aggregate } from '@/lib/aggregate';
import { aggregateExcess, listYears, monthsOfYear } from '@/lib/excess';
import { periodLabel, yen } from '@/lib/format';
import CsvImport from './CsvImport';
import SummaryCards from './SummaryCards';
import MinorBreakdownTable from './MinorBreakdownTable';
import ReflectionEditor from './ReflectionEditor';
import DetailTab from './DetailTab';
import BudgetTab from './BudgetTab';
import CompareTab from './CompareTab';
import TrendTab from './TrendTab';
import Placeholder from './Placeholder';

// Recharts（依存の中で最も重いライブラリ）を初期バンドルから切り離し、
// 円グラフ部分だけ後から読み込む。グラフはブラウザ描画専用なのでSSRも切る。
const ExpensePieChart = dynamic(() => import('./ExpensePieChart'), {
  ssr: false,
  loading: () => <div className="empty">グラフを読み込み中…</div>,
});

const TABS = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'detail', label: '明細' },
  { key: 'review', label: '分析' },
  { key: 'compare', label: '比較' },
  { key: 'trend', label: '推移' },
  { key: 'budget', label: '予算' },
];

// 初期データはサーバーコンポーネント（app/page.js）がファイルから直接読んで渡してくる。
// マウント後のfetchを待たずに最初の描画から集計結果を出せる。
export default function BudgetApp({ initialTransactions = [], initialReflections = {} }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [reflections, setReflections] = useState(initialReflections);
  // 期間の選択状態はダッシュボードと明細タブで共有する（タブを移動しても同じ期間を見続けられる）。
  const [periodMode, setPeriodMode] = useState('month'); // 'month' | 'year' | 'all'
  const [selectedMonth, setSelectedMonth] = useState(
    () => listMonths(initialTransactions)[0] || ''
  );
  const [selectedYear, setSelectedYear] = useState('');
  const [tab, setTab] = useState('dashboard');
  // 明細タブの大分類フィルタ。円グラフのスライスをクリックしたときに
  // その分類で絞り込んだ状態で明細タブへ飛べるよう、ここで持つ。
  const [detailMajor, setDetailMajor] = useState('all');

  // 円グラフのスライスをクリック → その大分類で絞った明細タブを開く。
  function jumpToDetail(majorName) {
    setDetailMajor(majorName);
    setTab('detail');
  }

  // CSV取込・月削除の後にサーバーの最新状態を取り直す。
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
  }

  const months = useMemo(() => listMonths(transactions), [transactions]);
  const years = useMemo(() => listYears(transactions), [transactions]);
  const activeYear = selectedYear || years[0] || '';

  // 集計に使う期間（"2026-06" / "2026" / '' = 全期間）。日付の前方一致で絞る。
  const period =
    periodMode === 'year' ? activeYear : periodMode === 'all' ? '' : selectedMonth;
  // 超過支出の集計に使う月の配列。
  const periodMonths = useMemo(() => {
    if (periodMode === 'year') return activeYear ? monthsOfYear(activeYear) : [];
    if (periodMode === 'all') return months;
    return selectedMonth ? [selectedMonth] : [];
  }, [periodMode, activeYear, selectedMonth, months]);
  const periodTitle = periodLabel(period);

  // 月次選択は「年」と「月」の2段階に分ける（古い月まで1つのリストでスクロールさせない）。
  const monthYear = selectedMonth.slice(0, 4);
  const monthsInYear = useMemo(
    () => months.filter((m) => m.startsWith(monthYear)),
    [months, monthYear]
  );
  // 年を切り替えたら、同じ「月」がその年にあればそれを、なければその年の最新月を選ぶ。
  function changeMonthYear(y) {
    const candidates = months.filter((m) => m.startsWith(y));
    const same = `${y}-${selectedMonth.slice(5)}`;
    setSelectedMonth(candidates.includes(same) ? same : candidates[0] || '');
  }

  const summary = useMemo(() => aggregate(transactions, period), [transactions, period]);
  // ダッシュボードに出す選択期間の超過支出（合計・件数）。
  const periodExcess = useMemo(
    () => aggregateExcess(reflections, periodMonths),
    [reflections, periodMonths]
  );

  // 反省エディタで「対象の明細」として選べる、選択月の集計対象の支出。
  const monthExpenses = useMemo(
    () =>
      selectedMonth
        ? transactions.filter(
            (t) => t.included && t.type === 'expense' && (t.date || '').startsWith(selectedMonth)
          )
        : [],
    [transactions, selectedMonth]
  );

  // 期間セレクタ（月次/年次/全期間）。ダッシュボードと明細タブで同じ状態を共有する。
  const periodSelector = (
    <>
      <label className="field">
        期間
        <div className="seg">
          <button
            className={periodMode === 'month' ? 'active' : ''}
            onClick={() => setPeriodMode('month')}
          >
            月次
          </button>
          <button
            className={periodMode === 'year' ? 'active' : ''}
            onClick={() => setPeriodMode('year')}
          >
            年次
          </button>
          <button
            className={periodMode === 'all' ? 'active' : ''}
            onClick={() => setPeriodMode('all')}
          >
            全期間
          </button>
        </div>
      </label>
      {periodMode === 'month' && (
        <>
          <label className="field">
            対象年
            <select
              value={monthYear}
              onChange={(e) => changeMonthYear(e.target.value)}
              disabled={years.length === 0}
            >
              {years.length === 0 && <option value="">データなし</option>}
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            対象月
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={monthsInYear.length === 0}
            >
              {monthsInYear.length === 0 && <option value="">データなし</option>}
              {monthsInYear.map((m) => (
                <option key={m} value={m}>
                  {Number(m.slice(5))}月
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {periodMode === 'year' && (
        <label className="field">
          対象年
          <select
            value={activeYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            disabled={years.length === 0}
          >
            {years.length === 0 && <option value="">データなし</option>}
            {years.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </label>
      )}
    </>
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
            {t.key === 'budget' && <span className="badge">準備中</span>}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <>
          <div className="panel">
            <div className="toolbar">
              {periodSelector}
              <CsvImport
                transactions={transactions}
                month={periodMode === 'month' ? selectedMonth : ''}
                onImported={loadAll}
              />
            </div>
          </div>

          {transactions.length === 0 ? (
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
                  <p className="hint">
                    投資は支出に含めず別集計しています。スライスをクリックするとその分類の明細に飛べます。
                  </p>
                  <ExpensePieChart
                    data={summary.pie}
                    total={summary.expense}
                    onSelectMajor={jumpToDetail}
                  />
                </div>
                <div className="panel">
                  <h2>小分類の内訳</h2>
                  <MinorBreakdownTable summary={summary} />
                </div>
              </div>
              <div className="panel excess-summary">
                <div className="excess-summary-main">
                  <span className="label">超過支出（{periodTitle}）</span>
                  <span className="value expense">{yen(periodExcess.total)}</span>
                  <span className="sub">{periodExcess.entries.length} 件</span>
                </div>
                <p className="hint" style={{ margin: 0 }}>
                  反省で「超過（無駄）」と記録した金額の合計です。内訳は「分析」タブで確認できます。
                </p>
              </div>
              {periodMode === 'month' ? (
                <ReflectionEditor
                  // 月を切り替えたら入力途中のフォーム（選択中の明細など）は持ち越さない。
                  key={selectedMonth}
                  month={selectedMonth}
                  transactions={monthExpenses}
                  entries={reflections[selectedMonth] || []}
                  onChange={(updated) => setReflections(updated)}
                />
              ) : (
                <div className="panel">
                  <p className="hint" style={{ margin: 0 }}>
                    反省の記録・編集は月次表示のときに行えます。期間を「月次」に切り替えてください。
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'detail' && (
        <DetailTab
          transactions={transactions}
          period={period}
          periodSelector={periodSelector}
          major={detailMajor}
          onMajorChange={setDetailMajor}
        />
      )}
      {tab === 'review' && (
        <BudgetTab
          transactions={transactions}
          reflections={reflections}
          months={months}
          defaultMonth={selectedMonth}
        />
      )}
      {tab === 'compare' && (
        <CompareTab
          transactions={transactions}
          reflections={reflections}
          months={months}
          defaultMonth={selectedMonth}
          defaultYear={activeYear}
          defaultMode={periodMode}
        />
      )}
      {tab === 'trend' && (
        <TrendTab transactions={transactions} reflections={reflections} months={months} />
      )}
      {tab === 'budget' && (
        <Placeholder
          title="予算タブ"
          desc="分類ごとの予算を設定し、実績と突き合わせる機能をここに作ります。"
        />
      )}
    </div>
  );
}
