'use client';

import { useState } from 'react';

// 長い明細名を「先頭…」に省略して表示し、クリックで全文表示と切り替える。
// max 文字以上のときだけ省略する（それ未満はそのまま出す）。
export default function TruncatedText({ text, max = 30 }) {
  const [open, setOpen] = useState(false);
  const value = text || '';
  if (value.length < max) return <>{value}</>;

  return (
    <span
      className="trunc"
      role="button"
      tabIndex={0}
      title={open ? 'クリックで省略表示' : 'クリックで全文表示'}
      onClick={(e) => {
        // label 内に置いてもチェックボックスが切り替わらないようにする。
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
      {open ? value : `${value.slice(0, max - 1)}...`}
    </span>
  );
}
