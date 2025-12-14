# FilterRegistry 仕様書

## 1. ファイル概要

**ファイル名**: `filterRegistry.js`

**エクスポート**:
- `class FilterRegistry`
- （オプション）型やヘルパーの名前付きエクスポート（必要に応じて、ただし表面を最小限に保つ）

**実装の言語ルール**:
- `filterRegistry.js` 内のすべての JSDoc とインラインコメントは日本語で記述する。
- 関数名とメソッド名は短く明確に（例: `register`, `apply`, `names`）。

## 2. ファイル先頭の日本語 README コメント（filterRegistry.js に貼り付ける）

`filterRegistry.js` の最上部に以下のようなコメントを配置する：

```javascript
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
```

表現は調整可能ですが、日本語で情報量を保つこと。

## 3. コア設計: FilterRegistry クラス

### 3.1. 高レベルな責務

FilterRegistry は以下の機能を提供するクラス：

- **複数の名前付きフィルタリスト（パイプライン）の登録と管理**
  - 各リストは順序付けられたステップの配列。
  - 各ステップは、少なくとも関数とオプションのメタデータを含むフィルタ記述子。

- **API の提供**:
  - リストの登録、削除、検査
  - ステップの動的な挿入・削除・有効化
  - 登録済みリスト（またはアドホックリスト）を入力文字列に適用

- **複数引数フィルタのサポート**: ステップごとの引数の保存、または実行時追加引数の許可

- **同期・非同期フィルタの統一パイプライン**: 同期と非同期フィルタを統一的なパイプラインで処理

- **拡張性のためのフックとオプション**: `beforeApply`, `afterApply`, `onError` などのフック、およびリストごとのオプション（`stopOnError` など）

### 3.2. 推奨型モデル（内部、日本語 JSDoc で記述）

`filterRegistry.js` 内で、これらの形状を日本語 JSDoc で記述する：

**フィルタ関数**:

```typescript
type FilterFn = (str: string, ...args: any[]) => string | Promise<string>;
```

**フィルタ記述子（リスト内の 1 ステップ）**:

```typescript
interface FilterStep {
  fn: FilterFn;          // 実際に呼び出す関数
  name?: string;         // 任意の名前（デバッグ・ログ用）
  args?: any[];          // このステップ専用の追加引数
  enabled?: boolean;     // 無効化フラグ（false の場合はスキップ）
}
```

**リストオプション（名前付きリストごと）**:

```typescript
interface ListOptions {
  stopOnError?: boolean;  // true: エラー発生時に即座に中断
  parallel?: boolean;     // 将来拡張用。初期実装では sequential のみでよい
  // ここに list 単位のオプションを追加していく
}
```

**登録済みリストエントリ（Map に保存するもの）**:

```typescript
interface ListEntry {
  steps: FilterStep[];
  options: ListOptions;
}
```

**レジストリレベルのフック**:

```typescript
interface Hooks {
  beforeApply?: (name: string, input: string) => void | Promise<void>;
  afterApply?: (name: string, output: string) => void | Promise<void>;
  onError?: (name: string, error: unknown, stage: "hook" | "step", stepIndex?: number) => void | Promise<void>;
}
```

これらに対する実際の JSDoc は、コード内で日本語で記述する。

## 4. パブリック API: メソッドと動作

FilterRegistry を少なくとも以下のパブリックメソッドで実装する。
これらすべての JSDoc は、実際のファイル内で日本語で記述する。

### 4.1. コンストラクタ

```javascript
class FilterRegistry {
  constructor(options = {}) { ... }
}
```

**パラメータ（options）**:
- `hooks?: Hooks` — すべてのリストのデフォルトフック
- `defaults?: ListOptions` — リストごとのデフォルトオプション（例: `stopOnError: true`）

**動作**:
- リストを保存する内部 `Map<string, ListEntry>` を初期化
- インスタンスにフックとデフォルトを保存

