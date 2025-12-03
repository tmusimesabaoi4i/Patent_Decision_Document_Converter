/**
 * filterRegistry.js
 * --------------------------------------------------------------------------
 * フィルタレジストリモジュール
 *
 * ▼ 目的
 *   - テキスト変換用のフィルタ関数を「名前付きリスト」として登録し、
 *     入力文字列に対して順次適用するための共通基盤を提供する。
 *   - 特許文書などの変換パイプラインを柔軟に組み立てられるようにする。
 *
 * ▼ 基本コンセプト
 *   - 1 つの「フィルタリスト」は、複数のフィルタ関数を順番に実行するパイプライン。
 *   - 各フィルタは (str: string, ...args: any[]) => string | Promise<string>
 *     のシグネチャを持つことを想定する。
 *   - レジストリは、フィルタリストの登録・置き換え・削除・実行を司る。
 *
 * ▼ 主な使い方（概要）
 *   1. レジストリの生成
 *        const reg = new FilterRegistry();
 *
 *   2. フィルタリストの登録（1 引数フィルタの例）
 *        reg.register("simple", [
 *          (str) => str.toUpperCase(),
 *          (str) => str + "!",
 *        ]);
 *
 *   3. 複数引数フィルタの登録例
 *        reg.register("prefix", [
 *          { fn: (str, prefix) => prefix + str, args: ["[OA] "] }
 *        ]);
 *
 *   4. 登録済みリストの実行
 *        const out = await reg.apply("simple", "abc");
 *        // "ABC!"
 *
 *        const out2 = await reg.apply("prefix", "text");
 *        // "[OA] text"
 *
 *   5. 一時的なリストを登録せずに実行
 *        const out3 = await reg.applyList([
 *          (s) => s.trim(),
 *          (s) => s + " END",
 *        ], "  hello  ");
 *
 * ▼ フィルタの拡張
 *   - フィルタごとにメタデータ（fn, name, args, enabled など）を持たせることで、
 *     動的な有効・無効切り替えや設定値の変更が容易になる。
 *   - beforeApply / afterApply / onError などのフックで共通処理やログ出力を
 *     一元管理できる。
 *
 * ▼ 注意点
 *   - 本モジュール内のコメントおよび JSDoc はすべて日本語で記述する。
 *   - 文字列長が大きい入力でも不要なコピーを避け、パフォーマンスに配慮する。
 *   - 非同期フィルタ (Promise を返すフィルタ) にも対応するため、
 *     apply は基本的に Promise<string> を返す設計とする。
 */

/**
 * @typedef {(str: string, ...args: any[]) => (string|Promise<string>)} FilterFn
 * フィルタ関数の型定義
 * - 第 1 引数に現在の文字列を渡し、残りの引数は任意の追加パラメータとする。
 * - 戻り値は文字列または Promise<string> とし、非同期処理にも対応する。
 */

/**
 * @typedef {Object} FilterStep
 * @property {FilterFn} fn
 *   実際に呼び出されるフィルタ関数。
 * @property {string} [name]
 *   ステップ名（任意）。デバッグやログ出力に利用できる。
 * @property {any[]} [args]
 *   このステップ専用の追加引数配列。apply 時に invokeArgs と結合されて渡される。
 * @property {boolean} [enabled]
 *   有効・無効フラグ。false の場合、このステップはスキップされる。
 */

/**
 * @typedef {Object} ListOptions
 * @property {boolean} [stopOnError]
 *   true の場合、ステップでエラーが発生した時点でパイプラインを中断し、
 *   エラーをそのままスローする。false の場合は onError を呼び出したうえで
 *   パイプラインを継続する（current はエラー発生前の値を維持する）。
 * @property {boolean} [parallel]
 *   将来拡張用のオプション。初期実装ではシーケンシャル実行のみを行い、
 *   parallel が true でも挙動は変わらない（予約フィールド）。
 */

/**
 * @typedef {Object} ListEntry
 * @property {FilterStep[]} steps
 *   実行順で並んだフィルタステップ配列。
 * @property {ListOptions} options
 *   このリスト固有のオプション設定。
 */

/**
 * @typedef {Object} Hooks
 * @property {(name: string, input: string) => (void|Promise<void>)} [beforeApply]
 *   apply 実行前に呼び出されるフック。引数にはリスト名と入力文字列が渡される。
 * @property {(name: string, output: string) => (void|Promise<void>)} [afterApply]
 *   apply 実行後に呼び出されるフック。引数にはリスト名と出力文字列が渡される。
 * @property {(name: string, error: any, stage: "hook"|"step", stepIndex?: number) => (void|Promise<void>)} [onError]
 *   エラー発生時に呼び出されるフック。
 *   - name: 対象となるフィルタリスト名（applyList の場合は "<adhoc>" など）
 *   - error: 実際にスローされたエラー
 *   - stage: "hook"（before/after フック内）または "step"（ステップ実行中）
 *   - stepIndex: ステップ実行中のインデックス（hook の場合は undefined）
 */

