/**
 * defaultTextFilters.js
 * --------------------------------------------------------------------------
 * nl → hw → lead → clean → rmBlank → squeeze → trim → gap の順で実行する
 * フィルタパイプラインを FilterRegistry に登録し、グローバルから利用できるように
 * するための設定用スクリプト。
 *
 * ▼ 前提
 *   - filterRegistry/filterRegistry.js が先に読み込まれており、
 *     root.FilterRegistry が利用可能であること。
 *   - textUtils.js が読み込まれており、
 *     root.TextUtils に
 *       nl, hw, lead, clean, rmBlank, squeeze, trim, gap
 *     が定義されていること。
 *
 * ▼ 公開されるもの
 *   - root.TextFilterRegistry
 *       "init" という名前のフィルタリストを 1 つ登録済みの FilterRegistry インスタンス。
 *   - root.runTextChains(names, str, ...)
 *       複数のフィルタリストを順番に実行する汎用ヘルパ。
 *   - root.runInitFilters(str, ...)
 *       "init" パイプライン専用の簡易ヘルパ。
 *
 * ▼ 使い方（例）
 *   const input = "  ほげ\r\nふが  ";
 *   TextFilterRegistry.apply("init", input).then((out) => {
 *     console.log(out);
 *   });
 */

(function (root) {
  "use strict";

  // -------------------------------------------------------------------------
  // 依存オブジェクトの取得
  // -------------------------------------------------------------------------

  /** @type {typeof root.FilterRegistry} */
  var FilterRegistry = root.FilterRegistry;

  if (typeof FilterRegistry !== "function") {
    // FilterRegistry が見つからない場合は何もせず警告だけ出す
    // eslint-disable-next-line no-console
    console.warn("FilterRegistry が見つかりません。filterRegistry.js の読み込み順を確認してください。");
    return;
  }

  /**
   * TextUtils 側のユーティリティオブジェクトを取得
   * - textUtils.js で root.TextUtils にエクスポートされている前提。
   */
  var TextLib_Init = root.textUtilsInit || null;

  if (!TextLib_Init) {
    // eslint-disable-next-line no-console
    console.warn("TextUtils が見つかりません。textUtils.js の中でグローバル名を確認してください。");
    return;
  }

  // 必要なフィルタ関数を取り出す
  var nl = TextLib_Init.nl;
  var hw = TextLib_Init.hw;
  var lead = TextLib_Init.lead;
  var clean = TextLib_Init.clean;
  var rmBlank = TextLib_Init.rmBlank;
  var squeeze = TextLib_Init.squeeze;
  var trim = TextLib_Init.trim;
  var gap = TextLib_Init.gap;

  // どれか 1 つでも欠けている場合は警告を出して終了
  if (
    typeof nl !== "function" ||
    typeof hw !== "function" ||
    typeof clean !== "function" ||
    typeof rmBlank !== "function" ||
    typeof squeeze !== "function" ||
    typeof trim !== "function" ||
    typeof gap !== "function" ||
    typeof lead !== "function"
  ) {
    // eslint-disable-next-line no-console
    console.warn("nl, hw, lead, clean, rmBlank, squeeze, trim, gap のいずれかが定義されていません。textUtils.js を確認してください。");
    return;
  }

  /**
   * textUtilsMain 側のユーティリティオブジェクトを取得
   * - textUtilsMain.js で root.textUtilsMain にエクスポートされている前提。
   */
  var TextLib_Main = root.textUtilsMain || null;

  if (!TextLib_Main) {
    // eslint-disable-next-line no-console
    console.warn("textUtilsMain が見つかりません。textUtilsMain.js の中でグローバル名を確認してください。");
    return;
  }

  // 必要なフィルタ関数を取り出す
  var padHead = TextLib_Main.padHead;
  var trimHead = TextLib_Main.trimHead;
  var fwHead = TextLib_Main.fwHead;
  var alphaCase = TextLib_Main.alphaCase;
  var fwNumLaw = TextLib_Main.fwNumLaw;
  var fwRefLaw = TextLib_Main.fwRefLaw;
  var tightLines = TextLib_Main.tightLines;
  var tightClaims = TextLib_Main.tightClaims;
  var tightNote = TextLib_Main.tightNote;
  var tightBelowBullet = TextLib_Main.tightBelowBullet;

  // どれか 1 つでも欠けている場合は警告を出して終了
  if (
    typeof padHead !== "function" ||
    typeof trimHead !== "function" ||
    typeof fwHead !== "function" ||
    typeof alphaCase !== "function" ||
    typeof fwNumLaw !== "function" ||
    typeof fwRefLaw !== "function" ||
    typeof tightLines !== "function" ||
    typeof tightClaims !== "function" ||
    typeof tightNote !== "function" ||
    typeof tightBelowBullet !== "function"
  ) {
    // eslint-disable-next-line no-console
    console.warn("padHead, trimHead, fwHead, alphaCase, fwNumLaw, fwRefLaw, tightLines, tightClaims, tightNote, tightBelowBullet のいずれかが定義されていません。textUtilsMain.js を確認してください。");
    return;
  }

  /**
   * stripBlankLines 側のユーティリティオブジェクトを取得
   * - stripBlankLines.js で root.stripBlankLines にエクスポートされている前提。
   */
  var TextLib_BlankLines = root.stripBlankLines || null;

  if (!TextLib_BlankLines) {
    // eslint-disable-next-line no-console
    console.warn("stripBlankLines が見つかりません。stripBlankLines.js の中でグローバル名を確認してください。");
    return;
  }

  // 必要なフィルタ関数を取り出す
  var stripBlankLinesInCorrectionNote = TextLib_BlankLines.stripBlankLinesInCorrectionNote;
  var stripBlankLinesInSearchResult = TextLib_BlankLines.stripBlankLinesInSearchResult;
  var stripBlankLinesInCitation = TextLib_BlankLines.stripBlankLinesInCitation;
  var stripBlankLinesInAppendix = TextLib_BlankLines.stripBlankLinesInAppendix;
  var stripBlankLinesInPriority = TextLib_BlankLines.stripBlankLinesInPriority;
  var stripBlankLinesInAmendmentSuggestion = TextLib_BlankLines.stripBlankLinesInAmendmentSuggestion;

  // どれか 1 つでも欠けている場合は警告を出して終了
  if (
    typeof stripBlankLinesInCorrectionNote !== "function" ||
    typeof stripBlankLinesInSearchResult !== "function" ||
    typeof stripBlankLinesInCitation !== "function" ||
    typeof stripBlankLinesInAppendix !== "function" ||
    typeof stripBlankLinesInPriority !== "function" ||
    typeof stripBlankLinesInAmendmentSuggestion !== "function"
  ) {
    // eslint-disable-next-line no-console
    console.warn("stripBlankLinesInCorrectionNote, stripBlankLinesInSearchResult, stripBlankLinesInCitation, stripBlankLinesInAppendix, stripBlankLinesInPriority, stripBlankLinesInAmendmentSuggestion のいずれかが定義されていません。stripBlankLines.js を確認してください。");
    return;
  }

  /**
   * textUtilsConvertForDoc 側のユーティリティオブジェクトを取得
   * - textUtilsConvertForDoc.js で root.textUtilsConvertForDoc にエクスポートされている前提。
   */
  var TextLib_ConvertForDoc = root.textUtilsConvertForDoc || null;

  if (!TextLib_ConvertForDoc) {
    // eslint-disable-next-line no-console
    console.warn("textUtilsConvertForDoc が見つかりません。stripBlankLines.js の中でグローバル名を確認してください。");
    return;
  }

  /**
   * textUtilsConvertForCau 側のユーティリティオブジェクトを取得
   * - textUtilsConvertForCau.js で root.textUtilsConvertForCau にエクスポートされている前提。
   */
  var TextLib_ConvertForCau = root.textUtilsConvertForCau || null;

  if (!TextLib_ConvertForCau) {
    // eslint-disable-next-line no-console
    console.warn("textUtilsConvertForCau が見つかりません。stripBlankLines.js の中でグローバル名を確認してください。");
    return;
  }

  // 必要なフィルタ関数を取り出す
  var convertForDoc = TextLib_ConvertForDoc.convertForDoc;
  var convertForFamily = TextLib_ConvertForDoc.convertForFamily;
  // 必要なフィルタ関数を取り出す
  var convertForCau = TextLib_ConvertForCau.convertForCau;
  var convertForOther = TextLib_ConvertForCau.convertForOther;
  var applyFlexibleMap = TextLib_ConvertForCau.applyFlexibleMap;

  // -------------------------------------------------------------------------
  // FilterRegistry インスタンスの生成
  // -------------------------------------------------------------------------

  /**
   * Text 用の FilterRegistry インスタンス
   * - hooks と defaults は最低限の設定のみを行い、
   *   必要に応じて後から差し替えや上書きができるようにしておく。
   */
  var textFilterRegistry = new FilterRegistry({
    hooks: {
      /**
       * apply 実行前フック
       * @param {string} name リスト名
       * @param {string} input 入力文字列
       */
      beforeApply: function (name, input) {
        // 必要であればここにログなどの共通処理を追加する
        // 例: console.log("[beforeApply]", name, input.length);
      },

      /**
       * apply 実行後フック
       * @param {string} name リスト名
       * @param {string} output 出力文字列
       */
      afterApply: function (name, output) {
        // 必要であればここにログなどの共通処理を追加する
        // 例: console.log("[afterApply]", name, output.length);
      },

      /**
       * エラーフック
       * @param {string} name リスト名
       * @param {any} error 発生したエラー
       * @param {"hook"|"step"} stage エラーが発生した段階
       * @param {number} [stepIndex] ステップ実行中の場合のインデックス
       */
      onError: function (name, error, stage, stepIndex) {
        // 本例では単純にコンソールへ出力するのみ。
        // 実運用では、ここで監視連携やユーザー向けログ出力などを実装できる。
        // eslint-disable-next-line no-console
        console.error("[TextFilterRegistry onError]", {
          name: name,
          stage: stage,
          stepIndex: stepIndex,
          error: error
        });
      }
    },

    defaults: {
      // デフォルトでは、エラー発生時にパイプラインを中断する
      stopOnError: true,
      // 並列実行は現状対応しない（将来拡張用）
      parallel: false
    }
  });

  // -------------------------------------------------------------------------
  // "init" パイプラインの登録
  // nl → hw → lead → clean → rmBlank → squeeze → trim → gap
  // -------------------------------------------------------------------------

  /**
   * "init" という名前で、特許文書向けの前処理パイプラインを登録する。
   * 実行順:
   *   1. nl      : 改行コードの正規化（CRLF/CR を LF に統一）
   *   2. hw      : 全角→半角への正規化 (NFKC + 補正)
   *   3. clean   : 制御文字・特殊文字の除去／空白置換
   *   4. rmBlank : 空行（空白のみ行を含む）の削除
   *   5. squeeze : 連続する半角スペースの圧縮
   *   6. trim    : 全体の前後空白の削除
   *   7. gap     : 行間の空行を「ちょうど 1 行」に正規化
   *   8. lead    : 先頭に改行を 1 つだけ付与
   */
  textFilterRegistry.register("init", [
    nl,
    hw,
    clean,
    rmBlank,
    squeeze,
    trim,
    gap,
    lead
  ]);

  textFilterRegistry.register("main", [
    padHead,
    trimHead,
    tightBelowBullet, // 下の改行を詰める(箇条書き系は全角になると反応しないので、)
    fwHead,
    fwNumLaw,
    fwRefLaw,
    alphaCase, // 表とか図の英字を大文字にしない
    // tightLines,
    tightClaims,
    tightNote
  ]);

  textFilterRegistry.register("stripBlankLines", [
    stripBlankLinesInCorrectionNote,
    stripBlankLinesInSearchResult,
    stripBlankLinesInCitation,
    stripBlankLinesInAppendix,
    stripBlankLinesInPriority,
    stripBlankLinesInAmendmentSuggestion
  ]);

  textFilterRegistry.register("convertEnd", [
    convertForDoc,
    convertForFamily,
    convertForCau,
    convertForOther,
    applyFlexibleMap,
  ]);

  // -------------------------------------------------------------------------
  // グローバル公開
  // -------------------------------------------------------------------------

  /**
   * root.TextFilterRegistry という名前で公開する。
   * - 他のスクリプトから:
   *     TextFilterRegistry.apply("init", text).then(...);
   *   のように利用できる。
   */
  root.TextFilterRegistry = textFilterRegistry;

  // -----------------------------------------------------------------------
  // 複数パイプライン名を順に適用する汎用ヘルパ
  // -----------------------------------------------------------------------

  /**
   * 複数のフィルタリストを順番に適用する汎用ヘルパ関数
   *
   * - names で指定したリスト名を先頭から順に実行する。
   * - 途中でエラーが発生した場合の挙動は options.stopOnError で制御する。
   *   - true  (デフォルト): その時点で中断し、エラーをそのまま投げる。
   *   - false: onError を呼んだあと続行し、current はエラー前の値を維持。
   *
   * @param {string[]} names 実行したいフィルタリスト名の配列（例: ["init","exp1","exp2"]）
   * @param {string} str 入力文字列
   * @param {any[]} [invokeArgs] 各ステップに共通で渡す追加引数
   * @param {{ stopOnError?: boolean }} [options] 実行時オプション
   * @returns {Promise<string>} 最終的な変換結果文字列
   */
  root.runTextChains = function (names, str, invokeArgs, options) {
    if (!root.TextFilterRegistry || typeof root.TextFilterRegistry.apply !== "function") {
      return Promise.resolve(str == null ? "" : String(str));
    }

    var reg = root.TextFilterRegistry;
    var listNames = Array.isArray(names) ? names.slice() : [];
    var opts = options || {};
    var stopOnError = opts.stopOnError !== false; // デフォルト true

    // 空配列なら何もせずそのまま返す
    if (listNames.length === 0) {
      return Promise.resolve(str == null ? "" : String(str));
    }

    var current = str == null ? "" : String(str);
    var chain = Promise.resolve(current);

    listNames.forEach(function (name) {
      chain = chain.then(function (prev) {
        current = prev == null ? "" : String(prev);
        return reg
          .apply(name, current, invokeArgs)
          .then(function (out) {
            return out == null ? "" : String(out);
          })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[runTextChains] フィルタリスト実行中にエラー:", {
                name: name,
                error: err
              });
            }
            if (stopOnError) {
              throw err;
            }
            // 続行する場合は current を維持して次へ
            return current;
          });
      });
    });

    return chain;
  };

  /**
   * "init" だけを実行したい場合のショートカット
   *
   * @param {string} str 入力文字列
   * @param {any[]} [invokeArgs] 追加引数（通常は不要）
   * @returns {Promise<string>} 変換後の文字列
   */
  root.runInitFilters = function (str, invokeArgs) {
    return textFilterRegistry.apply("init", str, invokeArgs);
  };
})(globalThis);