/**
 * TextTransformer.js
 * ---------------------------------------------------------------------------
 * ローカル HTML 用テキスト変換ユーティリティ
 *
 * - root（globalThis）に TextTransformer クラスを公開する。
 * - splitLines / joinLines などのヘルパ関数はクロージャ内のプライベート実装。
 */

(function (root) {
  "use strict";

  // =========================
  // 基本ユーティリティ（非公開）
  // =========================

  // すべての改行 (\r\n, \r, \n) に対応して行に分割
  function splitLines(text) {
    return String(text).split(/\r\n|\r|\n/);
  }

  // 内部では \n で結合して返す
  function joinLines(lines) {
    return lines.join("\n");
  }

  // 文字列 or 配列 or null を配列に正規化
  function toArr(x) {
    if (x == null) return [];
    return Array.isArray(x) ? x : [x];
  }

  // F: 関数 or 関数配列
  function runF(str, F) {
    if (!F) return str;
    if (Array.isArray(F)) {
      return F.reduce(
        (s, fn) => (typeof fn === "function" ? fn(s) : s),
        str
      );
    }
    if (typeof F === "function") return F(str);
    return str;
  }

  // sep: 文字列 or 文字列配列
  function hasSep(str, sep) {
    const seps = toArr(sep);
    if (seps.length === 0) return false;
    return seps.some((s) => s && str.includes(s));
  }

  // 全角数字
  function fwNumChar(c) {
    const code = c.charCodeAt(0);
    if (code >= 0x30 && code <= 0x39) {
      // 0-9
      return String.fromCharCode(code - 0x30 + 0xff10); // ０-９
    }
    return c;
  }

  // 全角英数字
  function fwAlnumChar(c) {
    const code = c.charCodeAt(0);
    // 0-9
    if (code >= 0x30 && code <= 0x39) {
      return String.fromCharCode(code - 0x30 + 0xff10);
    }
    // A-Z
    if (code >= 0x41 && code <= 0x5a) {
      return String.fromCharCode(code - 0x41 + 0xff21);
    }
    // a-z
    if (code >= 0x61 && code <= 0x7a) {
      return String.fromCharCode(code - 0x61 + 0xff41);
    }
    return c;
  }

  // =========================
  // オブジェクト指向ラッパ
  // =========================

  class TextTransformer {
    constructor(text) {
      // 元テキストの行（インデックス探索用に保持）
      this._origLines = splitLines(text);
      // 編集用の行（ここに F を適用）
      this._lines = this._origLines.slice();
    }

    // 元テキストを再読み込み
    reset(text) {
      if (text !== undefined) {
        this._origLines = splitLines(text);
      }
      this._lines = this._origLines.slice();
      return this;
    }

    // 現在のテキストを取得
    toString() {
      return joinLines(this._lines);
    }

    // =====================
    // a より上（含む / 含まない）
    // a: 文字列 or 文字列[]
    // =====================

    aboveInc(a, F) {
      const marks = toArr(a);
      const n = this._lines.length;

      for (const m of marks) {
        if (m == null) continue;
        const idx = this._origLines.indexOf(m);
        if (idx < 0) continue;
        for (let i = 0; i <= idx && i < n; i++) {
          this._lines[i] = runF(this._lines[i], F);
        }
      }
      return this;
    }

    aboveExc(a, F) {
      const marks = toArr(a);
      const n = this._lines.length;

      for (const m of marks) {
        if (m == null) continue;
        const idx = this._origLines.indexOf(m);
        if (idx <= 0) continue; // 0 以下なら「上」がない
        for (let i = 0; i < idx && i < n; i++) {
          this._lines[i] = runF(this._lines[i], F);
        }
      }
      return this;
    }

    // =====================
    // a より下（含む / 含まない）
    // =====================

    belowInc(a, F) {
      const marks = toArr(a);
      const n = this._lines.length;

      for (const m of marks) {
        if (m == null) continue;
        const idx = this._origLines.indexOf(m);
        if (idx < 0 || idx >= n) continue;
        for (let i = idx; i < n; i++) {
          this._lines[i] = runF(this._lines[i], F);
        }
      }
      return this;
    }

    belowExc(a, F) {
      const marks = toArr(a);
      const n = this._lines.length;

      for (const m of marks) {
        if (m == null) continue;
        const idx = this._origLines.indexOf(m);
        if (idx < 0 || idx + 1 >= n) continue;
        for (let i = idx + 1; i < n; i++) {
          this._lines[i] = runF(this._lines[i], F);
        }
      }
      return this;
    }

    // =====================
    // a〜b の範囲（ペア）（含む / 含まない）
    // a, b: 文字列 or 文字列[]
    // a=[a1,a2,...], b=[b1,b2,...] のとき、
    // (a1,b1), (a2,b2), ... のペアごとに適用
    // =====================

    rangeInc(a, b, F) {
      const arrA = toArr(a);
      const arrB = toArr(b);
      const len = Math.min(arrA.length, arrB.length);
      const n = this._lines.length;

      for (let k = 0; k < len; k++) {
        const ma = arrA[k];
        const mb = arrB[k];
        if (ma == null || mb == null) continue;

        const ia = this._origLines.indexOf(ma);
        const ib = this._origLines.indexOf(mb);
        if (ia < 0 || ib < 0) continue;

        const s = Math.max(0, Math.min(ia, ib));
        const e = Math.min(n - 1, Math.max(ia, ib));

        for (let i = s; i <= e; i++) {
          this._lines[i] = runF(this._lines[i], F);
        }
      }
      return this;
    }

    rangeExc(a, b, F) {
      const arrA = toArr(a);
      const arrB = toArr(b);
      const len = Math.min(arrA.length, arrB.length);
      const n = this._lines.length;

      for (let k = 0; k < len; k++) {
        const ma = arrA[k];
        const mb = arrB[k];
        if (ma == null || mb == null) continue;

        const ia = this._origLines.indexOf(ma);
        const ib = this._origLines.indexOf(mb);
        if (ia < 0 || ib < 0) continue;

        let s = Math.min(ia, ib) + 1;
        let e = Math.max(ia, ib) - 1;

        if (s > e) continue;
        if (s < 0) s = 0;
        if (e >= n) e = n - 1;

        for (let i = s; i <= e; i++) {
          this._lines[i] = runF(this._lines[i], F);
        }
      }
      return this;
    }

    // =====================
    // 行頭が ch の行全体に F を適用
    // ch: 1文字想定
    // =====================

    head(ch, F) {
      const n = this._lines.length;
      for (let i = 0; i < n; i++) {
        const line = this._lines[i];
        if (line.startsWith(ch)) {
          this._lines[i] = runF(line, F);
        }
      }
      return this;
    }

    // =====================
    // mark 以降 + 区切りあり の場合だけ
    // 数字 / 英数字を全角化
    //
    // mark: 文字列 or 文字列[]
    // sep : 文字列 or 文字列[]
    // =====================

    fwNumMark(mark, sep) {
      const marks = toArr(mark);
      const n = this._lines.length;

      for (let i = 0; i < n; i++) {
        let line = this._lines[i];
        let bestPos = -1;
        let bestLen = 0;

        // 行内で一番手前に現れる mark を探す
        for (const m of marks) {
          if (!m) continue;
          const pos = line.indexOf(m);
          if (pos === -1) continue;

          if (bestPos === -1 || pos < bestPos) {
            bestPos = pos;
            bestLen = m.length;
          }
        }

        if (bestPos === -1) continue;

        const headPart = line.slice(0, bestPos + bestLen);
        const tailPart = line.slice(bestPos + bestLen);

        if (!hasSep(tailPart, sep)) continue;

        const convTail = tailPart.replace(/[0-9]/g, fwNumChar);
        this._lines[i] = headPart + convTail;
      }

      return this;
    }

    fwAlnumMark(mark, sep) {
      const marks = toArr(mark);
      const n = this._lines.length;

      for (let i = 0; i < n; i++) {
        let line = this._lines[i];
        let bestPos = -1;
        let bestLen = 0;

        for (const m of marks) {
          if (!m) continue;
          const pos = line.indexOf(m);
          if (pos === -1) continue;

          if (bestPos === -1 || pos < bestPos) {
            bestPos = pos;
            bestLen = m.length;
          }
        }

        if (bestPos === -1) continue;

        const headPart = line.slice(0, bestPos + bestLen);
        const tailPart = line.slice(bestPos + bestLen);

        if (!hasSep(tailPart, sep)) continue;

        const convTail = tailPart.replace(/[0-9A-Za-z]/g, fwAlnumChar);
        this._lines[i] = headPart + convTail;
      }

      return this;
    }

    // =====================
    // 便利な static ラッパ関数
    // （関数スタイルで使いたい場合）
    // =====================

    static aboveInc(text, a, F) {
      return new TextTransformer(text).aboveInc(a, F).toString();
    }

    static aboveExc(text, a, F) {
      return new TextTransformer(text).aboveExc(a, F).toString();
    }

    static belowInc(text, a, F) {
      return new TextTransformer(text).belowInc(a, F).toString();
    }

    static belowExc(text, a, F) {
      return new TextTransformer(text).belowExc(a, F).toString();
    }

    static rangeInc(text, a, b, F) {
      return new TextTransformer(text).rangeInc(a, b, F).toString();
    }

    static rangeExc(text, a, b, F) {
      return new TextTransformer(text).rangeExc(a, b, F).toString();
    }

    static head(text, ch, F) {
      return new TextTransformer(text).head(ch, F).toString();
    }

    static fwNumMark(text, mark, sep) {
      return new TextTransformer(text).fwNumMark(mark, sep).toString();
    }

    static fwAlnumMark(text, mark, sep) {
      return new TextTransformer(text).fwAlnumMark(mark, sep).toString();
    }
  }

  // グローバル公開（ローカル HTML 専用）
  root.TextTransformer = TextTransformer;
})(globalThis);
