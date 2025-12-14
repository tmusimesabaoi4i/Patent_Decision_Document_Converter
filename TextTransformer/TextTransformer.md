# TextTransformer 使い方ガイド

このドキュメントは **TextTransformer クラスの「使い方だけ」** をまとめた Markdown です。  
（クラス実装本体は `TextTransformer.js` に存在している前提）

---

## 1. 前提：インポート方法

### 1-1. Node.js（CommonJS）

```javascript
// TextTransformer.js に TextTransformer クラスが export されている前提
const { TextTransformer } = require("./TextTransformer.js");
```

### 1-2. Node.js / ブラウザ（ES Modules）

```javascript
import { TextTransformer } from "./TextTransformer.js";
```

### 1-3. ブラウザでの <script> 直接読み込み

```html
<script src="./TextTransformer.js"></script>
<script>
  // グローバルに TextTransformer が生える前提
  const tt = new TextTransformer("line1\nline2");
  console.log(tt.toString());
</script>
```

## 2. TextTransformer の基本コンセプト

テキスト全体を **行単位** に分割して処理します。

行の「上／下」や「a〜b の範囲」「行頭が特定文字」「マーカー以降＋区切りあり」など、
ルールに合致する行に対して、変換関数 F を適用していきます。

改行コードはすべてサポート：

- `\r\n`（Windows）
- `\r`（古い Mac）
- `\n`（Unix / Linux / macOS）

## 3. 変換関数 F の前提

TextTransformer は、任意の「行 → 行」変換関数 F を受け取ります。

```javascript
function F(str) {
  // str は 1 行分の文字列
  return str + " ★";  // 変換後の文字列
}
```

複数の変換を順番に適用したい場合は、配列で渡すこともできます。

```javascript
function F1(s) { return s.toLowerCase(); }
function F2(s) { return "[[" + s + "]]"; }

const Flist = [F1, F2];  // 下記のように渡せる
```

## 4. 基本的な使い方スタイル

### 4-1. インスタンススタイル（メソッドチェーン）

```javascript
const text = [
  "# HEADER",
  "line1",
  "line2",
  "# FOOTER",
  "line3"
].join("\n");

function toLower(s) { return s.toLowerCase(); }

const tt = new TextTransformer(text);

const result = tt
  .aboveInc("# HEADER", toLower)  // "# HEADER" より上（含む）を小文字化
  .belowExc("# FOOTER", toLower)  // "# FOOTER" より下（含まない）を小文字化
  .toString();                    // 最終結果を文字列で取得

console.log(result);
```

**ポイント:**

- `new TextTransformer(text)` で 元テキストを渡す。
- その後は、`aboveInc`, `belowExc`, `rangeInc`, `head`, `fwNumMark` などを チェーンして呼び出せる。
- 最後に `toString()` で結果を文字列として取り出す。

### 4-2. 関数スタイル（static メソッド）

```javascript
function toLower(s) { return s.toLowerCase(); }

const result = TextTransformer.aboveInc(
  text,
  "# HEADER",
  toLower
);

console.log(result);
```

static メソッドは、内部で毎回 `new TextTransformer(text)` を生成し、
指定メソッドを 1 回だけ呼んで `toString()` したものを返します。

## 5. a より上／下に適用するメソッド

### 5-1. aboveInc(a, F) – a を含む「上側」すべてに F を適用

```javascript
const result = new TextTransformer(text)
  .aboveInc("### START", toLower)
  .toString();
```

- **a**: 文字列 or 文字列配列
- **F**: 関数 or 関数配列

**挙動:**

- **a が文字列のとき：**
  - 元テキストの行の中から、a と完全一致する行を探す。
  - その行のインデックスを idx とすると、行 0〜idx に F を適用。

- **a が配列のとき：**
  - 配列の各要素 a[k] について同じロジックを行う。
  - → a[0] が見つかっても a[1] 以降も順番にチェック・適用される。

**例：配列 a の利用**

```javascript
const aList = ["[BLOCK1_START]", "[BLOCK2_START]"];

const result = new TextTransformer(text)
  .aboveInc(aList, toLower)
  .toString();
```

### 5-2. aboveExc(a, F) – a を含まない「上側」に F を適用

```javascript
const result = new TextTransformer(text)
  .aboveExc("### START", toLower)
  .toString();
```

a 自身の行には適用せず、それより **上の行だけ** 対象になります。

a が配列の場合も、各要素ごとに「その行より上」が処理対象になります。

### 5-3. belowInc(a, F) – a を含む「下側」すべてに F を適用

```javascript
const result = new TextTransformer(text)
  .belowInc("### START", toLower)
  .toString();
```

a 行を含めて、その行から下のすべての行に F を適用します。

a が配列の場合、それぞれの a[k] 行から下に適用されます。

### 5-4. belowExc(a, F) – a を含まない「下側」に F を適用

```javascript
const result = new TextTransformer(text)
  .belowExc("### START", toLower)
  .toString();
```

a 行を除いて、その **1 行下から末尾まで** に F を適用します。

a が配列の場合も同様に、各 a[k] について処理します。

## 6. a〜b の範囲に適用するメソッド（ペア）

a と b をペアで扱い、(a1, b1), (a2, b2), … というイメージで範囲指定します。
|a| = |b| を想定していますが、実装上は k < min(|a|, |b|) までが対象です。

