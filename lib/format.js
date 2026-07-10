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
