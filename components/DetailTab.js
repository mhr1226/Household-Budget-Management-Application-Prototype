'use client';

import { useEffect, useMemo, useState } from 'react';
import { yen } from '@/lib/format';
import { MAJOR_COLORS } from '@/lib/mapping';

const TYPE_LABEL = { expense: '支出', income: '収入', investment: '投資' };
const SOURCE_LABEL = { zaim: 'Zaim', moneyforward: 'MF' };

// 期間（月次/年次/全期間）の選択状態は BudgetApp が持ち、ダッシュボードと共有する。
// period は "2026-06"（月）/ "2026"（年）/ ''（全期間）、periodSelector は共通の選択UI。
// 大分類フィルタ（major）も BudgetApp が持ち、円グラフのクリックから飛んで来られるようにする。
export default function DetailTab({ transactions, period, periodSelector, major, onMajorChange }) {
  const [type, setType] = useState('all'); // all | expense | income | investment
  const [minor, setMinor] = useState('all');
  const [incl, setIncl] = useState('in'); // all | in（集計対象のみ）| out（対象外のみ）
  const [q, setQ] = useState('');
  // 日付範囲での絞り込み（期間セレクタよりさらに細かく絞りたいとき用）。空なら制限なし。
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState('date'); // date | amount
  const [sortDir, setSortDir] = useState('asc');

  // 大分類が変わったら（セレクタ操作でも円グラフ経由でも）小分類の選択をリセットする。
  useEffect(() => {
    setMinor('all');
  }, [major]);

  // 期間で絞ったベース（大分類/小分類の選択肢はここから作る）。日付の前方一致で月・年どちらにも対応。
  const inPeriod = useMemo(
    () => transactions.filter((t) => (!period ? true : (t.date || '').startsWith(period))),
    [transactions, period]
  );

  const majorOptions = useMemo(() => {
    const s = new Set(inPeriod.filter((t) => t.type === 'expense').map((t) => t.major));
    return Array.from(s);
  }, [inPeriod]);

  const minorOptions = useMemo(() => {
    const s = new Set(
      inPeriod
        .filter((t) => t.type === 'expense' && (major === 'all' || t.major === major))
        .map((t) => t.minor)
    );
    return Array.from(s);
  }, [inPeriod, major]);

  const rows = useMemo(() => {
    const kw = q.trim();
    let list = inPeriod.filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (incl === 'in' && !t.included) return false;
      if (incl === 'out' && t.included) return false;
      if (major !== 'all' && t.major !== major) return false;
      if (minor !== 'all' && t.minor !== minor) return false;
      // 日付は "YYYY-MM-DD" の文字列比較でそのまま大小判定できる。
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (kw) {
        const hay = `${t.store} ${t.item} ${t.originalCategory} ${t.memo} ${t.major} ${t.minor}`;
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      let c;
      if (sortKey === 'amount') c = a.amount - b.amount;
      else c = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      return sortDir === 'asc' ? c : -c;
    });
    return list;
  }, [inPeriod, type, incl, major, minor, q, dateFrom, dateTo, sortKey, sortDir]);

  // フィルタ後の合計（種別ごと）
  const totals = useMemo(() => {
    const t = { expense: 0, income: 0, investment: 0 };
    for (const r of rows) t[r.type] += r.amount;
    return t;
  }, [rows]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'amount' ? 'desc' : 'asc');
    }
  }
  // 並び替え中の列は ▲/▼、それ以外の並び替え可能な列は薄い ⇅ を常に見せて、
  // クリックで並び替えできることをわかりやすくする。
  const arrow = (key) =>
    sortKey === key ? (
      <span className="sort-arrow active">{sortDir === 'asc' ? '▲' : '▼'}</span>
    ) : (
      <span className="sort-arrow">⇅</span>
    );

  return (
    <div>
      <div className="panel">
        <h2>明細フィルタ</h2>
        <p className="hint">
          集計に使われている取引を1件ずつ確認できます。「集計対象」を「対象外のみ」にすると、
          クレジット一括払い等で集計から除外している行だけを表示します（不要データの点検用）。
        </p>
        <div className="filters">
          {periodSelector}
          <label className="field">
            種別
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">すべて</option>
              <option value="expense">支出</option>
              <option value="income">収入</option>
              <option value="investment">投資</option>
            </select>
          </label>
          <label className="field">
            大分類
            <select value={major} onChange={(e) => onMajorChange(e.target.value)}>
              <option value="all">すべて</option>
              {majorOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            小分類
            <select value={minor} onChange={(e) => setMinor(e.target.value)}>
              <option value="all">すべて</option>
              {minorOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            集計対象
            <select value={incl} onChange={(e) => setIncl(e.target.value)}>
              <option value="in">集計対象のみ</option>
              <option value="out">対象外のみ</option>
              <option value="all">すべて</option>
            </select>
          </label>
          <label className="field grow">
            キーワード（店名・内容・メモ）
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="例: Amazon / サブスク / ハロカ"
            />
          </label>
          <label className="field">
            日付範囲（さらに絞り込む）
            <div className="date-range">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span>〜</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              {(dateFrom || dateTo) && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  クリア
                </button>
              )}
            </div>
          </label>
          <label className="field">
            並び替え
            <div className="seg">
              <button
                className={sortKey === 'date' ? 'active' : ''}
                onClick={() => setSortKey('date')}
              >
                日付
              </button>
              <button
                className={sortKey === 'amount' ? 'active' : ''}
                onClick={() => setSortKey('amount')}
              >
                金額
              </button>
              <button onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
                {sortDir === 'asc' ? '昇順 ▲' : '降順 ▼'}
              </button>
            </div>
          </label>
        </div>

        <div className="detail-totals">
          <span>
            表示 <strong>{rows.length}</strong> 件
          </span>
          <span className="t-exp">支出 {yen(totals.expense)}</span>
          <span className="t-inc">収入 {yen(totals.income)}</span>
          <span className="t-inv">投資 {yen(totals.investment)}</span>
        </div>
      </div>

      <div className="panel">
        <div className="table-scroll">
          <table className="detail">
            <thead>
              <tr>
                <th className="sortable" title="クリックで並び替え" onClick={() => toggleSort('date')}>
                  日付{arrow('date')}
                </th>
                <th>元</th>
                <th>種別</th>
                <th>分類</th>
                <th>店名</th>
                <th>内容</th>
                <th
                  className="num sortable"
                  title="クリックで並び替え"
                  onClick={() => toggleSort('amount')}
                >
                  金額{arrow('amount')}
                </th>
                <th>集計</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    該当する取引がありません。
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className={!t.included ? 'excluded' : ''}>
                  <td className="nowrap">{t.date}</td>
                  <td>
                    <span className={`src src-${t.source}`}>{SOURCE_LABEL[t.source] || t.source}</span>
                  </td>
                  <td className="nowrap">{TYPE_LABEL[t.type] || t.type}</td>
                  <td className="nowrap">
                    {t.type === 'expense' ? (
                      <>
                        <span
                          className="swatch"
                          style={{ background: MAJOR_COLORS[t.major] || '#999' }}
                        />
                        {t.major} / {t.minor}
                        {!t.matched && t.major !== '未分類' && (
                          <span className="tag warn-tag">未分類</span>
                        )}
                      </>
                    ) : (
                      <span className="muted">{t.major}</span>
                    )}
                  </td>
                  <td className="content">{t.store || '—'}</td>
                  <td className="content">{t.item || '—'}</td>
                  <td className={`num ${t.amount < 0 ? 'neg' : ''}`}>{yen(t.amount)}</td>
                  <td>
                    {t.included ? (
                      <span className="tag ok-tag">対象</span>
                    ) : (
                      <span className="tag out-tag" title={t.aggregationSetting || '集計対象外'}>
                        対象外
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
