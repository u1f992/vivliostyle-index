# @u1f992/vivliostyle-index

藤田節子『本の索引の作り方』　p.63より

```
自由利用　104-108, 112
相続　88
　一身専属　76
　相続人　90-91
知的財産権　56-58
著作権　3, 8, 33-35
　⇒知的財産権　［主見出し語から主見出し語への「をも見よ」参照］
　――の使用　150
　――の譲渡　42, 100-104
　――の制限　→自由利用　［副見出し語から主見出し語への「を見よ」参照］
　――の相続　20
　　⇒相続：一身専属　［副見出し語から副見出し語への「をも見よ」参照］
```

所在指示と「を見よ」参照が両立する例　p.99より

```
絵　21　→美術の著作物
```

複数の参照は`；`で区切る例　p.64より

```
大学　→京都大学；シカゴ大学；ハーバード大学

著者名　24
　⇒個人著者名；団体著者名
```

フォーマットは`<索引ID>,<登録先見出し語>[,<登録種別>[,<参照>]]`です。内部的には、両端に`[ ]`を補ってYAMLのリストとしてパースします。TypeScript風に記載すると以下の通りです。正確なスキーマは実装を確認してください。

```typescript
type 索引指定 =
  | [索引ID, 登録先見出し語]
  | [索引ID, 登録先見出し語, 登録種別]
  | [索引ID, 登録先見出し語, 登録種別, 参照];

/**
 * 索引が1つの場合は`$`や`_`としておけばよいでしょう。
 */
type 索引ID = string;

/**
 * `<グループ>[,<読み>[,<見出し語>]]`です。
 * `<グループ>`には見出し語自体を入れ子状に指定することができ、
 * この場合は`<グループ>`に指定された主見出し語に副見出しを登録します。
 * 省略された箇所はinnerHTML（textContentではない）を使用します。
 */
type 登録先見出し語 =
  | [string, string, string]
  | [string, string]
  | [string]
  | [[string, string, string], string, string]
  | [[string, string, string], string]
  | [[string, string, string]]
  | [[string, string], string, string]
  | [[string, string], string]
  | [[string, string]]
  | [[string], string, string]
  | [[string], string]
  | [[string]];

/**
 * それぞれ所在指示（範囲）、「を見よ参照」、「をも見よ参照」に対応します。
 * 省略した場合は所在指示（ページ）になります。
 */
type 登録種別 = "range" | "see" | "seeAlso";

/**
 * 「を見よ参照」、「をも見よ参照」の参照先を指定します。
 * 参照先見出し語が存在するかは関知しません。
 */
type 参照 = 登録先見出し語;
```

原稿内では次のように指定します。タグ（`span`/`div`）は何であっても構いません。

<!-- prettier-ignore-start -->

```html
<span data-index="$,[さ,じゆうりよう]">自由利用</span>
<div data-index="$,[さ,じゆうりよう,自由利用],range">
  自由利用について……
</div>
<span data-index="$,[さ,そうぞく]">相続</span>
<span data-index="$,[[さ,そうぞく,相続],いつしんせんぞく]">一身専属</span>
<div data-index="$,[[さ,そうぞく,相続],そうぞくにん,相続人],range">
  相続人について……
</div>
<div data-index="$,[た,ちてきざいさんけん,知的財産権],range">
  知的財産権について……
</div>
<span data-index="$,[た,ちよさくけん]">著作権</span>
<span data-index="$,[た,ちよさくけん]">著作権</span>
<div data-index="$,[た,ちよさくけん,著作権],range">
  著作権について……
</div>
<span data-index="$,[た,ちよさくけん,著作権],seeAlso,[た,ちてきざいさんけん,知的財産権]"></span>
<span data-index="$,[[た,ちよさくけん,著作権],ちよさくけんのしよう,――の使用]"
>著作権の使用</span>
<span data-index="$,[[た,ちよさくけん,著作権],ちよさくけんのじようと,――の譲渡]">著作権の譲渡</span>
<div data-index="$,[[た,ちよさくけん,著作権],ちよさくけんのじようと,――の譲渡],range">
  著作権の譲渡について……
</div>
<span data-index="$,[[た,ちよさくけん,著作権],ちよさくけんのせいげん,――の制限],see,[さ,じゆうりよう,自由利用]"></span>
<span data-index="$,[[た,ちよさくけん,著作権],ちよさくけんのそうぞく,――の相続]">著作権の相続</span>
<span data-index="$,[[た,ちよさくけん,著作権],ちよさくけんのそうぞく,――の相続],see,[[さ,そうぞく,相続],いつしんせんぞく,一身専属]"></span>
```

`elem.tagName==="nav" && elem.classList.contains("index") && elem.hasAttribute("data-index")`を満たす要素の内部に、索引を展開します。

