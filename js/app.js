/**
 * app.js - Patent Decision Document Converter
 * ---------------------------------------------------------------------------
 * README（アプリ本体とモード登録の拡張方法）
 *
 * ▼ 全体構成
 *   - toHalfWidth(text):
 *       入力文字列を半角に正規化する純粋関数。単体テストしやすいように外出し。
 *
 *   - ModeRegistry:
 *       モードキーと「変換ハンドラ（単体 or リスト）」の対応を管理するレジストリ。
 *       レジストリは (text) => string | Promise<string> または
 *       { process: (text) => string | Promise<string> } を受け付けます。
 *
 *   - ToastManager:
 *       成功 / 失敗などの短いステータスメッセージをトースト表示するクラス。
 *       コピー内容などの機微情報は一切表示しません。
 *
 *   - AppCore:
 *       DOM 操作・イベント制御・変換パイプライン実行を担当する本体クラス。
 *
 *   - app（グローバルに公開されるファクトリ関数）:
 *       const a = app(); a.run();
 *       という形で App インスタンスを生成して起動する。
 *       本ファイル末尾で
 *         root.app = root.app();
 *         root.app.run();
 *       を実行しているため、通常は読み込みだけで自動起動される。
 *
 * ▼ モード（変換処理）の追加・変更方法
 *   - 基本パターン:
 *       1. modeLists.js にモード用の関数リストを追加
 *       2. HTML のラジオボタンに同じ value を設定
 *       3. app.js 側は ModeFunctionLists を自動登録するため、core は変更不要
 *
 *   - コード側から追加したい場合:
 *       const a = app(); // もしくは既存 app インスタンスを利用
 *       a.registerModeList('myMode', [fn1, fn2, ...]);
 *       // または 単体ハンドラとして
 *       a.registerMode('myMode', (text) => text);
 *       a.registerMode('myMode', { process(text) { return text; } });
 *
 * ▼ ハンドラの契約
 *   - シグネチャ:
 *       (text: string) => string | Promise<string>
 *       または
 *       { process(text: string): string | Promise<string> }
 *   - AppCore 側で同期 / 非同期の両方に対応してシーケンシャルに実行します。
 *
 * ▼ 起動方法
 *   - 本ファイル末尾で
 *       root.app = root.app();
 *       root.app.run();
 *     を実行しているため、通常は <script src="js/app.js"></script>
 *     を読み込むだけで自動起動します。
 *   - 別のインスタンスを試したい場合などは、app ファクトリを直接呼び出して
 *     使ってください。
 * ---------------------------------------------------------------------------
 */

