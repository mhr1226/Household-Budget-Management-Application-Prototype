'use client';

import { useRef, useState } from 'react';
import { readCsvFile } from '@/lib/parseCsv';
import { transformZaim, transformMf } from '@/lib/transform';

// Zaim / MoneyForward の CSV を取り込む。
// ヘッダの特徴でどちらのCSVかを自動判定する。
function detectSource(rows) {
  if (!rows || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  if (keys.includes('カテゴリの内訳') && keys.includes('集計の設定')) return 'zaim';
  if (keys.includes('大項目') && keys.includes('保有金融機関')) return 'moneyforward';
  return null;
}

export default function CsvImport({ onImported }) {
  const zaimRef = useRef(null);
  const mfRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // {type, text}

  async function handleImport() {
    const zaimFile = zaimRef.current?.files?.[0];
    const mfFile = mfRef.current?.files?.[0];
    if (!zaimFile && !mfFile) {
      setStatus({ type: 'err', text: 'Zaim か MoneyForward のCSVを選んでください。' });
      return;
    }
    setBusy(true);
    setStatus({ type: '', text: '取り込み中…' });
    try {
      let transactions = [];
      const notes = [];
      for (const file of [zaimFile, mfFile].filter(Boolean)) {
        const rows = await readCsvFile(file);
        const src = detectSource(rows);
        if (src === 'zaim') {
          const t = transformZaim(rows);
          transactions = transactions.concat(t);
          notes.push(`Zaim ${t.length}件`);
        } else if (src === 'moneyforward') {
          const t = transformMf(rows);
          transactions = transactions.concat(t);
          notes.push(`MoneyForward ${t.length}件`);
        } else {
          notes.push(`${file.name}: 形式を判別できませんでした`);
        }
      }
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      }).then((r) => r.json());

      setStatus({
        type: 'ok',
        text: `取込完了: ${notes.join(' / ')} → 新規${res.added}件（保存済み合計${res.total}件）`,
      });
      if (zaimRef.current) zaimRef.current.value = '';
      if (mfRef.current) mfRef.current.value = '';
      onImported?.();
    } catch (e) {
      setStatus({ type: 'err', text: `取込エラー: ${e.message}` });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm('保存済みの明細をすべて削除します。よろしいですか？')) return;
    setBusy(true);
    try {
      await fetch('/api/transactions', { method: 'DELETE' });
      setStatus({ type: 'ok', text: '全明細を削除しました。' });
      onImported?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="field file-drop">
        Zaim CSV
        <input type="file" accept=".csv" ref={zaimRef} />
      </label>
      <label className="field file-drop">
        MoneyForward CSV
        <input type="file" accept=".csv" ref={mfRef} />
      </label>
      <button className="btn" onClick={handleImport} disabled={busy}>
        CSV取込
      </button>
      <button className="btn ghost" onClick={handleReset} disabled={busy}>
        全消去
      </button>
      {status && <span className={`status ${status.type}`}>{status.text}</span>}
    </>
  );
}
