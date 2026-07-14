'use client';

import { Fragment, useMemo, useState } from 'react';
import { monthLabel, yen, percent } from '@/lib/format';
import { MAJOR_COLORS } from '@/lib/mapping';
import { aggregateExcess, buildExcessComparison, listYears, monthsOfYear } from '@/lib/excess';

// 予算タブは「超過支出のビュー専用」。編集はダッシュボードの反省エディタでのみ行い、
// ここは読み取り専用で月次／年次に集計して見せる。
export default function BudgetTab({ transactions, reflections, months, defaultMonth }) {
  const [mode, setMode] = useState('month'); // 'month' | 'year'
  const [month, setMonth] = useState(defaultMonth || '');
  const [year, setYear] = useState('');

  const years = useMemo(() => listYears(transactions), [transactions]);

  // セレクタが未選択（初期状態）でも先頭を既定にする。
  const activeMonth = month || months[0] || '';
  const activeYear = year || years[0] || '';

  // 集計対象の月配列（月次は1ヶ月、年次はその年の12ヶ月）。
  const activeMonths = useMemo(() => {
    if (mode === 'year') return activeYear ? monthsOfYear(activeYear) : [];
    return activeMonth ? [activeMonth] : [];
  }, [mode, activeMonth, activeYear]);

  const periodLabel = mode === 'year' ? `${activeYear}年` : monthLabel(activeMonth);

  const excess = useMemo(
    () => aggregateExcess(reflections, activeMonths),
    [reflections, activeMonths]
  );
  // 比較テーブルは大分類・小分類の両方を用意しておく（小分類は大分類の下に入れ子表示する）。
  const majorComparison = useMemo(
    () => buildExcessComparison(transactions, reflections, activeMonths, 'major'),
    [transactions, reflections, activeMonths]
  );
  const minorComparison = useMemo(
    () => buildExcessComparison(transactions, reflections, activeMonths, 'minor'),
    [transactions, reflections, activeMonths]
  );

  // 比較テーブルの合計行（大分類の集計＝小分類の集計と一致する）。
  const totals = useMemo(() => {
    return majorComparison.reduce(
      (acc, r) => {
        acc.nominal += r.nominal;
        acc.excess += r.excess;
        acc.baseline += r.baseline;
        return acc;
      },
      { nominal: 0, excess: 0, baseline: 0 }
    );
  }, [majorComparison]);

  return (
    <div>
      {/* 期間切替 */}
      <div className="panel">
        <div className="filters">
          <label className="field">
            期間
            <div className="seg">
              <button
                className={mode === 'month' ? 'active' : ''}
                onClick={() => setMode('month')}
              >
                月次
              </button>
              <button
                className={mode === 'year' ? 'active' : ''}
                onClick={() => setMode('year')}
              >
                年次
              </button>
            </div>
          </label>
          {mode === 'month' ? (
            <label className="field">
              対象月
              <select
                value={activeMonth}
                onChange={(e) => setMonth(e.target.value)}
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
          ) : (
            <label className="field">
              対象年
              <select
                value={activeYear}
                onChange={(e) => setYear(e.target.value)}
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
        </div>

        {/* 超過支出の合計 */}
        <div className="excess-headline">
          <div className="label">超過支出の合計（{periodLabel}）</div>
          <div className="value expense">{yen(excess.total)}</div>
          <div className="sub">{excess.entries.length} 件</div>
        </div>
      </div>

      {/* 超過支出エントリの一覧（読み取り専用） */}
      <div className="panel">
        <h2>超過支出の一覧</h2>
        <p className="hint">金額の大きい順。編集はダッシュボードの反省欄から行います。</p>
        <div className="table-scroll">
          <table className="detail">
            <thead>
              <tr>
                {mode === 'year' && <th>月</th>}
                <th>分類</th>
                <th>品名</th>
                <th className="num">金額</th>
                <th>理由</th>
                <th>反省点</th>
                <th>改善点</th>
              </tr>
            </thead>
            <tbody>
              {excess.entries.length === 0 && (
                <tr>
                  <td colSpan={mode === 'year' ? 7 : 6} className="empty">
                    該当する超過支出がありません。
                  </td>
                </tr>
              )}
              {excess.entries.map((e) => (
                <tr key={e.id}>
                  {mode === 'year' && <td className="nowrap">{monthLabel(e.month)}</td>}
                  <td className="nowrap">
                    <span
                      className="swatch"
                      style={{ background: MAJOR_COLORS[e.major] || '#999' }}
                    />
                    {e.major}
                    {e.minor && ` / ${e.minor}`}
                  </td>
                  <td className="content">{e.itemName || '—'}</td>
                  <td className="num">{yen(e.excessAmount)}</td>
                  <td className="nowrap">{e.excessReason || '—'}</td>
                  <td className="content">{e.reflection || '—'}</td>
                  <td className="content">{e.improvement || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 名目 / 超過 / 基準 の比較テーブル */}
      <div className="panel">
        <h2>名目 / 超過 / 基準 の比較</h2>
        <p className="hint">
          基準支出 = 名目支出 − 超過支出。無駄がなかった場合の支出水準です。
          構成比は超過支出全体に対する各行の割合です。
          基準がマイナスの行は超過額の入力ミスの可能性があります。
        </p>
        {majorComparison.length === 0 ? (
          <div className="empty">この期間の支出データがありません。</div>
        ) : (
          <div className="table-scroll">
            <table className="breakdown">
              <thead>
                <tr>
                  <th>大分類 / 小分類</th>
                  <th className="num">名目支出</th>
                  <th className="num">超過支出</th>
                  <th className="num">構成比</th>
                  <th className="num">基準支出</th>
                </tr>
              </thead>
              <tbody>
                {/* 大分類の見出し行 → 配下の小分類行、の入れ子で表示する。 */}
                {majorComparison.map((m) => (
                      <Fragment key={m.major}>
                        <tr className="major-row">
                          <td>
                            <span
                              className="swatch"
                              style={{ background: MAJOR_COLORS[m.major] || '#999' }}
                            />
                            {m.major}
                          </td>
                          <td className="num">{yen(m.nominal)}</td>
                          <td className="num">{m.excess > 0 ? yen(m.excess) : '—'}</td>
                          <td className="num">
                            {totals.excess && m.excess > 0 ? percent(m.excess / totals.excess) : '—'}
                          </td>
                          <td className={`num ${m.baseline < 0 ? 'neg' : ''}`}>
                            {yen(m.baseline)}
                            {m.baseline < 0 && <span className="tag warn-tag">要確認</span>}
                          </td>
                        </tr>
                        {minorComparison
                          .filter((r) => r.major === m.major)
                          .map((r) => (
                            <tr key={`${r.major} ${r.minor}`}>
                              <td style={{ paddingLeft: 24 }}>{r.minor || '（小分類なし）'}</td>
                              <td className="num">{yen(r.nominal)}</td>
                              <td className="num">{r.excess > 0 ? yen(r.excess) : '—'}</td>
                              <td className="num">
                                {totals.excess && r.excess > 0 ? percent(r.excess / totals.excess) : '—'}
                              </td>
                              <td className={`num ${r.baseline < 0 ? 'neg' : ''}`}>
                                {yen(r.baseline)}
                                {r.baseline < 0 && <span className="tag warn-tag">要確認</span>}
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                <tr className="major-row total-row">
                  <td>合計</td>
                  <td className="num">{yen(totals.nominal)}</td>
                  <td className="num">{yen(totals.excess)}</td>
                  <td className="num">{totals.excess ? percent(1) : '—'}</td>
                  <td className="num">{yen(totals.baseline)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