(function (root) {
  "use strict";

  // =========================================================
  // 共通ユーティリティ関数
  // =========================================================

  /**
   * 半角正規化（NFKC を優先し、非対応環境では簡易フォールバック）
   * @param {string} text 入力文字列
   * @returns {string} 半角正規化済み文字列
   */
  const toHalfWidth = (text) => {
    if (!text) return "";

    // 可能なら NFKC 正規化で一括変換（全角英数・記号などを含む）
    if (typeof text.normalize === "function") {
      try {
        return text.normalize("NFKC");
      } catch (_e) {
        // normalize 非対応あるいは内部エラーの場合、下のフォールバックへ
      }
    }

    // 簡易フォールバック: 全角 ASCII / 数字 + 全角スペースのみ変換
    const FW_START = 0xff01;
    const FW_END = 0xff5e;
    const FW_SPACE = 0x3000;
    const OFFSET = 0xfee0;

    let result = "";
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code === FW_SPACE) {
        result += " ";
      } else if (code >= FW_START && code <= FW_END) {
        result += String.fromCharCode(code - OFFSET);
      } else {
        result += ch;
      }
    }
    return result;
  };

  // =========================================================
  // モードレジストリ
  // =========================================================

  /**
   * ModeRegistry クラス
   * ------------------------------------------------------------------------
   * - モードキー（文字列）とハンドラ（単体または配列）を管理する責務を持つ。
   * - ハンドラは以下のいずれか:
   *     1) 関数: (text: string) => string | Promise<string>
   *     2) オブジェクト: { process(text: string): string | Promise<string> }
   * - レジストリは「あるモードのハンドラ生データ」を返すだけで、
   *   実際の呼び出し方法（async/await 等）は AppCore 側で統一的に扱う。
   */
  class ModeRegistry {
    constructor() {
      /** @type {Map<string, any>} */
      this._store = new Map();
    }

    /**
     * ハンドラの形式が契約を満たしているかチェックする
     * @param {any} handler チェック対象
     * @returns {boolean}
     * @private
     */
    _isValidHandler(handler) {
      if (typeof handler === "function") return true;
      if (handler && typeof handler === "object" && typeof handler.process === "function") {
        return true;
      }
      return false;
    }

    /**
     * モードを登録する（単体ハンドラまたは配列のどちらも受け付ける）
     * @param {string} key モードキー
     * @param {any} handlerOrList 関数 / オブジェクト / 配列
     */
    registerMode(key, handlerOrList) {
      if (!key || typeof key !== "string") {
        console.warn("[ModeRegistry] 無効なモードキーです:", key);
        return;
      }

      if (Array.isArray(handlerOrList)) {
        this.registerModeList(key, handlerOrList);
        return;
      }

      if (!this._isValidHandler(handlerOrList)) {
        console.warn("[ModeRegistry] 無効なハンドラが指定されました:", key, handlerOrList);
        return;
      }

      this._store.set(key, handlerOrList);
    }

    /**
     * モードを「複数ハンドラのリスト」として登録する
     * @param {string} key モードキー
     * @param {any[]} list ハンドラ配列
     */
    registerModeList(key, list) {
      if (!key || typeof key !== "string") {
        console.warn("[ModeRegistry] 無効なモードキーです:", key);
        return;
      }
      if (!Array.isArray(list)) {
        console.warn("[ModeRegistry] list は配列である必要があります:", key, list);
        return;
      }

      const filtered = list.filter((h) => this._isValidHandler(h));
      if (filtered.length === 0) {
        console.warn("[ModeRegistry] 有効なハンドラが 1 件もありません:", key, list);
        return;
      }

      this._store.set(key, filtered);
    }

    /**
     * モードキーに紐づく「生のハンドラ集合」を取得する
     * - 戻り値は配列で統一される（単体ハンドラは長さ 1 の配列に正規化）
     * @param {string} key モードキー
     * @returns {any[]} ハンドラ配列（未登録の場合は空配列）
     */
    getRawHandlers(key) {
      const value = this._store.get(key);
      if (!value) return [];
      if (Array.isArray(value)) return value.slice();
      return [value];
    }

    /**
     * 登録済みモードキー一覧を取得する
     * @returns {string[]}
     */
    listKeys() {
      return Array.from(this._store.keys());
    }
  }

  // =========================================================
  // トースト表示マネージャ
  // =========================================================

  /**
   * ToastManager クラス
   * ------------------------------------------------------------------------
   * - DOM 上のトースト要素を制御し、短いステータスメッセージを表示する。
   * - コピーした内容や詳細テキストは表示せず、「コピーしました」などの
   *   シンプルな文言のみを扱う。
   */
  class ToastManager {
    /**
     * @param {HTMLElement|null} rootEl トースト全体のルート要素
     * @param {HTMLElement|null} messageEl メッセージ表示要素
     */
    constructor(rootEl, messageEl) {
      /** @type {HTMLElement|null} */
      this._rootEl = rootEl;
      /** @type {HTMLElement|null} */
      this._messageEl = messageEl;
      /** @type {number|null} */
      this._timerId = null;
      /** @type {boolean} */
      this._prefersReducedMotion =
        typeof root.matchMedia === "function" &&
        root.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
    }

    /**
     * トーストを表示する
     * @param {string} message 表示するメッセージ（短い日本語推奨）
     * @param {"info"|"success"|"error"} [type="info"] メッセージ種別
     */
    show(message, type = "info") {
      if (!this._rootEl || !this._messageEl) return;

      this._messageEl.textContent = message || "";

      this._rootEl.classList.remove("toast--info", "toast--success", "toast--error");
      this._rootEl.classList.add(`toast--${type}`);

      this._rootEl.classList.add("show");

      if (this._timerId != null) {
        root.clearTimeout(this._timerId);
        this._timerId = null;
      }

      const duration = this._prefersReducedMotion ? 1500 : 2000;

      this._timerId = root.setTimeout(() => {
        this._rootEl.classList.remove("show");
        this._timerId = null;
      }, duration);
    }
  }

  // =========================================================
  // アプリ本体コアクラス
  // =========================================================

  /**
   * AppCore クラス
   * ------------------------------------------------------------------------
   * - DOM 要素の取得、イベントバインド、変換パイプライン実行など、
   *   「画面」と「モードレジストリ」をつなぐ役割を持つ。
   */
  class AppCore {
    /**
     * @param {ModeRegistry} registry モードレジストリ
     * @param {ToastManager} toastManager トーストマネージャ
     */
    constructor(registry, toastManager) {
      /** @type {ModeRegistry} */
      this._registry = registry;
      /** @type {ToastManager} */
      this._toast = toastManager;

      /** @type {HTMLTextAreaElement|null} */
      this._inputEl = null;
      /** @type {HTMLTextAreaElement|null} */
      this._outputEl = null;
      /** @type {HTMLButtonElement|null} */
      this._convertBtn = null;
      /** @type {HTMLButtonElement|null} */
      this._copyBtn = null;

      /** @type {boolean} */
      this._initialized = false;
    }

    /**
     * 初期化処理
     * - 必要な DOM 要素の取得とイベントバインドを行う。
     */
    init() {
      if (this._initialized) return;
      this._initialized = true;

      if (typeof document === "undefined") {
        // テスト / Node 環境では何もしない
        return;
      }

      this._inputEl = /** @type {HTMLTextAreaElement|null} */ (
        document.getElementById("inputText")
      );
      this._outputEl = /** @type {HTMLTextAreaElement|null} */ (
        document.getElementById("outputText")
      );
      this._convertBtn = /** @type {HTMLButtonElement|null} */ (
        document.getElementById("convertBtn")
      );
      this._copyBtn = /** @type {HTMLButtonElement|null} */ (
        document.getElementById("copyBtn")
      );

      if (!this._inputEl || !this._outputEl) {
        console.error("[AppCore] 入出力テキストエリアが見つかりません。");
        this._toast.show("初期化に失敗しました。", "error");
        return;
      }

      this._bindEvents();
    }

    /**
     * イベントをバインドする
     * @private
     */
    _bindEvents() {
      if (this._convertBtn) {
        this._convertBtn.addEventListener("click", () => {
          this._handleConvert().catch((err) => {
            console.error("[AppCore] 変換処理で予期せぬ例外:", err);
            this._toast.show("変換中にエラーが発生しました。", "error");
          });
        });
      }

      if (this._copyBtn) {
        this._copyBtn.addEventListener("click", () => {
          this._handleCopy().catch((err) => {
            console.error("[AppCore] コピー処理で予期せぬ例外:", err);
            this._toast.show("コピーに失敗しました。", "error");
          });
        });
      }

      if (this._inputEl) {
        this._inputEl.addEventListener("keydown", (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            this._handleConvert().catch((err) => {
              console.error("[AppCore] 変換処理で予期せぬ例外:", err);
              this._toast.show("変換中にエラーが発生しました。", "error");
            });
          }
        });
      }
    }

    /**
     * モード選択ラジオから現在選択されているモードキーを取得する
     * @returns {string|null}
     * @private
     */
    _getSelectedModeKey() {
      if (typeof document === "undefined") return null;
      const selected = /** @type {HTMLInputElement|null} */ (
        document.querySelector('input[name="mode"]:checked')
      );
      return selected ? selected.value : null;
    }

    /**
     * 指定モードに対する「非同期パイプライン関数」の配列を生成する
     * - ここで handler / {process} / 配列 の違いを吸収し、
     *   すべて async (text) => string というインターフェースに揃える。
     * @param {string} modeKey モードキー
     * @returns {Array<(text: string) => Promise<string>>}
     * @private
     */
    _buildPipeline(modeKey) {
      const rawHandlers = this._registry.getRawHandlers(modeKey);
      /** @type {Array<(text: string) => Promise<string>>} */
      const pipeline = [];

      rawHandlers.forEach((handler, index) => {
        if (typeof handler === "function") {
          // 関数ハンドラを async 関数にラップ
          const wrapped = async (text) => {
            const result = handler(text);
            if (result && typeof result.then === "function") {
              return String(await result);
            }
            return String(result ?? "");
          };
          pipeline.push(wrapped);
        } else if (handler && typeof handler === "object" && typeof handler.process === "function") {
          // オブジェクトハンドラ（process メソッド）を async 関数にラップ
          const wrapped = async (text) => {
            const result = handler.process(text);
            if (result && typeof result.then === "function") {
              return String(await result);
            }
            return String(result ?? "");
          };
          pipeline.push(wrapped);
        } else {
          console.warn("[AppCore] 無効なハンドラが検出されました:", modeKey, index, handler);
        }
      });

      return pipeline;
    }

    /**
     * 画面全体に対して「処理中」状態をセットする
     * - 長時間処理中にユーザーが再度ボタンを押すことを防ぎ、
     *   アクセシビリティ向上のため aria-busy も設定する。
     * @param {boolean} isBusy 処理中かどうか
     * @private
     */
    _setBusy(isBusy) {
      if (typeof document === "undefined") return;

      const appRoot = document.querySelector(".app");
      if (appRoot) {
        appRoot.classList.toggle("is-busy", isBusy);
        appRoot.setAttribute("aria-busy", isBusy ? "true" : "false");
      }

      if (this._convertBtn) {
        this._convertBtn.disabled = isBusy;
      }
    }

    /**
     * 変換処理本体
     * - 入力取得 → 半角正規化 → モード別パイプライン適用 → 出力反映までを行う。
     * @returns {Promise<void>}
     * @private
     */
    async _handleConvert() {
      if (!this._inputEl || !this._outputEl) return;

      const raw = this._inputEl.value || "";

      // ------------------------------------------------------
      // 日本語タイポチェック
      // ------------------------------------------------------
      // - jaTypoChecker.js 側で root.JaTypoChecker が定義されている前提。
      // - タイポが検出された場合は警告モーダルを表示し、
      //   いったん変換処理を中断する（ユーザーが修正後に再度 Convert する想定）。
      if (root.JaTypoChecker && typeof root.JaTypoChecker.check === "function") {
        const typoResult = root.JaTypoChecker.check(raw);
        if (typoResult && typoResult.hasError) {
          if (typeof root.JaTypoChecker.openModal === "function") {
            root.JaTypoChecker.openModal(typoResult);
          }
          return;
        }
      }

      const normalized = toHalfWidth(raw);

      const modeKey = this._getSelectedModeKey();
      if (!modeKey) {
        this._toast.show("モードを選択してください。", "info");
        return;
      }

      const pipeline = this._buildPipeline(modeKey);
      if (pipeline.length === 0) {
        console.warn("[AppCore] モードに対応するパイプラインが存在しません:", modeKey);
        this._toast.show("このモードには処理が定義されていません。", "info");
        this._outputEl.value = normalized;
        return;
      }

      this._setBusy(true);

      try {
        let current = normalized;

        for (const step of pipeline) {
          current = await step(current);
        }

        this._outputEl.value = current;
        this._toast.show("変換が完了しました。", "success");
      } catch (err) {
        console.error("[AppCore] 変換パイプライン実行中に例外が発生しました:", err);
        this._toast.show("変換中にエラーが発生しました。", "error");
      } finally {
        this._setBusy(false);
      }
    }

    /**
     * 出力テキストをクリップボードにコピーする
     * - Clipboard API を優先し、非対応環境では execCommand をフォールバックとして使用。
     * @returns {Promise<void>}
     * @private
     */
    async _handleCopy() {
      if (!this._outputEl) return;
      const text = this._outputEl.value || "";

      if (!text) {
        this._toast.show("コピーする内容がありません。", "info");
        return;
      }

      // Clipboard API を優先利用
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === "function") {
        try {
          await root.navigator.clipboard.writeText(text);
          this._toast.show("コピーしました。", "success");
          return;
        } catch (err) {
          console.warn("[AppCore] Clipboard API でのコピーに失敗:", err);
          // 下のフォールバックに進む
        }
      }

      // フォールバック: execCommand("copy")
      try {
        this._outputEl.focus();
        this._outputEl.select();
        const ok = document.execCommand("copy");
        if (ok) {
          this._toast.show("コピーしました。", "success");
        } else {
          this._toast.show("コピーに失敗しました。", "error");
        }
      } catch (err) {
        console.warn("[AppCore] execCommand でのコピーに失敗:", err);
        this._toast.show("コピーに失敗しました。", "error");
      } finally {
        const selection = root.getSelection && root.getSelection();
        if (selection && selection.removeAllRanges) {
          selection.removeAllRanges();
        }
      }
    }
  }

  // =========================================================
  // app ファクトリ（グローバル公開用）
  // =========================================================

  /**
   * app ファクトリ関数
   * ------------------------------------------------------------------------
   * - 呼び出されるたびに新しい ModeRegistry / ToastManager / AppCore を構築し、
   *   それらをまとめた「アプリインスタンスオブジェクト」を返す。
   * - 戻り値オブジェクトは run / registerMode / registerModeList /
   *   bootstrapModeLists / listModes / toHalfWidth を公開する。
   */
  function app() {
    const modeRegistry = new ModeRegistry();

    /** @type {AppCore|null} */
    let core = null;
    /** @type {ToastManager|null} */
    let toastManager = null;
    /** @type {boolean} */
    let initialized = false;

    /**
     * グローバルに定義された ModeFunctionLists をレジストリへ取り込む
     * - modeLists.js が root.ModeFunctionLists を定義していることを想定。
     * @param {Record<string, any[]>} [source] 明示的に渡す場合のオブジェクト
     */
    function bootstrapModeLists(source) {
      const src =
        source ||
        (root.ModeFunctionLists && typeof root.ModeFunctionLists === "object"
          ? root.ModeFunctionLists
          : null);

      if (!src || typeof src !== "object") {
        return;
      }

      Object.entries(src).forEach(([modeKey, list]) => {
        modeRegistry.registerModeList(modeKey, list);
      });
    }

    /**
     * DOM 初期化（1 回だけ実行）
     */
    function initDOM() {
      if (initialized) return;
      initialized = true;

      if (typeof document === "undefined") {
        // テスト環境 / Node.js では画面初期化は行わない
        return;
      }

      // modeLists.js 由来の関数リストを取り込み
      bootstrapModeLists();

      const toastRoot = /** @type {HTMLElement|null} */ (
        document.getElementById("toast")
      );
      const toastMsg = /** @type {HTMLElement|null} */ (
        document.getElementById("toastMessage")
      );

      toastManager = new ToastManager(toastRoot, toastMsg);
      core = new AppCore(modeRegistry, toastManager);
      core.init();
    }

    /**
     * アプリ実行エントリポイント
     * - DOMContentLoaded 前で呼ばれた場合は、DOMContentLoaded 後に initDOM を実行。
     * - DOM が既に構築済みであれば即座に initDOM を実行。
     */
    function run() {
      if (typeof document === "undefined") {
        // DOM がない環境では何もしない
        initialized = true;
        return;
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          initDOM();
        }, { once: true });
      } else {
        initDOM();
      }
    }

    // ファクトリが返す公開 API
    return {
      /** DOM 初期化とイベントバインドを開始する */
      run,

      /** 直接 DOM 初期化を呼びたい場合のエイリアス */
      init: initDOM,

      /**
       * モードを登録（単体ハンドラまたはハンドラ配列）
       * @param {string} key
       * @param {any} handlerOrList
       * @returns {any} this
       */
      registerMode(key, handlerOrList) {
        modeRegistry.registerMode(key, handlerOrList);
        return this;
      },

      /**
       * モードを「ハンドラ配列」として登録する
       * @param {string} key
       * @param {any[]} list
       * @returns {any} this
       */
      registerModeList(key, list) {
        modeRegistry.registerModeList(key, list);
        return this;
      },

      /**
       * ModeFunctionLists など外部オブジェクトを明示的にブートストラップする
       * @param {Record<string, any[]>} source
       * @returns {any} this
       */
      bootstrapModeLists(source) {
        bootstrapModeLists(source);
        return this;
      },

      /**
       * 登録済みモードキー一覧を取得する（デバッグ / 確認用）
       * @returns {string[]}
       */
      listModes() {
        return modeRegistry.listKeys();
      },

      /**
       * 半角正規化関数を公開（ユニットテストや外部ユーティリティとして利用可能）
       * @param {string} text
       * @returns {string}
       */
      toHalfWidth(text) {
        return toHalfWidth(text);
      }
    };
  }

  // =========================================================
  // グローバル公開 & 自動起動
  // =========================================================

  // グローバルにファクトリ関数を公開
  root.app = app;

  // 指定どおり、最後に app = app(); app.run() を実行
  root.app = root.app();
  root.app.run();

})(globalThis);
