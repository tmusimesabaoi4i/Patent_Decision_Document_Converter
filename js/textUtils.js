/**
 * textUtils.js
 * ---------------------------------------------------------------------------
 * 特許文書変換向けテキストユーティリティ集
 *
 * ▼ 目的
 *   - 特許文書の前処理・整形でよく使うテキスト変換関数をまとめたモジュール。
 *
 * ▼ 提供内容（主なエクスポート）
 *   - 個別関数:
 *       nl, hw, lead, clean, rmBlank, squeeze, trim, gap
 * ---------------------------------------------------------------------------
 */

(function (root) {
  "use strict";

  // ========================================================================
  // 個別ユーティリティ関数
  // ========================================================================

  /**
   * 改行コードを統一する
   *
   * - CRLF ("\r\n"), CR ("\r"), LF ("\n") のすべてを "\n" に統一する。
   * - 空文字列や null / undefined が渡された場合は空文字列を返す。
   * - 既に "\n" のみで構成されている場合はほぼそのまま返るためコストは低い。
   *
   * @param {string} str 入力文字列
   * @returns {string} 改行コードを "\n" に正規化した文字列
   */
  function nl(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    // \r\n または単体 \r をすべて \n に統一
    return s.replace(/\r\n?/g, "\n");
  }

  /**
   * 全角を半角へ変換する
   *
   * - 可能であれば Unicode NFKC 正規化を用いて、全角英数字・記号などを半角へ寄せる。
   * - その後、全角スペース (U+3000) を半角スペース " " に変換する。
   * - NFKC により一部のカナや結合文字が変形・結合される可能性があることに注意。
   *   （例: 一部の濁点付き文字が 1 文字に統合される等）
   * - 正規化が利用できない環境でも、ASCII 全角 (U+FF01〜U+FF5E) と全角スペースを
   *   手動で半角へ変換するフォールバックを行う。
   *
   * @param {string} str 入力文字列
   * @returns {string} 半角化された文字列
   */
  function hw(str) {
    if (str == null || str === "") return "";
    let s = String(str);

    // NFKC 正規化（可能であれば実施）
    if (typeof s.normalize === "function") {
      try {
        s = s.normalize("NFKC");
      } catch (_e) {
        // normalize が失敗した場合はフォールバックのみで対応
      }
    }

    // ここで改めて全角 ASCII / 数字 / 全角スペースを手動変換
    const FW_START = 0xff01; // 全角 '！'
    const FW_END = 0xff5e; // 全角 '～'
    const FW_SPACE = 0x3000; // 全角スペース
    const OFFSET = 0xfee0;

    let out = "";
    for (const ch of s) {
      const code = ch.charCodeAt(0);
      if (code === FW_SPACE) {
        out += " ";
      } else if (code >= FW_START && code <= FW_END) {
        out += String.fromCharCode(code - OFFSET);
      } else {
        out += ch;
      }
    }
    return out;
  }

  /**
   * 先頭に改行を 1 つだけ挿入する
   *
   * - 文字列の先頭に必ず 1 つの "\n" が存在するようにする。
   * - 既に先頭が "\n" の場合は何もしない（重複させない）。
   * - 空文字列の場合は、そのまま空文字列を返す（"\n" は付与しない）。
   *   ※ 空入力に改行を付けるかどうかは運用に依存するため、ここでは付与しない実装。
   *
   * @param {string} str 入力文字列
   * @returns {string} 先頭に改行が 1 つだけ保証された文字列
   */
  function lead(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    if (s[0] === "\n") return s;
    return "\n" + s;
  }

  /**
   * 特定の制御文字・特殊文字を除去／空白に変換する
   *
   * - 以下の文字を半角スペース " " に変換する:
   *     - タブ: \t (U+0009)
   *     - 垂直タブ: \v (U+000B)
   *     - 改ページ: \f (U+000C)
   * - 以下の制御文字を削除する:
   *     - ASCII 制御文字 (U+0000〜U+001F, U+007F) のうち、上記以外と改行以外。
   * - 改行 "\n" は保持する（行構造を崩さないため）。
   * - それ以外の可視文字（日本語や一般的な Unicode 文字）はそのまま維持する。
   * - 将来、Unicode カテゴリ（Cc など）に基づく厳密なホワイトリスト方式へ
   *   拡張しやすいよう、1 文字ずつ走査して判定している。
   *
   * @param {string} str 入力文字列
   * @returns {string} 不要な制御文字が除去された文字列
   */
  function clean(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";
    for (const ch of s) {
      const code = ch.charCodeAt(0);

      // 改行はそのまま保持
      if (ch === "\n") {
        out += ch;
        continue;
      }

      // タブ / 垂直タブ / 改ページは半角スペースに変換
      if (ch === "\t" || ch === "\v" || ch === "\f") {
        out += " ";
        continue;
      }

      // その他の ASCII 制御文字 (0x00〜0x1F, 0x7F) は削除
      if ((code >= 0x0000 && code <= 0x001f) || code === 0x007f) {
        continue;
      }

      // それ以外はそのまま出力（日本語・記号など）
      out += ch;
    }
    return out;
  }

  /**
   * 空行（空白のみの行を含む）を削除する
   *
   * - 改行 "\n" で行分割し、次の条件を満たす行を「空行」とみなして削除する:
   *     - 行内の文字から半角・全角スペースおよびタブ類をすべて取り除いた結果、
   *       長さが 0 の行。
   * - "空白のみ" の行も空行として扱う（推奨設定）。
   * - 非空行同士は 1 本の "\n" で連結されるため、連続する空行は完全に消える。
   *
   * @param {string} str 入力文字列
   * @returns {string} 空行が削除された文字列
   */
  function rmBlank(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    const lines = s.split("\n");
    const outLines = [];

    for (const line of lines) {
      // 半角・全角スペースとタブ類を削除して空かどうか判定
      const trimmed = line.replace(/[ \t\r\f\v\u3000]/g, "");
      if (trimmed.length === 0) {
        // 空行はスキップ
        continue;
      }
      outLines.push(line);
    }

    return outLines.join("\n");
  }

  /**
   * 連続する半角スペースを 1 つに圧縮する
   *
   * - "  "（半角スペース 2 個以上）の連続を、常に 1 個の半角スペース " " に置き換える。
   * - 改行やタブなど、スペース以外の文字は対象外。
   * - 頻繁に登場する余分なスペースのノイズを削減するのに有効。
   *
   * @param {string} str 入力文字列
   * @returns {string} 連続スペースが 1 つに圧縮された文字列
   */
  function squeeze(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    // 半角スペース 2 個以上の連続を 1 個にまとめる
    return s.replace(/ {2,}/g, " ");
  }

  /**
   * 先頭と末尾の半角空白を削除する
   *
   * - 文字列全体の前後にある空白文字（半角スペース・タブ・改行など）を取り除く。
   *   （標準の String.prototype.trim() と同等の挙動）
   * - 行ごとのトリミングは行わない（必要であれば別関数として拡張可能）。
   *
   * @param {string} str 入力文字列
   * @returns {string} 前後の空白が削除された文字列
   */
  function trim(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    return s.trim();
  }

  /**
   * 行間に「ちょうど 1 行の空行」を挿入する
   *
   * - 目的: コンテンツ行の間に、常に 1 行だけの空行が入るように整形する。
   * - アルゴリズム概要:
   *     1. "\n" で行分割する。
   *     2. 「空行かどうか」を、行全体が空白（半角・全角・タブ等）のみかどうかで判定。
   *     3. 連続する空行は 1 行の空行としてまとめる。
   *     4. 先頭および末尾の空行は削除する。
   * - 結果として、非空行同士の間には最大 1 行の空行だけが存在する状態になる。
   *
   * @param {string} str 入力文字列
   * @returns {string} 行間が正規化された文字列
   */
  function gap(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    const lines = s.split("\n");
    const out = [];

    let prevWasContent = false; // 直前の出力行がコンテンツ行かどうか
    let pendingBlank = false; // 空行を 1 行だけ挿入すべき状態かどうか

    for (const line of lines) {
      // 空白（半角・全角・タブ類）のみで構成されているかどうか
      const isBlank = /^[\s\u3000]*$/.test(line);

      if (isBlank) {
        if (prevWasContent) {
          // 後続にコンテンツ行が来たら 1 行だけ空行を挿入するフラグ
          pendingBlank = true;
        }
        // 空行自体はここでは出力しない（後続コンテンツ行の直前でまとめて挿入）
        continue;
      }

      // ここに来るのはコンテンツ行のみ
      if (prevWasContent && pendingBlank) {
        out.push(""); // 空行 1 行を挿入
      }

      out.push(line);
      prevWasContent = true;
      pendingBlank = false;
    }

    return out.join("\n");
  }

  // ========================================================================
  // グローバルへの公開
  // ========================================================================

  /**
   * ブラウザ環境（ローカル HTML）専用想定:
   * - root は globalThis（≒ window）であり、TextUtils を直にぶら下げる。
   * - 他のスクリプトからは TextUtils.nl(...) などとして利用できる。
   */
  root.TextUtils = {
    nl: nl,
    hw: hw,
    lead: lead,
    clean: clean,
    rmBlank: rmBlank,
    squeeze: squeeze,
    trim: trim,
    gap: gap
  };
})(globalThis);
