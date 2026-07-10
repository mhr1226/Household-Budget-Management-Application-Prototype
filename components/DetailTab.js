'use client';

import { useMemo, useState } from 'react';
import { monthOf } from '@/lib/aggregate';
import { monthLabel, yen } from '@/lib/format';
import { MAJOR_COLORS } from '@/lib/mapping';

const TYPE_LABEL = { expense: '支出', income: '収入', investment: '投資' };
const SOURCE_LABEL = { zaim: 'Zaim', moneyforward: 'MF' };

export default function DetailTab({ transactions, months, defaultMonth }) {
  const [month, setMonth] = useState(defaultMonth || '');
  const [type, setType] = useState('all'); // all | expense | income | investment
  const [major, setMajor] = useState('all');
  const [minor, setMinor] = useState('all');
  const [incl, setIncl] = useState('in'); // all | in（集計対象のみ）| out（対象外のみ）
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState('date'); // date | amount
  const [sortDir, setSortDir] = useState('asc');

  // 月で絞ったベース（大分類/小分類の選択肢はここから作る）
  const inMonth = useMemo(
    () => transactions.filter((t) => (!month ? true : monthOf(t.date) === month)),
    [transactions, month]
  );

  const majorOptions = useMemo(() => {
    const s = new Set(inMonth.filter((t) => t.type === 'expense').map((t) => t.major));
    return Array.from(s);
  }, [inMonth]);

  const minorOptions = useMemo(() => {
    const s = new Set(
      inMonth
        .filter((t) => t.type === 'expense' && (major === 'all' || t.major === major))
        .map((t) => t.minor)
    );
    return Array.from(s);
  }, [inMonth, major]);

  const rows = useMemo(() => {
    const kw = q.trim();
    let list = inMonth.filter((t) => {
      if (type !== 'all' && t.type !== type) return false;
      if (incl === 'in' && !t.included) return false;
      if (incl === 'out' && t.included) return false;
      if (major !== 'all' && t.major !== major) return false;
      if (minor !== 'all' && t.minor !== minor) return false;
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
  }, [inMonth, type, incl, major, minor, q, sortKey, sortDir]);

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
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  function resetMinorOnMajor(v) {
    setMajor(v);
    setMinor('all');
  }

  return (
    <div>
      <div className="panel">
        <h2>明細フィルタ</h2>
        <p className="hint">
          集計に使われている取引を1件ずつ確認できます。「集計対象」を「対象外のみ」にすると、
          クレジット一括払い等で集計から除外している行だけを表示します（不要データの点検用）。
        </p>
        <div className="filters">
          <label className="field">
            対象月
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">全期間</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
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
            <select value={major} onChange={(e) => resetMinorOnMajor(e.target.value)}>
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
                <th className="sortable" onClick={() => toggleSort('date')}>
                  日付{arrow('date')}
                </th>
                <th>元</th>
                <th>種別</th>
                <th>分類</th>
                <th>店名</th>
                <th>内容</th>
                <th className="num sortable" onClick={() => toggleSort('amount')}>
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
