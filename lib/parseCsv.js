// ============================================================================
// ブラウザ側で CSV ファイルを読み込む。
//  - 両CSVとも Shift-JIS。TextDecoder で UTF-8 の文字列に変換してから Papa Parse。
//  - まれに UTF-8 で書き出される場合に備え、文字化け（U+FFFD）が少ない方を採用。
// ============================================================================

import Papa from 'papaparse';

function decodeBest(buffer) {
  const bytes = new Uint8Array(buffer);
  // UTF-8 BOM があれば UTF-8 確定。
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  const sjis = new TextDecoder('shift_jis').decode(bytes);
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const bad = (s) => (s.match(/�/g) || []).length;
  return bad(sjis) <= bad(utf8) ? sjis : utf8;
}

// File -> パース済みオブジェクト配列（ヘッダ行をキーにする）。
export async function readCsvFile(file) {
  const buffer = await file.arrayBuffer();
  const text = decodeBest(buffer);
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}
