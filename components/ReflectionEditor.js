'use client';

import { useMemo, useState } from 'react';
import { monthLabel, yen } from '@/lib/format';
import { CATEGORY_TREE, REFLECTION_MAJORS, EXCESS_REASONS } from '@/lib/mapping';
import TruncatedText from './TruncatedText';

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
  linkedItems: [], // 反省の対象として選んだ明細のスナップショット（複数可）
  reflection: '',
  improvement: '',
};

// 明細の表示名。内容が空の明細（MFの一部など）は店名で代用する。
const itemLabel = (t) => t.item || t.store || '（名称なし）';

// 直下の割引行として自動選択しない内容。ハローズの「税金・値引き」は毎会計で出る
// 税額の打ち消し行で、商品の値引きではない。
const NON_DISCOUNT_ITEMS = ['税金・値引き'];

const snapshotOf = (t) => ({
  id: t.id,
  date: t.date,
  store: t.store || '',
  item: t.item || '',
  amount: t.amount,
});

// 商品の直下に続く割引行（割引・値引き・ポイント・ギフト券など）を取り出す。
// 「同日・同じ店・マイナス金額」の行が連続している間だけを対象にする。
// list は取込順のまま（＝レシートの並び順）であること。
function discountsBelow(list, t) {
  if (!(t.amount > 0)) return [];
  const out = [];
  const start = list.findIndex((x) => x.id === t.id);
  if (start < 0) return out;
  for (let i = start + 1; i < list.length; i++) {
    const x = list[i];
    if (x.date !== t.date || x.store !== t.store || !(x.amount < 0)) break;
    if (NON_DISCOUNT_ITEMS.some((w) => (x.item || '').includes(w))) break;
    out.push(x);
  }
  return out;
}

// 選択中の明細の合計を超過額欄（文字列）へ入れる形にする。返金などで0以下になる場合は空欄に戻す。
function linkedTotal(items) {
  const total = Math.round(items.reduce((sum, x) => sum + (Number(x.amount) || 0), 0));
  return total > 0 ? String(total) : '';
}

