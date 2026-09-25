// 盤面の生成・実行・探索のテスト: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../puzzle.js');

const B = (o) => Object.assign({ w: 4, h: 4, mode: 'muki', start: { x: 0, y: 3, d: 0 }, goal: { x: 3, y: 0 }, rocks: [] }, o);
const code = (c) => P.parseCode(c);

test('rng: 同じ種なら同じ並び、ちがう種ならちがう並び', () => {
  const a = P.rng(42), b = P.rng(42), c = P.rng(43);
  const xa = [a(), a(), a()], xb = [b(), b(), b()], xc = [c(), c(), c()];
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, xc);
  xa.forEach((v) => assert.ok(v >= 0 && v < 1));
});

test('parseCode / toCode: 行って戻る', () => {
  for (const c of ['F', 'FFRFL', '3[FR]', '12[?[L]F]', 'N2[ES]W', '2[3[F]R]', '']) assert.equal(P.toCode(code(c)), c);
  assert.deepEqual(code('3[F]'), [{ t: 'REP', n: 3 }, { t: 'F' }, { t: 'END' }]);
  assert.equal(code('X'), null);
  assert.equal(code('3F'), null);
});

test('build: 「ここまで」の数・カードの種類・くりかえしの数をたしかめる', () => {
  assert.match(P.build(code('3[F'), 'muki').error, /「くりかえし」の「ここまで」が たりません/);
  assert.match(P.build(code('?[R'), 'muki').error, /「もし」の「ここまで」が たりません/);
  assert.match(P.build(code('F]'), 'muki').error, /「ここまで」が おおすぎます（2まいめ）/);
  assert.match(P.build(code('?[E]'), 'yaji').error, /「もし」は まえ・みぎ・ひだり/);
  assert.match(P.build(code('N'), 'muki').error, /まえ・みぎ・ひだりの カードで/);
  assert.match(P.build(code('F'), 'yaji').error, /やじるしの カードで/);
  assert.match(P.build([{ t: 'REP', n: 21 }, { t: 'F' }, { t: 'END' }], 'muki').error, /1〜20/);
  assert.match(P.build([{ t: 'REP', n: 0 }, { t: 'F' }, { t: 'END' }], 'muki').error, /1〜20/);
  assert.ok(P.build(code('20[F]'), 'muki').tree);
});

test('run: まえ・みぎ・ひだり（その場で向きを変える）', () => {
  const b = B({});
  const r = P.run(b, code('FFFRFFF'));
  assert.equal(r.result, 'goal');
  assert.deepEqual(r.end, { x: 3, y: 0, d: 1 });
  assert.equal(P.run(b, code('FF')).result, 'end');
  assert.deepEqual(P.run(b, code('RF')).end, { x: 1, y: 3, d: 1 });
  assert.deepEqual(P.run(b, code('LLL')).end, { x: 0, y: 3, d: 1 });
});

test('run: 盤の外・いわに ぶつかると止まる（何まいめのカードか）', () => {
  const out = P.run(B({}), code('LF'));
  assert.equal(out.result, 'bump');
  const e = out.events[out.events.length - 1];
  assert.equal(e.i, 1);
  assert.equal(e.out, true);
  const rock = P.run(B({ rocks: [[0, 1]] }), code('FFF'));
  assert.equal(rock.result, 'bump');
  assert.equal(rock.events[rock.events.length - 1].out, false);
  assert.deepEqual(rock.end, { x: 0, y: 2, d: 0 });
});

test('run: ゴールに着いたら、残りのカードは動かさない', () => {
  const b = B({ goal: { x: 0, y: 1 } });
  const r = P.run(b, code('FFLF'));
  assert.equal(r.result, 'goal');
  assert.deepEqual(r.end, { x: 0, y: 1, d: 0 });
  assert.equal(r.cards, 4);
});

test('run: くりかえし（入れ子も）ともし', () => {
  assert.equal(P.run(B({}), code('3[F]R3[F]')).result, 'goal');
  assert.equal(P.run(B({}), code('2[3[F]R]')).result, 'goal');   // 上へ 3、右を向いて右へ 3 で右上のゴール
  assert.equal(P.run(B({}), code('4[F]')).result, 'bump');        // 上へ 4 マスめは盤の外
  // もし: まえが外なら右を向く。6 回で左上 → 右上
  assert.equal(P.run(B({}), code('6[?[R]F]')).result, 'goal');
  const r = P.run(B({}), code('?[R]F'));
  assert.deepEqual(r.events.map((e) => e.type), ['check', 'move']);
  assert.equal(r.events[0].blocked, false);
});

test('run: やじるし（向きを変えて 1 マス）', () => {
  const b = B({ mode: 'yaji', goal: { x: 2, y: 2 } });
  const r = P.run(b, code('NEE' + 'S'));
  assert.equal(r.result, 'goal');
  assert.equal(P.run(b, code('W')).result, 'bump');
});

test('run: うごきが多すぎると止める（入れ子の 20×20×20）', () => {
  const b = B({ w: 3, h: 3, goal: { x: 2, y: 2 }, start: { x: 0, y: 0, d: 0 } });
  assert.equal(P.run(b, code('20[20[20[R]]]')).result, 'toolong');
});

