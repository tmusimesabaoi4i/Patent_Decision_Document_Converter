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

    // デバッグしたいときだけコメントアウトを外す
    // console.log("[convertEachLine]", s);

    // ------------------------------
    // 固定文言に対する完全一致マッチ
    // ------------------------------
    if (s === "<先行技術文献調査結果の記録>") {
      return "\n　　　　　　　　　　<先行技術文献調査結果の記録>";
    }

    if (s === "DB名 IEEE 802.11") {
      return "　　　　　　　　DB名 IEEE 802.11";
    }

    if (s === "DB名 3GPP TSG RAN WG1-4") {
      return "　　　　　　　　DB名 3GPP TSG RAN WG1-4";
    }

    if (s === "SA WG1-4、6") {
      return "　　　　　　　　　　　　　　　SA WG1-4、6";
    }

    if (s === "CT WG1、4") {
      return "　　　　　　　　　　　　　　　CT WG1、4";
    }

    // ------------------------------
    // ラベル＋可変末尾のパターンマッチ
    // ------------------------------

    // 例: 「・調査した分野　IPC　H04B...」など
    var m = s.match(/^・調査した分野[\s\u3000]+IPC[\s\u3000]+(.+)$/);
    if (m) {
      // 「・調査した分野  IPC  (末尾)」というスペース固定フォーマットに整形
      return "\n・調査した分野  IPC  " + m[1];
    }

    // 例: 「・先行技術文献　特開...」など
    m = s.match(/^・先行技術文献[\s\u3000]+(.+)$/);
    if (m) {
      // ラベルと本文の間のスペースを固定
      return "\n・先行技術文献  " + m[1];
    }

    // IPC 行: "H04B..." / "H04W..." など
    // 先頭空白は trim() 済みなので、先頭からアルファベット＋2桁数字＋アルファベットを判定
    m = s.match(/^([A-Za-z]\d{2}[A-Za-z].*)$/);
    if (m) {
      // 所定インデント＋内容
      return "　　　　　　　　　　 " + m[1]; // 全角スペース 10個分＋α
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
    var pattern =
      /(-{20,}\r?\n)([\s\S]*?)(\r?\n[ \t\u3000]*この先行技術文献調査結果の記録は、拒絶理由を構成するものではありません。)/g;

    return String(text).replace(pattern, function (_all, pre, inner, post) {
      // inner（ハイフン行の次の行〜メッセージ直前）を行ごとに分解
      var innerLines = splitLines(inner);

      // 各行をルールベースで整形
      var outLines = innerLines.map(function (line) {
        return convertEachLine(line);
      });

      // ハイフン行 / 整形後テキスト / 固定メッセージ の順で再構成
      // pre には末尾の改行、post には先頭の改行を含めているので、
      // ここでは追加の "\n" は挟まない。
      return pre + joinLines(outLines) + "\n" + post;
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
  };
})(globalThis);
