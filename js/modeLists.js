/**
 * modeLists.js
 * --------------------------------------------------------------------------
 * README（モード別変換関数リストの追加・編集方法）
 *
 * ▼ 役割
 *   - 各モードに対する「変換関数のリスト（パイプライン）」を定義するファイルです。
 *   - 1 つのモードに対して、複数の関数を順番に適用する構成を想定しています。
 *
 * ▼ 関数リストの基本形
 *   - 各モードは「文字列を受け取り、文字列または Promise<string> を返す関数」の配列です。
 *   - 例:
 *     const officeActionList = [
 *       (text) => step1(text),
 *       (text) => step2(text),
 *       async (text) => await step3Async(text),
 *     ];
 *
 * ▼ 複数引数を使いたい場合
 *   - コア側の契約は「(text: string) => string | Promise<string>」です。
 *   - 追加パラメータを使いたい場合は、クロージャで包み込んでください。
 *
 *   例:
 *     function toUpperWithPrefix(text, prefix) {
 *       return prefix + text.toUpperCase();
 *     }
 *
 *     const officeActionList = [
 *       (text) => toUpperWithPrefix(text, "[OA] "),
 *       (text) => anotherStep(text, 42, true),
 *     ];
 *
 * ▼ App との連携（ローカル HTML 前提）
 *   1. index.html で app.js より先に modeLists.js を読み込む。
 *        <script src="js/modeLists.js"></script>
 *        <script src="js/app.js"></script>
 *   2. modeLists.js はグローバル（root）に ModeFunctionLists を公開する。
 *   3. app.js 内の App.init() が起動時に ModeFunctionLists を自動登録する。
 *
 * ▼ 注意
 *   - 本ファイルはローカルでブラウザから直接開いて使うことを前提とし、
 *     モジュールシステム（CommonJS / ES Modules）は考慮していない。
 * --------------------------------------------------------------------------
 */