test('shortest: むきは曲がる数も数える、やじるしはマスの数', () => {
  const b = B({});
  assert.equal(P.shortest(b, 'muki').length, 7);   // FFF R FFF
  assert.equal(P.shortest(b, 'yaji').length, 6);
  assert.equal(P.run(b, P.shortest(b, 'muki').tokens).result, 'goal');
  const walled = B({ rocks: [[1, 0], [1, 1], [1, 2], [1, 3]] });
  assert.equal(P.shortest(walled, 'muki'), null);
  assert.equal(P.shortest(walled, 'yaji'), null);
});

// ---- 生成した盤面を全部たしかめる（段階 3 × むずかしさ 3 × カード 2、種 1〜300） ----
const COMBOS = [];
for (const step of [1, 2, 3]) for (const level of ['easy', 'normal', 'hard']) for (const mode of ['yaji', 'muki']) {
  if (step === 3 && mode === 'yaji') continue;
  COMBOS.push({ step, level, mode });
}
const SEEDS = 300;

test('generate: どの盤面も、カードの上限いないで解ける（答えを実行してゴール・探索でも着ける）', () => {
  for (const c of COMBOS) {
    const seen = new Set();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const b = P.generate(Object.assign({ seed }, c));
      const tag = JSON.stringify(Object.assign({ seed }, c));
      const L = P.LEVELS[c.level];
      assert.equal(b.w, L.w, tag); assert.equal(b.h, L.h, tag);
      assert.equal(b.mode, c.mode, tag);
      const inB = (x, y) => x >= 0 && y >= 0 && x < b.w && y < b.h;
      assert.ok(inB(b.start.x, b.start.y) && inB(b.goal.x, b.goal.y), tag);
      assert.ok(b.start.x !== b.goal.x || b.start.y !== b.goal.y, tag);
      const rk = new Set(b.rocks.map((p) => p.join(',')));
      assert.equal(rk.size, b.rocks.length, tag + ' いわが重なる');
      b.rocks.forEach((p) => assert.ok(inB(p[0], p[1]), tag));
      assert.ok(!rk.has(b.start.x + ',' + b.start.y) && !rk.has(b.goal.x + ',' + b.goal.y), tag);
      // 答えのプログラム: 実行するとゴール、カードは上限いない
      const sol = P.parseCode(b.solution);
      const r = P.run(b, sol);
      assert.equal(r.result, 'goal', tag + ' ' + b.solution);
      assert.ok(sol.length <= b.limit, tag);
      // 探索（答えのプログラムとは別の道）でもゴールに着ける
      const sh = P.shortest(b);
      assert.ok(sh, tag);
      assert.equal(sh.length, b.seqShortest, tag);
      assert.equal(P.run(b, sh.tokens).result, 'goal', tag);
      if (c.step === 1) {
        assert.equal(sol.length, sh.length, tag + ' じゅんばんの答えはいちばん短い');
        assert.equal(b.limit, sh.length + L.slack[1], tag);
        assert.ok(sh.length >= L.seq[c.mode][0] && sh.length <= L.seq[c.mode][1], tag);
        assert.ok(!/[\[\]?]/.test(b.solution), tag);
      } else {
        // じゅんばんだけでは上限を超える ＝ くりかえし（もし）を使わないと解けない
        assert.ok(b.seqShortest > b.limit, tag + ' seq ' + b.seqShortest + ' limit ' + b.limit);
        assert.ok(sol.some((k) => k.t === 'REP'), tag);
        if (c.step === 3) assert.ok(sol.some((k) => k.t === 'IF'), tag);
        if (c.step === 2) assert.ok(!sol.some((k) => k.t === 'IF'), tag);
      }
      seen.add(JSON.stringify([b.start, b.goal, b.rocks]));
    }
    // 4×4 のくりかえしは道の形が少ないので、ちがう盤面の数は少なめ（下の数字は 2026-09-25 の実測を下回らないこと）
    assert.ok(seen.size >= (c.level === 'easy' && c.step === 2 ? SEEDS * 0.4 : SEEDS * 0.8), JSON.stringify(c) + ' ちがう盤面 ' + seen.size);
  }
});

test('generate: 同じ設定・同じ種なら同じ盤面', () => {
  for (const c of COMBOS) {
    const a = P.generate(Object.assign({ seed: 77 }, c)), b = P.generate(Object.assign({ seed: 77 }, c));
    assert.deepEqual(a, b);
  }
});

test('generate: 「もし」の段階はやじるしを選んでも、まえ・みぎ・ひだりになる。おかしな値は既定に', () => {
  assert.equal(P.generate({ step: 3, level: 'easy', mode: 'yaji', seed: 1 }).mode, 'muki');
  const o = P.normalizeOpts({ step: 9, level: 'x', mode: 'z', seed: -3 });
  assert.deepEqual(o, { step: 1, level: 'easy', mode: 'yaji', seed: 1 });
});

test('cardNeeds: 答えといちばん短い道で使う数', () => {
  const b = P.generate({ step: 1, level: 'normal', mode: 'muki', seed: 3 });
  const n = P.cardNeeds(b);
  const count = (t) => P.parseCode(b.solution).filter((k) => k.t === t).length;
  ['F', 'L', 'R'].forEach((t) => assert.ok((n[t] || 0) >= count(t)));
});
