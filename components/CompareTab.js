'use client';

import { Fragment, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { aggregate } from '@/lib/aggregate';
import { buildExcessComparison, listYears, monthsOfYear } from '@/lib/excess';
import { yen, periodLabel } from '@/lib/format';
import { MAJOR_COLORS } from '@/lib/mapping';

// 棒グラフ（Recharts）は初期バンドルから切り離して後読みする（円グラフと同じ方針）。
const CompareBarChart = dynamic(() => import('./CompareBarChart'), {
  ssr: false,
  loading: () => <div className="empty">グラフを読み込み中…</div>,
});

// 分類別比較で切り替えられる指標。名目=実支出 / 超過=無駄と記録した分 / 基準=名目−超過。
const METRICS = [
  { key: 'nominal', label: '名目支出' },
  { key: 'excess', label: '超過支出' },
  { key: 'baseline', label: '基準支出' },
];

// "2026-06" -> "2025-06" / "2026" -> "2025"。前年同期のデフォルト算出に使う。
function prevYearOf(period) {
  if (!period) return '';
  const y = String(Number(period.slice(0, 4)) - 1);
  return period.length > 4 ? `${y}${period.slice(4)}` : y;
}

// セレクタ選択肢にデータの無い期間（例: 前年同月が未取込）も出せるよう、
// 現在値がリストに無ければ加えて新しい順に並べ直す。
function withValue(list, v) {
  if (!v || list.includes(v)) return list;
  return [...list, v].sort().reverse();
}

// 差額の符号付き表示。"+¥1,234" / "−¥1,234" / "±¥0"
function signedYen(n) {
  const v = Math.round(n || 0);
  const s = v > 0 ? '+' : v < 0 ? '−' : '±';
  return `${s}¥${Math.abs(v).toLocaleString('ja-JP')}`;
}

// 増減率の符号付き表示。比較元が0のときは null を渡して "—" にする。
function signedPercent(r) {
  if (r == null) return '—';
  const s = r > 0 ? '+' : r < 0 ? '−' : '±';
  return `${s}${Math.abs(r * 100).toFixed(1)}%`;
}

// 増減の色分け。upIsGood=true なら増加を緑（収入など）、false なら増加を赤（支出など）。
function deltaClass(diff, upIsGood) {
  if (!diff) return '';
  return (diff > 0) === upIsGood ? 'delta-good' : 'delta-bad';
}

// buildExcessComparison の結果2期間分を、分類キーで {base, target} に統合する。
// 各サイドは { nominal, excess, baseline } を持つ。
function mergeComparison(baseRows, targetRows, level) {
  const keyOf = (r) => (level === 'minor' ? `${r.major}|${r.minor}` : r.major);
  const empty = () => ({ nominal: 0, excess: 0, baseline: 0 });
  const map = new Map();
  const ensure = (r) => {
    const key = keyOf(r);
    let b = map.get(key);
    if (!b) {
      b = { major: r.major, minor: r.minor, base: empty(), target: empty() };
      map.set(key, b);
    }
    return b;
  };
  for (const r of baseRows) {
    const b = ensure(r);
    b.base = { nominal: r.nominal, excess: r.excess, baseline: r.baseline };
  }
  for (const r of targetRows) {
    const b = ensure(r);
    b.target = { nominal: r.nominal, excess: r.excess, baseline: r.baseline };
  }
  return Array.from(map.values());
}

// 期間セレクタ1組（比較元／比較先で共用）。月次は「年＋月」の2段階で選ぶ。
function PeriodPicker({ legend, mode, month, year, months, years, onMonth, onYear }) {
  if (mode === 'year') {
    return (
      <label className="field">
        {legend}
        <select value={year} onChange={(e) => onYear(e.target.value)} disabled={years.length === 0}>
          {years.length === 0 && <option value="">データなし</option>}
          {withValue(years, year).map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </label>
    );
  }

  const monthYear = month.slice(0, 4);
  const monthsInYear = withValue(
    months.filter((m) => m.startsWith(monthYear)),
    month
  );
  // 年を切り替えても「月」は維持する（前年同月比較のような使い方が主のため）。
  function changeYear(y) {
    const same = month ? `${y}-${month.slice(5)}` : '';
    const candidates = months.filter((m) => m.startsWith(y));
    onMonth(same || candidates[0] || '');
  }

  return (
    <>
      <label className="field">
        {legend}（年）
        <select
          value={monthYear}
          onChange={(e) => changeYear(e.target.value)}
          disabled={years.length === 0}
        >
          {years.length === 0 && <option value="">データなし</option>}
          {withValue(years, monthYear).map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {legend}（月）
        <select
          value={month}
          onChange={(e) => onMonth(e.target.value)}
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
  );
}

// 比較タブ。比較元（基準）と比較先の2期間を選んで支出・収入などを突き合わせる。
// 既定はダッシュボードで選択中の期間 vs その前年同期。
export default function CompareTab({
  transactions,
  reflections,
  months,
  defaultMonth,
  defaultYear,
  defaultMode,
}) {
  const years = useMemo(() => listYears(transactions), [transactions]);

  const [mode, setMode] = useState(defaultMode === 'year' ? 'year' : 'month');
  const [metric, setMetric] = useState('nominal');
  // 内訳セクションの切替（分類別の比較 / 支出・収入・投資の比較）。縦長になるのを防ぐ。
  const [section, setSection] = useState('category'); // 'category' | 'overview'
  const initTargetMonth = defaultMonth || months[0] || '';
  const initTargetYear = defaultYear || years[0] || '';
  const [targetMonth, setTargetMonth] = useState(initTargetMonth);
  const [baseMonth, setBaseMonth] = useState(prevYearOf(initTargetMonth));
  const [targetYear, setTargetYear] = useState(initTargetYear);
  const [baseYear, setBaseYear] = useState(prevYearOf(initTargetYear));

  const basePeriod = mode === 'year' ? baseYear : baseMonth;
  const targetPeriod = mode === 'year' ? targetYear : targetMonth;
  const baseLabel = periodLabel(basePeriod);
  const targetLabel = periodLabel(targetPeriod);
  const metricLabel = METRICS.find((m) => m.key === metric)?.label || '';

  const base = useMemo(() => aggregate(transactions, basePeriod), [transactions, basePeriod]);
  const target = useMemo(() => aggregate(transactions, targetPeriod), [transactions, targetPeriod]);

  // 超過支出の集計は「月の配列」単位なので、期間を月配列へ展開する。
  const baseMonths = useMemo(
    () => (mode === 'year' ? (baseYear ? monthsOfYear(baseYear) : []) : baseMonth ? [baseMonth] : []),
    [mode, baseYear, baseMonth]
  );
  const targetMonths = useMemo(
    () =>
      mode === 'year' ? (targetYear ? monthsOfYear(targetYear) : []) : targetMonth ? [targetMonth] : [],
    [mode, targetYear, targetMonth]
  );

  // 名目/超過/基準の3値を両期間分算出し、分類キーで統合する。
  const majorMerged = useMemo(
    () =>
      mergeComparison(
        buildExcessComparison(transactions, reflections, baseMonths, 'major'),
        buildExcessComparison(transactions, reflections, targetMonths, 'major'),
        'major'
      ),
    [transactions, reflections, baseMonths, targetMonths]
  );
  const minorMerged = useMemo(
    () =>
      mergeComparison(
        buildExcessComparison(transactions, reflections, baseMonths, 'minor'),
        buildExcessComparison(transactions, reflections, targetMonths, 'minor'),
        'minor'
      ),
    [transactions, reflections, baseMonths, targetMonths]
  );

  // 選択中の指標で大分類の比較行を作る。どちらの期間も0の分類は出さない。
  const majorRows = useMemo(() => {
    return majorMerged
      .map((m) => ({ name: m.major, base: m.base[metric], target: m.target[metric] }))
      .filter((r) => r.base !== 0 || r.target !== 0)
      .sort((a, b) => b.target - a.target);
  }, [majorMerged, metric]);

  const minorRows = useMemo(() => {
    return minorMerged
      .map((m) => ({
        major: m.major,
        minor: m.minor,
        base: m.base[metric],
        target: m.target[metric],
      }))
      .filter((r) => r.base !== 0 || r.target !== 0)
      .sort((a, b) => b.target - a.target);
  }, [minorMerged, metric]);

  // 指標ごとの合計（テーブルの合計行に使う）。
  const totals = useMemo(() => {
    return majorMerged.reduce(
      (acc, m) => {
        acc.base += m.base[metric];
        acc.target += m.target[metric];
        return acc;
      },
      { base: 0, target: 0 }
    );
  }, [majorMerged, metric]);
  const totalDiff = totals.target - totals.base;

  // 支出・収入・投資の全体比較グラフ用データ。
  const overviewRows = [
    { name: '支出', base: base.expense, target: target.expense },
    { name: '収入', base: base.income, target: target.income },
    { name: '投資', base: base.investment, target: target.investment },
  ];

  // サマリーカードの定義。支出は増えると悪い（赤）、収入・収支は増えると良い（緑）。
  const cards = [
    { label: '支出（投資除く）', base: base.expense, target: target.expense, upIsGood: false, cls: 'expense' },
    { label: '収入', base: base.income, target: target.income, upIsGood: true, cls: 'income' },
    { label: '収支', base: base.netBalance, target: target.netBalance, upIsGood: true, cls: '' },
    { label: '投資', base: base.investment, target: target.investment, upIsGood: null, cls: '' },
  ];

  return (
    <div>
      {/* 期間と指標の選択 */}
      <div className="panel">
        <div className="filters">
          <label className="field">
            期間
            <div className="seg">
              <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
                月次
              </button>
              <button className={mode === 'year' ? 'active' : ''} onClick={() => setMode('year')}>
                年次
              </button>
            </div>
          </label>
          <PeriodPicker
            legend="比較元"
            mode={mode}
            month={baseMonth}
            year={baseYear}
            months={months}
            years={years}
            onMonth={setBaseMonth}
            onYear={setBaseYear}
          />
          <span className="compare-arrow">→</span>
          <PeriodPicker
            legend="比較先"
            mode={mode}
            month={targetMonth}
            year={targetYear}
            months={months}
            years={years}
            onMonth={setTargetMonth}
            onYear={setTargetYear}
          />
        </div>
        <p className="hint" style={{ margin: '10px 0 0' }}>
          初期状態では、選択中の期間（比較先）とその前年同期（比較元）を比較します。差額・増減率は「比較先 − 比較元」です。
        </p>
      </div>

      {base.txCount === 0 && (
        <div className="warn">
          ⚠️ 比較元（{baseLabel}）に取引データがありません。差額は比較先の金額がそのまま表示されます。
        </div>
      )}
      {target.txCount === 0 && (
        <div className="warn">⚠️ 比較先（{targetLabel}）に取引データがありません。</div>
      )}

      {/* サマリーカード（差額・増減率つき） */}
      <div className="cards">
        {cards.map((c) => {
          const diff = c.target - c.base;
          // 比較元が0以下（収支の赤字など）だと増減率の符号が意味を持たないため出さない。
          const rate = c.base > 0 ? diff / c.base : null;
          const cls = c.upIsGood == null ? '' : deltaClass(diff, c.upIsGood);
          return (
            <div className="card" key={c.label}>
              <div className="label">{c.label}</div>
              <div className={`value ${c.cls}`}>{yen(c.target)}</div>
              <div className="sub">
                {baseLabel}: {yen(c.base)}
              </div>
              <div className={`delta ${cls}`}>
                {signedYen(diff)}（{signedPercent(rate)}）
              </div>
            </div>
          );
        })}
      </div>

      {/* 内訳セクション（分類別 / 支出・収入・投資 をサブタブで切替） */}
      <div className="panel">
        <div className="filters subtab-bar">
          <div className="seg">
            <button
              className={section === 'category' ? 'active' : ''}
              onClick={() => setSection('category')}
            >
              分類別の比較
            </button>
            <button
              className={section === 'overview' ? 'active' : ''}
              onClick={() => setSection('overview')}
            >
              支出・収入・投資
            </button>
          </div>
          {section === 'category' && (
            <label className="field">
              指標
              <div className="seg">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    className={metric === m.key ? 'active' : ''}
                    onClick={() => setMetric(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </label>
          )}
        </div>

        {section === 'overview' ? (
          <>
            <h2>支出・収入・投資の比較</h2>
            <p className="hint">
              差額・増減率は「比較先 − 比較元」。増減率は比較元が0円以下（収支の赤字など）では計算できないため「—」になります。
            </p>
            <div className="table-scroll">
              <table className="breakdown">
                <thead>
                  <tr>
                    <th>項目</th>
                    <th className="num">比較元（{baseLabel}）</th>
                    <th className="num">比較先（{targetLabel}）</th>
                    <th className="num">差額</th>
                    <th className="num">増減率</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c) => {
                    const diff = c.target - c.base;
                    const rate = c.base > 0 ? diff / c.base : null;
                    const cls = c.upIsGood == null ? '' : deltaClass(diff, c.upIsGood);
                    return (
                      <tr key={c.label}>
                        <td>{c.label}</td>
                        <td className="num">{yen(c.base)}</td>
                        <td className="num">{yen(c.target)}</td>
                        <td className={`num ${cls}`}>{signedYen(diff)}</td>
                        <td className={`num ${cls}`}>{signedPercent(rate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <h2 style={{ marginTop: 20 }}>
              グラフ（{baseLabel} → {targetLabel}）
            </h2>
            <CompareBarChart data={overviewRows} baseLabel={baseLabel} targetLabel={targetLabel} />
          </>
        ) : (
          <>
            <h2>分類別の比較：{metricLabel}</h2>
            <p className="hint">
              差額・増減率は「比較先 − 比較元」。増加は赤、減少は緑で表示します。増減率は比較元が0円の分類では計算できないため「—」になります。
              超過・基準支出は各月の反省（超過の記録）を元に計算します（名目=実支出 / 超過=無駄と記録した分 / 基準=名目−超過）。
            </p>
            {majorRows.length === 0 ? (
          <div className="empty">
            {metric === 'excess'
              ? 'どちらの期間にも超過支出の記録がありません。'
              : 'どちらの期間にも支出データがありません。'}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="breakdown">
              <thead>
                <tr>
                  <th>大分類 / 小分類</th>
                  <th className="num">比較元（{baseLabel}）</th>
                  <th className="num">比較先（{targetLabel}）</th>
                  <th className="num">差額</th>
                  <th className="num">増減率</th>
                </tr>
              </thead>
              <tbody>
                {majorRows.map((m) => {
                  const diff = m.target - m.base;
                  const rate = m.base > 0 ? diff / m.base : null;
                  return (
                    <Fragment key={m.name}>
                      <tr className="major-row">
                        <td>
                          <span
                            className="swatch"
                            style={{ background: MAJOR_COLORS[m.name] || '#999' }}
                          />
                          {m.name}
                        </td>
                        <td className="num">{yen(m.base)}</td>
                        <td className="num">{yen(m.target)}</td>
                        <td className={`num ${deltaClass(diff, false)}`}>{signedYen(diff)}</td>
                        <td className={`num ${deltaClass(diff, false)}`}>{signedPercent(rate)}</td>
                      </tr>
                      {minorRows
                        .filter((r) => r.major === m.name)
                        .map((r) => {
                          const d = r.target - r.base;
                          const rr = r.base > 0 ? d / r.base : null;
                          return (
                            <tr key={`${r.major} ${r.minor}`}>
                              <td style={{ paddingLeft: 24 }}>{r.minor || '（小分類なし）'}</td>
                              <td className="num">{yen(r.base)}</td>
                              <td className="num">{yen(r.target)}</td>
                              <td className={`num ${deltaClass(d, false)}`}>{signedYen(d)}</td>
                              <td className={`num ${deltaClass(d, false)}`}>{signedPercent(rr)}</td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
                <tr className="major-row total-row">
                  <td>合計</td>
                  <td className="num">{yen(totals.base)}</td>
                  <td className="num">{yen(totals.target)}</td>
                  <td className={`num ${deltaClass(totalDiff, false)}`}>{signedYen(totalDiff)}</td>
                  <td className={`num ${deltaClass(totalDiff, false)}`}>
                    {signedPercent(totals.base > 0 ? totalDiff / totals.base : null)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
            <h2 style={{ marginTop: 20 }}>
              大分類別の比較グラフ：{metricLabel}（{baseLabel} → {targetLabel}）
            </h2>
            <CompareBarChart data={majorRows} baseLabel={baseLabel} targetLabel={targetLabel} />
          </>
        )}
      </div>
    </div>
  );
}
