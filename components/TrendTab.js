'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { aggregate } from '@/lib/aggregate';
import { aggregateExcess } from '@/lib/excess';
import { monthLabel } from '@/lib/format';
import { MAJOR_CATEGORIES, MAJOR_COLORS, UNMAPPED } from '@/lib/mapping';

// 折れ線グラフ（Recharts）は初期バンドルから切り離して後読みする（円グラフと同じ方針）。
const TrendLineChart = dynamic(() => import('./TrendLineChart'), {
  ssr: false,
  loading: () => <div className="empty">グラフを読み込み中…</div>,
});

// 表示内容の切替。明細フィルタと同じく「何を見るか」をセレクタで選ぶ。
const VIEWS = [
  { key: 'major', label: '大分類別の支出' },
  { key: 'overview', label: '支出・収入・収支' },
  { key: 'excess', label: '名目・超過・基準支出' },
];

// 収支・超過ビューの固定色（アプリ全体の 支出=赤 / 収入=緑 / アクセント=青 に合わせる）。
const OVERVIEW_COLORS = { 支出: '#e15759', 収入: '#2f9e58', 収支: '#2f6fed' };
const EXCESS_COLORS = { 名目支出: '#2f6fed', 超過支出: '#e15759', 基準支出: '#2f9e58' };

// 小分類の折れ線用パレット（大分類色とは別の判別しやすい色）。
const MINOR_PALETTE = [
  '#2f6fed',
  '#e15759',
  '#2f9e58',
  '#f0a983',
  '#8a5cd6',
  '#17a2b8',
  '#d63384',
  '#6b7280',
];

// "2026-07" に n ヶ月足す（負も可）。年境界をまたいでも正しく計算する。
function addMonths(m, n) {
  const y = Number(m.slice(0, 4));
  const mo = Number(m.slice(5)) - 1 + n;
  const ny = y + Math.floor(mo / 12);
  const nmo = ((mo % 12) + 12) % 12;
  return `${ny}-${String(nmo + 1).padStart(2, '0')}`;
}

// start〜end（両端含む）の連続した月の配列（古い順）。データの無い月も含めて線を切らさない。
function monthRange(start, end) {
  if (!start || !end) return [];
  const [a, b] = start <= end ? [start, end] : [end, start];
  const out = [];
  for (let m = a; m <= b && out.length < 120; m = addMonths(m, 1)) out.push(m);
  return out;
}

// X軸用の短いラベル。"2025-08" -> "25/8"
function shortLabel(m) {
  return `${m.slice(2, 4)}/${Number(m.slice(5))}`;
}