(function (root) {
  "use strict";

  /**
   * モード別変換関数リスト
   * - キー: モードキー（HTML ラジオボタンの value と一致させる）
   * - 値:  (text: string) => string | Promise<string> の配列
   */
  const ModeFunctionLists = {
    /**
     * Office Action 用変換パイプライン
     */
    _officeAction: [
      /**
       * Office 系文書共通の前処理
       * - TextFilterRegistry に登録された複数パイプラインを順に実行する。
       * - runTextChains を経由することで、後からパイプライン名を追加・変更しやすくする。
       * - 実際の戻り値は Promise<string> だが、呼び出し側が非同期対応している前提で
       *   JSDoc 上は string として記述している。
       *
       * @param {string} text 半角正規化済みテキスト
       * @returns {string} 実際の戻り値は Promise<string>
       */
      function (text) {
        // runTextChains が定義されていなければ何もせず text を返す
        if (typeof root.runTextChains !== "function") {
          return text;
        }

        // -------------------------------------------------------------
        // このモードで実行したいパイプライン名の一覧
        //   - 将来 "exp1", "exp2", "exp3" ... を足したい場合は
        //     下記配列に名前を追加するだけでよい。
        // -------------------------------------------------------------
        // 例: var names = ["init", "exp1", "exp2"];
        var names = ["init", "main", "stripBlankLines", "convertEnd"];
        // var names = ["init", "main", "stripBlankLines"];
        // var names = ["init", "main"];
        // var names = ["init"];

        // -------------------------------------------------------------
        // 複数パイプラインを順に実行
        //   - stopOnError: true により、途中でエラーが発生したら即中断。
        //   - catch 内で元の text を返すことで、UI が壊れないようにする。
        // -------------------------------------------------------------
        return root
          .runTextChains(names, text, /* invokeArgs */ undefined, {
            stopOnError: true
          })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error(
                "[officeAction] runTextChains 実行中にエラー:",
                err
              );
            }
            // エラー時は元の text を返して UI を壊さない
            return text;
          });
      }
    ],
    get officeAction() {
      return this._officeAction;
    },
    set officeAction(value) {
      this._officeAction = value;
    },

    /**
     * Final Office Action (Final Rejection) 用変換パイプライン
     */
    _finalOfficeAction: [
      /**
       * Office 系文書共通の前処理
       * - TextFilterRegistry に登録された複数パイプラインを順に実行する。
       * - runTextChains を経由することで、後からパイプライン名を追加・変更しやすくする。
       * - 実際の戻り値は Promise<string> だが、呼び出し側が非同期対応している前提で
       *   JSDoc 上は string として記述している。
       *
       * @param {string} text 半角正規化済みテキスト
       * @returns {string} 実際の戻り値は Promise<string>
       */
      function (text) {
        if (typeof root.runTextChains !== "function") {
          return text;
        }

        // var names = ["init", "main", "stripBlankLines", "convertEnd"];
        var names = ["init", "main", "stripBlankLines", "finalAction"];

        return root
          .runTextChains(names, text, /* invokeArgs */ undefined, {
            stopOnError: true
          })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error(
                "[finalOfficeAction] runTextChains 実行中にエラー:",
                err
              );
            }
            return text;
          });
      }
    ],
    get finalOfficeAction() {
      return this._finalOfficeAction;
    },
    set finalOfficeAction(value) {
      this._finalOfficeAction = value;
    },

    /**
     * Amendment Refused / Amendment Not Entered 用変換パイプライン
     */
    _amendmentRefused: [
      /**
       * Office 系文書共通の前処理
       * - TextFilterRegistry に登録された複数パイプラインを順に実行する。
       * - runTextChains を経由することで、後からパイプライン名を追加・変更しやすくする。
       * - 実際の戻り値は Promise<string> だが、呼び出し側が非同期対応している前提で
       *   JSDoc 上は string として記述している。
       *
       * @param {string} text 半角正規化済みテキスト
       * @returns {string} 実際の戻り値は Promise<string>
       */
      function (text) {
        if (typeof root.runTextChains !== "function") {
          return text;
        }

        var names = ["init", "main", "stripBlankLines", "convertEnd"];

        return root
          .runTextChains(names, text, /* invokeArgs */ undefined, {
            stopOnError: true
          })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error(
                "[amendmentRefused] runTextChains 実行中にエラー:",
                err
              );
            }
            return text;
          });
      }
    ],
    get amendmentRefused() {
      return this._amendmentRefused;
    },
    set amendmentRefused(value) {
      this._amendmentRefused = value;
    },

    /**
     * Pre-examination Report / Report to Director 用変換パイプライン
     */
    _preExaminationReport: [
      /**
       * Office 系文書共通の前処理
       * - TextFilterRegistry に登録された複数パイプラインを順に実行する。
       * - runTextChains を経由することで、後からパイプライン名を追加・変更しやすくする。
       * - 実際の戻り値は Promise<string> だが、呼び出し側が非同期対応している前提で
       *   JSDoc 上は string として記述している。
       *
       * @param {string} text 半角正規化済みテキスト
       * @returns {string} 実際の戻り値は Promise<string>
       */
      function (text) {
        if (typeof root.runTextChains !== "function") {
          return text;
        }

        var names = ["init", "main", "stripBlankLines", "convertEnd"];

        return root
          .runTextChains(names, text, /* invokeArgs */ undefined, {
            stopOnError: true
          })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error(
                "[preExaminationReport] runTextChains 実行中にエラー:",
                err
              );
            }
            return text;
          });
      }
    ],
    get preExaminationReport() {
      return this._preExaminationReport;
    },
    set preExaminationReport(value) {
      this._preExaminationReport = value;
    },

    /**
     * PCT (Patent Cooperation Treaty / International application) 用変換パイプライン
     */
    _pct: [
      /**
       * Office 系文書共通の前処理
       * - TextFilterRegistry に登録された複数パイプラインを順に実行する。
       * - runTextChains を経由することで、後からパイプライン名を追加・変更しやすくする。
       * - 実際の戻り値は Promise<string> だが、呼び出し側が非同期対応している前提で
       *   JSDoc 上は string として記述している。
       *
       * @param {string} text 半角正規化済みテキスト
       * @returns {string} 実際の戻り値は Promise<string>
       */
      function (text) {
        if (typeof root.runTextChains !== "function") {
          return text;
        }

        var names = ["init", "main"];

        return root
          .runTextChains(names, text, /* invokeArgs */ undefined, {
            stopOnError: true
          })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[pct] runTextChains 実行中にエラー:", err);
            }
            return text;
          });
      }
    ],
    get pct() {
      return this._pct;
    },
    set pct(value) {
      this._pct = value;
    },
    /**
     * PCT (Patent Cooperation Treaty / International application) conversion pipeline (EN)
     * Use this when the source document is primarily in English.
     */
    _pct_eng: [
      /**
       * Shared pre-processing for Office documents (EN)
       * - Runs multiple pipelines registered in TextFilterRegistry in order.
       * - Going through runTextChains makes it easy to add/rename pipelines later.
       * - The actual return type is Promise<string>. We annotate it as string here because
       *   callers are expected to be async-aware.
       *
       * @param {string} text Half-width normalized text
       * @returns {string} The actual return value is Promise<string>
       */
      function (text) {
        if (typeof root.runTextChains !== "function") {
          return text;
        }

        var names = ["init", "main_PCTENG"];

        return root
          .runTextChains(names, text, /* invokeArgs */ undefined, {
            stopOnError: true
          })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[pct_eng] Error while running runTextChains:", err);
            }
            return text;
          });
      }
    ],
    get pct_eng() {
      return this._pct_eng;
    },
    set pct_eng(value) {
      this._pct_eng = value;
    },
  };

  // ------------------------------------------------------------------------
  // グローバル公開（ローカル HTML 前提）
  // ------------------------------------------------------------------------

  /**
   * - 本ファイルは root（globalThis）に ModeFunctionLists をぶら下げるだけ。
   * - ほかのスクリプトからは:
   *     ModeFunctionLists.officeAction
   *   のようにアクセスして利用する。
   */
  root.ModeFunctionLists = ModeFunctionLists;

})(globalThis);