### 4.2. register(name, fnList, options?)

```javascript
register(name, fnList, options)
```

**目的**: 名前付きフィルタリストを登録または置き換え

**パラメータ**:
- `name: string` — リスト名（キー）
- `fnList: FilterFn | FilterFn[] | FilterStep | FilterStep[]`:
  - 単一の関数または記述子、またはそれらの配列を受け入れる
- `options?: ListOptions` — リストごとのオプション（デフォルトを上書き）

**動作**:
- `name` を検証（空文字列でない文字列）。無効な場合は、日本語でエラーをスローまたはログ出力
- `fnList` を `FilterStep` オブジェクトの配列に正規化:
  - 要素が関数の場合: `{ fn, enabled: true }` としてラップ
  - 要素がプレーンオブジェクトの場合:
    - `fn` が関数であることを確認
    - `enabled` が省略されている場合は `true` に正規化
- オプションをデフォルトとマージ（例: `stopOnError` デフォルト `true`）
- `{ steps, options }` を `name` の下の Map に保存

**コメント（コード内）**:
- 複数引数フィルタが `FilterStep.args` に引数を保存する方法を説明
- `fnList` を実行時に安全に置き換えられることを説明

### 4.3. unregister(name)

```javascript
unregister(name)
```

**目的**: 名前付きリストを削除

**動作**:
- Map からエントリを削除
- 見つからない場合は問題なし（動作を日本語で文書化）

### 4.4. get(name)

```javascript
get(name) => FilterStep[] | null
```

**目的**: 登録済みリストを検査

**動作**:
- 見つかった場合は、ステップ配列のシャローコピーを返す
- そのようなリストがない場合は `null` を返す
- 返されたステップは読み取り専用として扱うべきであることを文書化（混乱を避けるため）

### 4.5. names()

```javascript
names() => string[]
```

**目的**: 登録済み名のリストを取得

**動作**:
- `Array.from(map.keys())` を返す

### 4.6. insert(name, index, filter)

```javascript
insert(name, index, filter)
```

**目的**: 既存リストの特定インデックスに新しいフィルタステップを挿入

**パラメータ**:
- `filter: FilterFn | FilterStep`

**動作**:
- 既存リストを解決。見つからない場合は、日本語でエラーをスローまたはログ出力
- `filter` を `FilterStep` に正規化
- インデックスに挿入（インデックスを有効範囲にクランプ）

**コメント**: これは実行時カスタマイズ（プラグイン）に有用であることを説明

### 4.7. removeAt(name, index)

```javascript
removeAt(name, index)
```

**目的**: 名前付きリストから指定インデックスのステップを削除

**動作**:
- インデックスが範囲外の場合、以下のいずれかを選択して文書化:
  - 静かに無視する、または
  - エラーをスローする（推奨: 明確な日本語メッセージでスロー）

### 4.8. enable(name, index, bool)

```javascript
enable(name, index, enabled)
```

**目的**: `enabled` フラグを切り替えて特定のステップを有効化/無効化

**動作**:
- ステップが存在する場合、`step.enabled = !!enabled` を設定
- 無効化されたステップは、リストを適用する際にスキップされる

### 4.9. apply(name, str, invokeArgs?)

```javascript
async apply(name, str, invokeArgs)
```

**推奨**: シンプルにするため、`apply` は常に `Promise<string>` を返すようにする。
すべてのフィルタが同期の場合でも、呼び出し側は同期的に扱える（Promise は即座に解決される）が、型は統一される。

**目的**: 名前付きフィルタリストを入力文字列に対して実行

**パラメータ**:
- `name: string` — リスト名
- `str: string` — 入力テキスト
- `invokeArgs?: any[]` — 各フィルタステップに渡す追加引数