/**
 * フィルタレジストリクラス
 * ---------------------------------------------------------------------------
 * - 複数のフィルタリスト（パイプライン）を名前付きで管理し、
 *   入力文字列に対して順次適用するためのクラス。
 * - フィルタは同期・非同期どちらにも対応し、apply は常に Promise<string> を返す。
 * - 各フィルタステップは FilterStep としてメタ情報を持ち、後から挿入・削除・
 *   有効／無効化が可能。
 */
class FilterRegistry {
  /**
   * コンストラクタ
   *
   * @param {Object} [options]
   * @param {Hooks} [options.hooks]
   *   レジストリ全体に適用されるフック群。
   * @param {ListOptions} [options.defaults]
   *   各リストのデフォルトオプション（stopOnError など）。
   */
  constructor(options = {}) {
    /** @type {Map<string, ListEntry>} */
    this._map = new Map();

    /** @type {Hooks} */
    this._hooks = options.hooks || {};

    /** @type {ListOptions} */
    this._defaults = Object.assign(
      {
        stopOnError: true,
        parallel: false
      },
      options.defaults || {}
    );
  }

  // -------------------------------------------------------------------------
  // 公開 API
  // -------------------------------------------------------------------------

  /**
   * フィルタリストを登録または置き換える
   *
   * @param {string} name
   *   フィルタリスト名（キー）。空文字列は許可しない。
   * @param {FilterFn|FilterFn[]|FilterStep|FilterStep[]} fnList
   *   登録するフィルタの集合。
   *   - 単一関数または FilterStep の場合は 1 要素のリストとして扱う。
   *   - 配列の場合は、各要素を FilterStep に正規化して steps として保持する。
   * @param {ListOptions} [options]
   *   このリスト固有のオプション（defaults を上書きする）。
   */
  register(name, fnList, options) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("フィルタ名は空文字列にできません。");
    }
    const steps = this._normalizeToSteps(fnList);
    const mergedOptions = Object.assign({}, this._defaults, options || {});
    /** @type {ListEntry} */
    const entry = {
      steps,
      options: mergedOptions
    };
    this._map.set(name, entry);
  }

  /**
   * 指定されたフィルタリストを削除する
   *
   * @param {string} name フィルタリスト名
   */
  unregister(name) {
    this._map.delete(name);
  }

  /**
   * 指定されたフィルタリストのステップ一覧を取得する
   *
   * - 返り値はステップ配列の浅いコピーであり、内部状態を守るため、
   *   呼び出し側での直接変更は推奨されない。
   *
   * @param {string} name フィルタリスト名
   * @returns {FilterStep[]|null} ステップ配列のコピー。存在しない場合は null。
   */
  get(name) {
    const entry = this._map.get(name);
    if (!entry) return null;
    return entry.steps.slice();
  }

  /**
   * 登録済みフィルタリスト名の一覧を取得する
   *
   * @returns {string[]} フィルタリスト名の配列
   */
  names() {
    return Array.from(this._map.keys());
  }

  /**
   * 既存フィルタリストにステップを挿入する
   *
   * @param {string} name フィルタリスト名
   * @param {number} index 挿入位置（0〜steps.length の範囲にクランプされる）
   * @param {FilterFn|FilterStep} filter 挿入するフィルタステップ
   */
  insert(name, index, filter) {
    const entry = this._map.get(name);
    if (!entry) {
      throw new Error("指定されたフィルタリストは登録されていません: " + name);
    }
    const step = this._normalizeToStep(filter);
    const steps = entry.steps;
    const i = Math.max(0, Math.min(index, steps.length));
    steps.splice(i, 0, step);
  }

  /**
   * 指定インデックスのステップを削除する
   *
   * @param {string} name フィルタリスト名
   * @param {number} index 削除するステップのインデックス
   */
  removeAt(name, index) {
    const entry = this._map.get(name);
    if (!entry) {
      throw new Error("指定されたフィルタリストは登録されていません: " + name);
    }
    const steps = entry.steps;
    if (index < 0 || index >= steps.length) {
      throw new Error("ステップのインデックスが範囲外です: " + index);
    }
    steps.splice(index, 1);
  }

  /**
   * 指定インデックスのステップを有効／無効化する
   *
   * @param {string} name フィルタリスト名
   * @param {number} index 対象ステップのインデックス
   * @param {boolean} enabled true: 有効, false: 無効
   */
  enable(name, index, enabled) {
    const entry = this._map.get(name);
    if (!entry) {
      throw new Error("指定されたフィルタリストは登録されていません: " + name);
    }
    const steps = entry.steps;
    if (index < 0 || index >= steps.length) {
      throw new Error("ステップのインデックスが範囲外です: " + index);
    }
    steps[index].enabled = !!enabled;
  }

  /**
   * 指定されたフィルタリストを入力文字列に適用する
   *
   * - 常に Promise<string> を返す。すべてのステップが同期的でも Promise は即座に
   *   resolve されるため、呼び出し側は一貫した扱いができる。
   *
   * @param {string} name フィルタリスト名
   * @param {string} str 入力文字列
   * @param {any[]} [invokeArgs]
   *   各ステップに共通で渡したい追加引数配列。
   *   - 実際にステップに渡される引数順序は:
   *       [ current, ...step.args, ...invokeArgs ]
   *     となる。
   * @returns {Promise<string>} 変換後の文字列
   */
  async apply(name, str, invokeArgs) {
    const entry = this._map.get(name);
    if (!entry) {
      throw new Error("指定されたフィルタリストは登録されていません: " + name);
    }
    const input = str == null ? "" : String(str);
    return this._runPipeline(name, entry, input, invokeArgs);
  }

  /**
   * 登録せずに一時的なフィルタリストを適用する
   *
   * - fnList の形式は register と同様に柔軟に受付ける。
   * - リスト名は内部的に "<adhoc>" としてフックに通知される。
   *
   * @param {FilterFn|FilterFn[]|FilterStep|FilterStep[]} fnList
   *   一時的に適用するフィルタ集合
   * @param {string} str 入力文字列
   * @param {any[]} [invokeArgs]
   *   各ステップに共通で渡したい追加引数配列
   * @returns {Promise<string>} 変換後の文字列
   */
  async applyList(fnList, str, invokeArgs) {
    const steps = this._normalizeToSteps(fnList);
    /** @type {ListEntry} */
    const entry = {
      steps,
      // 一時的なリストのデフォルトは stopOnError: true とする
      options: Object.assign({}, this._defaults, { stopOnError: true })
    };
    const input = str == null ? "" : String(str);
    return this._runPipeline("<adhoc>", entry, input, invokeArgs);
  }

  /**
   * プラグインを登録する
   *
   * - プラグインは (registry: FilterRegistry) => void 形式の関数とし、
   *   register / insert などを通じてリストの追加や変更を行う。
   *
   * @param {(reg: FilterRegistry) => void} plugin プラグイン関数
   */
  use(plugin) {
    if (typeof plugin !== "function") return;
    plugin(this);
  }

  // -------------------------------------------------------------------------
  // 内部ユーティリティ
  // -------------------------------------------------------------------------

  /**
   * 任意のフィルタ定義を FilterStep 配列に正規化する
   *
   * @param {FilterFn|FilterFn[]|FilterStep|FilterStep[]} fnList
   * @returns {FilterStep[]} 正規化されたステップ配列
   * @private
   */
  _normalizeToSteps(fnList) {
    if (fnList == null) {
      throw new Error("フィルタリストが指定されていません。");
    }
    const src = Array.isArray(fnList) ? fnList : [fnList];
    /** @type {FilterStep[]} */
    const steps = [];
    for (const item of src) {
      const step = this._normalizeToStep(item);
      steps.push(step);
    }
    if (steps.length === 0) {
      throw new Error("フィルタリストに有効なステップがありません。");
    }
    return steps;
  }

  /**
   * 個々の要素を FilterStep に正規化する
   *
   * @param {FilterFn|FilterStep} item
   * @returns {FilterStep}
   * @private
   */
  _normalizeToStep(item) {
    // 関数の場合は最小限の FilterStep としてラップ
    if (typeof item === "function") {
      return {
        fn: item,
        enabled: true
      };
    }

    if (item && typeof item === "object") {
      const fn = /** @type {any} */ (item).fn;
      if (typeof fn !== "function") {
        throw new Error("FilterStep オブジェクトには fn 関数が必要です。");
      }
      /** @type {FilterStep} */
      const step = {
        fn,
        name: typeof item.name === "string" ? item.name : undefined,
        args: Array.isArray(item.args) ? item.args.slice() : item.args,
        enabled: item.enabled === false ? false : true
      };
      return step;
    }

    throw new Error("フィルタステップは関数または { fn } 形式のオブジェクトである必要があります。");
  }

  /**
   * パイプラインを実行する共通ロジック
   *
   * - name: リスト名（フックに通知するために使用）
   * - entry: steps と options を含むリストエントリ
   * - input: 初期文字列
   * - invokeArgs: 各ステップに共通で渡す追加引数
   *
   * @param {string} name
   * @param {ListEntry} entry
   * @param {string} input
   * @param {any[]} [invokeArgs]
   * @returns {Promise<string>}
   * @private
   */
  async _runPipeline(name, entry, input, invokeArgs) {
    const steps = entry.steps;
    const options = entry.options || this._defaults;
    const hooks = this._hooks || {};

    let current = input;

    // beforeApply フック
    if (typeof hooks.beforeApply === "function") {
      try {
        await hooks.beforeApply(name, current);
      } catch (err) {
        await this._handleHookError(name, err, "hook");
        if (options.stopOnError !== false) {
          throw err;
        }
      }
    }

    // ステップ実行ループ（シーケンシャル）
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step || step.enabled === false) {
        continue;
      }

      const args = [];
      // 第 1 引数は常に現在の文字列
      args.push(current);

      // ステップ固有の args を先に展開
      if (Array.isArray(step.args) && step.args.length > 0) {
        args.push(...step.args);
      }

      // 呼び出し時に指定された共通引数を後ろに展開
      if (Array.isArray(invokeArgs) && invokeArgs.length > 0) {
        args.push(...invokeArgs);
      }

      try {
        const result = step.fn(...args);
        if (result && typeof result.then === "function") {
          current = String(await result);
        } else {
          current = String(result ?? "");
        }
      } catch (err) {
        await this._handleHookError(name, err, "step", i);
        if (options.stopOnError !== false) {
          // stopOnError が true (デフォルト) の場合は即座に中断
          throw err;
        } else {
          // stopOnError が false の場合は current を変更せず次のステップへ進む
          continue;
        }
      }
    }

    // afterApply フック
    if (typeof hooks.afterApply === "function") {
      try {
        await hooks.afterApply(name, current);
      } catch (err) {
        await this._handleHookError(name, err, "hook");
        if (options.stopOnError !== false) {
          throw err;
        }
      }
    }

    return current;
  }

  /**
   * onError フック呼び出しのヘルパ
   *
   * - フック自体が例外を投げた場合はコンソールへログ出力し、
   *   元のエラーはそのまま扱う方針とする。
   *
   * @param {string} name リスト名
   * @param {any} error 発生したエラーオブジェクト
   * @param {"hook"|"step"} stage 発生箇所の種別
   * @param {number} [stepIndex] ステップ実行中の場合のインデックス
   * @returns {Promise<void>}
   * @private
   */
  async _handleHookError(name, error, stage, stepIndex) {
    const hooks = this._hooks || {};
    if (typeof hooks.onError !== "function") return;

    try {
      await hooks.onError(name, error, stage, stepIndex);
    } catch (hookErr) {
      // onError 自体のエラーはここで握りつぶし、デバッグ用にログのみ出す
      // （本来の error を上書きしないため）
      // eslint-disable-next-line no-console
      console.error("onError フック内でエラーが発生しました:", hookErr);
    }
  }
}

