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

    // ------------------------------------------------------------
    // 共通ヘルパ（ASCII / 全角 ASCII 判定用）
    // ------------------------------------------------------------

    /** 全角と半角 ASCII のオフセット差分（'A' → 'Ａ' など） */
    const FW_OFFSET = 0xfee0;
    /** 半角スペース ' ' */
    const HW_SPACE = 0x0020;
    /** 全角スペース '　' */
    const FW_SPACE = 0x3000;

    /**
     * 半角 ASCII 数字判定 ('0'〜'9')
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isAsciiDigit(code) {
    return code >= 0x30 && code <= 0x39;
    }

    /**
     * 半角 ASCII 英字判定 ('A'〜'Z', 'a'〜'z')
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isAsciiAlpha(code) {
    return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
    }

    /**
     * 半角 ASCII 英数字判定
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isAsciiAlnum(code) {
    return isAsciiDigit(code) || isAsciiAlpha(code);
    }

    /**
     * 半角 ASCII 記号判定
     * - 対象: '!'(0x21)〜'~'(0x7E) のうち、英数字以外
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isAsciiSymbol(code) {
    return code >= 0x21 && code <= 0x7e && !isAsciiAlnum(code);
    }

    /**
     * 全角数字判定（'０'〜'９'）
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isFwDigit(code) {
    return code >= 0xff10 && code <= 0xff19;
    }

    /**
     * 全角英字判定（'Ａ'〜'Ｚ', 'ａ'〜'ｚ'）
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isFwAlpha(code) {
    return (code >= 0xff21 && code <= 0xff3a) || (code >= 0xff41 && code <= 0xff5a);
    }

    /**
     * 全角英数字判定
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isFwAlnum(code) {
    return isFwDigit(code) || isFwAlpha(code);
    }

    /**
     * 全角記号判定
     * - 対象: '！'(0xFF01)〜'～'(0xFF5E) のうち、英数字以外
     * @param {number} code charCode
     * @returns {boolean}
     */
    function isFwSymbol(code) {
    return code >= 0xff01 && code <= 0xff5e && !isFwAlnum(code);
    }

    // ------------------------------------------------------------
    // 1) 文字列中の「数字のみ」を全角／半角に
    // ------------------------------------------------------------

    /**
     * 文字列中の「数字」だけを全角に変換する。
     *
     * - 対象: 半角 '0'〜'9'
     * - 既に全角数字（'０'〜'９'）の部分はそのまま。
     * - 数字以外（英字・記号・日本語など）は一切変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 数字だけが全角化された文字列
     */
    function fwNum(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isAsciiDigit(code)) {
        // 半角数字 → 全角数字
        out += String.fromCharCode(code + FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    /**
     * 文字列中の「数字」だけを半角に変換する。
     *
     * - 対象: 全角 '０'〜'９'
     * - 既に半角数字（'0'〜'9'）の部分はそのまま。
     * - 数字以外（英字・記号・日本語など）は一切変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 数字だけが半角化された文字列
     */
    function hwNum(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isFwDigit(code)) {
        // 全角数字 → 半角数字
        out += String.fromCharCode(code - FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    // ------------------------------------------------------------
    // 2) 文字列中の「記号のみ」を全角／半角に
    // ------------------------------------------------------------

    /**
     * 文字列中の「記号」だけを全角に変換する。
     *
     * - 対象: 半角 ASCII 記号（'!'〜'~' のうち英数字以外）
     * - 既に全角記号（'！'〜'～' のうち英数字以外）はそのまま。
     * - 英数字や日本語などは一切変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 記号だけが全角化された文字列
     */
    function fwSym(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isAsciiSymbol(code)) {
        // 半角記号 → 全角記号
        out += String.fromCharCode(code + FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    /**
     * 文字列中の「記号」だけを半角に変換する。
     *
     * - 対象: 全角 ASCII 記号（'！'〜'～' のうち英数字以外）
     * - 既に半角記号（'!'〜'~' のうち英数字以外）はそのまま。
     * - 英数字や日本語などは一切変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 記号だけが半角化された文字列
     */
    function hwSym(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isFwSymbol(code)) {
        // 全角記号 → 半角記号
        out += String.fromCharCode(code - FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    // ------------------------------------------------------------
    // 3) 文字列中の「英字のみ」を全角／半角に
    // ------------------------------------------------------------

    /**
     * 文字列中の「英字」だけを全角に変換する。
     *
     * - 対象: 半角 'A'〜'Z', 'a'〜'z'
     * - 既に全角英字（'Ａ'〜'Ｚ', 'ａ'〜'ｚ'）はそのまま。
     * - 英字以外（数字・記号・日本語など）は変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 英字だけが全角化された文字列
     */
    function fwAlpha(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isAsciiAlpha(code)) {
        // 半角英字 → 全角英字
        out += String.fromCharCode(code + FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    /**
     * 文字列中の「英字」だけを半角に変換する。
     *
     * - 対象: 全角 'Ａ'〜'Ｚ', 'ａ'〜'ｚ'
     * - 既に半角英字（'A'〜'Z', 'a'〜'z'）はそのまま。
     * - 英字以外（数字・記号・日本語など）は変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 英字だけが半角化された文字列
     */
    function hwAlpha(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isFwAlpha(code)) {
        // 全角英字 → 半角英字
        out += String.fromCharCode(code - FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    // ------------------------------------------------------------
    // 4) 文字列中の「英数字のみ」を全角／半角に
    // ------------------------------------------------------------

    /**
     * 文字列中の「英数字」だけを全角に変換する。
     *
     * - 対象: 半角英数字 ('0'〜'9', 'A'〜'Z', 'a'〜'z')
     * - 既に全角英数字（'０'〜'９', 'Ａ'〜'Ｚ', 'ａ'〜'ｚ'）はそのまま。
     * - 英数字以外（記号・日本語など）は変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 英数字だけが全角化された文字列
     */
    function fwAlnum(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isAsciiAlnum(code)) {
        // 半角英数字 → 全角英数字
        out += String.fromCharCode(code + FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    /**
     * 文字列中の「英数字」だけを半角に変換する。
     *
     * - 対象: 全角英数字（'０'〜'９', 'Ａ'〜'Ｚ', 'ａ'〜'ｚ'）
     * - 既に半角英数字（'0'〜'9', 'A'〜'Z', 'a'〜'z'）はそのまま。
     * - 英数字以外（記号・日本語など）は変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 英数字だけが半角化された文字列
     */
    function hwAlnum(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (isFwAlnum(code)) {
        // 全角英数字 → 半角英数字
        out += String.fromCharCode(code - FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    // ------------------------------------------------------------
    // 5) 文字列中の「全ての文字」を全角／半角に
    // ------------------------------------------------------------

    /**
     * 文字列中の「変換可能な全ての ASCII 文字」を全角に変換する。
     *
     * - 対象:
     *   - 半角スペース ' ' → 全角スペース '　'
     *   - 半角 ASCII（'!'〜'~'）→ 対応する全角 ASCII（'！'〜'～'）
     *     （英数字・記号をまとめて全角化）
     * - 日本語（ひらがな・カタカナ・漢字など）は変更しない。
     *
     * @param {string} str 入力文字列
     * @returns {string} 可能な限り全角に寄せた文字列
     */
    function fw(str) {
    if (str == null || str === "") return "";
    const s = String(str);
    let out = "";

    for (const ch of s) {
        const code = ch.charCodeAt(0);

        if (code === HW_SPACE) {
        // 半角スペース → 全角スペース
        out += String.fromCharCode(FW_SPACE);
        } else if (code >= 0x21 && code <= 0x7e) {
        // 半角 ASCII（英数字＋記号）→ 全角 ASCII
        out += String.fromCharCode(code + FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out.replace(/[－＜＞［］／　]/g, c => ({
                                "－": "-",
                                "＜": "<",
                                "＞": ">",
                                "［": "[",
                                "］": "]",
                                "／": "/",
                                "　": " "
                                }[c] || c));

    }

    /**
     * 文字列中の「変換可能な全ての文字」を半角に変換する。
     *
     * - 仕様は質問にある hw 関数と同じ方針：
     *   - まず Unicode NFKC 正規化で互換文字を可能な範囲で半角側へ寄せる。
     *   - その後、全角 ASCII（'！'〜'～'）と全角スペースを明示的に半角へ変換。
     * - カナなど一部の文字は NFKC により形が変わる／結合される点に注意。
     *
     * @param {string} str 入力文字列
     * @returns {string} 可能な限り半角に寄せた文字列
     */
    function hw(str) {
    if (str == null || str === "") return "";
    let s = String(str);

    // NFKC 正規化（利用可能な環境のみ）
    if (typeof s.normalize === "function") {
        try {
        s = s.normalize("NFKC");
        } catch (_e) {
        // normalize が失敗した場合はフォールバックのみで対応
        }
    }

    const FW_START = 0xff01; // 全角 '！'
    const FW_END = 0xff5e;   // 全角 '～'

    let out = "";
    for (const ch of s) {
        const code = ch.charCodeAt(0);
        if (code === FW_SPACE) {
        // 全角スペース → 半角スペース
        out += " ";
        } else if (code >= FW_START && code <= FW_END) {
        // 全角 ASCII → 半角 ASCII
        out += String.fromCharCode(code - FW_OFFSET);
        } else {
        out += ch;
        }
    }
    return out;
    }

    /**
     * 改行コードを統一する
     *
     * - CRLF ("\r\n"), CR ("\r"), LF ("\n") のすべてを "\n" に統一する。
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
     * すべての文字列：全角を半角へ変換する
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
     * 配列化を \n で結合して文字列に戻す
     * @param {string[]} lines
     * @returns {string}
     */
    function joinLines(lines) {
        return lines.join("\n");
    }

    /**
     * すべての改行コード (\r\n, \r, \n) を \n に正規化して配列化
     * @param {string} str
     * @returns {string[]}
     */
    function splitLines(str) {
        // str = nl(ss(str));
        return String(str).split(/\r\n|\r|\n/);
    }

    function ss(str){ if (str == null || str === "") return [""]; }

    // 基本  // str = nl(ss(str)); // 初期化

  root.Std = {
    ss: ss,                     // 初期化
    nl: nl,                     // 改行コードを統一する
    joinLines: joinLines,       // 配列化を \n で結合して文字列に戻す
    splitLines: splitLines,     // すべての改行コード (\r\n, \r, \n) を \n に正規化して配列化
    fwNum: fwNum,               // strのすべての数字のみを全角にする関数
    hwNum: hwNum,               // strのすべての数字のみを半角にする関数
    fwSym: fwSym,               // strのすべての記号のみを全角にする関数
    hwSym: hwSym,               // strのすべての記号のみを半角にする関数
    fwAlpha: fwAlpha,           // strのすべての英字のみを全角にする関数
    hwAlpha: hwAlpha,           // strのすべての英字のみを半角にする関数
    fwAlnum: fwAlnum,           // strのすべての英数字のみを全角にする関数
    hwAlnum: hwAlnum,           // strのすべての英数字のみを半角にする関数
    fw: fw,                     // strのすべての全ての文字を全角にする関数
    hw: hw,                     // strのすべての全ての文字を半角にする関数
  };
})(globalThis);