export default function ReflectionEditor({ month, entries, transactions, onChange }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null=新規追加, それ以外=編集中のエントリid
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // 明細ピッカーの絞り込み・並び替え。
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerSort, setPickerSort] = useState('date'); // date（日付順）| amount（金額の大きい順）

  // 万一データが配列でない場合でも UI を壊さない（不正データの防御）。
  const list = Array.isArray(entries) ? entries : [];
  // 新しく追加したものを上に表示する。
  const ordered = [...list].reverse();
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = ordered.length - visible.length;

  // 選択中の大分類に対応する小分類の候補。
  const minorOptions = CATEGORY_TREE[form.major] || [];

  // 明細ピッカーの候補。選択中の大分類・小分類で自動的に絞り込む（未選択ならその月の全支出）。
  const candidates = useMemo(() => {
    const kw = pickerQuery.trim();
    const list = (Array.isArray(transactions) ? transactions : []).filter((t) => {
      if (form.major && t.major !== form.major) return false;
      if (form.minor && t.minor !== form.minor) return false;
      if (kw && !`${t.store} ${t.item} ${t.memo}`.includes(kw)) return false;
      return true;
    });
    return list.sort((a, b) =>
      pickerSort === 'amount'
        ? b.amount - a.amount
        : a.date < b.date
          ? -1
          : a.date > b.date
            ? 1
            : 0
    );
  }, [transactions, form.major, form.minor, pickerQuery, pickerSort]);

  const selectedIds = new Set(form.linkedItems.map((x) => x.id));
  const selectedSum = form.linkedItems.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

  // 明細の選択／解除。超過チェックが入っていれば、選択中の合計を超過額へ反映し直す
  // （手入力で直した金額は、次に選択を変えるまで保持される）。
  // 商品を選ぶと直下の割引行も一緒に選び、商品を外すと一緒に外す。
  // 割引行だけを個別に外す・選ぶこともできる（その場合は1件だけ切り替わる）。
  function toggleItem(t) {
    const discounts = discountsBelow(Array.isArray(transactions) ? transactions : [], t);
    setForm((f) => {
      const exists = f.linkedItems.some((x) => x.id === t.id);
      const group = new Set([t.id, ...discounts.map((x) => x.id)]);
      const linkedItems = exists
        ? f.linkedItems.filter((x) => !group.has(x.id))
        : [
            ...f.linkedItems,
            ...[t, ...discounts]
              .filter((x) => !f.linkedItems.some((y) => y.id === x.id))
              .map(snapshotOf),
          ];
      const next = { ...f, linkedItems };
      // 分類が未選択のまま明細を選んだら、その明細の分類を引き継ぐ。
      if (!exists && !f.major && REFLECTION_MAJORS.includes(t.major)) {
        next.major = t.major;
        next.minor = (CATEGORY_TREE[t.major] || []).includes(t.minor) ? t.minor : '';
      }
      if (next.isExcess) next.excessAmount = linkedTotal(linkedItems);
      return next;
    });
  }

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
      // 超過チェックを入れたとき、明細を選択済みならその合計を超過額の初期値にする。
      if (key === 'isExcess' && value && next.linkedItems.length > 0) {
        next.excessAmount = linkedTotal(next.linkedItems);
      }
      return next;
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setPickerQuery('');
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
      linkedItems: Array.isArray(e.linkedItems) ? e.linkedItems : [],
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

        {/* 対象の明細（任意・複数可）。似た明細をまとめて1件の反省にできる。 */}
        <div className="reflection-picker">
          <div className="reflection-picker-head">
            <span className="reflection-picker-title">対象の明細（任意・複数選択可）</span>
            <input
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="店名・内容で絞り込み"
            />
            <div className="seg">
              <button
                type="button"
                className={pickerSort === 'date' ? 'active' : ''}
                onClick={() => setPickerSort('date')}
              >
                日付順
              </button>
              <button
                type="button"
                className={pickerSort === 'amount' ? 'active' : ''}
                onClick={() => setPickerSort('amount')}
              >
                金額順
              </button>
            </div>
          </div>

          {form.linkedItems.length > 0 && (
            <div className="reflection-picked">
              {form.linkedItems.map((x) => (
                <span key={x.id} className="reflection-chip">
                  <TruncatedText text={itemLabel(x)} />
                  <span className="reflection-chip-amount">{yen(x.amount)}</span>
                  <button type="button" onClick={() => toggleItem(x)} title="選択を外す">
                    ×
                  </button>
                </span>
              ))}
              <span className="reflection-picked-total">
                {form.linkedItems.length} 件 合計 {yen(selectedSum)}
              </span>
            </div>
          )}

          <div className="reflection-picker-list">
            {candidates.length === 0 ? (
              <div className="reflection-picker-empty">該当する明細がありません。</div>
            ) : (
              candidates.map((t) => (
                <label
                  key={t.id}
                  className={`reflection-picker-row ${selectedIds.has(t.id) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleItem(t)}
                  />
                  <span className="reflection-picker-date">{t.date.slice(5)}</span>
                  <span className="reflection-picker-name">
                    <TruncatedText text={itemLabel(t)} />
                    {t.item && t.store && <span className="reflection-picker-store">{t.store}</span>}
                  </span>
                  <span className="reflection-picker-cat">{t.minor}</span>
                  <span className={`reflection-picker-amount ${t.amount < 0 ? 'neg' : ''}`}>
                    {yen(t.amount)}
                  </span>
                </label>
              ))
            )}
          </div>
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
                超過額（円）{form.linkedItems.length > 0 && ' ※選択した明細の合計を自動入力・修正可'}
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

        {/* 品名（任意）。明細に無い項目や、複数明細をまとめた呼び名などを自由に書ける。 */}
        <label className="field">
          品名
          <input
            type="text"
            value={form.itemName}
            onChange={(e) => setField('itemName', e.target.value)}
            placeholder="例: ○○（任意・明細以外の項目や補足もここに書けます）"
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
                {e.linkedItems?.length > 0 && (
                  <div className="reflection-block">
                    <span className="reflection-label item">明細</span>
                    <ul className="reflection-linked">
                      {e.linkedItems.map((x) => (
                        <li key={x.id}>
                          <span className="reflection-picker-date">{x.date.slice(5)}</span>
                          <TruncatedText text={itemLabel(x)} />
                          <span className="reflection-chip-amount">{yen(x.amount)}</span>
                        </li>
                      ))}
                      {e.linkedItems.length > 1 && (
                        <li className="reflection-linked-total">
                          合計{' '}
                          {yen(e.linkedItems.reduce((sum, x) => sum + (Number(x.amount) || 0), 0))}
                        </li>
                      )}
                    </ul>
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
