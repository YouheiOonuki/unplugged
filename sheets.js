// ===========================
// 印刷するページ（盤面・カード・こたえ）と、盤面・ロボット・カードの絵（SVG）を HTML の文字列で作る
// DOM に触らない（テストで同じ設定から同じ HTML になることを確かめる）。ブラウザでは window.Sheets
// ===========================
(function (root) {
  'use strict';
  var P = (typeof module !== 'undefined' && module.exports) ? require('./puzzle.js') : root.Puzzle;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // カードの名前と説明（印刷のカード・画面のボタン・答えの列で同じ文を使う）
  var CARDS = {
    F: { name: 'まえ', sub: '1マス すすむ', cls: 'c-move' },
    R: { name: 'みぎ', sub: 'みぎを むく', cls: 'c-turn' },
    L: { name: 'ひだり', sub: 'ひだりを むく', cls: 'c-turn' },
    N: { name: 'うえ', sub: '1マス すすむ', cls: 'c-move' },
    E: { name: 'みぎ', sub: '1マス すすむ', cls: 'c-move' },
    S: { name: 'した', sub: '1マス すすむ', cls: 'c-move' },
    W: { name: 'ひだり', sub: '1マス すすむ', cls: 'c-move' },
    REP: { name: 'くりかえし', sub: 'かい', cls: 'c-rep' },
    IF: { name: 'もし', sub: 'まえが とおれない なら', cls: 'c-if' },
    END: { name: 'ここまで', sub: '', cls: 'c-end' },
  };
  function cardTypes(mode, step) {
    var t = mode === 'muki' ? ['F', 'R', 'L'] : ['N', 'E', 'S', 'W'];
    if (step >= 2) t = t.concat(['REP', 'END']);
    if (step >= 3) t.splice(t.length - 1, 0, 'IF');
    return t;
  }

  // --- 絵（SVG）。viewBox は 1 マス 100 ---
  var ARROW = 'M50 14 L80 50 L61 50 L61 86 L39 86 L39 50 L20 50 Z';
  function icon(t) {
    var body;
    if (t === 'F' || t === 'N') body = '<path d="' + ARROW + '"/>';
    else if (t === 'E') body = '<path d="' + ARROW + '" transform="rotate(90 50 50)"/>';
    else if (t === 'S') body = '<path d="' + ARROW + '" transform="rotate(180 50 50)"/>';
    else if (t === 'W') body = '<path d="' + ARROW + '" transform="rotate(270 50 50)"/>';
    else if (t === 'R') body = '<path d="M28 88 L28 50 A20 20 0 0 1 48 30 L62 30 L62 14 L88 38 L62 62 L62 46 L50 46 A6 6 0 0 0 44 52 L44 88 Z"/>';
    else if (t === 'L') body = '<path d="M28 88 L28 50 A20 20 0 0 1 48 30 L62 30 L62 14 L88 38 L62 62 L62 46 L50 46 A6 6 0 0 0 44 52 L44 88 Z" transform="translate(100 0) scale(-1 1)"/>';
    else if (t === 'REP') body = '<path d="M50 16 A34 34 0 1 1 18 60 L32 56 A20 20 0 1 0 50 30 L50 44 L26 24 L50 4 Z"/>';
    else if (t === 'IF') body = '<path d="M50 8 L92 50 L50 92 L8 50 Z" fill="none" stroke="currentColor" stroke-width="8"/><text x="50" y="66" text-anchor="middle" font-size="46" font-weight="700" fill="currentColor">?</text>';
    else body = '<path d="M20 14 L48 14 L48 26 L34 26 L34 74 L48 74 L48 86 L20 86 Z" transform="translate(100 0) scale(-1 1)"/>';
    return '<svg class="ic" viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">' + body + '</svg>';
  }

  // ロボット（d の向きに前を向く）。cx, cy はマスの中心、s は大きさ（100 で 1 マスいっぱい）
  function robot(cx, cy, d, s, extra) {
    var k = s / 100;
    return '<g class="robot' + (extra ? ' ' + extra : '') + '" transform="translate(' + cx + ' ' + cy + ') rotate(' + (d * 90) + ') scale(' + k + ')">' +
      '<path d="M0 -46 L14 -30 L-14 -30 Z" class="rb-nose"/>' +
      '<rect x="-30" y="-28" width="60" height="58" rx="12" class="rb-body"/>' +
      '<circle cx="-12" cy="-10" r="7" class="rb-eye"/><circle cx="12" cy="-10" r="7" class="rb-eye"/>' +
      '<rect x="-14" y="10" width="28" height="7" rx="3" class="rb-eye"/>' +
      '</g>';
  }
  function rock(x, y) {
    var cx = x * 100 + 50, cy = y * 100 + 50;
    return '<g class="rock"><path d="M' + (cx - 36) + ' ' + (cy + 30) + ' L' + (cx - 40) + ' ' + (cy + 2) + ' L' + (cx - 20) + ' ' + (cy - 28) + ' L' + (cx + 8) + ' ' + (cy - 36) +
      ' L' + (cx + 34) + ' ' + (cy - 14) + ' L' + (cx + 40) + ' ' + (cy + 30) + ' Z"/>' +
      '<path class="rock-line" d="M' + (cx - 14) + ' ' + (cy - 8) + ' L' + (cx + 4) + ' ' + (cy + 4) + ' M' + (cx + 12) + ' ' + (cy - 18) + ' L' + (cx + 20) + ' ' + (cy + 12) + '"/></g>';
  }
  function flag(x, y) {
    var cx = x * 100 + 50, cy = y * 100 + 50;
    return '<g class="goal"><rect x="' + (x * 100 + 4) + '" y="' + (y * 100 + 4) + '" width="92" height="92" rx="6" class="goal-bg"/>' +
      '<path d="M' + (cx - 18) + ' ' + (cy + 20) + ' L' + (cx - 18) + ' ' + (cy - 40) + '" class="goal-pole"/>' +
      '<path d="M' + (cx - 16) + ' ' + (cy - 40) + ' L' + (cx + 30) + ' ' + (cy - 26) + ' L' + (cx - 16) + ' ' + (cy - 10) + ' Z" class="goal-flag"/>' +
      '<text x="' + cx + '" y="' + (cy + 40) + '" text-anchor="middle" class="cell-label">ゴール</text></g>';
  }

  /**
   * 盤面の SVG
   * @param {object} o { path: [[x,y],...] 答えの道（赤い線）、robotAt: {x,y,d} 画面のロボット、startRobot: true でスタートにロボットをうすく }
   */
  function boardSvg(board, o) {
    o = o || {};
    var W = board.w * 100, H = board.h * 100, s = [];
    s.push('<svg class="board" viewBox="-4 -4 ' + (W + 8) + ' ' + (H + 8) + '" role="img" aria-label="' + esc(board.w + '×' + board.h + ' の盤面。いわ ' + board.rocks.length + ' こ') + '">');
    s.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="b-bg"/>');
    for (var i = 1; i < board.w; i++) s.push('<line x1="' + i * 100 + '" y1="0" x2="' + i * 100 + '" y2="' + H + '" class="b-line"/>');
    for (var j = 1; j < board.h; j++) s.push('<line x1="0" y1="' + j * 100 + '" x2="' + W + '" y2="' + j * 100 + '" class="b-line"/>');
    s.push('<rect x="' + (board.start.x * 100 + 4) + '" y="' + (board.start.y * 100 + 4) + '" width="92" height="92" rx="6" class="start-bg"/>');
    s.push('<text x="' + (board.start.x * 100 + 50) + '" y="' + (board.start.y * 100 + 94) + '" text-anchor="middle" class="cell-label">スタート</text>');
    board.rocks.forEach(function (p) { s.push(rock(p[0], p[1])); });
    s.push(flag(board.goal.x, board.goal.y));
    if (o.path && o.path.length > 1) {
      s.push('<polyline class="ans-path" points="' + o.path.map(function (p) { return (p[0] * 100 + 50) + ',' + (p[1] * 100 + 50); }).join(' ') + '"/>');
      o.path.forEach(function (p, n) {
        if (n === 0) return;
        s.push('<circle class="ans-dot" cx="' + (p[0] * 100 + 50) + '" cy="' + (p[1] * 100 + 50) + '" r="13"/><text class="ans-num" x="' + (p[0] * 100 + 50) + '" y="' + (p[1] * 100 + 57) + '" text-anchor="middle">' + n + '</text>');
      });
    }
    if (o.startRobot) s.push(robot(board.start.x * 100 + 50, board.start.y * 100 + 46, board.mode === 'muki' ? board.start.d : 0, 70, o.startRobot === 'faint' ? 'faint' : ''));
    if (o.robotAt) s.push(robot(o.robotAt.x * 100 + 50, o.robotAt.y * 100 + 46, o.robotAt.d, 70, 'live'));
    s.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" class="b-frame"/>');
    s.push('</svg>');
    return s.join('');
  }

  // カード 1 まい（印刷・答え・画面で共通の見た目）
  function cardHtml(t, n, cls) {
    var c = CARDS[t];
    var sub = t === 'REP' ? '<span class="rep-n">' + (n ? esc(n) : '') + '</span> かい' : esc(c.sub);
    return '<div class="pcard ' + c.cls + (cls ? ' ' + cls : '') + '">' + icon(t) + '<span class="pc-name">' + esc(c.name) + '</span>' + (sub ? '<span class="pc-sub">' + sub + '</span>' : '') + '</div>';
  }

  // プログラム（カードの列）を、くりかえし・もしの中を字下げして並べる
  function programHtml(tokens) {
    var depth = 0, rows = [];
    tokens.forEach(function (k) {
      if (k.t === 'END') depth = Math.max(0, depth - 1);
      rows.push('<li style="--dep:' + depth + '">' + cardHtml(k.t, k.n, 'mini') + '</li>');
      if (k.t === 'REP' || k.t === 'IF') depth++;
    });
    return '<ol class="prog">' + rows.join('') + '</ol>';
  }

  var STEP_INST = {
    1: 'カードを じゅんばんに ならべて、ロボットを ゴールまで うごかそう。',
    2: 'おなじ ならびは「くりかえし」で まとめよう。',
    3: '「もし まえが とおれない なら」を つかって みよう。',
  };
  function rules(board) {
    var r = ['カードは <b>' + board.limit + ' まい</b>まで', 'いわ と ばんの そとには すすめない', 'ゴールに ついたら おわり'];
    if (board.mode === 'muki') r.splice(1, 0, '「みぎ」「ひだり」は その ばで むきを かえる');
    if (board.step >= 2) r.push('「くりかえし」〜「ここまで」を かいた かずだけ する');
    if (board.step >= 3) r.push('「もし」〜「ここまで」は まえが いわ か そとの ときだけ');
    return r;
  }
  function boardId(board) { return board.step + '-' + board.level.charAt(0) + (board.mode === 'muki' ? 'm' : 'y') + '-' + board.seed; }

  function head(title, sub, o, badge) {
    return '<header class="sh-head"><div class="sh-title"><h3>' + (badge ? '<span class="ans-badge">' + esc(badge) + '</span> ' : '') + esc(title) + '</h3><p class="sh-sub">' + esc(sub) + '</p></div>' +
      (o.nameField === false ? '' : '<div class="sh-fields"><span class="f"><span class="lbl">なまえ</span><span class="box name">' + (o.name ? '<span class="name-dark">' + esc(o.name) + '</span>' : '') + '</span></span></div>') + '</header>';
  }
  function foot(o, left) {
    return '<footer class="sh-foot"><span>' + esc(left || '') + '</span><span>' + (o.credit === false ? '' : 'yorozu-craft.com/unplugged/print/ で作成') + '</span></footer>';
  }
  function subLine(board) { return P.STEPS[board.step] + '・' + P.LEVELS[board.level].name + '・' + (board.mode === 'muki' ? 'まえ みぎ ひだり' : 'やじるし'); }

  /** 盤面のページ（子ども用）。プログラムを書くらん・切り取るロボットつき */
  function boardPage(board, o) {
    o = o || {};
    var cell = Math.min(150 / board.h, 176 / board.w);   // mm
    var boxes = '';
    for (var i = 1; i <= board.limit; i++) boxes += '<span class="pbox"><span class="pbox-n">' + i + '</span></span>';
    var piece = Math.max(18, Math.round(cell - 3));
    var robotSvg = '<svg viewBox="0 0 100 100" aria-hidden="true">' + robot(50, 50, 0, 88, '') + '</svg>';
    return '<section class="sheet sheet-board">' + head('ロボットを ゴールまで うごかそう', subLine(board), o) +
      '<p class="sh-inst">' + esc(STEP_INST[board.step]) + '</p>' +
      '<ul class="rules">' + rules(board).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
      '<div class="sh-body board-wrap" style="--cell:' + cell.toFixed(2) + 'mm">' + boardSvg(board, { startRobot: 'faint' }) + '</div>' +
      '<div class="write"><p class="write-h">プログラムを かこう（カードの なまえや やじるしを かく）</p><div class="pboxes">' + boxes + '</div></div>' +
      '<div class="cutout"><span class="cut-h">✂ きりとって スタートに おく</span>' +
      '<span class="piece" style="width:' + piece + 'mm;height:' + piece + 'mm">' + robotSvg + '</span><span class="piece" style="width:' + piece + 'mm;height:' + piece + 'mm">' + robotSvg + '</span></div>' +
      foot(o, 'もんだい ばんごう ' + boardId(board)) + '</section>';
  }

  /** こたえのページ（先生・おうちの人用） */
  function answerPage(board, o) {
    o = o || {};
    var tokens = P.parseCode(board.solution);
    var t = P.trace(board, tokens);
    var cell = Math.min(118 / board.h, 150 / board.w);
    var notes = [
      'この こたえの カード: <b>' + tokens.length + ' まい</b>（じょうげん ' + board.limit + ' まい）',
    ];
    if (board.seqShortest != null) notes.push('「じゅんばん」の カードだけで ならべると、いちばん みじかくて <b>' + board.seqShortest + ' まい</b>' + (board.step >= 2 ? '（じょうげんを こえるので、' + (board.step === 2 ? 'くりかえし' : 'もし') + 'が いる）' : ''));
    notes.push('ほかの ならべかたでも、じょうげんの まいすう いないで ゴールに つけば せいかい');
    if (board.step === 3) notes.push('とちゅうで まがる ところは、まえが いわ か ばんの そと。まっすぐの ところは まえが あいている');
    return '<section class="sheet sheet-answer">' + head('こたえの れい', subLine(board) + '・もんだい ばんごう ' + boardId(board), { nameField: false }, '先生・おうちの人用') +
      '<div class="ans-grid"><div class="board-wrap" style="--cell:' + cell.toFixed(2) + 'mm">' + boardSvg(board, { path: t.path, startRobot: true }) + '</div>' +
      '<div class="ans-prog"><p class="write-h">プログラム（上から じゅんに）</p>' + programHtml(tokens) + '</div></div>' +
      '<ul class="ans-notes">' + notes.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
      foot(o, '赤い 数字は ロボットが すすむ じゅんばん') + '</section>';
  }

  /** カードを何まい印刷するか（盤面ごとの答え・いちばん短い道で使う数の最大 ＋ 予備 2 まい。くりかえしの数は空らん） */
  function cardList(boards, spare) {
    spare = spare == null ? 2 : spare;
    var mode = boards[0].mode, step = boards[0].step, need = {};
    boards.forEach(function (b) {
      var n = P.cardNeeds(b);
      Object.keys(n).forEach(function (t) { need[t] = Math.max(need[t] || 0, n[t]); });
    });
    var list = [];
    cardTypes(mode, step).forEach(function (t) {
      var c = Math.max(2, (need[t] || 0) + spare);
      for (var i = 0; i < c; i++) list.push(t);
    });
    return list;
  }

  /** カードのページ（切り取って使う）。big は黒板に貼る大きさ（1 ページ 6 まい） */
  function cardPages(boards, o) {
    o = o || {};
    var list = cardList(boards);
    var per = o.big ? 6 : 18, pages = [];
    var total = Math.ceil(list.length / per);
    for (var p = 0; p < total; p++) {
      var part = list.slice(p * per, (p + 1) * per);
      pages.push('<section class="sheet sheet-cards' + (o.big ? ' big' : '') + '">' +
        head('めいれい カード', '点線で きりとって つかう' + (total > 1 ? '（' + (p + 1) + '/' + total + '）' : ''), { nameField: false }) +
        '<div class="cut-grid">' + part.map(function (t) { return cardHtml(t, ''); }).join('') + '</div>' +
        foot(o, boards[0].step >= 2 ? '「くりかえし」の □ には、くりかえす かずを かく' : '') + '</section>');
    }
    return pages;
  }

  /**
   * 印刷するページをすべて作る
   * @param {object} s 設定 { step, level, mode, seed, boards: 枚数, parts: { board, cards, answer }, big, name, credit }
   */
  function buildPages(s) {
    var boards = [];
    for (var i = 0; i < s.boards; i++) boards.push(P.generate({ step: s.step, level: s.level, mode: s.mode, seed: seedFor(s.seed, i) }));
    var o = { name: s.name, credit: s.credit, big: s.big };
    var pages = [];
    if (s.parts.board) boards.forEach(function (b) { pages.push(boardPage(b, o)); });
    if (s.parts.cards) pages = pages.concat(cardPages(boards, o));
    if (s.parts.answer) boards.forEach(function (b) { pages.push(answerPage(b, o)); });
    return { boards: boards, pages: pages };
  }
  // 2 枚目からの盤面の種（1 枚目は設定の種そのまま）
  function seedFor(seed, i) { return ((seed - 1 + i * 7331) % 99999) + 1; }

  var api = { CARDS: CARDS, cardTypes: cardTypes, icon: icon, robot: robot, boardSvg: boardSvg, cardHtml: cardHtml, programHtml: programHtml,
    boardPage: boardPage, answerPage: answerPage, cardList: cardList, cardPages: cardPages, buildPages: buildPages, seedFor: seedFor, boardId: boardId, rules: rules, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sheets = api;
})(this);
