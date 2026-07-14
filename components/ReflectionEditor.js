'use client';

import { useState } from 'react';
import { monthLabel, yen } from '@/lib/format';
import { CATEGORY_TREE, REFLECTION_MAJORS, EXCESS_REASONS } from '@/lib/mapping';

// リストがこの件数を超えたら「もっと見る」で折りたたむ。
const COLLAPSED_COUNT = 3;

// excessAmount は number input の値なので文字列で保持し、送信時に API 側で数値化する。
const EMPTY_FORM = {
  major: '',
  minor: '',
  isExcess: false,
  excessAmount: '',
  excessReason: '',
  itemName: '',
  reflection: '',
  improvement: '',
};

export default function ReflectionEditor({ month, entries, onChange }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null=新規追加, それ以外=編集中のエントリid
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 万一データが配列でない場合でも UI を壊さない（不正データの防御）。
  const list = Array.isArray(entries) ? entries : [];
  // 新しく追加したものを上に表示する。
  const ordered = [...list].reverse();
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = ordered.length - visible.length;

  // 選択中の大分類に対応する小分類の候補。
  const minorOptions = CATEGORY_TREE[form.major] || [];

  function setField(key, value) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // 大分類を変えたら、対応しない小分類はクリアする。
      if (key === 'major') {
        const allowed = CATEGORY_TREE[value] || [];
        if (!allowed.includes(next.minor)) next.minor = '';
      }
      // 超過チェックを外したら、金額と理由タグはクリアする。
      if (key === 'isExcess' && !value) {
        next.excessAmount = '';
        next.excessReason = '';
      }
      return next;
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(e) {
    setForm({
      major: e.major || '',
      minor: e.minor || '',
      isExcess: e.isExcess === true,
      // number input へは文字列で渡す（0 は「未入力」として空欄にする）。
      excessAmount: e.isExcess && e.excessAmount ? String(e.excessAmount) : '',
      excessReason: e.isExcess ? e.excessReason || '' : '',
      itemName: e.itemName || '',
      reflection: e.reflection || '',
      improvement: e.improvement || '',
    });
    setEditingId(e.id);
    setStatus(null);
  }

  async function submit() {
    if (!month) return;
    if (!form.major.trim()) {
      setStatus({ type: 'err', text: 'カテゴリ（大分類）を選択してください。' });
      return;
    }
    if (!form.reflection.trim()) {
      setStatus({ type: 'err', text: '反省点を入力してください。' });
      return;
    }
    if (!form.improvement.trim()) {
      setStatus({ type: 'err', text: '改善点を入力してください。' });
      return;
    }
    if (form.isExcess) {
      const amount = Number(form.excessAmount);
      if (!Number.isInteger(amount) || amount < 1) {
        setStatus({ type: 'err', text: '超過額は1以上の整数で入力してください。' });
        return;
      }
      if (!form.excessReason) {
        setStatus({ type: 'err', text: '超過の理由タグを選択してください。' });
        return;
      }
    }
    setSaving(true);
    setStatus(null);
    try {
      const editing = editingId != null;
      const res = await fetch('/api/reflections', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editing ? { month, id: editingId, entry: form } : { month, entry: form }
        ),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '保存に失敗しました');
      onChange?.(data.reflections);
      resetForm();
      setStatus({ type: 'ok', text: editing ? '更新しました。' : '追加しました。' });
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
      // 編集中のエントリを消したらフォームも初期化する。
      if (editingId === id) resetForm();
      onChange?.(data.reflections);
    } catch (e) {
      setStatus({ type: 'err', text: `削除エラー: ${e.message}` });
    }
  }

  const editing = editingId != null;

  return (
    <div className="panel">
      <h2>{monthLabel(month)} の反省</h2>

      {/* 入力フォーム：カテゴリ（大分類／小分類）・反省点・改善点・結果を付けて登録する */}
      <div className={`reflection-form ${editing ? 'editing' : ''}`}>
        <div className="reflection-cat-fields">
          <label className="field">
            大分類
            <select value={form.major} onChange={(e) => setField('major', e.target.value)}>
              <option value="">選択してください</option>
              {REFLECTION_MAJORS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            小分類
            <select
              value={form.minor}
              onChange={(e) => setField('minor', e.target.value)}
              disabled={minorOptions.length === 0}
            >
              <option value="">{minorOptions.length === 0 ? '（なし）' : '（指定なし）'}</option>
              {minorOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 超過支出（無駄遣い）の記録。チェック時のみ金額・理由タグを表示する。 */}
        <div className="reflection-excess-field">
          <label className="reflection-excess-check">
            <input
              type="checkbox"
              checked={form.isExcess}
              onChange={(e) => setField('isExcess', e.target.checked)}
            />
            超過支出の有無 ※セールなどによるストック（買い溜め）は含めない
          </label>
          {form.isExcess && (
            <div className="reflection-excess-detail">
              <label className="field">
                超過額（円）
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.excessAmount}
                  onChange={(e) => setField('excessAmount', e.target.value)}
                  placeholder="4000"
                />
              </label>
              <label className="field">
                理由タグ
                <select
                  value={form.excessReason}
                  onChange={(e) => setField('excessReason', e.target.value)}
                >
                  <option value="">選択してください</option>
                  {EXCESS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        {/* 品名（任意）。超過支出の対象品など、具体的な品目を記録する。 */}
        <label className="field">
          品名
          <input
            type="text"
            value={form.itemName}
            onChange={(e) => setField('itemName', e.target.value)}
            placeholder="例: ○○（任意）"
          />
        </label>

        <div className="reflection-fields">
          <label className="field grow">
            反省点
            <textarea
              value={form.reflection}
              onChange={(e) => setField('reflection', e.target.value)}
              placeholder="気づいた反省点…"
            />
          </label>
          <label className="field grow">
            改善点
            <textarea
              value={form.improvement}
              onChange={(e) => setField('improvement', e.target.value)}
              placeholder="次に向けた改善点…"
            />
          </label>
        </div>

        <div className="reflection-foot">
          <button className="btn" onClick={submit} disabled={saving || !month}>
            {editing ? '更新' : '追加'}
          </button>
          {editing && (
            <button className="btn ghost" onClick={resetForm} disabled={saving}>
              キャンセル
            </button>
          )}
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
              <li
                key={e.id}
                className={`reflection-item ${editingId === e.id ? 'is-editing' : ''}`}
              >
                <div className="reflection-item-head">
                  <span className="reflection-cat">{e.major}</span>
                  {e.minor && <span className="reflection-sub">{e.minor}</span>}
                  {e.isExcess && (
                    <span className="reflection-excess-tag">
                      超過 {yen(e.excessAmount)}
                      {e.excessReason && ` · ${e.excessReason}`}
                    </span>
                  )}
                  {e.createdAt && <span className="reflection-date">{formatDate(e.createdAt)}</span>}
                  {e.updatedAt && <span className="reflection-date">（編集済）</span>}
                  <span className="reflection-actions">
                    <button className="reflection-edit" onClick={() => startEdit(e)} title="編集">
                      編集
                    </button>
                    <button className="reflection-del" onClick={() => remove(e.id)} title="削除">
                      ×
                    </button>
                  </span>
                </div>
                {e.itemName && (
                  <div className="reflection-block">
                    <span className="reflection-label item">品名</span>
                    <p>{e.itemName}</p>
                  </div>
                )}
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
