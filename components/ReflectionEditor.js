'use client';

import { useEffect, useState } from 'react';
import { monthLabel } from '@/lib/format';

export default function ReflectionEditor({ month, value, onSaved }) {
  const [text, setText] = useState(value || '');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  // 対象月が変わったら本文を差し替える。
  useEffect(() => {
    setText(value || '');
    setStatus(null);
  }, [month, value]);

  async function save() {
    if (!month) return;
    setSaving(true);
    setStatus(null);
    try {
      await fetch('/api/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, text }),
      });
      onSaved?.(month, text);
      setStatus({ type: 'ok', text: '保存しました。' });
    } catch (e) {
      setStatus({ type: 'err', text: `保存エラー: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>{monthLabel(month)} の反省</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="この月の反省・気づき・来月に向けたメモを書く…"
      />
      <div className="reflection-foot">
        <button className="btn" onClick={save} disabled={saving || !month}>
          保存
        </button>
        {status && <span className={`status ${status.type}`}>{status.text}</span>}
      </div>
    </div>
  );
}
