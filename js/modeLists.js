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
 * ▼ App との連携
 *   - ブラウザ環境:
 *       1. index.html で app.js より先に modeLists.js を読み込む。
 *          <script src="js/modeLists.js"></script>
 *          <script src="js/app.js"></script>
 *       2. modeLists.js は global（window）に ModeFunctionLists を公開します。
 *       3. app.js 内の App.init() が起動時に ModeFunctionLists を自動登録します。
 *
 *   - テストや Node.js 環境:
 *       - CommonJS の module.exports として ModeFunctionLists を export しています。
 *       - 各関数の単体テストがしやすいように、関数はできる限り純粋関数として実装してください。
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
     * - 現状は何もしない（半角化のみ）。実際の処理に合わせて書き換えてください。
     */
    officeAction: [
      /**
       * 例: Office Action 共通の前処理
       * @param {string} text 半角正規化済みテキスト
       * @returns {string}
       */
      (text) => {
        // TODO: Office Action 固有の整形処理をここに追加
        return text;
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
      (text) => {
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
      (text) => {
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
      (text) => {
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
      (text) => {
        // TODO: PCT 固有の整形処理をここに追加
        return text;
      }
    ]
  };

  // ブラウザ環境: グローバルに公開
  if (typeof root !== "undefined") {
    root.ModeFunctionLists = ModeFunctionLists;
  }

  // CommonJS / Node.js 環境: モジュールとしてエクスポート
  if (typeof module !== "undefined" && module.exports) {
    module.exports = ModeFunctionLists;
  }
})(typeof window !== "undefined" ? window : globalThis);
