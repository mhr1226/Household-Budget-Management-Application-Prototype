'use client';

import { useRef, useState } from 'react';
import { readCsvFile } from '@/lib/parseCsv';
import { transformZaim, transformMf } from '@/lib/transform';
import { monthOf } from '@/lib/aggregate';
import { monthLabel } from '@/lib/format';

// Zaim / MoneyForward の CSV を取り込む。
// 取込口は1つだけ。どちらのCSVかはヘッダの特徴から自動判定するので、
// ユーザーはファイルの種類を意識せずまとめて放り込める。
function detectSource(rows) {
  if (!rows || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  if (keys.includes('カテゴリの内訳') && keys.includes('集計の設定')) return 'zaim';
  if (keys.includes('大項目') && keys.includes('保有金融機関')) return 'moneyforward';
  return null;
}

export default function CsvImport({ transactions = [], month, onImported }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // {type, text, warnings[]}

  async function importFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0 || busy) return;

    setBusy(true);
    setStatus({ type: '', text: '取り込み中…' });
    try {
      let transactions = [];
      const counts = { zaim: 0, moneyforward: 0 };
      const warnings = [];

      for (const file of files) {
        if (!/\.csv$/i.test(file.name)) {
          warnings.push(`${file.name}：CSVファイルではないため無視しました`);
          continue;
        }
        let rows;
        try {
          rows = await readCsvFile(file);
        } catch (e) {
          warnings.push(`${file.name}：読み込めませんでした（${e.message}）`);
          continue;
        }
        // 判別できないファイルは取り込まず、どのファイルだったかを警告に残す。
        const src = detectSource(rows);
        if (src === 'zaim') {
          const t = transformZaim(rows);
          transactions = transactions.concat(t);
          counts.zaim += t.length;
        } else if (src === 'moneyforward') {
          const t = transformMf(rows);
          transactions = transactions.concat(t);
          counts.moneyforward += t.length;
        } else {
          warnings.push(
            `${file.name}：Zaim / MoneyForward のどちらの形式か判別できず、取り込みませんでした`
          );
        }
      }

      if (transactions.length === 0) {
        setStatus({ type: 'err', text: '取り込めるデータがありませんでした。', warnings });
        return;
      }

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      }).then((r) => r.json());

      const parts = [];
      if (counts.zaim) parts.push(`Zaim ${counts.zaim}件`);
      if (counts.moneyforward) parts.push(`MoneyForward ${counts.moneyforward}件`);
      setStatus({
        type: 'ok',
        text: `取込完了: ${parts.join(' / ')} → 新規${res.added}件・上書き${res.updated}件（保存済み合計${res.total}件）`,
        warnings,
      });
      onImported?.();
    } catch (e) {
      setStatus({ type: 'err', text: `取込エラー: ${e.message}` });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  // 選択中の月の明細をまとめて削除する（マッピング修正 → 再取込のやり直し用）。
  const monthCount = month
    ? transactions.filter((t) => monthOf(t.date) === month).length
    : 0;

  async function handleDeleteMonth() {
    if (!month) return;
    if (
      !confirm(
        `${monthLabel(month)}の明細 ${monthCount}件 をすべて削除します。よろしいですか？\n（CSVを取り込み直せば復元できます）`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/transactions?month=${month}`, { method: 'DELETE' }).then((r) =>
        r.json()
      );
      setStatus({
        type: 'ok',
        text: `${monthLabel(month)}の明細 ${res.deleted}件 を削除しました（残り${res.total}件）。`,
      });
      onImported?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          importFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept=".csv"
          multiple
          ref={inputRef}
          disabled={busy}
          onChange={(e) => importFiles(e.target.files)}
        />
        <strong>CSVをここにドラッグ＆ドロップ</strong>
        <span>
          Zaim / MoneyForward を自動判別します。複数まとめて可・クリックでファイル選択
        </span>
      </label>

      <button
        className="btn ghost"
        onClick={handleDeleteMonth}
        disabled={busy || !month || monthCount === 0}
        title="マッピングを直した後などに、選択中の月を消してCSVを取り込み直せます"
      >
        {month ? `${monthLabel(month)}の明細を削除` : '月の明細を削除'}
      </button>

      {status && (
        <div className="import-result">
          <span className={`status ${status.type}`}>{status.text}</span>
          {status.warnings?.length > 0 && (
            <ul className="import-warnings">
              {status.warnings.map((w) => (
                <li key={w}>⚠️ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
