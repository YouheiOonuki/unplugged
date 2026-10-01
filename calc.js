// ===========================
// 計算ロジック（画面から切り離した純粋関数）
// DOM や localStorage に触らない。tests/calc.test.js から node --test で確かめる
// ブラウザでは window.Calc、Node（テスト）では module.exports で使う
// ===========================
(function (root) {
  'use strict';

  var P = (typeof module !== 'undefined' && module.exports) ? require('./puzzle.js') : root.Puzzle;

  /**
   * 設定をそろえる（保存・共有リンク・読み込んだファイルの中身はそのまま信じない）
   * { step: 1|2|3, level, mode: 'yaji'|'muki', seed: 1〜99999, boards: 1〜4, parts: { board, cards, answer }, big, name（20 字まで）, credit }
   */
  function normalizeSettings(d) {
    d = d && typeof d === 'object' ? d : {};
    var o = P.normalizeOpts(d);
    var parts = d.parts && typeof d.parts === 'object' ? d.parts : {};
    var boards = Math.floor(Number(d.boards));
    return {
      step: o.step, level: o.level, mode: o.mode, seed: o.seed,
      boards: boards >= 1 && boards <= 4 ? boards : 1,
      parts: { board: parts.board !== false, cards: parts.cards !== false, answer: parts.answer !== false },
      big: d.big === true,
      name: typeof d.name === 'string' ? d.name.replace(/[\u0000-\u001f]/g, '').slice(0, 20) : '',
      credit: d.credit !== false,
    };
  }

  // --- 共有リンク（README 11: # 以降）。base64url の JSON。なまえは入れない ---
  function b64urlEncode(str) {
    var bytes = unescape(encodeURIComponent(str));
    var b = typeof btoa === 'function' ? btoa(bytes) : Buffer.from(bytes, 'binary').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bytes = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    return decodeURIComponent(escape(bytes));
  }
  function toShareHash(settings) {
    var s = normalizeSettings(settings);
    delete s.name;
    return '#s=' + b64urlEncode(JSON.stringify(s));
  }
  function fromShareHash(hash) {
    var m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash || '');
    if (!m) return null;
    try { var o = JSON.parse(b64urlDecode(m[1])); return o && typeof o === 'object' ? normalizeSettings(o) : null; } catch (e) { return null; }
  }

  // --- バックアップファイル（README「ツールを追加するとき」20。決定 D31） ---
  // 形式: { tool, version, exportedAt, data }。data はブラウザに保存しているものと同じ形
  var BACKUP_VERSION = 1;

  /** 書き出すファイル名: <ツール名>-backup-YYYYMMDD.json（日付は端末の時計） */
  function backupFileName(tool, date) {
    var d = date || new Date();
    return tool + '-backup-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
  }

  /** 書き出す中身 */
  function buildBackup(tool, data, date) {
    return { tool: tool, version: BACKUP_VERSION, exportedAt: (date || new Date()).toISOString(), data: data };
  }

  /**
   * 読み込んだファイルの文字列を確かめる。中身の正規化は画面側の既存の関数で行う
   * @param {string} [lang] 'en' なら英語の文（英語版 en/ の画面）
   * @returns {{ok: true, data: object} | {ok: false, error: string}} error は画面にそのまま出す文
   */
  var BACKUP_MSG = {
    ja: {
      read: 'ファイルを読み取れませんでした。このツールの「ファイルに書き出す」で作った .json ファイルを選んでください。',
      other: function (t) { return 'ほかのツール（' + t + '）のファイルです。このツールで書き出したファイルを選んでください。'; },
      newer: '新しい版のツールで書き出したファイルのため読み込めません。ページを再読み込みしてから、もう一度お試しください。',
      format: 'ファイルの形式が正しくないため読み込めません。',
      missing: 'ファイルの中身が足りないため読み込めません。',
    },
    en: {
      read: 'This file could not be read. Choose a .json file made with "Save to a file" in this tool.',
      other: function (t) { return 'This file is from another tool (' + t + '). Choose a file saved from this tool.'; },
      newer: 'This file was saved by a newer version of the tool. Reload the page and try again.',
      format: 'This file is not in the right format.',
      missing: 'This file is missing some settings.',
    },
  };
  function parseBackup(text, tool, requiredKeys, lang) {
    var M = BACKUP_MSG[lang === 'en' ? 'en' : 'ja'];
    var o;
    try { o = JSON.parse(text); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.tool !== 'string') {
      return { ok: false, error: M.read };
    }
    if (o.tool !== tool) {
      return { ok: false, error: M.other(o.tool.slice(0, 40)) };
    }
    if (o.version !== BACKUP_VERSION) {
      return { ok: false, error: typeof o.version === 'number' && o.version > BACKUP_VERSION
        ? M.newer
        : M.format };
    }
    var data = o.data;
    var missing = !data || typeof data !== 'object' || Array.isArray(data) ||
      (requiredKeys || []).some(function (k) { return data[k] === undefined || data[k] === null; });
    if (missing) return { ok: false, error: M.missing };
    return { ok: true, data: data };
  }

  var api = { normalizeSettings: normalizeSettings, toShareHash: toShareHash, fromShareHash: fromShareHash, backupFileName: backupFileName, buildBackup: buildBackup, parseBackup: parseBackup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
