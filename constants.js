// ===========================
// 出典と確認日（使い方ページ・授業の流れのページに出す文の根拠）。値は 1 か所にだけ持つ
// check-site（youheioonuki.github.io の tools/check-site.mjs）は CHECKED を読んで確認日の古さを見る
// ブラウザでは window.Constants、Node（テスト）では module.exports
// ===========================
(function (root) {
  'use strict';

  var CHECKED = '2026-09-25';

  var CONSTANTS = {
    CHECKED: CHECKED,
    tebiki: {
      label: '小学校プログラミング教育の手引（第三版）',
      source: '文部科学省（令和2年2月）',
      url: 'https://www.mext.go.jp/content/20200218-mxt_jogai02-100003171_002.pdf',
      page: 'https://www.mext.go.jp/a_menu/shotou/zyouhou/detail/1403162.htm',
      // 使っている箇所（ページは冊子の印刷ページ）
      refs: {
        thinking: 'p.9・p.13「プログラミング的思考」の説明と、コンピュータを動作させるための手順①〜⑤',
        unplugged: 'p.20「ア コンピュータを用いずに行う指導の考え方」',
        qa: 'p.62 Q4（コンピュータを用いない取組）',
      },
      checked: CHECKED,
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONSTANTS;
  else root.Constants = CONSTANTS;
})(this);