**動作（コアパイプラインロジック）**:
1. 名前でリストエントリを検索
2. 見つからない場合、日本語でエラーをスロー（例: `new Error("指定されたフィルタリストは登録されていません: " + name)`）
3. `str` を文字列に正規化（例: `const input = str == null ? "" : String(str);`）
4. `beforeApply(name, input)` フックが定義されている場合は呼び出し
   - `try/catch` でラップ。フックがスローした場合、`onError` を `stage "hook"` で呼び出し、ポリシーに基づいて再スローまたは続行
5. 順序に従ってステップを反復処理し、現在の文字列を維持:
```javascript
let current = input;
for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  if (step.enabled === false) continue;

  const args = [];
  // 第 1 パラメータ: 現在の文字列
  args.push(current);

  // ステップごとの引数および/または invokeArgs を追加
  if (Array.isArray(step.args)) {
    args.push(...step.args);
  }
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
    // stopOnError の場合: onError を呼び出して再スロー
    // それ以外: onError を呼び出して続行（current は変更なし）
  }
}
```
6. ループ後、`afterApply(name, current)` が定義されている場合は呼び出し（再度 `try/catch` でラップ。フックが失敗した場合は `onError` 経由でログ出力）
7. `current` を最終的な `out_str` として返す

**オプション**:
- リストごとのオプション（`ListEntry.options`）および/またはレジストリのデフォルトを使用:
  - **stopOnError**:
    - `true`: 最初のエラーで `onError` を呼び出し、その後スロー/拒否
    - `false`: `onError` を呼び出すが、パイプラインを続行（`current` を変更しないままにするか、フォールバックを決定）
  - **parallel**:
    - テキスト変換では、順次セマンティクスが推奨される
    - 初期実装では `parallel` を保存できるが無視し、コメントで `parallel` は将来のために予約されていることを注記

### 4.10. applyList(fnList, str, invokeArgs?)

```javascript
async applyList(fnList, str, invokeArgs)
```

**目的**: 登録せずにアドホックリストを適用

**パラメータ**:
- `fnList: FilterFn | FilterFn[] | FilterStep | FilterStep[]` — `register` と同じ形式
- `str: string`
- `invokeArgs?: any[]`

**動作**:
- `fnList` を `FilterStep` の配列に正規化
- `apply` と同じ内部パイプライン実行を使用するが、リスト名とオプションなし
- `beforeApply` / `afterApply` はスキップするか、`"<adhoc>"` のような合成名で呼び出す（選択可能。日本語コメントで文書化）
- `stopOnError` デフォルト: `true`（適切なデフォルト）

## 5. フックとライフサイクル

レジストリコンストラクタで、オプションのフックを受け入れる:

```javascript
constructor({ hooks, defaults } = {})
```

- `this._hooks = hooks || {};` を保存

`apply` 内で:
- パイプライン前: `this._hooks.beforeApply?.(name, input)` を呼び出し
- パイプライン後: `this._hooks.afterApply?.(name, output)` を呼び出し
- ステップエラーまたはフックエラー時: `this._hooks.onError?.(name, err, stage, stepIndex)` を呼び出し

すべてのフック呼び出しは `try/catch` でラップする。
`onError` 自体がスローした場合、再スローまたはログ出力する — この動作を日本語で文書化。

## 6. プラグイン API

シンプルな `use` メソッドを提供:

```javascript
use(plugin)
```

**プラグインシグネチャ（日本語で文書化）**:

```typescript
type Plugin = (registry: FilterRegistry) => void;
```

**動作**:
- プラグインが関数の場合、`plugin(this)` を呼び出す
- プラグインコードは、`register`, `insert` などを呼び出してリストを追加または変更できる

**例（コードコメント内、日本語）**:

```javascript
// プラグイン例:
//   - "oa" というフィルタリストを登録するプラグイン
// registry.use((reg) => {
//   reg.register("oa", [
//     (s) => s.trim(),
//     (s) => s + " [OA]",
//   ]);
// });
```

## 7. パフォーマンスに関する考慮事項