### 6-1. rangeInc(a, b, F) – a, b を含む範囲に F を適用

```javascript
const aList = ["[SEC1_START]", "[SEC2_START]"];
const bList = ["[SEC1_END]",   "[SEC2_END]"];

function wrap(s) { return ">> " + s; }

const result = new TextTransformer(text)
  .rangeInc(aList, bList, wrap)
  .toString();
```

**挙動:**

- **a と b を配列にした場合：**
  - k = 0..min(a.length, b.length)-1 について
  - a[k] と一致する行を ia
  - b[k] と一致する行を ib
  - s = min(ia, ib) から e = max(ia, ib) までの行に F を適用

- a / b が単独文字列のときは、要素数 1 の配列として扱われます。

### 6-2. rangeExc(a, b, F) – a, b を含まない「間」だけに F を適用

```javascript
const result = new TextTransformer(text)
  .rangeExc(["[SEC1_START]", "[SEC2_START]"],
            ["[SEC1_END]",   "[SEC2_END]"],
            wrap)
  .toString();
```

**挙動:**

- (a[k], b[k]) のペアごとに、
  - s = min(ia, ib) + 1
  - e = max(ia, ib) - 1
  - s > e なら無視
- つまり a[k] と b[k] の **間の行だけ** が対象になります。

## 7. 行頭（文頭）が特定文字の行に F を適用：head(ch, F)

```javascript
const result = new TextTransformer(text)
  .head("#", toLower)
  .toString();
```

**挙動:**

- 各行について、
- その行の **先頭文字** が ch であれば、その行全体に F を適用します。
- 文頭は「改行で区切られた各行の先頭」を意味します。

## 8. マーカー以降＋区切りありの数字／英字を全角化

### 8-1. fwNumMark(mark, sep) – mark 以降で sep がある場合のみ数字を全角化

```javascript
const text2 = [
  "param1: 123,456abc",
  "param2=999no_sep",
  "other: 42;Abc9"
].join("\n");

const result = new TextTransformer(text2)
  .fwNumMark([":", "="], [",", ";"])
  .toString();

console.log(result);
```

**挙動:**

- 各行ごとに、
  - mark（文字列 or 配列）のうち、その行で **最も左に現れるものを探す**
  - その位置以降の文字列を tail とする
  - tail に sep（文字列 or 配列）のいずれかが含まれている場合のみ、
    tail 内の [0-9] を全角数字（０〜９）に変換
  - head + 変換後 tail を、その行の新しい内容とする

### 8-2. fwAlnumMark(mark, sep) – mark 以降で sep がある場合のみ数字＋英字を全角化

```javascript
const text3 = [
  "TAG: id123,Abc45",
  "OTHER x=99;YZ",
  "no_mark_here"
].join("\n");

const result = new TextTransformer(text3)
  .fwAlnumMark(["TAG:", "x="], [",", ";"])
  .toString();

console.log(result);
```

**挙動:**

- fwNumMark と同じ条件で対象範囲を決定し、
- tail 内の [0-9A-Za-z] を全角英数字に変換します。

## 9. static メソッド（関数スタイル）

クラスを意識したくない場合は、static メソッドをそのまま「関数」のように使えます。

```javascript
const out1 = TextTransformer.aboveInc(text, "### START", toLower);
const out2 = TextTransformer.belowExc(text, ["A", "B"], toLower);
const out3 = TextTransformer.rangeInc(text,
                                      ["[S1]", "[S2]"],
                                      ["[E1]", "[E2]"],
                                      wrap);
const out4 = TextTransformer.head(text, "#", toLower);
const out5 = TextTransformer.fwNumMark(text, [":", "="], [",", ";"]);
const out6 = TextTransformer.fwAlnumMark(text, ":", ",");
```

内部的には、

1. `new TextTransformer(text)`
2. 対応するインスタンスメソッドを 1 回呼び出し
3. `.toString()` した結果を返す

というだけです。

## 10. よくあるパターン例

### 10-1. 「見出し〜次の見出しの手前まで」をまとめて加工

```javascript
const aList = ["# SECTION1", "# SECTION2"];
const bList = ["# SECTION2", "# SECTION3"];

function addMark(s) { return "★ " + s; }

const result = new TextTransformer(text)
  .rangeExc(aList, bList, addMark)  // 各セクションの中身だけに ★ を付ける
  .toString();
```

### 10-2. 「設定行の右側の数字だけ全角化」

```javascript
const configText = [
  "MAX_USERS: 1000,2000",
  "TIMEOUT=30",
  "NOTE: value not set"
].join("\n");

const result = new TextTransformer(configText)
  .fwNumMark([":", "="], [","])  // ":" or "=" 以降に "," がある行だけ数値を全角に
  .toString();
```

## 11. 実装挙動に関する注意

- 行の境界（a, b, mark の検索）は **常に元テキスト行配列（_origLines）** を基準に行われます。
- 途中で F によってテキスト内容を変えても、境界の検索位置は変わりません。
- 実際に書き換えが行われるのは _lines（編集用）のみです。
- a / b / mark / sep が配列のときは、それぞれの全要素について判定・適用が行われるため、
  同じ行に F が **複数回適用される** ケースがあります。
- F はできるだけ **冪等（何度適用しても結果が変わらない）** になるよう設計しておくと安全です。






