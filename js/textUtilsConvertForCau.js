// ファイル名例: text-convert-module.js
// （お好みで textUtilsConvertForCau.js などに変更してください）

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
   * 全角英数字（０-９, Ａ-Ｚ, ａ-ｚ）を半角英数字に変換するヘルパ
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
   * 半角英数字 (0-9, A-Z, a-z) を全角英数字に変換するヘルパ
   * @param {string} c - 1文字
   * @returns {string} 全角に変換された文字（または元の文字）
   */
  function toFullAlnumChar(c) {
    var code = c.charCodeAt(0);
    // 半角数字（0-9）
    if (code >= 0x30 && code <= 0x39) {
      return String.fromCharCode(code - 0x30 + 0xff10);
    }
    // 半角大文字（A-Z）
    if (code >= 0x41 && code <= 0x5a) {
      return String.fromCharCode(code - 0x41 + 0xff21);
    }
    // 半角小文字（a-z）
    if (code >= 0x61 && code <= 0x7a) {
      return String.fromCharCode(code - 0x61 + 0xff41);
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
   * 文字列中の「全角英数字」を半角英数字に変換する
   * @param {string} text
   * @returns {string}
   */
  function toHalfAlnumStr(text) {
    return String(text).replace(/[０-９Ａ-Ｚａ-ｚ]/g, toHalfAlnumChar);
  }

  /**
   * 文字列中の「半角数字（0-9）」のみを全角数字に変換する
   * @param {string} text
   * @returns {string}
   */
  function toFullNumStr(text) {
    return String(text).replace(/[0-9]/g, toFullAlnumChar);
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
  function convertEachLine_ForCau(str) {
    var s = str == null ? "" : String(str);
    // var s = raw.trim(); // 行頭・行末の空白を削除

    // 完全な空行はそのまま空行として返す
    if (s === "") {
      return "";
    }

    // 全角英数字を半角に正規化
    s = toHalfAlnumStr(s);

    // デバッグしたいときだけコメントアウトを外す
    // console.log("[convertEachLine_ForCau]", s);

    // ------------------------------
    // 固定文言に対する完全一致マッチ
    // ------------------------------
    if (s === "　審査第四部伝送システム(PA5J) 飯星 陽平(いいほし ようへい)") {
      return "\n審査第四部伝送システム(PA5J) 飯星 陽平(いいほし ようへい)";
    }

    if (s === "　TEL.03-3581-1101 内線3534") {
      return "TEL.03-3581-1101 内線3534";
    }

    if (s === "　※●●●●@Jpo.Go.Jp (上記「●●●●」に置き換えて、「PA5J」と入力ください。)") {
      return "※●●●●@jpo.go.jp (上記「●●●●」に置き換えて、「PA5J」と入力ください。)";
    }

    // ------------------------------
    // どのパターンにも一致しなかった行のデフォルト処理
    // ------------------------------
    // ベースとなるインデント（全角スペースの塊）を前置した上で、
    // 行内容（trim & 全角英数字→半角 済み）をそのまま連結する。
    return toFullNumStr(s);
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
   *   - 各行を convertEachLine_ForCau() で整形
   *   - 行を結合（joinLines）
   * した上で、前後（ハイフン行／固定メッセージ）はそのまま維持する。
   *
   * @param {string} text - 全文テキスト
   * @returns {string} 内部だけ行整形済みのテキスト
   */
  function convertForCau(text) {
    var pattern = /(<補正をする際の注意>)([\s\S]*)/;

    return String(text).replace(pattern, function (_all, marker, tail) {
      // tail: 「<補正をする際の注意>」の直後から末尾まで

      // tail を行ごとに分解
      var lines = splitLines(tail);

      // 各行をルールベースで整形
      var outLines = lines.map(function (line) {
        return convertEachLine_ForCau(line);
      });

      // マーカー部分はそのまま、後ろだけ整形済みテキストを連結
      return marker + joinLines(outLines);
    });
  }

  function convertForOther(text) {
    var lines = splitLines(text);
    var outLines = lines.map(function (line) {
      if (line === "　記 (引用文献等については引用文献等一覧参照)"){
        return "\n　　　　　記　　　（引用文献等については引用文献等一覧参照）";
      }

      if (line === "　記"){
        return "\n　　　　　　　　　　　　　　　　　記";
      }
      if (line === "------------------------------------"){
        return "－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－";
      }

      if (line === "<引用文献等一覧>"){
        return "　　　　　　　　　　　　　<引用文献等一覧>";
      }
      return line;
    });
    return joinLines(outLines)
      .replace(/[<>]/g, (c) => {return c === "<" ? "＜" : "＞";})
      .replace(/[、。]/g, (c) => {return c === "、" ? "、" : "。";});
  }

  /**
   * 柔軟なマッチングで置換を行う（-/_/大文字小文字を無視）
   * @param {string} str - 入力文字列
   * @returns {string} - 置換後の文字列
   */
  function applyFlexibleMap(str) {
    const replaceMap = {
      gNB: "gNB",
      pa5j: "PA5J",
      lte: "LTE"
    };

    // 正規化関数：記号除去＋小文字化
    const normalize = (s) => s.replace(/[-_]/g, "").toLowerCase();

    // マップの正規化版を作る
    const normalizedMap = {};
    for (const key in replaceMap) {
      normalizedMap[normalize(key)] = replaceMap[key];
    }

    // 単語ごとに分割して置換
    return str.replace(/\b[\w\-]+\b/gi, (word) => {
      const norm = normalize(word);
      return normalizedMap[norm] || word;
    });
  }



  // ----------------------------------------
  // グローバルへのエクスポート
  // ----------------------------------------
  /**
   * textUtilsConvertForCau 名前空間として公開。
   *
   * 使用例:
   *   const out = textUtilsConvertForCau.convertForCau(inputText);
   */
  root.textUtilsConvertForCau = {
    // 先行技術文献調査ブロック内部の一括変換
    convertForCau: convertForCau,
    convertForOther: convertForOther,
    applyFlexibleMap: applyFlexibleMap,
  };
})(globalThis);
