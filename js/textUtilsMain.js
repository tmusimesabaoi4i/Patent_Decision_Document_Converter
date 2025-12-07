(function (root) {
  "use strict";

  /**
   * patTextOps.js
   * ------------------------------------------------------------------------
   * 特許文書向けテキスト整形ユーティリティ
   *
   * ▼ 目的
   *   - 箇条書きや条文番号、引用箇所など、特許実務でよく出てくる
   *     独特の書式に対して、共通パターンで加工を行う関数群を提供する。
   *
   * ▼ 設計方針
   *   - すべての公開関数は基本形として (str: string) => string の形で実装。
   *     ※ 一部は第 2 引数 options でオーバーロードできるようにしているが、
   *       フィルタパイプラインでは 1 引数だけで使用可能。
   *   - 処理の粒度は「ライン単位」を基本としつつ、条文番号や引用部は
   *     正規表現で抽出して部分変換を行う。
   *   - 全角化は「数字のみ」または「数字＋英字」を用途に応じて使い分ける。
   *
   * ▼ 主な公開関数（概要）
   *   - padHead     : 行頭に空白を挿入（空白挿入（先頭））
   *   - trimHead    : 条件付きで行頭空白を削除（箇条書き・< など）
   *   - fwHead      : 箇条書き行のマーク／行全体を条件付き全角化
   *   - alphaCase   : 英字の大小変換（大文字化・小文字化）
   *   - fwNumLaw    : 条文番号・第◯節/頁・キーワード後続番号の全角化
   *   - fwRefLaw    : 【図】【表】【式】など引用箇所の番号全角化
   *   - tightLines  : 改行圧縮（余分な空行の圧縮）
   *   - tightClaims : 『』内（主張部分）の空白行削除
   *   - tightNote   : 付記／補正の示唆ブロック内の空白行削除
   *   - tightBelowBullet : 箇条書き行の直下空行（または 1 行）を削除して詰める
   *
   * 各関数は単独でフィルタとして使えるように設計しているため、
   * FilterRegistry / TextFilterRegistry などのパイプラインにもそのまま組み込める。
   * ------------------------------------------------------------------------
   */

  // ========================================================================
  // 内部共通ユーティリティ
  // ========================================================================

  /**
   * すべての改行コード (\r\n, \r, \n) を \n に正規化して配列化
   * @param {string} str
   * @returns {string[]}
   */
  function splitLines(str) {
    if (str == null || str === "") return [""];
    return String(str).split(/\r\n|\r|\n/);
  }

  /**
   * 行配列を \n で結合して文字列に戻す
   * @param {string[]} lines
   * @returns {string}
   */
  function joinLines(lines) {
    return lines.join("\n");
  }

  /**
   * 行が空行かどうか（空白類のみなら空行とみなす）
   * @param {string} line
   * @returns {boolean}
   */
  function isBlankLine(line) {
    return /^[ \t\r\f\v\u3000]*$/.test(line);
  }

  /**
   * 文字列からすべての空白文字（ホワイトスペース）を削除する
   *
   * 対象となる空白文字には以下が含まれます：
   * - 半角スペース（' '）
   * - タブ（\t）
   * - 改行（\n, \r）
   * - 垂直タブ（\v）
   * - フォームフィード（\f）
   *
   * @param {string} str - 処理対象の文字列
   * @returns {string} - 空白文字をすべて除去した新しい文字列
   */
  const removeWS = str => str.replace(/ \u3000\t\v\f/g, '');


  /**
   * 数字 0-9 を全角数字 ０-９ に変換するヘルパ
   * @param {string} c
   * @returns {string}
   */
  function fwNumChar(c) {
    var code = c.charCodeAt(0);
    if (code >= 0x30 && code <= 0x39) {
      return String.fromCharCode(code - 0x30 + 0xff10);
    }
    return c;
  }

  /**
   * 英数字 (0-9, A-Z, a-z) を全角英数字に変換するヘルパ
   * @param {string} c
   * @returns {string}
   */
  function fwAlnumChar(c) {
    var code = c.charCodeAt(0);
    // 0-9
    if (code >= 0x30 && code <= 0x39) {
      return String.fromCharCode(code - 0x30 + 0xff10);
    }
    // A-Z
    if (code >= 0x41 && code <= 0x5a) {
      return String.fromCharCode(code - 0x41 + 0xff21);
    }
    // a-z
    if (code >= 0x61 && code <= 0x7a) {
      return String.fromCharCode(code - 0x61 + 0xff41);
    }
    return c;
  }

  /**
   * padLeftZero
   *
   * 指定した長さになるように、数値または文字列の左側を '0' で埋めて返すユーティリティ関数。
   * - 正負符号がある場合は符号を保持して、数値部分のみをゼロ詰めする。
   * - 入力は数値でも文字列でも受け付ける（内部で String に変換して処理）。
   * - 既に指定長以上の長さがある場合は、そのまま返す（切り詰めはしない）。
   *
   * @param {number|string} y - ゼロ詰めしたい値。数値または数値を表す文字列を想定。
   *                            小数点や桁区切りが含まれる場合は、事前に整形して渡すこと。
   * @param {number} n - 返したい最小文字長（ゼロ詰め後の長さ）。負の値や非整数は無視される。
   * @returns {string} 指定長に左ゼロ詰めされた文字列。符号があれば先頭に付与される。
   *
   * 例:
   *   padLeftZero(5, 3)     -> "005"
   *   padLeftZero("12", 4)  -> "0012"
   *   padLeftZero(-7, 2)    -> "-07"
   *   padLeftZero(1234, 3)  -> "1234"  // 既に長いのでそのまま
   */
  function padLeftZero(y, n) {
    n = Math.floor(Number(n)); // n を整数化（数値変換に失敗すると NaN になる）
    if (!isFinite(n) || n <= 0) {
      return String(y);
    }
    var s = String(y);
    var sign = "";
    if (s.charAt(0) === "-" || s.charAt(0) === "+") {
      sign = s.charAt(0);
      s = s.slice(1); // 符号を取り除いた部分をゼロ詰め対象とする
    }
    if (s.length >= n) return sign + s;
    if (typeof String.prototype.padStart === "function") {
      return sign + s.padStart(n, "　");
    }
    var zeros = new Array(n - s.length + 1).join("　"); // 必要なゼロ数を生成
    return sign + zeros + s;
  }

  /**
   * 文字列中の数字のみを全角化
   * @param {string} text
   * @returns {string}
   */
  function toFwNumStr(text) {
    return String(text).replace(/[0-9]/g, fwNumChar);
  }

  /**
   * 文字列中の英数字を全角化
   * @param {string} text
   * @returns {string}
   */
  function toFwAlnumStr(text) {
    return String(text).replace(/[0-9A-Za-z]/g, fwAlnumChar);
  }

  // 正規表現用にエスケープするユーティリティ
  function escapeForRegExp(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  /**
   * 箇条書き用の「ドットマーク」候補セット
   * - 実務でよく登場する記号のみをデフォルトで含める。
   *   必要に応じてコード側で変更してよい。
   * @type {string[]}
   */
  var DOT_MARKS = ["・", "●", "○", "◆", "◇", "■", "□"];

  var DASH_AND_ANGLE_MARKS = ["-", "<"];   // 記号の形状に着目した命名

  /**
   * 「見出し型箇条書き」の簡易判定用正規表現
   * - 行頭の空白を許容し、その後に 1〜3 桁の数字や英字 + "." or ")" などを想定。
   *   例: "1.", "1)", "(1)", "a.", "A)" 等
   * - 実際の運用に合わせて調整可能。
   * @type {RegExp}
   */
  // var HEADING_MARK_RE = /^[ \u3000]*((?:[\(\（][0-9]{1,2}[\)\）]|[\(\（][A-Za-z]{1,3}[\)\）]|[0-9]{1,2}[\.．]|[A-Za-z][\.．]|[0-9]{1,2}(?=\s)|[A-Za-z]+(?=\s)|第[0-9]{1,2}(?=\s)))/;
  var HEADING_MARK_RE = /^[ \u3000]*((?:[\(\（][0-9]{1,2}[\)\）]|[\(\（][A-Za-z]{1,3}[\)\）]|[0-9]{1,2}[\.．]|[A-Za-z][\.．]|[0-9]{1,2}(?=\s)|第[0-9]{1,2}(?=\s)))/;

  // ========================================================================
  // 1. 空白挿入（先頭）
  // ========================================================================

  /**
   * 行頭に空白を挿入する
   *
   * - すべての非空行の先頭に指定個数の半角スペースを付与する。
   * - 第 2 引数 count を省略した場合は 1 個だけ付与。
   * - 既に空白が存在していても、そのまま上から追加する（正規化は行わない）。
   *
   * @param {string} str 入力文字列
   * @param {number} [count=1] 付与する半角スペースの個数（オーバーロード用）
   * @returns {string} 行頭に空白が挿入された文字列
   */
  function padHead(str, count) {
    var lines = splitLines(str);
    var c = typeof count === "number" && count > 0 ? count : 1;
    var pad = new Array(c + 1).join("　"); // " ".repeat(c) 互換

    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === "") continue;
      lines[i] = pad + lines[i];
    }
    return joinLines(lines);
  }

  // ========================================================================
  // 2. 空白削除（条件付き）
  //   - 先頭文字が【空白＋箇条書き_ドット】
  //   - 先頭文字が【空白＋箇条書き_見出し】
  //   - 先頭文字が【空白＋<】
  // ========================================================================

  /**
   * 行頭の空白を条件付きで削除する
   *
   * ▼ mode の指定（オーバーロード）
   *   - 省略 or "all"
   *       → すべての行で「行頭の空白類（半角・全角）」を削除（trimStart 相当）
   *   - "dot"
   *       → 「半角または全角空白 + 箇条書きドット記号」で始まる行だけ、
   *          先頭の空白 1 文字を削除する。
   *   - "head"
   *       → 「半角または全角空白 + 見出しマーク（HEADING_MARK_RE で判定）」で
   *          始まる行だけ、先頭の空白 1 文字を削除する。
   *   - "lt"
   *       → 「半角または全角空白 + '<'」で始まる行だけ、先頭の空白 1 文字を削除。
   *   - ["dot", "lt"] のように配列で複数指定も可能。
   *
   * @param {string} str 入力文字列
   * @param {string|string[]} [mode="all"] 削除モード
   * @returns {string} 行頭空白が条件に応じて削除された文字列
   */
  function trimHead(str, mode) {
    var lines = splitLines(str);
    var modes;

    if (mode == null) {
      modes = ["dot", "head", "lt"];
    } else if (Array.isArray(mode)) {
      modes = mode.slice();
    } else {
      modes = [mode];
    }

    var useAll = modes.indexOf("all") !== -1;
    var useDot = modes.indexOf("dot") !== -1;
    var useHead = modes.indexOf("head") !== -1;
    var useLt = modes.indexOf("lt") !== -1;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (useAll) {
        // 先頭の空白類（半角・全角）をすべて削除
        lines[i] = line.replace(/^[ \t\u3000]+/, "");
        continue;
      }

      var trimmed = line;

      // 「空白 + ドット箇条書き」の場合だけ 1 文字削除
      if (useDot && /^[ \u3000]/.test(trimmed)) {
        for (var d = 0; d < DOT_MARKS.length; d++) {
          var mark = DOT_MARKS[d];
          if (trimmed.indexOf(" " + mark) === 0 || trimmed.indexOf("　" + mark) === 0) {
            trimmed = trimmed.slice(1); // 先頭の空白 1 文字だけ削除
            break;
          }
        }
      }

      // 「空白 + 見出し箇条書き」の場合だけ 1 文字削除
      if (useHead && /^[ \u3000]/.test(trimmed) && HEADING_MARK_RE.test(trimmed.slice(1))) {
        trimmed = trimmed.slice(1);
      }

      // 「空白 + '<'」で始まる場合だけ 1 文字削除
      if (useLt && (trimmed.indexOf(" <") === 0 || trimmed.indexOf("　<") === 0)) {
        trimmed = trimmed.slice(1);
      }

      // 「空白 + '<'」で始まる場合だけ 1 文字削除
      if (useLt && (trimmed.indexOf(" -") === 0 || trimmed.indexOf("　-") === 0)) {
        trimmed = trimmed.slice(1);
      }

      lines[i] = trimmed;
    }

    return joinLines(lines);
  }

  // ========================================================================
  // 10. 箇条書き行の直下行削除で詰める
  //     - 先頭文字が【箇条書き_ドット】 → 直下行削除
  //     - 先頭文字が【箇条書き_見出し】 → 直下行削除
  // ========================================================================

  /**
   * 箇条書き行の直下行を削除して詰める
   *
   * ▼ 挙動（デフォルト）
   *   - mode によって対象となる箇条書き行を切り替える：
   *       "dot"  : ドット箇条書き行のみ対象
   *       "head" : 見出し箇条書き行のみ対象
   *       "both" : 両方を対象（デフォルト）
   *   - 対象となった行の「直下の行」が空行（空白のみ含む行を含む）の場合、
   *     その直下行を削除して行を詰める。
   *   - 「空行のみ削除」にしているのは安全側の実装とするためであり、
   *     必要であれば「常に 1 行削除」に変更可能。
   *
   * @param {string} str 入力文字列
   * @param {"dot"|"head"|"both"} [mode="both"] 箇条書き種別
   * @returns {string} 箇条書き直下の空行が削除された文字列
   */
  function tightBelowBullet(str, mode) {
    var lines = splitLines(str);
    var n = lines.length;
    var m = mode || "both";
    var useDot = m === "both" || m === "dot";
    var useHead = m === "both" || m === "head";

    var out = [];
    var i = 0;

    while (i < n) {
      var line = lines[i];
      out.push(line);

      var isDotBullet = false;
      var isHeadBullet = false;
      var isDashAndAngle = false;

      var dotRe_marksClass = DOT_MARKS.filter(ch => ch !== "●").map(escapeForRegExp).join("");
      var dotRe = new RegExp("^[ \\u3000]*([" + dotRe_marksClass + "])");

      var dAaRe_marksClass = DASH_AND_ANGLE_MARKS.map(escapeForRegExp).join("");
      var dAaRe = new RegExp("^[ \\u3000]*([" + dAaRe_marksClass + "])");

      if (useDot && dotRe.test(line)) {
        isDotBullet = true;
      }
      if (useHead && HEADING_MARK_RE.test(line)) {
        isHeadBullet = true;
      }
      if (dAaRe.test(line)) {
        isDashAndAngle = true;
      }

      if ((isDotBullet || isHeadBullet || isDashAndAngle) && i + 1 < n) {
        var nextLine = lines[i + 1];
        if (isBlankLine(nextLine)) {
          // 直下行が空行ならスキップ（＝削除）
          i +=2;
          continue;
        }
      } 
      i += 1;
    }

    return joinLines(out);
  }

  // ========================================================================
  // 3. 全角化（条件付き）
  //   - 先頭文字が【箇条書き_見出し】 → マーク全角化
  //   - 先頭文字が【箇条書き_ドット】 → 行全体全角化
  // ========================================================================

  /**
   * 行頭条件に応じて全角化を行う
   *
   * ▼ mode の指定（オーバーロード）
   *   - "head"（デフォルト）
   *       → 見出し型箇条書き行の「マーク部分のみ」を全角英数字化。
   *         例: "1. 本発明は…" → "１. 本発明は…"
   *   - "dot"
   *       → ドット箇条書き行全体に対して全角英数字化を行う。
   *         例: "・ a) sample1, sample2" → "・ ａ) ｓａｍｐｌｅ１, ｓａｍｐｌｅ２"
   *
   * @param {string} str 入力文字列
   * @param {"head"|"dot"} [mode="head"] 全角化モード
   * @returns {string} 条件付き全角化後の文字列
   */
  function fwHead(str, mode) {
    var lines = splitLines(str);
    var m = mode || "both";

    // ドット記号用の正規表現を事前作成（空白はあってもなくてもよい）
    var marksClass = DOT_MARKS.map(escapeForRegExp).join("");
    var dotRe = new RegExp("^[ \\u3000]*([" + marksClass + "])");

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === "") continue;

      // 1) ドット箇条書き判定（行頭）
      var dotMatch = line.match(dotRe);
      if (dotMatch) {
        if (m === "dot" || m === "both") {
          // 行全体の英数字を全角化
          lines[i] = toFwAlnumStr(line);
          // dot 行は既に処理済みなので次行へ
          continue;
        }
        // mode が "head" の場合は dot 行はスキップして見出し判定へ進める
      }

      // 2) 見出しマーク判定（head 処理）
      if (m === "head" || m === "both") {
        var mHead = line.match(HEADING_MARK_RE);
        if (mHead) {
          var headMark = mHead[1]; // マーク部分（正規表現でキャプチャされる想定）
          var idx = line.indexOf(headMark);
          if (idx >= 0) {
            var before = line.slice(0, idx);
            var after = line.slice(idx + headMark.length);
            var fwMark = toFwAlnumStr(headMark);
            lines[i] = before + fwMark + after;
          }
        }
      }
      // それ以外はそのまま
    }

    return joinLines(lines);
  }
  
  // ========================================================================
  // 5. 番号全角化（条文番号・第◯節／第◯頁・キーワード後続数字）
  // ========================================================================

  /**
   * 条文系の番号を全角化する
   *
   * 対象とするパターン（簡易版。必要に応じて拡張可能）:
   *   1) 「第◯条」
   *        - 例: "第12条" → "第１２条"
   *   2) 「第◯節」「第◯頁」（数字＋英字）
   *        - 例: "第3A節" → "第３Ａ節"
   *   3) キーワード後続の番号列（数字 or 数字＋英字）
   *        - キーワード: 「引用文献」「文献」「相違点」「主張」「請求項」
   *        - 区切り: 「、」「,」「-」「及び」「又は」「.」などを想定
   *        - 例: "引用文献 1, 2-4" → "引用文献 １, ２-４"
   *
   * 実装は簡易的な正規表現ベースとし、特殊な書き方が出てきた場合は
   * 正規表現を追加・修正する前提。
   *
   * @param {string} str 入力文字列
   * @returns {string} 番号部分が全角化された文字列
   */
  function fwNumLaw(str) {
    var s = String(str || "");

    // 1) 第◯条 形式の数字だけを全角化
    // 1-1. 「第◯条の◯第◯項第◯号」形式を処理
    s = s.replace(/第([0-9]+)条の([0-9]+)第([0-9]+)項第([0-9]+)号/g, (_, j, n, k, g) => {
      j = removeWS(j); n = removeWS(n); k = removeWS(k); g = removeWS(g);
      return `第${toFwNumStr(j)}条の${toFwNumStr(n)}第${toFwNumStr(k)}項第${toFwNumStr(g)}号`;
    });
    // 1-2. 「第◯条の◯第◯項」形式を処理
    s = s.replace(/第([0-9]+)条の([0-9]+)第([0-9]+)項/g, (_, j, n, k) => {
      j = removeWS(j); n = removeWS(n); k = removeWS(k);
      return `第${toFwNumStr(j)}条の${toFwNumStr(n)}第${toFwNumStr(k)}項`;
    });
    // 1-3. 「第◯条の◯」形式を処理
    s = s.replace(/第([0-9]+)条の([0-9]+)/g, (_, j, n) => {
      j = removeWS(j); n = removeWS(n);
      return `第${toFwNumStr(j)}条の${toFwNumStr(n)}`;
    });

    // 2-1. 「第◯条第◯項第◯号」形式を処理
    s = s.replace(/第([0-9]+)条第([0-9]+)項第([0-9]+)号/g, (_, j, k, g) => {
      j = removeWS(j); k = removeWS(k); g = removeWS(g);
      return `第${toFwNumStr(j)}条第${toFwNumStr(k)}項第${toFwNumStr(g)}号`;
    });
    
    // 2-2. 「第◯条第◯項」形式を処理
    s = s.replace(/第([0-9]+)条第([0-9]+)項/g, (_, j, k) => {
      j = removeWS(j); k = removeWS(k);
      return `第${toFwNumStr(j)}条第${toFwNumStr(k)}項`;
    });
    
    // 2-3. 「第◯条」形式を処理
    s = s.replace(/第([0-9]+)条/g, (_, j) => {
      j = removeWS(j);
      return `第${toFwNumStr(j)}条`;
    });
    
    // 3. 「特許法施行規則」
    s = s.replace(/特許法施行規則様式第([0-9]+)備考([0-9、]+)/g, (_, j, n) => {
      j = removeWS(j); n = removeWS(n);
      return `特許法施行規則様式第${toFwNumStr(j)}備考${toFwNumStr(n)}`;
    });
    
    // 2) 第◯節 / 第◯頁 （数字＋英字）を全角英数字化
    s = s.replace(/第([0-9A-Za-z\.\s]+)(節|頁)/g, function (_, j, suffix) {
      j = removeWS(j);
      return "第" + toFwAlnumStr(j) + suffix;
    });

    // 3) 日付を全数字化
    s = s.replace(/令和([0-9\s]+)年([0-9\s]+)月([0-9\s]+)日/g, function (_, y, m, d) {
      y = removeWS(y); m = removeWS(m); d = removeWS(d);
      y = padLeftZero(y.trim(),2);
      m = padLeftZero(m.trim(),2);
      d = padLeftZero(d.trim(),2);
      return `令和${toFwNumStr(y)}年${toFwNumStr(m)}月${toFwNumStr(d)}日`;
    });

    // 3) キーワード後続の番号列（簡易的に行末までを対象とする）
    var KEYWORD_RE =
      /(引用文献|文献|相違点|主張)([\s:：]*)([0-9A-Za-z、,\-\.\s及び又は]+)/g;

    s = s.replace(KEYWORD_RE, function (_all, kw, sep, tail) {
      tail = removeWS(tail);
      // tail 部分の英数字を全角化
      var fwTail = toFwAlnumStr(tail);
      return kw + sep + fwTail;
    });

    var KEYWORD_RE =
      /(請求項)([\s:：]*)([0-9A-Za-z、,\-\.\(\)\s及び又は]+)/g;

    s = s.replace(KEYWORD_RE, function (_all, kw, sep, tail) {
      tail = removeWS(tail);
      // tail 部分の英数字を全角化
      var fwTail = toFwAlnumStr(tail);
      return kw + sep + fwTail;
    });
    
    var KEYWORD_RE =
      /(段落|図|式)([\s:：]*)([0-9A-Za-z、,\-\.\[\]\(\)\s及び又は]+)/g;

    s = s.replace(KEYWORD_RE, function (_all, kw, sep, tail) {
      tail = removeWS(tail);
      // tail 部分の英数字を全角化
      var fwTail = toFwAlnumStr(tail);
      return kw + sep + fwTail;
    });

    return s;
  }

  // ========================================================================
  // 6. 引用箇所全角化
  //   - 【特に段落】で始まる数字
  //   - 【図】で始まる数字＋英字
  //   - 【特表】でない【表】で始まる数字＋英字
  //   - 【式】で始まる数字＋英字
  // ========================================================================

  /**
   * 引用箇所（【図】【表】【式】など）の番号を全角化する
   *
   *  文中の「特表」を除く「表(...)」の括弧内だけ、数字＋英字を全角化する
   *  - 例: 「表(1-3, A)」→ 「表（１－３， Ａ）」
   *  - 例: 「特表(1-3)」→ 変更しない
   *
   * 区切り記号「、」「-」「及び」「又は」「[」「]」「(」「)」「.」などは
   * そのまま残しつつ、数字と英字だけを全角化する。
   *
   * @param {string} str 入力文字列
   * @returns {string} 引用番号が全角化された文字列
   */
  function fwRefLaw(str) {
    return str.replace(/表([\s:：]*)([0-9A-Za-z、,\-\.\[\]\(\)及び又は]+)/g, function (match, _all ,inner, offset, s) {
      inner = removeWS(inner);
      // 直前が「特」なら「特表」なのでスキップ
      if (offset > 0 && s.charAt(offset - 1) === "特") return match;
      return "表" + toFwAlnumStr(inner) + "";
    });

  }

  // ========================================================================
  // 4. 文字置換（英字の大小処理）
  // ========================================================================

  /**
   * 英字の連続部分（単語）の先頭1文字のみを大文字に変換する
   *
   * ▼ 処理内容
   *   - 半角英字（a〜z, A〜Z）の連続部分（単語）をすべて検出
   *   - 各単語の先頭1文字を大文字にし、2文字目以降はそのまま
   *   - 区切り文字（数字、記号、スペース、改行など）はそのまま保持
   *
   * ▼ 対象外
   *   - 全角英字（Ａ〜Ｚ、ａ〜ｚ）は対象外
   *   - 英字以外の文字列は変更されない
   *
   * @param {string} str 入力文字列
   * @returns {string} 英字単語の先頭のみ大文字にした文字列
   */
  function alphaCase(str) {
    return String(str || "").replace(/[a-zA-Z]+/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }

  // ========================================================================
  // 7. 改行圧縮
  // ========================================================================

  /**
   * 改行（空行）を圧縮する
   *
   * - 連続する空行を 1 行に圧縮しつつ、先頭と末尾の空行は削除する。
   * - 「空白類のみの行」も空行として扱う。
   * - コンテンツ行同士の間には最大 1 行の空行だけが存在する状態を目指す。
   *
   * @param {string} str 入力文字列
   * @returns {string} 改行が圧縮された文字列
   */
  function tightLines(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    const lines = splitLines(str);
    const outLines = [];

    for (const line of lines) {
        if (isBlankLine(line)) {
          // 空行はすべて削除
          continue;
        }
      outLines.push(line);
    }

    return joinLines(outLines);
  }

  // ========================================================================
  // 8. 主張部分（『』内の空白行削除）
  // ========================================================================


  /**
   * 指定したマーカーに挟まれた範囲の空白行を削除する。
   *
   * - 開始マーカーと終了マーカーに挟まれたテキストを対象とし、
   *   その内部の空白行（空文字や空白のみの行）を削除する。
   * - マーカーは文字列または文字列配列で指定可能。
   * - 対象範囲外のテキストは変更しない。
   * - 入れ子構造や複数出現には非対応の簡易実装。
   *
   * @param {string} str 入力文字列
   * @param {string|string[]} startMarker 開始マーカー
   * @param {string|string[]} endMarker 終了マーカー
   * @returns {string} 空白行が削除された文字列
   */
  function stripBlankLinesBetween(str, startMarker, endMarker) {
    if (str == null || str === "") return "";
    const s = String(str);

    const starts = Array.isArray(startMarker) ? startMarker : [startMarker];
    const ends = Array.isArray(endMarker) ? endMarker : [endMarker];

    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let result = s;
    for (const start of starts) {
      for (const end of ends) {
        const pattern = new RegExp(
          `(${escapeRegExp(start)})([\\s\\S]*?)(${escapeRegExp(end)})`,
          'g'
        );

        result = result.replace(pattern, (_all, pre, inner, post) => {
          const innerLines = splitLines(inner);
          const outLines = innerLines.filter(line => !isBlankLine(line));
          return pre + joinLines(outLines).trim() + post;
        });
      }
    }

    return result;
  }


  /**
   * 『』内（主張部分）に存在する空白行を削除する
   *
   * - 文字列全体から「『...』」パターンを探し、それぞれの内部で
   *   改行単位に分割して空白行を削除する。
   * - 『』の外側は一切変更しない。
   * - 入れ子構造は想定せず、最短一致の『...』を対象とする簡易実装。
   *
   * @param {string} str 入力文字列
   * @returns {string} 『』内部の空白行が削除された文字列
   */
  function tightClaims(str) {
    if (str == null || str === "") return "";
    const s = String(str);

    const startMarkers = "『";
    const endMarkers = "』";

    return stripBlankLinesBetween(s, startMarkers, endMarkers);
  }


  // ========================================================================
  // 9. 付記／補正の示唆部分（ブロック内空白行削除：簡易版）
  // ========================================================================

  /**
   * 「付記」「補正の示唆」ブロック内の空白行を削除する（簡易版）
   *
   * ▼ 対象とする開始行（行頭判定）
   *   - "付記" で始まる行
   *   - "補正の示唆" で始まる行
   *
   * ▼ ブロックの終端
   *   - 次に現れる「行頭が全角ブラケット '【' 」の行
   *   - またはテキスト末尾
   *
   * 対象ブロック内の空白行を削除し、内容を詰める。
   * 実際の運用仕様に合わせて開始条件・終了条件は調整可能。
   *
   * @param {string} str 入力文字列
   * @returns {string} 付記／補正の示唆ブロック内の空白行が削除された文字列
   */
  function tightNote(str) {
    return str;
  }

  // ========================================================================
  // グローバル公開
  // ========================================================================

  /**
   * 公開オブジェクト
   * - 各関数は (str: string) => string を基本形としているため、
   *   FilterRegistry のステップ関数としてもそのまま利用可能。
   */
  root.textUtilsMain = {
    // 空白系
    padHead: padHead,
    trimHead: trimHead,

    // 下の改行を詰める(箇条書き系は全角になると反応しないので、)
    tightBelowBullet: tightBelowBullet,

    // 全角化・文字種変換
    fwHead: fwHead,
    fwNumLaw: fwNumLaw,
    fwRefLaw: fwRefLaw,

    // 表とか図の英字を大文字にしない
    alphaCase: alphaCase,

    // 行構造（改行・空行）系
    tightLines: tightLines,
    tightClaims: tightClaims,
    tightNote: tightNote
  };
})(globalThis);
