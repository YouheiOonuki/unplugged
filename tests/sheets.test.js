// 印刷するページ・設定・共有リンクのテスト: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../puzzle.js');
const S = require('../sheets.js');
const C = require('../calc.js');

const base = { step: 2, level: 'normal', mode: 'muki', seed: 11, boards: 1, parts: { board: true, cards: true, answer: true } };

test('buildPages: 同じ設定なら同じ HTML、種がちがえばちがう盤面', () => {
  const a = S.buildPages(C.normalizeSettings(base)), b = S.buildPages(C.normalizeSettings(base));
  assert.equal(a.pages.join(''), b.pages.join(''));
  const c = S.buildPages(C.normalizeSettings(Object.assign({}, base, { seed: 12 })));
  assert.notEqual(a.pages[0], c.pages[0]);
});

test('buildPages: ページの数（盤面・カード・こたえ）', () => {
  const count = (o) => S.buildPages(C.normalizeSettings(Object.assign({}, base, o))).pages;
  const all = count({});
  assert.equal(all.filter((p) => p.includes('sheet-board')).length, 1);
  assert.equal(all.filter((p) => p.includes('sheet-answer')).length, 1);
  assert.ok(all.filter((p) => p.includes('sheet-cards')).length >= 1);
  const three = count({ boards: 3 });
  assert.equal(three.filter((p) => p.includes('sheet-board')).length, 3);
  assert.equal(three.filter((p) => p.includes('sheet-answer')).length, 3);
  assert.equal(count({ parts: { board: false, cards: false, answer: true } }).length, 1);
  assert.equal(count({ parts: { board: false, cards: false, answer: false } }).length, 0);
  // 大きいカードは 1 ページ 6 まい
  const big = count({ big: true, parts: { board: false, cards: true, answer: false } });
  const list = S.cardList([P.generate(C.normalizeSettings(base))]);
  assert.equal(big.length, Math.ceil(list.length / 6));
});

test('buildPages: 2 枚目からはちがう盤面（種をずらす）', () => {
  const r = S.buildPages(C.normalizeSettings(Object.assign({}, base, { boards: 4 })));
  const keys = new Set(r.boards.map((b) => JSON.stringify([b.start, b.goal, b.rocks])));
  assert.equal(keys.size, 4);
  assert.equal(r.boards[0].seed, 11);
  r.boards.forEach((b) => assert.ok(b.seed >= 1 && b.seed <= 99999));
});

test('cardList: 答えに要るカードは必ず足りる（予備つき）。段階ごとのカードの種類', () => {
  for (const step of [1, 2, 3]) for (const level of ['easy', 'normal', 'hard']) for (const mode of ['yaji', 'muki']) {
    for (let seed = 1; seed <= 40; seed++) {
      const b = P.generate({ step, level, mode, seed });
      const list = S.cardList([b]);
      const need = P.cardNeeds(b);
      Object.keys(need).forEach((t) => assert.ok(list.filter((x) => x === t).length >= need[t] + 2, t));
      const types = new Set(list);
      assert.equal(types.has('REP'), step >= 2);
      assert.equal(types.has('IF'), step >= 3);
      assert.equal(types.has('F'), b.mode === 'muki');
      assert.equal(types.has('N'), b.mode === 'yaji');
    }
  }
});

test('boardPage: 上限の数だけ書くらん、なまえ、クレジットの有無', () => {
  const b = P.generate({ step: 1, level: 'easy', mode: 'yaji', seed: 7 });
  const html = S.boardPage(b, { name: '<たろう>' });
  assert.equal((html.match(/class="pbox"/g) || []).length, b.limit);
  assert.ok(html.includes('&lt;たろう&gt;'));
  assert.ok(!html.includes('<たろう>'));
  assert.ok(html.includes('yorozu-craft.com/unplugged/print/'));
  assert.ok(!S.boardPage(b, { credit: false }).includes('yorozu-craft.com/unplugged/print/'));
  assert.equal((html.match(/class="rock"/g) || []).length, b.rocks.length);
});

test('answerPage: 答えの道の番号がゴールまで', () => {
  const b = P.generate({ step: 3, level: 'hard', mode: 'muki', seed: 5 });
  const html = S.answerPage(b, {});
  const t = P.trace(b, P.parseCode(b.solution));
  assert.equal((html.match(/class="ans-dot"/g) || []).length, t.path.length - 1);
  assert.ok(html.includes('じょうげん ' + b.limit));
});

test('normalizeSettings: おかしな値は既定に、なまえは 20 字まで', () => {
  const s = C.normalizeSettings({ step: '7', boards: 99, name: 'あ'.repeat(30), parts: 'x', big: 'yes', credit: 0 });
  assert.equal(s.step, 1); assert.equal(s.boards, 1); assert.equal(s.name.length, 20);
  assert.deepEqual(s.parts, { board: true, cards: true, answer: true });
  assert.equal(s.big, false); assert.equal(s.credit, true);
  assert.deepEqual(C.normalizeSettings(null), C.normalizeSettings({}));
});

test('共有リンク: 行って戻る。なまえは入らない。壊れたリンクは null', () => {
  const s = C.normalizeSettings(Object.assign({}, base, { name: 'はなこ', boards: 3, big: true }));
  const h = C.toShareHash(s);
  assert.match(h, /^#s=[A-Za-z0-9_-]+$/);
  const back = C.fromShareHash(h);
  assert.deepEqual(back, Object.assign({}, s, { name: '' }));
  assert.equal(C.fromShareHash('#s=@@@'), null);
  assert.equal(C.fromShareHash('#x=1'), null);
  assert.equal(C.fromShareHash(''), null);
  // 共有リンクの盤面は、印刷と同じ
  assert.deepEqual(P.generate(back), P.generate(s));
});

test('constants: 出典に URL と確認日（YYYY-MM-DD）', () => {
  const K = require('../constants.js');
  assert.match(K.CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(K.tebiki.source && K.tebiki.url.startsWith('https://www.mext.go.jp/') && K.tebiki.checked === K.CHECKED);
});
