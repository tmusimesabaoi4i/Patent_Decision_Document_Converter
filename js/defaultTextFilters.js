/**
 * defaultTextFilters.js
 * --------------------------------------------------------------------------
 * nl → hw → lead → clean → rmBlank → squeeze → trim → gap の順で実行する
 * フィルタパイプラインを FilterRegistry に登録し、グローバルから利用できるように
 * するための設定用スクリプト。
 *
 * ▼ 前提
 *   - filterRegistry/filterRegistry.js が先に読み込まれており、
 *     window.FilterRegistry が利用可能であること。
 *   - TextTransformer/TextTransformer.js が読み込まれており、
 *     TextUtils または TextTransformer のいずれかに
 *       nl, hw, lead, clean, rmBlank, squeeze, trim, gap
 *     が定義されていること。
 *
 * ▼ 公開されるもの
 *   - window.TextFilterRegistry
 *       "init" という名前のフィルタリストを 1 つ登録済みの FilterRegistry インスタンス。
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
   * TextTransformer 側のユーティリティオブジェクトを取得
   * - TextUtils（前回提案の textUtils.js パターン）
   * - TextTransformer（ファイル名に合わせたグローバル名）
   * のどちらかが存在する前提で、最初に見つかったものを採用する。
   */
  var TextLib = root.TextUtils || null;

  if (!TextLib) {
    // eslint-disable-next-line no-console
    console.warn("TextUtils が見つかりません。TextUtils.js の中でグローバル名を確認してください。");
    return;
  }

  // 必要なフィルタ関数を取り出す
  var nl = TextLib.nl;
  var hw = TextLib.hw;
  var lead = TextLib.lead;
  var clean = TextLib.clean;
  var rmBlank = TextLib.rmBlank;
  var squeeze = TextLib.squeeze;
  var trim = TextLib.trim;
  var gap = TextLib.gap;

  // どれか 1 つでも欠けている場合は警告を出して終了
  if (
    typeof nl !== "function" ||
    typeof hw !== "function" ||
    typeof lead !== "function" ||
    typeof clean !== "function" ||
    typeof rmBlank !== "function" ||
    typeof squeeze !== "function" ||
    typeof trim !== "function" ||
    typeof gap !== "function"
  ) {
    // eslint-disable-next-line no-console
    console.warn("nl, hw, lead, clean, rmBlank, squeeze, trim, gap のいずれかが定義されていません。TextTransformer.js を確認してください。");
    return;
  }

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
   *   3. lead    : 先頭に改行を 1 つだけ付与
   *   4. clean   : 制御文字・特殊文字の除去／空白置換
   *   5. rmBlank : 空行（空白のみ行を含む）の削除
   *   6. squeeze : 連続する半角スペースの圧縮
   *   7. trim    : 全体の前後空白の削除
   *   8. gap     : 行間の空行を「ちょうど 1 行」に正規化
   */
  textFilterRegistry.register("init", [
    nl,
    hw,
    lead,
    clean,
    rmBlank,
    squeeze,
    trim,
    gap
  ]);

  // -------------------------------------------------------------------------
  // グローバル公開
  // -------------------------------------------------------------------------

  /**
   * window.TextFilterRegistry という名前で公開する。
   * - 他のスクリプトから:
   *     TextFilterRegistry.apply("init", text).then(...);
   *   のように利用できる。
   */
  root.TextFilterRegistry = textFilterRegistry;

  /**
   * 簡易ヘルパ:
   * - よく使う "init" パイプラインだけを直接呼びたい場合に利用する。
   *   runInitFilters("text").then((out) => { ... });
   *
   * @param {string} str 入力文字列
   * @param {any[]} [invokeArgs] 追加引数（通常は不要）
   * @returns {Promise<string>} 変換後の文字列
   */
  root.runInitFilters = function (str, invokeArgs) {
    return textFilterRegistry.apply("init", str, invokeArgs);
  };
})(typeof window !== "undefined" ? window : this);
