// 表示用フォーマッタ。

export function yen(n) {
  const v = Math.round(n || 0);
  return `¥${v.toLocaleString('ja-JP')}`;
}

export function percent(r, digits = 1) {
  return `${((r || 0) * 100).toFixed(digits)}%`;
}

// "2026-06" -> "2026年6月"
export function monthLabel(m) {
  if (!m || m === 'all') return '全期間';
  const [y, mo] = m.split('-');
  return `${y}年${Number(mo)}月`;
}

// 期間ラベル。"2026-06" -> "2026年6月" / "2026" -> "2026年" / falsy -> "全期間"
export function periodLabel(p) {
  if (!p || p === 'all') return '全期間';
  return p.includes('-') ? monthLabel(p) : `${p}年`;
}
