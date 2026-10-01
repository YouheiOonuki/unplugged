// ===========================
// アンプラグド・プログラミング教材メーカーの英語版（en/）— 画面の制御（設定 → 見本 → 印刷）
// 日本語版の main.js と同じ流れ。盤面は ../puzzle.js、印刷するページは ../sheets.js（lang: 'en'）、設定・共有・バックアップは ../calc.js
// 違い: 文が英語、用紙（A4 / US Letter）を選べる、ためす画面（try.html）へのボタンは無い（ためす画面は日本語だけ）
// ===========================
(function () {
  'use strict';
  var P = window.Puzzle, S = window.Sheets, C = window.Calc;

  // --- ブラウザへの保存（README「ツールを追加するとき」12）。キーは "unplugged_" で始める。日本語版の unplugged_settings とは別に持つ ---
  var KEY_PREFIX = 'unplugged_';
  var store = {
    get: function (name, fallback) {
      try { var v = localStorage.getItem(KEY_PREFIX + name); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set: function (name, value) {
      try { localStorage.setItem(KEY_PREFIX + name, JSON.stringify(value)); } catch (e) { /* 保存できなくても続ける */ }
    },
  };

  function $(id) { return document.getElementById(id); }
  function radios(name) { return Array.prototype.slice.call(document.querySelectorAll('input[name="' + name + '"]')); }
  function radioVal(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function setRadio(name, v) { radios(name).forEach(function (r) { r.checked = r.value === String(v); }); }
  function newSeed() { return 1 + Math.floor(Math.random() * 99999); }
  // 用紙の既定: 米国・カナダ・メキシコ・フィリピンの言語設定なら US Letter、ほかは A4
  function defaultPaper() { return /-(US|CA|MX|PH)$/i.test(navigator.language || '') ? 'letter' : 'a4'; }
  function paper() { return radioVal('paper') === 'letter' ? 'letter' : 'a4'; }

  var sharedView = false;   // 共有リンクで開いたあと、何か変えるまでは自分の保存を上書きしない

  function state() {
    return C.normalizeSettings({
      step: radioVal('step'), level: radioVal('level'), mode: radioVal('mode'),
      seed: $('seed').value, boards: $('boards').value,
      parts: { board: $('part-board').checked, cards: $('part-cards').checked, answer: $('part-answer').checked },
      big: $('big').checked, name: $('name').value, credit: $('credit').checked,
    });
  }
  function apply(s) {
    s = C.normalizeSettings(s);
    setRadio('step', s.step); setRadio('level', s.level); setRadio('mode', s.mode);
    $('seed').value = s.seed; $('boards').value = String(s.boards);
    $('part-board').checked = s.parts.board; $('part-cards').checked = s.parts.cards; $('part-answer').checked = s.parts.answer;
    $('big').checked = s.big; $('name').value = s.name; $('credit').checked = s.credit;
  }

  var bar = window.YorozuScreen.fixedBar({ bar: 'fixbar', watch: 'print-row', jump: 'print-row', text: 'fixbar-text', onClick: doPrint });

  function render() {
    var s = state(), pp = paper();
    // 「If」はまえ・みぎ・ひだり（Forward and turn）のカードだけ
    radios('mode').forEach(function (r) { r.disabled = s.step === 3 && r.value === 'yaji'; });
    if (s.step === 3) { setRadio('mode', 'muki'); s.mode = 'muki'; }
    $('mode-note').textContent = s.step === 3 ? '"If blocked" works with Forward and turn cards.' : 'Arrows move one square that way. Turn cards turn the robot on its square.';
    var out = S.buildPages(Object.assign({}, s, { lang: 'en', paper: pp }));
    $('sheets').className = 'sheets' + (pp === 'letter' ? ' letter' : '');
    $('page-size').textContent = '@page { size: ' + (pp === 'letter' ? 'letter' : 'A4') + ' portrait; margin: 0; }';
    $('sheets').innerHTML = out.pages.join('') || '<p class="small">Choose what to print (More settings).</p>';
    $('btn-print').disabled = out.pages.length === 0;
    $('preview-info').textContent = out.pages.length + (out.pages.length === 1 ? ' page' : ' pages') + ' · puzzle ' + S.boardId(out.boards[0]);
    var parts = [s.parts.board && 'board', s.parts.cards && 'cards', s.parts.answer && 'answers'].filter(Boolean).join(', ') || 'nothing';
    window.YorozuScreen.detailsSummary({ 'opt-more': parts + '; ' + s.boards + (s.boards === 1 ? ' board' : ' boards') + (s.big ? '; large cards' : '') });
    bar.set(S.STEPS_EN[s.step] + ' · ' + S.LEVELS_EN[s.level] + ' (' + out.pages.length + (out.pages.length === 1 ? ' page)' : ' pages)'));
    fitPreview();
    if (!sharedView) store.set('en_settings', s);
    store.set('en_paper', pp);
    return s;
  }

  // 見本は用紙を画面の幅に縮める（印刷では原寸）
  function fitPreview() {
    var box = $('sheets'), w = box.clientWidth, pw = (paper() === 'letter' ? 215.9 : 210) * 96 / 25.4;
    if (!w) return;
    var z = Math.min(1, (w - 4) / pw);
    box.style.setProperty('--z', String(z));
    box.style.setProperty('--zs', String(z * 0.3));
  }
  addEventListener('resize', fitPreview);

  function doPrint() {
    render();
    window.print();
  }
  $('btn-print').addEventListener('click', doPrint);
  $('btn-new').addEventListener('click', function () { $('seed').value = newSeed(); changed(); });

  function changed() { if (sharedView) { sharedView = false; $('shared-banner').hidden = true; } render(); }
  document.querySelectorAll('#sec-type input, #sec-opts input, #opt-more input, #opt-more select').forEach(function (el) {
    el.addEventListener(el.type === 'text' || el.type === 'number' ? 'input' : 'change', changed);
  });

  // --- 共有リンク（README 11: # 以降。名前は入れない）。日本語版と同じ形なので、どちらの画面でも同じ盤面が開く ---
  $('share').addEventListener('click', function () {
    var url = location.href.split('#')[0] + C.toShareHash(state());
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
    history.replaceState(null, '', url);
    $('backup-msg').textContent = 'Link copied (it is also in the address bar). The name is not included.';
  });

  // --- ファイルへの書き出し・読み込み（README 20・決定 D31）。ファイルの形は日本語版と同じ ---
  var TOOL = 'unplugged';
  $('backup-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(C.buildBackup(TOOL, { settings: state() }), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = C.backupFileName(TOOL);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    $('backup-msg').textContent = 'Saved to a file. On a new device, open this page and press "Load from a file".';
  });
  $('backup-import').addEventListener('click', function () { $('backup-file').click(); });
  $('backup-file').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) { $('backup-msg').textContent = 'This file is too large. Choose a file saved from this tool.'; return; }
    file.text().then(function (text) {
      var r = C.parseBackup(text, TOOL, ['settings'], 'en');
      if (!r.ok) { $('backup-msg').textContent = r.error; return; }
      if (!window.confirm('Replace the current settings with the ones in this file?')) return;
      sharedView = false;
      $('shared-banner').hidden = true;
      apply(r.data.settings);
      render();
      $('backup-msg').textContent = 'Loaded from the file.';
    }, function () { $('backup-msg').textContent = 'This file could not be read.'; });
  });

  // --- はじめ ---
  setRadio('paper', store.get('en_paper', null) || defaultPaper());
  var shared = C.fromShareHash(location.hash);
  if (shared) {
    sharedView = true;
    apply(shared);
    $('shared-banner').hidden = false;
    $('shared-banner').textContent = 'This is a shared puzzle (number ' + S.boardId(P.generate(C.normalizeSettings(shared))) + '). Change any setting to save it in this browser.';
  } else {
    apply(store.get('en_settings', null) || { seed: newSeed() });
  }
  render();

  // 開いているページに共有リンクを貼ったとき（# だけ変わるので読み込み直さない）も、共有の盤面にする
  addEventListener('hashchange', function () { if (C.fromShareHash(location.hash)) location.reload(); });

  // ブラウザのメニュー（Ctrl+P）から印刷しても見本がそのまま出る
  addEventListener('beforeprint', fitPreview);

  // オフライン対応。Service Worker は日本語版と同じ ../sw.js（スコープ /unplugged/）
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', function () { navigator.serviceWorker.register('../sw.js').catch(function () {}); });
  }
})();
