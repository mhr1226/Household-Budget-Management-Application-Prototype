'use client';

import { useState } from 'react';
import { monthLabel } from '@/lib/format';
import { MAJOR_CATEGORIES } from '@/lib/mapping';

// カテゴリ入力の候補（自由入力も可）。元集計表の反省シートに倣い、大分類＋総評を出す。
const CATEGORY_SUGGESTIONS = [...MAJOR_CATEGORIES, '総評'];

// リストがこの件数を超えたら「もっと見る」で折りたたむ。
const COLLAPSED_COUNT = 3;

export default function ReflectionEditor({ month, entries, onChange }) {
  const [category, setCategory] = useState('');
  const [reflection, setReflection] = useState('');
  const [improvement, setImprovement] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const list = entries || [];
  // 新しく追加したものを上に表示する。
  const ordered = [...list].reverse();
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = ordered.length - visible.length;

  async function add() {
    if (!month) return;
    const cat = category.trim();
    if (!cat) {
      setStatus({ type: 'err', text: 'カテゴリを入力してください。' });
      return;
    }
    if (!reflection.trim() && !improvement.trim()) {
      setStatus({ type: 'err', text: '反省点か改善点のどちらかを入力してください。' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/reflections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, entry: { category: cat, reflection, improvement } }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '保存に失敗しました');
      onChange?.(data.reflections);
      // フォームをクリアして、続けて追加できるようにする。
      setCategory('');
      setReflection('');
      setImprovement('');
      setStatus({ type: 'ok', text: '追加しました。' });
    } catch (e) {
      setStatus({ type: 'err', text: `保存エラー: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    setStatus(null);
    try {
      const res = await fetch('/api/reflections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '削除に失敗しました');
      onChange?.(data.reflections);
    } catch (e) {
      setStatus({ type: 'err', text: `削除エラー: ${e.message}` });
    }
  }

  return (
    <div className="panel">
      <h2>{monthLabel(month)} の反省</h2>

      {/* 入力フォーム：カテゴリ・反省点・改善点を付けて1件ずつ追加する */}
      <div className="reflection-form">
        <label className="field" style={{ maxWidth: 300 }}>
          カテゴリ
          <input
            type="text"
            list="reflection-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="固定費・サブスク / 娯楽 / 総評 …"
          />
          <datalist id="reflection-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="reflection-fields">
          <label className="field grow">
            反省点
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="気づいた反省点…"
            />
          </label>
          <label className="field grow">
            改善点
            <textarea
              value={improvement}
              onChange={(e) => setImprovement(e.target.value)}
              placeholder="次に向けた改善点…"
            />
          </label>
        </div>
        <div className="reflection-foot">
          <button className="btn" onClick={add} disabled={saving || !month}>
            追加
          </button>
          {status && <span className={`status ${status.type}`}>{status.text}</span>}
        </div>
      </div>

      {/* 保存済みリスト */}
      {ordered.length === 0 ? (
        <p className="hint" style={{ marginTop: 16 }}>
          まだ反省が登録されていません。上のフォームから追加してください。
        </p>
      ) : (
        <>
          <ul className="reflection-list">
            {visible.map((e) => (
              <li key={e.id} className="reflection-item">
                <div className="reflection-item-head">
                  <span className="reflection-cat">{e.category}</span>
                  {e.createdAt && <span className="reflection-date">{formatDate(e.createdAt)}</span>}
                  <button className="reflection-del" onClick={() => remove(e.id)} title="削除">
                    ×
                  </button>
                </div>
                {e.reflection && (
                  <div className="reflection-block">
                    <span className="reflection-label reflect">反省点</span>
                    <p>{e.reflection}</p>
                  </div>
                )}
                {e.improvement && (
                  <div className="reflection-block">
                    <span className="reflection-label improve">改善点</span>
                    <p>{e.improvement}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {ordered.length > COLLAPSED_COUNT && (
            <button
              className="btn ghost reflection-toggle"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '表示を少なくする' : `もっと見る（残り${hiddenCount}件）`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  } catch {
    return '';
  }
}
