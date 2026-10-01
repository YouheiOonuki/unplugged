// 英語版（en/）のテスト: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../puzzle.js');
const S = require('../sheets.js');
const C = require('../calc.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const JA = /[぀-ヿ㐀-鿿＀-￯]/;
const all = { board: true, cards: true, answer: true };
const en = (o) => S.buildPages(Object.assign(C.normalizeSettings(Object.assign({ boards: 1, parts: all }, o)), { lang: 'en' }, o.paper ? { paper: o.paper } : {}));

test('英語の印刷物に日本語の文字が無い（全段階・むずかしさ・カード・大きいカード・名前なし）', () => {
  for (const step of [1, 2, 3]) for (const level of ['easy', 'normal', 'hard']) for (const mode of ['yaji', 'muki']) for (const big of [false, true]) {
    if (step === 3 && mode === 'yaji') continue;
    for (const seed of [1, 77, 4242]) {
      const html = en({ step, level, mode, seed, big, boards: 2 }).pages.join('');
      const m = html.match(JA);
      assert.equal(m, null, `${step}/${level}/${mode}/${seed}: ` + (m && html.slice(m.index - 40, m.index + 40)));
    }
  }
});

test('英語のカードの名前（forward / turn right / turn left / repeat / if blocked / end）', () => {
  assert.deepEqual(['F', 'R', 'L', 'REP', 'IF', 'END'].map((t) => S.CARDS_EN[t].name), ['Forward', 'Turn right', 'Turn left', 'Repeat', 'If blocked', 'End']);
  assert.deepEqual(Object.keys(S.CARDS_EN).sort(), Object.keys(S.CARDS).sort());
  const cards = en({ step: 3, level: 'normal', mode: 'muki', seed: 5 }).pages.find((p) => p.includes('sheet-cards'));
  for (const n of ['Forward', 'Turn right', 'Turn left', 'Repeat', 'If blocked', 'End', 'Command cards']) assert.ok(cards.includes('>' + n + '<'), n);
});

test('英語と日本語で同じ盤面・同じ枚数（生成は共通。文だけ違う）', () => {
  for (const seed of [3, 300, 9999]) {
    const o = { step: 2, level: 'normal', mode: 'muki', seed, boards: 2 };
    const a = S.buildPages(C.normalizeSettings(Object.assign({ parts: all }, o))), b = en(o);
    assert.deepEqual(a.boards, b.boards);
    assert.equal(a.pages.length, b.pages.length);
    // 盤面の SVG の図形（文字を除く）は同じ
    const shapes = (h) => (h.match(/<(rect|line|path|polyline|circle)[^>]*>/g) || []).join('');
    assert.equal(shapes(a.pages[0]), shapes(b.pages[0]));
  }
});

test('答えのページ: 枚数と上限、じゅんばんだけの最短を英語で', () => {
  const r = en({ step: 2, level: 'normal', mode: 'muki', seed: 11 });
  const b = r.boards[0], ans = r.pages.find((p) => p.includes('sheet-answer'));
  assert.ok(ans.includes('This answer uses <b>' + P.parseCode(b.solution).length + ' cards</b> (limit ' + b.limit + ').'));
  assert.ok(ans.includes('the shortest program is <b>' + b.seqShortest + ' cards</b>, over the limit, so "Repeat" is needed.'));
  assert.ok(ans.includes('For teachers and parents'));
  assert.ok(ans.includes('Made at yorozu-craft.com/unplugged/en/'));
  assert.ok(!en({ step: 1, level: 'easy', mode: 'yaji', seed: 11, credit: false }).pages.join('').includes('Made at'));
});

test('US Letter: 盤面の 1 マスが小さくなる（A4 は変わらない）', () => {
  const cell = (h) => Number(h.match(/--cell:([\d.]+)mm/)[1]);
  const a4 = en({ step: 1, level: 'easy', mode: 'yaji', seed: 2, parts: { board: true } }).pages[0];
  const lt = en({ step: 1, level: 'easy', mode: 'yaji', seed: 2, parts: { board: true }, paper: 'letter' }).pages[0];
  assert.equal(cell(a4), 37.5);   // min(150 / 4, 176 / 4)
  assert.equal(cell(lt), 33.5);   // min(134 / 4, 176 / 4)
});

test('バックアップの読み込みの文が英語', () => {
  for (const t of ['nope', JSON.stringify({ tool: 'bingo', version: 1, data: {} }), JSON.stringify({ tool: 'unplugged', version: 9, data: {} }), JSON.stringify({ tool: 'unplugged', version: 1, data: {} })]) {
    const r = C.parseBackup(t, 'unplugged', ['settings'], 'en');
    assert.equal(r.ok, false);
    assert.equal(JA.test(r.error), false, r.error);
  }
  assert.equal(C.parseBackup('nope', 'unplugged', ['settings']).error.includes('ファイル'), true);   // 日本語版は変わらない
});

// --- ページ ---
const pages = { 'en/index.html': 'index.html', 'en/guide.html': 'guide.html', 'en/lessons.html': 'jugyou.html' };
const visible = (html) => html
  .replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<a [^>]*hreflang="ja"[^>]*>[^<]*<\/a>/g, '')
  .replace(/<[^>]+>/g, ' ');