コードコメント（日本語）で、以下を強調:

- 現在の文字列と各ステップからの出力以外の不要な中間文字列を作成しない
- 厳密に必要な場合を除き、文字列を配列に分割しない。パイプラインは文字列全体で動作する必要がある
- フィルタは任意であるため、コア実行ループをシンプルで効率的に保つ。ホットパス内で記述子をディープクローンしない

## 8. エラーハンドリングとメッセージ（日本語）

**実装ガイダンス**:

検証エラー（無効な名前、無効な `fnList`、範囲外インデックス）の場合:
- 短く明確な日本語メッセージで `Error` をスロー、例:
```javascript
throw new Error("フィルタ名は空文字列にできません。");
```

フィルタの実行時エラーの場合:
- 各ステップを `try/catch` でラップ
- `stopOnError` が `true` の場合:
  - `onError` フックを呼び出す
  - エラーを再スロー（`apply` が拒否されるように）
- `stopOnError` が `false` の場合:
  - `onError` を呼び出す
  - 次のステップに続行
  - `current` をそのまま保持するか、フォールバック（例: 元の `str`）を使用するかを決定し、選択したポリシーを文書化

## 9. 日本語コメントに含める最小限の例

`filterRegistry.js` 内で、クラスの後または README ブロック内に、日本語コメントで最小限の例を追加。例:

### 9.1. シンプルな単一引数リスト

```javascript
// 使用例 1: 単純な 1 引数フィルタリスト
// const reg = new FilterRegistry();
// reg.register("upper", [
//   (s) => s.toUpperCase(),
//   (s) => s + "!"
// ]);
//
// const out = await reg.apply("upper", "abc");
// // 結果: "ABC!"
```

### 9.2. 複数引数フィルタと追加引数

```javascript
// 使用例 2: 複数引数フィルタの登録と追加引数
// reg.register("prefix", [
//   { fn: (s, prefix) => prefix + s, args: ["[OA] "] },
//   (s) => s.trimEnd(),
// ]);
//
// const out = await reg.apply("prefix", " hello ", ["(note) "]);
// // 実行時引数も渡す場合の呼び出しルールについては
// // apply 内のコメントで説明すること。
```

（`step.args` と `invokeArgs` の正確なマージ順序を定義し、日本語で明確に説明する）

### 9.3. 同期 vs 非同期フィルタ

```javascript
// 使用例 3: 非同期フィルタを含むリスト
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
```

## 10. filterRegistry.js の実装チェックリスト

`filterRegistry.js` を実装する際は、このチェックリストに従う:

- [ ] ファイルは日本語 README コメントで始まる（上記で提供したようなもの）
- [ ] すべての JSDoc とインラインコメントは日本語で、簡潔で情報量が多い
- [ ] `FilterRegistry` をエクスポート（デフォルトエクスポートまたは名前付きエクスポート）
- [ ] メソッドを実装: `constructor`, `register`, `unregister`, `get`, `names`, `insert`, `removeAt`, `enable`, `apply`, `applyList`, `use`
- [ ] `FilterStep.args` と `invokeArgs` 経由で複数引数フィルタをサポート
- [ ] 内部で正規化:
  - 単一関数 → 単一要素の `FilterStep` リスト
  - プレーン関数または記述子 → デフォルトで `enabled: true` の `FilterStep`
- [ ] `apply` と `applyList` はパイプラインを順次実行し、`await` 経由で同期関数と非同期関数の両方をサポート
- [ ] エラーハンドリングは、リストごとのオプションとフック（`beforeApply`, `afterApply`, `onError`）を使用して一元化される
- [ ] 実装は不要な割り当てを避け、大きな文字列に対して安全

この指示に従って `filterRegistry.js` を構築すると、既存のテキスト処理パイプラインとメインアプリケーションにクリーンに統合され、将来の特許文書変換に対して高度に拡張可能なままになります。