```html
<nav class="index" data-index="$"><!--
  <section class="index__group">
    <h2 class="index__group-tag">さ</h2>
    <section class="index__entry" id="さ-じゆうりよう-自由利用">
      <h3 class="index__entry__headword">自由利用</h3>
      <ol class="index__entry__locators">
        <li><a class="index__entry__page" href=" ... "></a><span class="index__entry__range-separator"></span><a class="index__entry__page" href=" ... "></a></li>
        <li><a class="index__entry__page" href=" ... "></a></li>
      </ol>
      <ol class="index__entry__see"></ol>
      <ol class="index__entry__see-also"></ol>
    </section>
    <section class="index__entry" id="さ-そうぞく-相続">
      <h3 class="index__entry__headword">相続</h3>
      <ol class="index__entry__locators">
        <li><a class="index__entry__page" href=" ... "></a></li>
      </ol>
      <ol class="index__entry__see"></ol>
      <ol class="index__entry__see-also"></ol>
      <section class="index__subentry" id="さ-そうぞく-相続-いつしんせんぞく-一身専属">
        <h4 class="index__subentry__headword">一身専属</h4>
        <ol class="index__subentry__locators">
          <li><a class="index__subentry__page" href=" ... "></a></li>
        </ol>
        <ol class="index__subentry__see"></ol>
        <ol class="index__subentry__see-also"></ol>
      </section>
      <section class="index__subentry" id="さ-そうぞく-相続-そうぞくにん-相続人">
        <h4 class="index__subentry__headword">相続人</h4>
        <ol class="index__subentry__locators">
          <li><a class="index__subentry__page" href=" ... "></a><span class="index__subentry__range-separator"></span><a class="index__subentry__page" href=" ... "></a></li>
        </ol>
        <ol class="index__subentry__see"></ol>
        <ol class="index__subentry__see-also"></ol>
      </section>
    </section>
  </section>
  <section class="index__group">
    <h2 class="index__group-tag">た</h2>
    <section class="index__entry" id="た-ちてきざいさんけん-知的財産権">
      <h3 class="index__entry__headword">知的財産権</h3>
      <ol class="index__entry__locators">
        <li><a class="index__entry__page" href=" ... "></a><span class="index__entry__range-separator"></span><a class="index__entry__page" href=" ... "></a></li>
      </ol>
      <ol class="index__entry__see"></ol>
      <ol class="index__entry__see-also"></ol>
    </section>
    <section class="index__entry" id="た-ちよさくけん-著作権">
      <h3 class="index__entry__headword">著作権</h3>
      <ol class="index__entry__locators">
        <li><a class="index__entry__page" href=" ... "></a></li>
        <li><a class="index__entry__page" href=" ... "></a></li>
        <li><a class="index__entry__page" href=" ... "></a><span class="index__entry__range-separator"></span><a class="index__entry__page" href=" ... "></a></li>
      </ol>
      <ol class="index__entry__see"></ol>
      <ol class="index__entry__see-also">
        <li><a class="index__entry__reference" href="#た-ちてきざいさんけん-知的財産権">知的財産権</a></li>
      </ol>
      <section class="index__subentry" id="た-ちよさくけん-著作権-ちよさくけんのしよう-――の使用">
        <h4 class="index__subentry__headword">――の使用</h4>
        <ol class="index__subentry__locators">
          <li><a class="index__subentry__page" href=" ... "></a></li>
        </ol>
        <ol class="index__subentry__see"></ol>
        <ol class="index__subentry__see-also"></ol>
      </section>
      <section class="index__subentry" id="た-ちよさくけん-著作権-ちよさくけんのじようと-――の譲渡">
        <h4 class="index__subentry__headword">――の譲渡</h4>
        <ol class="index__subentry__locators">
          <li><a class="index__subentry__page" href=" ... "></a></li>
          <li><a class="index__subentry__page" href=" ... "></a><span class="index__subentry__range-separator"></span><a class="index__subentry__page" href=" ... "></a></li>
        </ol>
        <ol class="index__subentry__see"></ol>
        <ol class="index__subentry__see-also"></ol>
      </section>
      <section class="index__subentry" id="た-ちよさくけん-著作権-ちよさくけんのせいげん-――の制限">
        <h4 class="index__subentry__headword">――の制限</h4>
        <ol class="index__subentry__locators"></ol>
        <ol class="index__subentry__see">
          <li><a class="index__subentry__reference" href="#さ-じゆうりよう-自由利用">自由利用</a></li>
        </ol>
        <ol class="index__subentry__see-also"></ol>
      </section>
      <section class="index__subentry" id="た-ちよさくけん-著作権-ちよさくけんのそうぞく-――の相続">
        <h4 class="index__subentry__headword">――の相続</h4>
        <ol class="index__subentry__locators">
          <li><a class="index__subentry__page" href=" ... "></a></li>
        </ol>
        <ol class="index__subentry__see"></ol>
        <ol class="index__subentry__see-also">
          <li><a class="index__subentry__reference" href="#さ-そうぞく-相続-いつしんせんぞく-一身専属">相続<span class="index__subentry__reference-separator"></span>一身専属</a></li>
        </ol>
      </section>
    </section>
  </section>
--></nav>
```

<!-- prettier-ignore-end -->