test('英語のページに日本語の文字が無い（言語の切り替えのリンクだけ）。画面の JS の文字列も', () => {
  for (const p of Object.keys(pages)) {
    const h = read(p), t = visible(h), m = t.match(JA);
    assert.equal(m, null, p + ': ' + (m && t.slice(Math.max(0, m.index - 30), m.index + 30)));
    const head = h.match(/<head>[\s\S]*<\/head>/)[0].replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(head.match(JA), null, p + ' head');
    assert.match(h, /<html lang="en">/);
    assert.ok(h.includes('href="https://yorozu-craft.com/en/"'), p + ' home');
  }
  const js = read('en/main-en.js').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (const s of js.match(/'(?:[^'\\]|\\.)*'/g) || []) assert.equal(JA.test(s), false, s);
});

test('hreflang: 日英が互いを指し、sitemap にも同じ組', () => {
  const B = 'https://yorozu-craft.com/unplugged/';
  const sm = read('sitemap.xml');
  for (const [enF, jaF] of Object.entries(pages)) {
    const enUrl = B + enF.replace(/index\.html$/, ''), jaUrl = B + jaF.replace(/index\.html$/, '');
    for (const f of [enF, jaF]) {
      const h = read(f);
      assert.ok(h.includes(`hreflang="ja" href="${jaUrl}"`), f);
      assert.ok(h.includes(`hreflang="en" href="${enUrl}"`), f);
      assert.ok(h.includes(`hreflang="x-default" href="${jaUrl}"`), f);
    }
    assert.ok(read(enF).includes(`<link rel="canonical" href="${enUrl}">`));
    for (const loc of [enUrl, jaUrl]) {
      const block = sm.split('<url>').find((b) => b.includes(`<loc>${loc}</loc>`));
      assert.ok(block && block.includes(`hreflang="en" href="${enUrl}"`) && block.includes(`hreflang="ja" href="${jaUrl}"`), 'sitemap ' + loc);
    }
  }
});

test('K123: 英語の画面にも「保存した内容をすべて消す」（unplugged_ の接頭辞）', () => {
  assert.match(read('en/index.html'), /data-reset-storage="unplugged_"[^>]*>Delete everything saved \(reset\)</);
  assert.match(read('en/index.html'), /<script src="\.\.\/reset-storage\.js"><\/script>/);
});

test('Service Worker が英語のページもキャッシュする', () => {
  const sw = read('sw.js');
  for (const f of ['./en/', './en/index.html', './en/guide.html', './en/lessons.html', './en/main-en.js']) assert.ok(sw.includes(`'${f}'`), f);
});