// ---------------------------------------------------------------------------
// 使用例（コメントのみ）
// ---------------------------------------------------------------------------

/*
// 使用例 1: 単純な 1 引数フィルタリスト
// const reg = new FilterRegistry();
// reg.register("upper", [
//   (s) => s.toUpperCase(),
//   (s) => s + "!"
// ]);
//
// const out = await reg.apply("upper", "abc");
// // 結果: "ABC!"
*/

/*
// 使用例 2: 複数引数フィルタの登録と追加引数
// const reg = new FilterRegistry();
// reg.register("prefix", [
//   { fn: (s, prefix) => prefix + s, args: ["[OA] "] },
//   (s) => s.trimEnd(),
// ]);
//
// const out = await reg.apply("prefix", " hello ", ["(note) "]);
// // この場合の引数順序:
// //   1. current (s)
// //   2. step.args ... → "[OA] "
// //   3. invokeArgs ... → "(note) "
// // となる。
*/

/*
// 使用例 3: 非同期フィルタを含むリスト
// const reg = new FilterRegistry();
// reg.register("asyncSample", [
//   (s) => s.trim(),
//   async (s) => {
//     // 非同期処理の例（実際には何らかの I/O を行う想定）
//     await new Promise((resolve) => setTimeout(resolve, 10));
//     return s + " [done]";
//   },
// ]);
//
// const out = await reg.apply("asyncSample", "  hello  ");
// // 結果: "hello [done]"
*/

/*
// プラグイン例:
//   - "oa" というフィルタリストを登録するプラグイン
// const reg = new FilterRegistry();
// reg.use((r) => {
//   r.register("oa", [
//     (s) => s.trim(),
//     (s) => s + " [OA]",
//   ]);
// });
*/

// ---------------------------------------------------------------------------
// エクスポート
// ---------------------------------------------------------------------------

// ES Modules 風 / CommonJS 両対応にする（必要に応じて調整）
if (typeof module !== "undefined" && module.exports) {
  module.exports = FilterRegistry;
  module.exports.FilterRegistry = FilterRegistry;
}
if (typeof window !== "undefined") {
  window.FilterRegistry = FilterRegistry;
}
