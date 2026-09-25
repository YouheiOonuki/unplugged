// ===========================
// 盤面の生成・プログラムの実行・いちばん短い道の探索（画面から切り離した純粋関数）
// DOM や localStorage に触らない。tests/*.test.js から node --test で確かめる
// ブラウザでは window.Puzzle、Node（テスト）では module.exports
//
// 盤面: { w, h, start: {x, y, d}, goal: {x, y}, rocks: [[x, y], ...], step, level, mode, seed, limit, solution, seqShortest }
//   d（向き）: 0 うえ・1 みぎ・2 した・3 ひだり。x は左から、y は上から（0 始まり）
// カード（トークン）: { t: 'F' | 'L' | 'R' | 'N' | 'E' | 'S' | 'W' | 'REP' | 'IF' | 'END', n? }
//   F まえ / L ひだりをむく / R みぎをむく（むきのカード）、N E S W うえ・みぎ・した・ひだりへ（やじるしのカード）
//   REP くりかえし n かい、IF もし まえが とおれない なら、END ここまで。カード 1 まい ＝ トークン 1 つ
// 文字列の形（共有リンク・テスト用）: F L R N E S W、"3[" くりかえし 3 かい、"?[" もし、"]" ここまで。例 "3[FRFL]"
// ===========================
(function (root) {
  'use strict';

  var DX = [0, 1, 0, -1];
  var DY = [-1, 0, 1, 0];
  var ARROW_DIR = { N: 0, E: 1, S: 2, W: 3 };
  var DIR_ARROW = ['N', 'E', 'S', 'W'];
  var MAX_REPEAT = 20;      // くりかえしの回数の上限（カードに書く数）
  var MAX_ACTIONS = 3000;   // 実行するうごきの上限（入れ子のくりかえしで長くなりすぎないように）

  // 段階（ステップ）とむずかしさ。盤面の大きさ・いわの数・カードの余り（いちばん短いプログラムより何まい多く使ってよいか）
  var STEPS = { 1: 'じゅんばん', 2: 'くりかえし', 3: 'もし' };
  var LEVELS = {
    easy:   { name: 'かんたん',   w: 4, h: 4, rocks: [2, 3], slack: { 1: 2, 2: 1, 3: 0 }, seq: { yaji: [3, 5], muki: [3, 6] },  turns: [2, 2], seg: 3 },
    normal: { name: 'ふつう',     w: 5, h: 5, rocks: [4, 5], slack: { 1: 1, 2: 1, 3: 0 }, seq: { yaji: [5, 7], muki: [6, 9] },  turns: [2, 3], seg: 3 },
    hard:   { name: 'むずかしい', w: 6, h: 6, rocks: [6, 8], slack: { 1: 0, 2: 0, 3: 0 }, seq: { yaji: [7, 10], muki: [9, 13] }, turns: [3, 4], seg: 4 },
  };
  var MODES = { yaji: 'やじるし', muki: 'まえ・みぎ・ひだり' };

  // --- 乱数（同じ種なら同じ盤面） ---
  function rng(seed) {
    var a = (Number(seed) >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ri(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }

  // --- 盤面の道具 ---
  function key(x, y) { return x + ',' + y; }
  function rockSet(board) { var s = {}; (board.rocks || []).forEach(function (p) { s[key(p[0], p[1])] = true; }); return s; }
  function inside(board, x, y) { return x >= 0 && y >= 0 && x < board.w && y < board.h; }
  function free(board, rocks, x, y) { return inside(board, x, y) && !rocks[key(x, y)]; }

  // --- カードの文字列 ⇄ トークン ---
  function parseCode(code) {
    var out = [], s = String(code || '');
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if ('FLRNESW'.indexOf(c) >= 0) out.push({ t: c });
      else if (c === ']') out.push({ t: 'END' });
      else if (c === '?' && s[i + 1] === '[') { out.push({ t: 'IF' }); i++; }
      else if (/[0-9]/.test(c)) {
        var m = /^([0-9]+)\[/.exec(s.slice(i));
        if (!m) return null;
        out.push({ t: 'REP', n: Number(m[1]) });
        i += m[0].length - 1;
      } else if (/\s/.test(c)) continue;
      else return null;
    }
    return out;
  }
  function toCode(tokens) {
    return (tokens || []).map(function (k) {
      return k.t === 'REP' ? k.n + '[' : k.t === 'IF' ? '?[' : k.t === 'END' ? ']' : k.t;
    }).join('');
  }

  // --- プログラムの組み立て（カードの列 → 木）。エラーは画面にそのまま出す文 ---
  function build(tokens, mode) {
    var stack = [{ kids: [] }];
    for (var i = 0; i < tokens.length; i++) {
      var k = tokens[i];
      if (k.t === 'REP' || k.t === 'IF') {
        if (k.t === 'REP' && !(k.n >= 1 && k.n <= MAX_REPEAT && Math.floor(k.n) === k.n)) {
          return { error: 'くりかえしの かずは 1〜' + MAX_REPEAT + ' に してください。', at: i };
        }
        if (k.t === 'IF' && mode === 'yaji') return { error: '「もし」は まえ・みぎ・ひだりの カードで つかいます。', at: i };
        var node = { t: k.t, n: k.n, i: i, kids: [] };
        stack[stack.length - 1].kids.push(node);
        stack.push(node);
      } else if (k.t === 'END') {
        if (stack.length === 1) return { error: '「ここまで」が おおすぎます（' + (i + 1) + 'まいめ）。', at: i };
        stack.pop();
      } else if ('FLR'.indexOf(k.t) >= 0) {
        if (mode === 'yaji') return { error: 'やじるしの カードで つくってください。', at: i };
        stack[stack.length - 1].kids.push({ t: k.t, i: i });
      } else if ('NESW'.indexOf(k.t) >= 0) {
        if (mode === 'muki') return { error: 'まえ・みぎ・ひだりの カードで つくってください。', at: i };
        stack[stack.length - 1].kids.push({ t: k.t, i: i });
      } else {
        return { error: 'わからない カードが あります。', at: i };
      }
    }
    if (stack.length > 1) {
      var open = stack[stack.length - 1];
      return { error: '「' + (open.t === 'REP' ? 'くりかえし' : 'もし') + '」の「ここまで」が たりません。', at: open.i };
    }
    return { tree: stack[0].kids };
  }

  /**
   * プログラムを動かす。ゴールに着いたら、そこでおわり（せいこう）
   * @returns {{result: 'goal'|'bump'|'end'|'error'|'toolong', events: Array, error?: string, cards: number}}
   *   events: { type: 'move'|'turn'|'check'|'bump'|'goal', x, y, d, i（カードの番号）, blocked? }
   */
  function run(board, tokens, mode) {
    mode = mode || board.mode;
    var b = build(tokens, mode);
    if (b.error) return { result: 'error', error: b.error, at: b.at, events: [], cards: tokens.length };
    var rocks = rockSet(board);
    var st = { x: board.start.x, y: board.start.y, d: board.start.d };
    var events = [], done = null, actions = 0;

    function blockedAhead() { return !free(board, rocks, st.x + DX[st.d], st.y + DY[st.d]); }
    function forward(i) {
      var nx = st.x + DX[st.d], ny = st.y + DY[st.d];
      if (!free(board, rocks, nx, ny)) {
        events.push({ type: 'bump', x: st.x, y: st.y, d: st.d, i: i, tx: nx, ty: ny, out: !inside(board, nx, ny) });
        done = 'bump';
        return;
      }
      st.x = nx; st.y = ny;
      events.push({ type: 'move', x: st.x, y: st.y, d: st.d, i: i });
      if (st.x === board.goal.x && st.y === board.goal.y) { events.push({ type: 'goal', x: st.x, y: st.y, d: st.d, i: i }); done = 'goal'; }
    }
    function exec(list) {
      for (var j = 0; j < list.length && !done; j++) {
        var node = list[j];
        if (++actions > MAX_ACTIONS) { done = 'toolong'; return; }
        if (node.t === 'F') forward(node.i);
        else if (node.t === 'L' || node.t === 'R') {
          st.d = (st.d + (node.t === 'R' ? 1 : 3)) % 4;
          events.push({ type: 'turn', x: st.x, y: st.y, d: st.d, i: node.i });
        } else if (ARROW_DIR[node.t] != null) {
          st.d = ARROW_DIR[node.t];
          forward(node.i);
        } else if (node.t === 'REP') {
          for (var c = 0; c < node.n && !done; c++) exec(node.kids);
        } else if (node.t === 'IF') {
          var bl = blockedAhead();
          events.push({ type: 'check', x: st.x, y: st.y, d: st.d, i: node.i, blocked: bl });
          if (bl) exec(node.kids);
        }
      }
    }
    exec(b.tree);
    return { result: done || 'end', events: events, cards: tokens.length, end: { x: st.x, y: st.y, d: st.d } };
  }

  /**
   * カードを「じゅんばん」だけで並べたときの、いちばん短いプログラム（幅優先探索）
   * むき: 状態（x, y, 向き）で F・L・R。やじるし: マスで N・E・S・W
   * @returns {{length: number, tokens: Array} | null}（着けないなら null）
   */
  function shortest(board, mode) {
    mode = mode || board.mode;
    var rocks = rockSet(board);
    var s = board.start, g = board.goal;
    var q = [], prev = {}, head = 0;
    function sk(x, y, d) { return mode === 'muki' ? x + ',' + y + ',' + d : x + ',' + y; }
    var k0 = sk(s.x, s.y, s.d);
    prev[k0] = null; q.push({ x: s.x, y: s.y, d: s.d, k: k0 });
    if (s.x === g.x && s.y === g.y) return { length: 0, tokens: [] };
    while (head < q.length) {
      var c = q[head++];
      var nexts = [];
      if (mode === 'muki') {
        var fx = c.x + DX[c.d], fy = c.y + DY[c.d];
        if (free(board, rocks, fx, fy)) nexts.push({ x: fx, y: fy, d: c.d, t: 'F' });
        nexts.push({ x: c.x, y: c.y, d: (c.d + 1) % 4, t: 'R' });
        nexts.push({ x: c.x, y: c.y, d: (c.d + 3) % 4, t: 'L' });
      } else {
        for (var d = 0; d < 4; d++) {
          var ax = c.x + DX[d], ay = c.y + DY[d];
          if (free(board, rocks, ax, ay)) nexts.push({ x: ax, y: ay, d: d, t: DIR_ARROW[d] });
        }
      }
      for (var n = 0; n < nexts.length; n++) {
        var nx = nexts[n], nk = sk(nx.x, nx.y, nx.d);
        if (nk in prev) continue;
        prev[nk] = { k: c.k, t: nx.t };
        if (nx.x === g.x && nx.y === g.y) {
          var toks = [], cur = nk;
          while (prev[cur]) { toks.unshift({ t: prev[cur].t }); cur = prev[cur].k; }
          return { length: toks.length, tokens: toks };
        }
        q.push({ x: nx.x, y: nx.y, d: nx.d, k: nk });
      }
    }
    return null;
  }

  // 動いた道（マスの列）。ゴールに着くまでを返す
  function trace(board, tokens) {
    var r = run(board, tokens);
    var path = [[board.start.x, board.start.y]];
    r.events.forEach(function (e) { if (e.type === 'move') path.push([e.x, e.y]); });
    return { result: r.result, path: path, run: r };
  }

  // --- 盤面の生成 ---
  function normalizeOpts(o) {
    o = o || {};
    var step = [1, 2, 3].indexOf(Number(o.step)) >= 0 ? Number(o.step) : 1;
    var level = LEVELS[o.level] ? o.level : 'easy';
    var mode = o.mode === 'muki' ? 'muki' : 'yaji';
    if (step === 3) mode = 'muki';   // 「もし まえが とおれない」は向きのあるカードでだけ意味がある
    var seed = Math.floor(Number(o.seed));
    if (!(seed >= 1 && seed <= 99999)) seed = 1;
    return { step: step, level: level, mode: mode, seed: seed };
  }

  function finish(o, L, b) {
    b.step = o.step; b.level = o.level; b.mode = o.mode; b.seed = o.seed;
    b.rocks.sort(function (p, q) { return p[1] - q[1] || p[0] - q[0]; });
    var sh = shortest(b);
    b.seqShortest = sh ? sh.length : null;
    return b;
  }

  function genStep1(o, L, r) {
    var range = L.seq[o.mode];
    for (var attempt = 0; attempt < 4000; attempt++) {
      var b = { w: L.w, h: L.h, mode: o.mode, rocks: [] };
      b.start = { x: ri(r, 0, L.w - 1), y: ri(r, 0, L.h - 1), d: o.mode === 'muki' && o.level !== 'easy' ? ri(r, 0, 3) : 0 };
      var cells = [];
      for (var y = 0; y < L.h; y++) for (var x = 0; x < L.w; x++) if (x !== b.start.x || y !== b.start.y) cells.push([x, y]);
      shuffle(r, cells);
      b.goal = { x: cells[0][0], y: cells[0][1] };
      var nr = ri(r, L.rocks[0], L.rocks[1]);
      b.rocks = cells.slice(1, 1 + nr);
      var sh = shortest(b, o.mode);
      if (!sh || sh.length < range[0] || sh.length > range[1]) continue;
      if (o.level !== 'easy') {   // いわで回り道になる盤面だけ（いわが飾りにならない）
        var open = shortest({ w: b.w, h: b.h, start: b.start, goal: b.goal, rocks: [] }, o.mode);
        if (!(open.length < sh.length)) continue;
      }
      b.solution = toCode(sh.tokens);
      b.limit = sh.length + L.slack[1];
      return b;
    }
    return null;
  }

  // くりかえしの中身（やじるし）: 直角の 2 方向を 1〜2 マスずつ（例: →↑、→→↓）
  function yajiBody(r, level) {
    var a = ri(r, 0, 3), b = (a + (r() < 0.5 ? 1 : 3)) % 4;
    var i = level === 'easy' ? 1 : ri(r, 1, 2), j = level === 'hard' ? ri(r, 1, 2) : 1;
    var body = [];
    for (var p = 0; p < i; p++) body.push(DIR_ARROW[a]);
    for (var q = 0; q < j; q++) body.push(DIR_ARROW[b]);
    return r() < 0.5 ? body : body.reverse();
  }
  var MUKI_BODIES = {
    easy: ['FRFL', 'FLFR', 'FFR', 'FFL'],
    normal: ['FRFL', 'FLFR', 'FFR', 'FFL', 'FFRFL', 'FFLFR'],
    hard: ['FRFL', 'FLFR', 'FFRFL', 'FFLFR', 'FFFR', 'FFFL', 'FRFFL'],
  };

  // 道（マスの列）を通らないマスに、いわを 1 つずつ置く。
  // 「じゅんばんだけの いちばん短いプログラム」がカードの上限を超えるまで（＝くりかえし・もしを使わないと解けない）置き、
  // そのあと むずかしさの数まで足す。置くたびに答えのプログラムでゴールに着くことを確かめる
  function placeRocks(o, L, r, b, path, tokens) {
    var onPath = {};
    path.forEach(function (p) { onPath[key(p[0], p[1])] = true; });
    b.rocks.forEach(function (p) { onPath[key(p[0], p[1])] = true; });   // すでにあるいわ（もしの曲がり角）は候補から外す
    var near = [], far = [];
    for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) {
      if (onPath[key(x, y)]) continue;
      var adj = path.some(function (p) { return Math.abs(p[0] - x) + Math.abs(p[1] - y) === 1; });
      (adj ? near : far).push([x, y]);
    }
    var cand = shuffle(r, near).concat(shuffle(r, far));
    function ok() { return run(b, tokens).result === 'goal'; }
    function forced() { var sh = shortest(b); return sh && sh.length > b.limit; }
    var rest = [];
    for (var c = 0; c < cand.length; c++) {
      if (forced()) { rest = cand.slice(c); break; }
      b.rocks.push(cand[c]);
      if (!ok()) b.rocks.pop();
    }
    if (!forced()) return false;
    var want = ri(r, L.rocks[0], L.rocks[1]);
    for (var k = 0; k < rest.length && b.rocks.length < want; k++) {
      b.rocks.push(rest[k]);
      if (!ok()) b.rocks.pop();
    }
    return true;
  }

  function genStep2(o, L, r) {
    for (var attempt = 0; attempt < 4000; attempt++) {
      var body = o.mode === 'yaji' ? yajiBody(r, o.level).join('') : pick(r, MUKI_BODIES[o.level]);
      var bodyMoves = body.replace(/[LR]/g, '').length;
      var maxN = Math.floor((L.w * L.h) / bodyMoves);
      var n = ri(r, 2, Math.min(4, maxN));
      var pre = '', post = '';
      var moves = o.mode === 'yaji' ? 'NESW' : 'F';
      if (o.level !== 'easy' && r() < 0.5) pre = o.mode === 'yaji' ? pick(r, moves.split('')) : pick(r, ['F', 'R', 'L']);
      if (o.level === 'hard' && r() < 0.6) post = o.mode === 'yaji' ? pick(r, moves.split('')) : 'F';
      var code = pre + n + '[' + body + ']' + post;
      var tokens = parseCode(code);
      var b = { w: L.w, h: L.h, mode: o.mode, rocks: [], start: { x: ri(r, 0, L.w - 1), y: ri(r, 0, L.h - 1), d: o.mode === 'muki' ? ri(r, 0, 3) : 0 } };
      if (o.mode === 'muki' && o.level === 'easy') b.start.d = 0;
      // まだゴールが無いので、いったん盤の外をゴールにして最後まで動かす
      b.goal = { x: -9, y: -9 };
      var t = trace(b, tokens);
      if (t.result !== 'end') continue;
      var seen = {}, dup = false;
      t.path.forEach(function (p) { if (seen[key(p[0], p[1])]) dup = true; seen[key(p[0], p[1])] = true; });
      if (dup || t.path.length < 4) continue;
      var last = t.path[t.path.length - 1];
      b.goal = { x: last[0], y: last[1] };
      // 最後のカードが「むく」なら、ゴールに着いたところで止まるので、そのカードは動かない（それでも正解）
      if (run(b, tokens).result !== 'goal') continue;
      b.solution = code;
      b.limit = tokens.length + L.slack[2];
      if (!placeRocks(o, L, r, b, t.path, tokens)) continue;
      return b;
    }
    return null;
  }

  function genStep3(o, L, r) {
    for (var attempt = 0; attempt < 6000; attempt++) {
      var T = r() < 0.5 ? 'R' : 'L';
      var turns = ri(r, L.turns[0], L.turns[1]);
      var b = { w: L.w, h: L.h, mode: o.mode, rocks: [], start: { x: ri(r, 0, L.w - 1), y: ri(r, 0, L.h - 1), d: ri(r, 0, 3) } };
      var x = b.start.x, y = b.start.y, d = b.start.d;
      var path = [[x, y]], visited = {}, rocks = {}, fail = false;
      visited[key(x, y)] = true;
      for (var s = 0; s <= turns && !fail; s++) {
        var len = ri(r, 1, L.seg);
        for (var m = 0; m < len; m++) {
          var nx = x + DX[d], ny = y + DY[d];
          if (!inside(b, nx, ny) || visited[key(nx, ny)] || rocks[key(nx, ny)]) { fail = true; break; }
          x = nx; y = ny; visited[key(x, y)] = true; path.push([x, y]);
        }
        if (fail || s === turns) break;
        // 曲がり角: 目の前をふさぐ（盤の外なら、そのまま「とおれない」）
        var fx = x + DX[d], fy = y + DY[d];
        if (inside(b, fx, fy)) {
          if (visited[key(fx, fy)]) { fail = true; break; }
          rocks[key(fx, fy)] = true; b.rocks.push([fx, fy]);
        }
        d = (d + (T === 'R' ? 1 : 3)) % 4;
      }
      if (fail) continue;
      var moves = path.length - 1;
      if (moves < 5) continue;
      b.goal = { x: x, y: y };
      var code = moves + '[?[' + T + ']F]';
      var tokens = parseCode(code);
      var t = trace(b, tokens);
      if (t.result !== 'goal' || t.path.length !== path.length) continue;
      b.solution = code;
      b.limit = tokens.length + L.slack[3];
      if (!placeRocks(o, L, r, b, path, tokens)) continue;
      return b;
    }
    return null;
  }

  /** 盤面を作る。同じ { step, level, mode, seed } なら同じ盤面 */
  function generate(opts) {
    var o = normalizeOpts(opts);
    var L = LEVELS[o.level];
    // 種ごとに乱数を分ける（段階・むずかしさ・カードが変わると別の盤面）
    var r = rng(o.seed * 7919 + o.step * 131 + (o.level === 'easy' ? 1 : o.level === 'normal' ? 2 : 3) * 17 + (o.mode === 'muki' ? 5 : 0));
    var b = o.step === 1 ? genStep1(o, L, r) : o.step === 2 ? genStep2(o, L, r) : genStep3(o, L, r);
    if (!b) throw new Error('盤面を作れませんでした: ' + JSON.stringify(o));
    return finish(o, L, b);
  }

  // 答えのプログラムと、いちばん短い「じゅんばんだけ」のプログラムで使うカードの種類ごとの数（カードを何まい印刷するか）
  function cardNeeds(board) {
    var need = {};
    function count(tokens) {
      var c = {};
      tokens.forEach(function (k) { c[k.t] = (c[k.t] || 0) + 1; });
      Object.keys(c).forEach(function (t) { need[t] = Math.max(need[t] || 0, c[t]); });
    }
    count(parseCode(board.solution));
    var sh = shortest(board);
    if (sh && board.step === 1) count(sh.tokens);
    return need;
  }

  var api = {
    DX: DX, DY: DY, STEPS: STEPS, LEVELS: LEVELS, MODES: MODES, MAX_REPEAT: MAX_REPEAT,
    rng: rng, parseCode: parseCode, toCode: toCode, build: build, run: run, shortest: shortest, trace: trace,
    generate: generate, normalizeOpts: normalizeOpts, cardNeeds: cardNeeds,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Puzzle = api;
})(this);
