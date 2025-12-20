(function (root) {
  "use strict";

  // ========================================================================
  // 内部共通ユーティリティ
  // ========================================================================

  /**
   * 文字列を行単位に分割します。
   *
   * - 入力の改行コード（\r\n, \r, \n）はすべて \n に正規化したうえで分割します。
   * - null / undefined / 空文字列の場合は、長さ 1 の配列 [""] を返します。
   *
   * @param {string} str 行分割したい文字列
   * @returns {string[]} 行ごとの文字列配列
   */
  function splitLines(str) {
    if (str == null || str === "") return [""];
    return String(str).split(/\r\n|\r|\n/);
  }

  /**
   * 行配列を 1 つの文字列に結合します。
   *
   * - 各行の間は \n で結合します。
   * - 末尾に余分な改行文字は追加しません（つまり `lines.join("\\n")` と同じ挙動です）。
   *
   * @param {string[]} lines 行の配列
   * @returns {string} 結合後の文字列
   */
  function joinLines(lines) {
    return lines.join("\n");
  }

  /**
   * 行が「空行」であるかどうかを判定します。
   *
   * - 半角スペース、タブ、復帰、改ページ、垂直タブ、および全角スペースのみで構成される行を
   *   空行とみなします。
   * - 何も文字が含まれない完全な空文字列も空行として判定されます。
   *
   * @param {string} line 判定対象の 1 行分の文字列
   * @returns {boolean} 空行であれば true、それ以外は false
   */
  function isBlankLine(line) {
    return /^[ \t\r\f\v\u3000]*$/.test(line);
  }

  // ========================================================================
  // 8. 主張部分（特定範囲内の空白行削除）
  // ========================================================================

  /**
   * 指定したマーカーに挟まれた範囲から空白行のみを削除します。
   *
   * - 開始マーカーと終了マーカーに挟まれたテキストを対象とし、
   *   その内部の「空白行」（空文字または空白類のみの行）を削除します。
   * - マーカーは文字列または文字列配列で指定できます。
   *   配列を渡した場合は、すべての組み合わせ（start × end）の範囲に対して処理します。
   * - 対象範囲外のテキストは変更しません。
   * - ネストしたマーカー構造や複雑な重なりには対応しない簡易実装です。
   *
   * @param {string} str 入力文字列
   * @param {string|string[]} startMarker 範囲の開始を表すマーカー
   * @param {string|string[]} endMarker   範囲の終了を表すマーカー
   * @returns {string} 空白行のみが削除された文字列
   */
  function stripBetween_L(str, startMarker, endMarker) {
    if (str == null || str === "") return "";
    const s = String(str);
    const starts = Array.isArray(startMarker) ? startMarker : [startMarker];
    const ends = Array.isArray(endMarker) ? endMarker : [endMarker];
    const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let result = s;
    for (const start of starts) {
      for (const end of ends) {
        const pattern = new RegExp(`(${escapeRegExp(start)})([\\s\\S]*?)(${escapeRegExp(end)})`, "g");
        result = result.replace(pattern, (_all, pre, inner, post) => {
          const innerLines = splitLines(inner);
          const outLines = innerLines.filter((line) => !isBlankLine(line));
          return pre + "\n" + joinLines(outLines) + post;
        });
      }
    }
    return result;
  }

  function stripBetween_LR(str, startMarker, endMarker) {
    if (str == null || str === "") return "";
    const s = String(str);
    const starts = Array.isArray(startMarker) ? startMarker : [startMarker];
    const ends = Array.isArray(endMarker) ? endMarker : [endMarker];
    const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let result = s;
    for (const start of starts) {
      for (const end of ends) {
        const pattern = new RegExp(`(${escapeRegExp(start)})([\\s\\S]*?)(${escapeRegExp(end)})`, "g");
        result = result.replace(pattern, (_all, pre, inner, post) => {
          const innerLines = splitLines(inner);
          const outLines = innerLines.filter((line) => !isBlankLine(line));
          return pre + "\n" + joinLines(outLines) + "\n" + post;
        });
      }
    }
    return result;
  }

  function stripBetween_R(str, startMarker, endMarker) {
    if (str == null || str === "") return "";
    const s = String(str);
    const starts = Array.isArray(startMarker) ? startMarker : [startMarker];
    const ends = Array.isArray(endMarker) ? endMarker : [endMarker];
    const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let result = s;
    for (const start of starts) {
      for (const end of ends) {
        const pattern = new RegExp(`(${escapeRegExp(start)})([\\s\\S]*?)(${escapeRegExp(end)})`, "g");
        result = result.replace(pattern, (_all, pre, inner, post) => {
          const innerLines = splitLines(inner);
          const outLines = innerLines.filter((line) => !isBlankLine(line));
          return pre + joinLines(outLines) + "\n" + post;
        });
      }
    }
    return result;
  }

  function stripBetween_Keep(str, startMarker, endMarker) {
    if (str == null || str === "") return "";
    const s = String(str);
    const starts = Array.isArray(startMarker) ? startMarker : [startMarker];
    const ends = Array.isArray(endMarker) ? endMarker : [endMarker];
    const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let result = s;
    for (const start of starts) {
      for (const end of ends) {
        const pattern = new RegExp(`(${escapeRegExp(start)})([\\s\\S]*?)(${escapeRegExp(end)})`, "g");
        result = result.replace(pattern, (_all, pre, inner, post) => {
          const innerLines = splitLines(inner);
          const outLines = innerLines.filter((line) => !isBlankLine(line));
          return pre + joinLines(outLines) + post;
        });
      }
    }
    return result;
  }


  /**
   * 「<補正をする際の注意>」から
   * 「(上記「●●●●」に置き換えて、「PA5J」と入力ください。)」までの
   * 範囲に含まれる空白行を削除します。
   *
   * @param {string} str 入力文字列
   * @returns {string} 該当範囲の空白行が削除された文字列
   */
  function stripBlankLinesInCorrectionNote(str) {
    if (str == null || str === "") return "";
    const s = String(str);

    const startMarker = "<補正をする際の注意>";
    const endMarker =
      "(上記「●●●●」に置き換えて、「PA5J」と入力ください。)";

    return stripBetween_L(s, startMarker, endMarker);
  }

  /**
   * 「<先行技術文献調査結果の記録>」から
   * 「この先行技術文献調査結果の記録は、拒絶理由を構成するものではありません。」までの
   * 範囲に含まれる空白行を削除します。
   *
   * @param {string} str 入力文字列
   * @returns {string} 該当範囲の空白行が削除された文字列
   */
  function stripBlankLinesInSearchResult(str) {
    if (str == null || str === "") return "";
    const s = String(str);

    const startMarker = "<先行技術文献調査結果の記録>";
    const endMarker =
      "　この先行技術文献調査結果の記録は、拒絶理由を構成するものではありません。";

    return stripBetween_LR(s, startMarker, endMarker);
  }

  /**
   * 「引用文献１(特に段落...)」から
   * 「…ことが記載されている。」または「…が記載されている。」までの
   * 範囲に含まれる空白行を削除します。
   *
   * - 終了マーカーは 2 種類の候補文字列を用意しており、
   *   いずれかにマッチした範囲が処理対象になります。
   *
   * @param {string} str 入力文字列
   * @returns {string} 該当範囲の空白行が削除された文字列
   */
  function stripBlankLinesInCitation(str) {
    if (str == null || str === "") return "";
    const s = String(str);

    const startMarkers = ["引用文献１(特に", "引用文献２(特に"]; // 必要に応じて他のパターンを追加
    const endMarkers = ["　ことが記載されている。", "　が記載されている。"];

    // 間の空白は、半角/全角スペース・タブ・改行などを許容
    // 「こと」+ 可変空白 + 「が記載されている。」を "A" に置換
    const pattern = /こと[\s\u3000]*が記載されている。/g;

    return stripBetween_R(s, startMarkers, endMarkers).replace(pattern, "ことが記載されている。");
  }

  /**
   * 「<付記>」から
   * 「この付記は、拒絶理由を構成するものではありません。」までの
   * 範囲に含まれる空白行を削除します。
   *
   * @param {string} str 入力文字列
   * @returns {string} 該当範囲の空白行が削除された文字列
   */
  function stripBlankLinesInAppendix(str) {
    if (str == null || str === "") return "";
    const s = String(str);

    const startMarker = "<付記>";
    const endMarker =
      "　この付記は、拒絶理由を構成するものではありません。";

    return stripBetween_LR(s, startMarker, endMarker);
  }

  /**
   * 「<優先権の主張の効果について>」から
   * 「優先権の主張の効果が認められない。」までの
   * 範囲に含まれる空白行を削除します。
   *
   * @param {string} str 入力文字列
   * @returns {string} 該当範囲の空白行が削除された文字列
   */
  function stripBlankLinesInPriority(str) {
    if (str == null || str === "") return "";
    const s = String(str);

    const startMarker = "<優先権の主張の効果について>";
    const endMarker = "優先権の主張の効果が認められない。";

    return stripBetween_L(s, startMarker, endMarker);
  }

  /**
   * 「<補正の示唆>」から
   * 「なお、上記の補正の示唆は、法律的効果を生じさせるものではなく、拒絶理由を解消するための一案である。明細書等についてどのように補正をするかは、出願人が決定すべきものである。」
   * までの範囲に含まれる空白行を削除します。
   *
   * @param {string} str 入力文字列
   * @returns {string} 該当範囲の空白行が削除された文字列
   */
  function stripBlankLinesInAmendmentSuggestion(str) {
    if (str == null || str === "") return "";
    const s = String(str);

    const startMarker = "<補正の示唆>";
    const endMarkers = [
      "　なお、上記の補正の示唆は、法律的効果を生じさせるものではなく、拒絶理由を解消するための一案である。明細書等についてどのように補正をするかは、出願人が決定すべきものである。"
    ];

    return stripBetween_LR(s, startMarker, endMarkers);
  }

  // ========================================================================
  // グローバル公開
  // ========================================================================

  /**
   * 空白行削除関連の関数群をまとめた公開オブジェクトです。
   *
   * - 各関数は基本的に (str: string) => string の形で実装されており、
   *   テキスト整形用のフィルタとしてそのまま利用できます。
   * - `applyAll` は、このモジュールで定義している個別ルールを
   *   順番にすべて適用するユーティリティです。
   */
  root.stripBlankLines = {
    // 用途別のヘルパ
    stripBlankLinesInCorrectionNote: stripBlankLinesInCorrectionNote,
    stripBlankLinesInSearchResult: stripBlankLinesInSearchResult,
    stripBlankLinesInCitation: stripBlankLinesInCitation,
    stripBlankLinesInAppendix: stripBlankLinesInAppendix,
    stripBlankLinesInPriority: stripBlankLinesInPriority,
    stripBlankLinesInAmendmentSuggestion: stripBlankLinesInAmendmentSuggestion
  };
})(globalThis);