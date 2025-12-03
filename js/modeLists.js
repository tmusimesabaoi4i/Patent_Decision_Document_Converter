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
     * Office Action (non-final Office Action) 用変換パイプライン
     * - 現状は TextFilterRegistry 経由で "init" などのパイプラインを呼び出す例。
     *   実際の処理に合わせて、names の中身や後続ステップを自由に変更してください。
     */
    officeAction: [
      /**
       * Office Action 共通の前処理
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
        var names = ["init"];

        // -------------------------------------------------------------
        // 複数パイプラインを順に実行
        //   - stopOnError: true により、途中でエラーが発生したら即中断。
        //   - catch 内で元の text を返すことで、UI が壊れないようにする。
        // -------------------------------------------------------------
        return root
          .runTextChains(names, text, /* invokeArgs */ undefined, { stopOnError: true })
          .catch(function (err) {
            if (typeof console !== "undefined" && console.error) {
              console.error("[officeAction] runTextChains 実行中にエラー:", err);
            }
            // エラー時は元の text を返して UI を壊さない
            return text;
          });
      }
    ],

    /**
     * Final Office Action (Final Rejection) 用変換パイプライン
     */
    finalOfficeAction: [
      /**
       * @param {string} text 半角正規化済みテキスト
       * @returns {string}
       */
      function (text) {
        // TODO: Final Office Action 固有の整形処理をここに追加
        return text;
      }
    ],

    /**
     * Amendment Refused / Amendment Not Entered 用変換パイプライン
     */
    amendmentRefused: [
      /**
       * @param {string} text 半角正規化済みテキスト
       * @returns {string}
       */
      function (text) {
        // TODO: Amendment Refused 固有の整形処理をここに追加
        return text;
      }
    ],

    /**
     * Pre-examination Report / Report to Director 用変換パイプライン
     */
    preExaminationReport: [
      /**
       * @param {string} text 半角正規化済みテキスト
       * @returns {string}
       */
      function (text) {
        // TODO: Pre-examination Report 固有の整形処理をここに追加
        return text;
      }
    ],

    /**
     * PCT (Patent Cooperation Treaty / International application) 用変換パイプライン
     */
    pct: [
      /**
       * @param {string} text 半角正規化済みテキスト
       * @returns {string}
       */
      function (text) {
        // TODO: PCT 固有の整形処理をここに追加
        return text;
      }
    ]
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
