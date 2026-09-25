// ===========================
// アンプラグド・プログラミング教材メーカー — 画面の制御（設定 → 見本 → 印刷）
// 盤面の生成と実行は puzzle.js、印刷するページの HTML は sheets.js、設定の正規化と共有・バックアップは calc.js（どれも DOM に触らない）
// ===========================
(function () {
  'use strict';
  var P = window.Puzzle, S = window.Sheets, C = window.Calc;

  // --- ブラウザへの保存（README「ツールを追加するとき」12）。キーは "unplugged_" で始める ---
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
    var s = state();
    // 「もし」はまえ・みぎ・ひだりのカードだけ
    radios('mode').forEach(function (r) { r.disabled = s.step === 3 && r.value === 'yaji'; });
    if (s.step === 3) setRadio('mode', 'muki');
    $('mode-note').textContent = s.step === 3 ? '「もし まえが とおれない」は向きのあるカードで使います。' : '「みぎ」「ひだり」はロボットから見た向き（その場で回る）。';
    var out = S.buildPages(s);
    $('sheets').innerHTML = out.pages.join('') || '<p class="small">印刷するものを選んでください（くわしい設定）。</p>';
    $('btn-print').disabled = out.pages.length === 0;
    $('preview-info').textContent = out.pages.length + ' ページ・もんだい ばんごう ' + S.boardId(out.boards[0]);
    $('btn-try').href = './try.html' + C.toShareHash(s);
    var parts = [s.parts.board && '盤面', s.parts.cards && 'カード', s.parts.answer && 'こたえ'].filter(Boolean).join('・') || 'なし';
    window.YorozuScreen.detailsSummary({ 'opt-more': parts + '、' + s.boards + ' 枚' + (s.big ? '、大きいカード' : '') });
    bar.set(P.STEPS[s.step] + '・' + P.LEVELS[s.level].name + '（' + out.pages.length + ' ページ）');
    fitPreview();
    if (!sharedView) store.set('settings', s);
    return s;
  }

  // 見本は A4 を画面の幅に縮める（印刷では原寸）
  function fitPreview() {
    var box = $('sheets'), w = box.clientWidth, pw = 210 * 96 / 25.4;
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

  // --- 共有リンク（README 11: # 以降。なまえは入れない） ---
  $('share').addEventListener('click', function () {
    var url = location.href.split('#')[0] + C.toShareHash(state());
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
    history.replaceState(null, '', url);
    $('backup-msg').textContent = 'リンクをコピーしました（アドレス欄にも出ています）。なまえは入りません。';
  });

  // --- ファイルへの書き出し・読み込み（README 20・決定 D31） ---
  var TOOL = 'unplugged';
  $('backup-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(C.buildBackup(TOOL, { settings: state() }), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = C.backupFileName(TOOL);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    $('backup-msg').textContent = 'ファイルに書き出しました。機種変更のときは、このファイルを新しい端末に移して「ファイルから読み込む」を押してください。';
  });
  $('backup-import').addEventListener('click', function () { $('backup-file').click(); });
  $('backup-file').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) { $('backup-msg').textContent = 'ファイルが大きすぎます。このツールで書き出したファイルを選んでください。'; return; }
    file.text().then(function (text) {
      var r = C.parseBackup(text, TOOL, ['settings']);
      if (!r.ok) { $('backup-msg').textContent = r.error; return; }
      if (!window.confirm('ファイルの内容で、今の設定を置き換えます。よろしいですか？')) return;
      sharedView = false;
      $('shared-banner').hidden = true;
      apply(r.data.settings);
      render();
      $('backup-msg').textContent = 'ファイルから読み込みました。';
    }, function () { $('backup-msg').textContent = 'ファイルを読み取れませんでした。'; });
  });

  // --- はじめ ---
  var shared = C.fromShareHash(location.hash);
  if (shared) {
    sharedView = true;
    apply(shared);
    $('shared-banner').hidden = false;
    $('shared-banner').textContent = '共有された盤面です（もんだい ばんごう ' + S.boardId(P.generate(C.normalizeSettings(shared))) + '）。設定を変えると、この端末に保存されます。';
  } else {
    apply(store.get('settings', null) || { seed: newSeed() });
  }
  render();

  // 開いているページに共有リンクを貼ったとき（# だけ変わるので読み込み直さない）も、共有の盤面にする
  addEventListener('hashchange', function () { if (C.fromShareHash(location.hash)) location.reload(); });

  // ブラウザのメニュー（Ctrl+P）から印刷しても見本がそのまま出る（見本の DOM を印刷するので白紙にならない）
  addEventListener('beforeprint', fitPreview);

  // オフライン対応。登録は './sw.js' だけ（README 13）
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
  }
})();
