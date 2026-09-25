// ===========================
// ためす画面: カードをならべて、ロボットを動かす（ブラウザでのこたえあわせ）
// 盤面と実行は puzzle.js（印刷と同じ関数・同じ種なので、印刷した盤面と同じになる）
// 保存はしない。盤面は共有リンク（#s=）か、印刷の画面で保存した設定から作る
// ===========================
(function () {
  'use strict';
  var P = window.Puzzle, S = window.Sheets, C = window.Calc;
  function $(id) { return document.getElementById(id); }

  var settings, board, prog = [], timer = null, robotEl = null, angle = 0;

  function load() {
    var s = C.fromShareHash(location.hash);
    if (!s) {
      try { s = C.normalizeSettings(JSON.parse(localStorage.getItem('unplugged_settings') || 'null')); } catch (e) { s = C.normalizeSettings({}); }
    }
    return s;
  }

  function setup(s) {
    stop();
    settings = C.normalizeSettings(s);
    board = P.generate(settings);
    prog = [];
    $('try-info').textContent = P.STEPS[board.step] + '・' + P.LEVELS[board.level].name + '・ばんごう ' + S.boardId(board);
    $('to-print').href = './' + C.toShareHash(settings);
    $('try-rule').textContent = 'カードは ' + board.limit + ' まいまで。いわ と そとには すすめない。ゴールに ついたら おわり。';
    $('t-step').value = String(settings.step); $('t-level').value = settings.level; $('t-mode').value = settings.mode;
    $('t-mode').disabled = settings.step === 3;
    window.YorozuScreen.detailsSummary({ 'opt-next': P.STEPS[board.step] + '・' + P.LEVELS[board.level].name });
    $('answer').innerHTML = '<p class="small">ほかの ならべかたでも、' + board.limit + ' まい いないで ゴールに つけば せいかい。</p><div class="prog-box">' + S.programHtml(P.parseCode(board.solution)) + '</div>';
    buildPalette();
    drawBoard(board.start);
    renderProg();
    $('result').textContent = ''; $('result').className = 'try-result';
  }

  function drawBoard() {
    $('board-box').innerHTML = S.boardSvg(board, {});
    var svg = $('board-box').querySelector('svg');
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.innerHTML = S.robot(0, 0, 0, 70, 'live');
    svg.insertBefore(g, svg.lastChild);
    robotEl = g.firstChild;
    angle = (board.mode === 'muki' ? board.start.d : 0) * 90;
    placeRobot(board.start.x, board.start.y, angle, false);
  }
  function placeRobot(x, y, deg, animate) {
    robotEl.style.transition = animate ? '' : 'none';
    robotEl.setAttribute('transform', '');
    robotEl.style.transform = 'translate(' + (x * 100 + 50) + 'px,' + (y * 100 + 46) + 'px) rotate(' + deg + 'deg) scale(0.7)';
  }
  function turnTo(d) {   // 向きの角度は近い回り方で（270° → 0° を逆回りしない）
    var cur = ((angle % 360) + 360) % 360, want = d * 90, diff = want - cur;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    angle += diff;
    return angle;
  }

  function buildPalette() {
    var types = S.cardTypes(board.mode, board.step), html = '';
    types.forEach(function (t) {
      var c = S.CARDS[t];
      html += '<button type="button" class="' + c.cls + '" data-t="' + t + '" aria-label="' + c.name + (c.sub && t !== 'REP' ? '（' + c.sub + '）' : '') + '">' + S.icon(t) + '<span>' + c.name + '</span></button>';
    });
    if (board.step >= 2) {
      var opts = '';
      for (var n = 2; n <= P.MAX_REPEAT; n++) opts += '<option value="' + n + '"' + (n === 3 ? ' selected' : '') + '>' + n + '</option>';
      html += '<label class="rep-pick">くりかえす かず <select id="rep-n">' + opts + '</select></label>';
    }
    $('palette').innerHTML = html;
  }
  $('palette').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-t]');
    if (!b) return;
    stop();
    var t = b.getAttribute('data-t');
    prog.push(t === 'REP' ? { t: 'REP', n: Number($('rep-n').value) } : { t: t });
    renderProg();
  });

  function renderProg(now, bad) {
    if (!prog.length) { $('prog-box').innerHTML = '<p class="small">上の カードを おして ならべよう</p>'; }
    else {
      $('prog-box').innerHTML = S.programHtml(prog);
      var lis = $('prog-box').querySelectorAll('li');
      if (now != null && lis[now]) lis[now].classList.add('now');
      if (bad != null && lis[bad]) lis[bad].classList.add('bad');
    }
    $('prog-count').textContent = prog.length + ' / ' + board.limit + ' まい';
  }

  function stop() { if (timer) { clearTimeout(timer); timer = null; } }

  function say(text, ok) { $('result').textContent = text; $('result').className = 'try-result ' + (ok ? 'ok' : 'ng'); }

  $('run').addEventListener('click', function () {
    stop();
    if (!prog.length) { say('カードを ならべてから うごかそう', false); return; }
    var r = P.run(board, prog);
    angle = (board.mode === 'muki' ? board.start.d : 0) * 90;
    placeRobot(board.start.x, board.start.y, angle, false);
    if (r.result === 'error') { renderProg(null, r.at); say(r.error, false); return; }
    say('うごいて います…', true);
    var i = 0, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function tick() {
      if (i >= r.events.length) { finish(r); return; }
      var e = r.events[i++];
      renderProg(e.i);
      if (e.type === 'move' || e.type === 'turn') placeRobot(e.x, e.y, turnTo(e.d), true);
      else if (e.type === 'bump') {
        placeRobot(e.x, e.y, turnTo(e.d), true);
        renderProg(null, e.i);
      }
      timer = setTimeout(tick, reduce ? 120 : e.type === 'check' ? 300 : 450);
    }
    // 最初の 1 フレームは位置を戻すだけ（アニメーションなし）
    requestAnimationFrame(function () { requestAnimationFrame(tick); });
  });

  function finish(r) {
    timer = null;
    var over = r.cards - board.limit;
    if (r.result === 'goal') {
      if (over > 0) say('ゴール！ でも カードが ' + over + ' まい おおい（' + board.limit + ' まいまで）', false);
      else say('ゴール！ カード ' + r.cards + ' まいで せいかい', true);
    } else if (r.result === 'bump') {
      var e = r.events[r.events.length - 1];
      say((e.out ? 'ばんの そとに でそう！' : 'いわに ぶつかった！') + '（' + (e.i + 1) + ' まいめの カード）', false);
    } else if (r.result === 'toolong') say('うごきが ながすぎます。くりかえしの かずを へらそう', false);
    else say('ゴールに とどかなかった。つづきを たそう', false);
  }

  $('undo').addEventListener('click', function () { stop(); prog.pop(); renderProg(); $('result').textContent = ''; drawBoard(); });
  $('clear').addEventListener('click', function () { stop(); prog = []; renderProg(); $('result').textContent = ''; drawBoard(); });
  $('next').addEventListener('click', function () {
    var s = C.normalizeSettings({ step: $('t-step').value, level: $('t-level').value, mode: $('t-mode').value, seed: 1 + Math.floor(Math.random() * 99999) });
    history.replaceState(null, '', location.pathname + C.toShareHash(s));
    setup(s);
    $('opt-next').open = false;
    window.scrollTo(0, 0);
  });
  $('t-step').addEventListener('change', function () { $('t-mode').disabled = $('t-step').value === '3'; if ($('t-step').value === '3') $('t-mode').value = 'muki'; });
  addEventListener('hashchange', function () { var s = C.fromShareHash(location.hash); if (s) setup(s); });

  setup(load());
})();