// 推移タブ。選んだ範囲の月ごとの推移を折れ線で表示する。既定は直近12ヶ月。
export default function TrendTab({ transactions, reflections, months }) {
  const latest = months[0] || '';
  const oldest = months[months.length - 1] || '';

  const [view, setView] = useState('major');
  // 大分類ビューで特定の大分類を選ぶと、その小分類の推移に掘り下げる。
  const [majorFilter, setMajorFilter] = useState('all');
  const [endMonth, setEndMonth] = useState(latest);
  // 既定の開始月は「終了月の11ヶ月前」か最古データ月の新しい方（=直近12ヶ月）。
  const [startMonth, setStartMonth] = useState(() => {
    if (!latest) return '';
    const back = addMonths(latest, -11);
    return oldest && back < oldest ? oldest : back;
  });

  const rangeMonths = useMemo(() => monthRange(startMonth, endMonth), [startMonth, endMonth]);

  // 月ごとの集計。既存の aggregate / aggregateExcess を月単位で回す
  // （範囲は最大数十ヶ月なのでプロトタイプでは都度計算で十分軽い）。
  const buckets = useMemo(
    () =>
      rangeMonths.map((m) => ({
        month: m,
        summary: aggregate(transactions, m),
        excessTotal: aggregateExcess(reflections, [m]).total,
      })),
    [rangeMonths, transactions, reflections]
  );

  // ビューごとにチャートデータと系列（色つき）を組み立てる。
  const { data, series } = useMemo(() => {
    const rows = buckets.map((b) => ({ label: shortLabel(b.month), fullLabel: monthLabel(b.month) }));

    if (view === 'overview') {
      buckets.forEach((b, i) => {
        rows[i]['支出'] = b.summary.expense;
        rows[i]['収入'] = b.summary.income;
        rows[i]['収支'] = b.summary.netBalance;
      });
      return {
        data: rows,
        series: Object.entries(OVERVIEW_COLORS).map(([key, color]) => ({ key, color })),
      };
    }

    if (view === 'excess') {
      buckets.forEach((b, i) => {
        rows[i]['名目支出'] = b.summary.expense;
        rows[i]['超過支出'] = b.excessTotal;
        rows[i]['基準支出'] = b.summary.expense - b.excessTotal;
      });
      return {
        data: rows,
        series: Object.entries(EXCESS_COLORS).map(([key, color]) => ({ key, color })),
      };
    }

    // view === 'major'
    if (majorFilter === 'all') {
      // 大分類ごとの折れ線。範囲内で一度も支出の無い分類（未分類など）は出さない。
      const majors = [...MAJOR_CATEGORIES, UNMAPPED];
      const used = new Set();
      buckets.forEach((b, i) => {
        for (const name of majors) {
          const v = b.summary.majorTotals[name] || 0;
          rows[i][name] = v;
          if (v > 0) used.add(name);
        }
      });
      return {
        data: rows,
        series: majors
          .filter((name) => used.has(name))
          .map((name) => ({ key: name, color: MAJOR_COLORS[name] || '#999' })),
      };
    }

    // 特定の大分類 → 小分類ごとの折れ線に掘り下げ。
    const minorSet = new Set();
    buckets.forEach((b, i) => {
      for (const r of b.summary.minorRows) {
        if (r.major !== majorFilter) continue;
        // 突発的な「高額支出」は金額の桁が違い他の線が潰れるため、推移には出さない。
        if (r.minor === '高額支出') continue;
        const name = r.minor || '（小分類なし）';
        rows[i][name] = (rows[i][name] || 0) + r.amount;
        minorSet.add(name);
      }
    });
    const minors = Array.from(minorSet).sort();
    // 出てこない月は0埋めして線を切らさない。
    for (const row of rows) {
      for (const name of minors) if (row[name] == null) row[name] = 0;
    }
    return {
      data: rows,
      series: minors.map((name, i) => ({ key: name, color: MINOR_PALETTE[i % MINOR_PALETTE.length] })),
    };
  }, [buckets, view, majorFilter]);

  const rangeText =
    rangeMonths.length > 0
      ? `${monthLabel(rangeMonths[0])} 〜 ${monthLabel(rangeMonths[rangeMonths.length - 1])}`
      : '';

  return (
    <div>
      {/* 表示内容と期間のフィルタ（明細タブのフィルタと同じ操作感） */}
      <div className="panel">
        <div className="filters">
          <label className="field">
            表示内容
            <select value={view} onChange={(e) => setView(e.target.value)}>
              {VIEWS.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          {view === 'major' && (
            <label className="field">
              大分類
              <select value={majorFilter} onChange={(e) => setMajorFilter(e.target.value)}>
                <option value="all">すべて（大分類別）</option>
                {MAJOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}（小分類別）
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            開始月
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
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
          <span className="compare-arrow">〜</span>
          <label className="field">
            終了月
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
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
        </div>
        <p className="hint" style={{ margin: '10px 0 0' }}>
          既定は直近12ヶ月です。データの無い月は0円として線をつなぎます。超過・基準支出は各月の反省（超過の記録）を元に計算します。
          グラフ下の凡例をクリックすると、その系列の表示/非表示を切り替えられます（住宅設備のように金額の大きい系列を隠すと、目盛りが残りの系列に合わせて細かくなります）。
        </p>
      </div>

      <div className="panel">
        <h2>
          {VIEWS.find((v) => v.key === view)?.label}
          {view === 'major' && majorFilter !== 'all' && `：${majorFilter}の小分類`}
          の推移（{rangeText}）
        </h2>
        {/* key で表示内容の切替時に凡例クリックの表示/非表示状態をリセットする。 */}
        <TrendLineChart
          key={view === 'major' ? `major-${majorFilter}` : view}
          data={data}
          series={series}
        />
      </div>
    </div>
  );
}
