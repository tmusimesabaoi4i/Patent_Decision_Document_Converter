// ファイル名例: text-convert-module.js
// （お好みで textUtilsConvertForDoc.js などに変更してください）

(function (root) {
  "use strict";

  /**
   * モジュール概要
   * ----------------------------------------
   * 特定フォーマットのテキスト（先行技術文献調査の結果など）に対して、
   * 各行をパターンマッチさせて整形するユーティリティ群です。
   *
   * 主な処理:
   *  - テキスト → 行配列 / 行配列 → テキスト の相互変換
   *  - 全角英数字の半角化
   *  - 行ごとのパターン判定＆整形（インデント調整・ラベル整形など）
   *  - 先行技術文献調査の記録部分だけを抜き出して整形するラッパ処理
   */

  /**
   * 全角英数字（０-９, Ａ-Ｚ, ａ-ｚ）を半角に変換するヘルパ
   * @param {string} c - 1文字
   * @returns {string} 半角に変換された文字（または元の文字）
   */
  function toHalfAlnumChar(c) {
    var code = c.charCodeAt(0);
    // 全角数字（０-９）
    if (code >= 0xff10 && code <= 0xff19) {
      return String.fromCharCode(code - 0xff10 + 0x30);
    }
    // 全角大文字（Ａ-Ｚ）
    if (code >= 0xff21 && code <= 0xff3a) {
      return String.fromCharCode(code - 0xff21 + 0x41);
    }
    // 全角小文字（ａ-ｚ）
    if (code >= 0xff41 && code <= 0xff5a) {
      return String.fromCharCode(code - 0xff41 + 0x61);
    }
    return c;
  }

  /**
   * 文字列を改行単位で分割する。
   * Windows / macOS / Unix など、代表的な改行パターンに対応する。
   *
   * @param {string} str - 入力文字列
   * @returns {string[]} 行ごとの配列
   */
  function splitLines(str) {
    return String(str).split(/\r\n|\r|\n/);
  }

  /**
   * 行配列を単純に "\n" で結合して 1 つの文字列に戻す。
   * 元の改行コードは保持しない（LF 固定）。
   *
   * @param {string[]} lines - 行配列
   * @returns {string} 結合した文字列
   */
  function joinLines(lines) {
    return lines.join("\n");
  }

  /**
   * 文字列中の「全角英数字」を半角化する
   * @param {string} text
   * @returns {string}
   */
  function toFwAlnumStr(text) {
    // ※名前は既存との互換のためそのままですが、
    //   実際には「全角 → 半角」に変換します。
    return String(text).replace(/[０-９Ａ-Ｚａ-ｚ]/g, toHalfAlnumChar);
  }

  /**
   * 単一行をルールベースで整形する。
   *
   * 処理の流れ:
   *   1. 前後の空白を trim()
   *   2. 全角英数字等を半角化
   *   3. 下記パターンに基づいて条件分岐し、先頭インデントやラベルを整形
   *
   * 主なルール:
   *   - DB名行（IEEE / 3GPP）を特定の全角スペース＋ラベルに揃える
   *   - 「SA WG1-4、6」「CT WG1、4」などを所定のインデント位置に揃える
   *   - 「・調査した分野  IPC ...」「・先行技術文献 ...」の空白を正規化
   *   - IPC 行（例: "H04B..." / "H04W..."）のインデントを固定
   *   - 「国」「特」「実」「米」「中」「韓」から始まる行を所定の位置に揃える
   *   - 上記いずれにも当てはまらない行は、基本インデント＋内容という形にする
   *
   * @param {string} str - 1 行分の文字列
   * @returns {string} 整形済みの 1 行分の文字列
   */
  function convertEachLine(str) {
    var raw = str == null ? "" : String(str);
    var s = raw.trim(); // 行頭・行末の空白を削除

    // 完全な空行はそのまま空行として返す
    if (s === "") {
      return "";
    }

    // 全角英数字を半角に正規化
    s = toFwAlnumStr(s);

    // n/m - x/y をまとめて拾う（/ と - の前後に空白があってもマッチさせる）
    var pattern = /\s*(\d+)\s*(\/)\s*(\d+)(\s*-\s*)(\d+)\s*(\/)\s*(\d+)/g;

    s = String(s).replace(
      pattern,
      function (_all, d1, slash1, d2, dashPart, d3, slash2, d4) {
        // 1個目の数字用パディング
        function pad_1st(numStr) {
          // 例: 4桁右寄せ（必要に応じて桁数変更）
          return ("   " + numStr).slice(-3);
        }

        // 2個目の数字用パディング
        function pad_2nd(numStr) {
          return ("   " + numStr).slice(-3);
        }

        // 3個目の数字用パディング
        function pad_3rd(numStr) {
          return ("     " + numStr).slice(-5);
        }

        // 4個目の数字用パディング
        function pad_4th(numStr) {
          return ("   " + numStr).slice(-3);
        }

        // 数字部分だけ整形して再構成
        return (
          pad_1st(d1.trim()) +
          slash1.trim() +               // "/" はそのまま
          pad_2nd(d2.trim()) +
          dashPart.trim() +             // " - " 含む部分（元の空白を維持）
          pad_3rd(d3.trim()) +
          slash2.trim() +
          pad_4th(d4.trim())
        );
      }
    );


    // デバッグしたいときだけコメントアウトを外す
    // console.log("[convertEachLine]", s);

    // ------------------------------
    // 固定文言に対する完全一致マッチ
    // ------------------------------
    if (s === "<先行技術文献調査結果の記録>") {
      return "　　　　　　　　　　<先行技術文献調査結果の記録>";
    }

    if (s === "DB名 IEEE 802.11") {
      return "　　　　　　　　　ＤＢ名　　IEEE 802.11";
    }

    if (s === "DB名 3GPP TSG RAN WG1-4") {
      return "　　　　　　　　　ＤＢ名　　3GPP TSG RAN WG1-4";
    }

    if (s === "IEEE 802.11") {
      return "　　　　　　　　　　　　　　IEEE 802.11";
    }

    if (s === "3GPP TSG RAN WG1-4") {
      return "　　　　　　　　　　　　　　3GPP TSG RAN WG1-4";
    }

    if (s === "SA WG1-4、6") {
      return "　　　　　　　　　　　　　　　　　　 SA  WG1-4、6";
    }

    if (s === "CT WG1、4") {
      return "　　　　　　　　　　　　　　　　　　 CT  WG1、4";
    }

    // ------------------------------
    // ラベル＋可変末尾のパターンマッチ
    // ------------------------------

    // 例: 「・調査した分野　IPC　H04B...」など
    var m = s.match(/^・調査した分野[\s\u3000]+IPC[\s\u3000]+(.+)$/);
    if (m) {
      // 「・調査した分野  IPC  (末尾)」というスペース固定フォーマットに整形
      return "・調査した分野　　ＩＰＣ　　" + m[1];
    }

    // 例: 「・先行技術文献　特開...」など
    m = s.match(/^・先行技術文献[\s\u3000]+(.+)$/);
    if (m) {
      // ラベルと本文の間のスペースを固定
      return "・先行技術文献  " + m[1];
    }

    // IPC 行: "H04B..." / "H04W..." など
    // 先頭空白は trim() 済みなので、先頭からアルファベット＋2桁数字＋アルファベットを判定
    m = s.match(/^([A-Za-z]\d{2}[A-Za-z].*)$/);
    if (m) {
      // 所定インデント＋内容
      return "　　　　　　　　　　　　　　" + m[1]; // 全角スペース 10個分＋α
    }

    // ------------------------------
    // 国 / 特 / 実 / 米 / 中 / 韓 などで始まる行のインデント調整
    // （実際の出力はデフォルト処理と同じだが、意味的に分けておく）
    // ------------------------------

    m = s.match(/^国(.*)$/);
    if (m) {
      return "　　　　　　　　国" + m[1];
    }

    m = s.match(/^特(.*)$/);
    if (m) {
      return "　　　　　　　　特" + m[1];
    }

    m = s.match(/^実(.*)$/);
    if (m) {
      return "　　　　　　　　実" + m[1];
    }

    m = s.match(/^米(.*)$/);
    if (m) {
      return "　　　　　　　　米" + m[1];
    }

    m = s.match(/^中(.*)$/);
    if (m) {
      return "　　　　　　　　中" + m[1];
    }

    m = s.match(/^韓(.*)$/);
    if (m) {
      return "　　　　　　　　韓" + m[1];
    }

    // ------------------------------
    // どのパターンにも一致しなかった行のデフォルト処理
    // ------------------------------
    // ベースとなるインデント（全角スペースの塊）を前置した上で、
    // 行内容（trim & 全角英数字→半角 済み）をそのまま連結する。
    return "　　　　　　　　" + s;
  }

  function convertEachLineForFamily(str) {
    var raw = str == null ? "" : String(str);
    var s = raw.trim(); // 行頭・行末の空白を削除

    // 完全な空行はそのまま空行として返す
    if (s === "") {
      return "";
    }

    // 全角英数字を半角に正規化
    s = toFwAlnumStr(s);

    // デバッグしたいときだけコメントアウトを外す
    // console.log("[convertEachLine]", s);

    // ------------------------------
    // 固定文言に対する完全一致マッチ
    // ------------------------------
    var m = s.match(/^([0-9].*)$/);
    if (m) {
      // 所定インデント＋内容
      return s; // 全角スペース 10個分＋α
    }

    // ------------------------------
    // どのパターンにも一致しなかった行のデフォルト処理
    // ------------------------------
    // ベースとなるインデント（全角スペースの塊）を前置した上で、
    // 行内容（trim & 全角英数字→半角 済み）をそのまま連結する。
    return "　　　" + s;
  }

  /**
   * 「記」行（「　記」「　記（引用文献等については引用文献等一覧参照）」など）
   * より上の部分だけを対象として、
   *
   *  1. ASCII の数字・英字・記号 (!〜~) を全角に変換する
   *  2. 行頭が「数字＋．」で始まる行について、
   *     「番号行の直後にちょうど 1 行だけ空行を挿入」する
   *     （元々の空行はまとめて 1 行に潰す）
   *
   * - 「記」行より下のテキストは一切変更しない。
   * - 「記」行が存在しない場合は元の文字列をそのまま返す。
   *
   * 例）
   *   １．（）      ２．あ
   *   ３．Ａ        ４．Ｂ
   *
   *         記      （引用文献等については引用文献等一覧参照）
   *
   * ↓ 変換後：
   *
   *   １．
   *
   *   ２．
   *
   *   ３．
   *
   *   ４．
   *
   *         記      （引用文献等については引用文献等一覧参照）
   *
   * @param {string} text 変換対象の全文テキスト
   * @returns {string} 変換後テキスト
   */
  function convertBeforeKirokuLineToFullWidth(text) {
    var str = String(text);

    // ------------------------------------------------------------
    // 「記」行を境に、pre（上側） / tail（「記」行以降）に分割する
    // ------------------------------------------------------------
    //
    // - 行全体が
    //     [スペース*] 記 [スペース*] （引用文献等については引用文献等一覧参照）? [スペース*]
    //   だけで構成されている行のみを「記」行とみなす。
    //
    //   つまり：
    //     「　　　　　記」
    //     「　　　　　記　　　（引用文献等については引用文献等一覧参照）」
    //   はマッチするが、
    //     「…下記の刊行物…」
    //     「…に記載された…」
    //   はマッチしない。
    //
    // - pre  : 「記」行より上の全文
    // - tail : 「記」行そのもの＋それ以降すべて
    //
    var splitByKiLinePattern =
      /([\s\S]*?)(^[ 　]*記[ 　]*(?:[（(]引用文献等については引用文献等一覧参照[）)])?[ 　]*$[\s\S]*)/m;

    // 「記」行が存在しない場合、replace は何も置き換えずそのまま str を返す
    return str.replace(
      splitByKiLinePattern,
      function (__all, pre, tail) {
        // --------------------------------------------------------
        // 1) 「記」より上の部分だけ ASCII → 全角 変換
        // --------------------------------------------------------
        var convertedBefore = toZenkakuAscii(pre);

        // --------------------------------------------------------
        // 2) 「数字＋．」で始まる行の直後を 1 行だけ空行に正規化
        // --------------------------------------------------------

        // 改行コード種別の推定（必要に応じて簡易判定）
        var newline = "\n";
        if (/\r\n/.test(str)) {
          newline = "\r\n";
        } else if (/\r/.test(str)) {
          newline = "\r";
        }

        convertedBefore = normalizeNumberedHeadingsWithBlankLine(
          convertedBefore,
          newline
        );

        // pre 側だけを加工し、tail（「記」行以降）は一切変更しない
        return convertedBefore + "\n" + tail;
      }
    );
  }


  /**
   * 「数字＋．」で始まる行を見つけた場合に、
   * その行の直後にちょうど 1 行だけ空行を入れるヘルパ。
   *
   * - もともと複数の空行がある場合はまとめて 1 行に潰す。
   * - 末尾行が番号行の場合も、最後に 1 行空行を追加する。
   *
   * 対象例：
   *   １．あ       → 「１．」だけ残し、次行に空行を 1 行挿入
   *   2.BBB        → 「2.」だけ残し、次行に空行を 1 行挿入
   *
   * @param {string} block 変換対象ブロック（「記」より上の部分）
   * @param {string} newline 改行コード（"\n" / "\r\n" など）
   * @returns {string}
   */
  function normalizeNumberedHeadingsWithBlankLine(block, newline) {
    var lines = String(block).split("\n");
    var resultLines = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // 行頭のパターン：
      //   [空白] + 数字(全角／半角) + ドット(全角／半角) + その後ろは任意
      //
      // 例：
      //   "１．あ"  → prefix=""; nums="１"; dot="．"; rest="あ"
      //   "  3. TEST" → prefix="  "; nums="3"; dot="."; rest=" TEST"
      var m = line.match(/^([ 　]*)([0-9０-９]+)([\.．])(\s*)(.*)$/);

      if (!m) {
        // 番号行でなければそのまま出力
        resultLines.push(line);
        i++;
        continue;
      }

      var prefix = m[1];
      var nums = m[2];
      var dot = m[3];
      var after = m[5]; // 今回は「数字＋．」以降のテキストは破棄する想定

      // 1行目: 「数字＋．」だけの行にする（後続テキストは削除）
      resultLines.push(prefix + nums + dot + after);

      // 以降の連続する空行を全部スキップ
      i++;
      while (i < lines.length && lines[i].trim() === "") {
        i++;
      }

      // そして空行を 1 行だけ挿入
      resultLines.push("");
    }

    return resultLines.join(newline);
  }

  /**
   * ASCII の記号／数字／英字 (!〜~) を全角に変換するユーティリティ。
   * - 半角スペース(0x20) はそのまま残す。
   *
   * @param {string} s
   * @returns {string}
   */
  function toZenkakuAscii(s) {
    return String(s).replace(/[!-~]/g, function (ch) {
      var code = ch.charCodeAt(0);

      // 半角スペース(0x20)は対象外（ここにはそもそも来ないが念のため）
      if (code === 0x20) {
        return ch;
      }

      // ASCII 0x21〜0x7E を全角へ（+0xFEE0）
      return String.fromCharCode(code + 0xFEE0);
    });
  }
  /**
   * 特定の「先行技術文献調査結果」のブロック部分だけを抜き出し、
   * その内部を行単位で整形する関数。
   *
   * 対象ブロックは、以下の 3 つの要素で囲まれた範囲とする:
   *   1. 20 個以上連続したハイフン＋改行
   *      （例）"------------------------------------\n"
   *   2. その後ろから、指定のコメント文言直前までの任意の文字列（改行含む）
   *   3. コメント文言:
   *      「この先行技術文献調査結果の記録は、拒絶理由を構成するものではありません。」
   *      （行頭に空白があってもよい）
   *
   * 正規表現:
   *   (-{20,}\r?\n)                → ハイフン20個以上＋改行（キャプチャ1）
   *   ([\s\S]*?)                   → 改行を含め任意文字（最短一致, キャプチャ2）
   *   (\r?\n[ \t\u3000]*この先行技術文献調査結果の記録は、拒絶理由を構成するものではありません。)
   *                                 → 改行＋任意空白＋固定メッセージ（キャプチャ3）
   *
   * マッチした範囲のうち「内部部分（キャプチャ2）」を:
   *   - 行に分解（splitLines）
   *   - 各行を convertEachLine() で整形
   *   - 行を結合（joinLines）
   * した上で、前後（ハイフン行／固定メッセージ）はそのまま維持する。
   *
   * @param {string} text - 全文テキスト
   * @returns {string} 内部だけ行整形済みのテキスト
   */
  function convertForDoc(text) {
    var str = String(text);
    
    str = convertBeforeKirokuLineToFullWidth(str);

    var pattern =
      /(-{20,}\r?\n)([\s\S]*?)(\r?\n[ \t\u3000]*この先行技術文献調査結果の記録は、拒絶理由を構成するものではありません。)/g;

    return String(str).replace(pattern, function (_all, pre, inner, post) {
      // inner（ハイフン行の次の行〜メッセージ直前）を行ごとに分解
      var innerLines = splitLines(inner);

      // 各行をルールベースで整形
      var outLines = innerLines.map(function (line) {
        return convertEachLine(line);
      });

      // ハイフン行 / 整形後テキスト / 固定メッセージ の順で再構成
      // pre には末尾の改行、post には先頭の改行を含めているので、
      // ここでは追加の "\n" は挟まない。
      return pre + joinLines(outLines) + post;
    });
  }

  function convertForFamily(text) {
    // ※注意：
    //   実際の本文が「＜ファミリー文献情報＞」（全角カギ）なのか
    //   「<ファミリー文献情報>」（半角カギ）なのかでパターンを変えてください。
    //
    //   ここでは例として「＜ファミリー文献情報＞」（全角）を想定しています。
    var pattern =
      /(<ファミリー文献情報>\n?)([\s\S]*?)([ 　]*この拒絶理由通知の内容に関するお問合せ又は面接のご希望がありましたら、次の連絡先までご連絡ください。補正案等の送付を希望される際は、その旨を事前にご連絡ください。)/;

    return String(text).replace(pattern, function (_all, header, inner, footer) {
      // ----------------------------------------------------
      // inner（間の部分）だけを行単位で変換する
      // ----------------------------------------------------

      // 中間部分を行ごとに分解
      var lines = splitLines(inner);

      // 各行を既存のルールベース関数で整形
      var outLines = lines.map(function (line) {
        return convertEachLineForFamily(line);
      });

      // 先頭の見出し行（header）と末尾の問い合わせ文（footer）はそのまま残し、
      // 間だけ整形済みテキストに置き換えて返す
      return "\n" + header + joinLines(outLines) + "\n" + footer;
    });
  }

  // ----------------------------------------
  // グローバルへのエクスポート
  // ----------------------------------------
  /**
   * textUtilsConvertForDoc 名前空間として公開。
   *
   * 使用例:
   *   const out = textUtilsConvertForDoc.convertForDoc(inputText);
   */
  root.textUtilsConvertForDoc = {
    // 先行技術文献調査ブロック内部の一括変換
    convertForDoc: convertForDoc,
    convertForFamily: convertForFamily,
  };
})(globalThis);
