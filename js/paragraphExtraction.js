// ファイル名例: paragraphExtraction.js

(function (root) {
  "use strict";

    /**
     * 特許テキスト中の「段落[００２７]」「段落[００９８]-[００９９]」「図１、６-８」などから
     * 段落番号・図番号を抽出し、重複排除→昇順→連番をまとめて返す。
     *
     * 返り値例:
     * (段落[００２７]、[００５３]-[００５４]、[００６１]、[００６５]-[００６７]、図１、６-８)
     */
    function extractParagraphAndFigureRefs(str) {
    // 0) 数字の全角⇔半角変換
    const toAsciiDigits = (s) => s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    const toFullwidthDigits = (s) => s.replace(/[0-9]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xFEE0));

    // 1) ハイフン/波ダッシュ類を「-」に寄せる（入力揺れ対策）
    const normalizeDash = (s) => s.replace(/[‐-‒–—−－〜～]/g, "-");

    // 2) Setに範囲を追加（a..b を展開）
    const addRange = (set, a, b) => {
        let start = a, end = b;
        if (Number.isNaN(start) || Number.isNaN(end)) return;
        if (start > end) [start, end] = [end, start];
        for (let i = start; i <= end; i++) set.add(i);
    };

    // 3) 連番をまとめる（例: 65,66,67 → [００６５]-[００６７]）
    const compressNumbers = (nums, fmtSingle, fmtRange) => {
        if (!nums.length) return [];
        nums.sort((a, b) => a - b);

        const out = [];
        let s = nums[0];
        let prev = nums[0];

        for (let i = 1; i < nums.length; i++) {
        const cur = nums[i];
        if (cur === prev + 1) {
            prev = cur;
            continue;
        }
        // ここで区切る
        out.push(s === prev ? fmtSingle(s) : fmtRange(s, prev));
        s = prev = cur;
        }
        out.push(s === prev ? fmtSingle(s) : fmtRange(s, prev));
        return out;
    };

    // ===== 段落抽出 =====
    const paragraphSet = new Set();
    let paragraphWidth = 0; // 桁数（[００２７]なら4）

    const LBR = "[\\[【]";
    const RBR = "[\\]】]";

    // (A) まず範囲 [xxxx]-[yyyy] を展開
    {
        const s = normalizeDash(str);
        const reRange = new RegExp(
            `${LBR}([0-9０-９]+)${RBR}\\s*-\\s*${LBR}([0-9０-９]+)${RBR}`,
            "g"
        );
        let m;
        while ((m = reRange.exec(s)) !== null) {
        const aRaw = m[1];
        const bRaw = m[2];
        paragraphWidth = Math.max(paragraphWidth, aRaw.length, bRaw.length);

        const a = parseInt(toAsciiDigits(aRaw), 10);
        const b = parseInt(toAsciiDigits(bRaw), 10);
        addRange(paragraphSet, a, b);
        }
    }

    // (B) 単独 [xxxx] も拾う（範囲の両端も拾うが、Setで重複排除される）
    {
        const s = normalizeDash(str);
        const reSingle = new RegExp(`${LBR}([0-9０-９]+)${RBR}`, "g");
        let m;
        while ((m = reSingle.exec(s)) !== null) {
        const raw = m[1];
        paragraphWidth = Math.max(paragraphWidth, raw.length);
        const n = parseInt(toAsciiDigits(raw), 10);
        if (!Number.isNaN(n)) paragraphSet.add(n);
        }
    }

    // 表示上は4桁ゼロ埋めを基本にする（入力が短くても [００２７] 形式に寄せる）
    const padWidth = Math.max(4, paragraphWidth);

    const paragraphNums = Array.from(paragraphSet);
    const paragraphParts = compressNumbers(
        paragraphNums,
        (n) => `[${toFullwidthDigits(String(n).padStart(padWidth, "0"))}]`,
        (a, b) =>
        `[${toFullwidthDigits(String(a).padStart(padWidth, "0"))}]-[${toFullwidthDigits(String(b).padStart(padWidth, "0"))}]`
    );

    // ===== 図抽出 =====
    const figSet = new Set();

    // 「図」の後ろの数列（例: 図１、６-８）を拾う
    {
        const reFigBlock = /図\s*([0-9０-９][0-9０-９\s、,，\-‐-‒–—−－〜～]*)/g;
        let m;
        while ((m = reFigBlock.exec(str)) !== null) {
        // 例: "１、６-８）" みたいに終端に余計な文字が付くので、許容文字以外を末尾から削る
        let block = m[1];
        block = normalizeDash(block);
        block = block.replace(/[^0-9０-９\s、,，\-]+$/g, ""); // 末尾の「）」等を除去

        const tokens = block.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);

        for (const tok0 of tokens) {
            let tok = normalizeDash(tok0).replace(/\s+/g, "");
            // さらに末尾の非数字を除去（安全策）
            tok = tok.replace(/[^0-9０-９\-]+$/g, "");

            const mRange = tok.match(/^([0-9０-９]+)\-([0-9０-９]+)$/);
            if (mRange) {
            const a = parseInt(toAsciiDigits(mRange[1]), 10);
            const b = parseInt(toAsciiDigits(mRange[2]), 10);
            addRange(figSet, a, b);
            } else {
            const n = parseInt(toAsciiDigits(tok), 10);
            if (!Number.isNaN(n)) figSet.add(n);
            }
        }
        }
    }

    const figNums = Array.from(figSet);
    const figParts = compressNumbers(
        figNums,
        (n) => toFullwidthDigits(String(n)),
        (a, b) => `${toFullwidthDigits(String(a))}-${toFullwidthDigits(String(b))}`
    );

    // ===== 出力整形 =====
    const parts = [];
    if (paragraphParts.length) parts.push(`段落${paragraphParts.join("、")}`);
    if (figParts.length) parts.push(`図${figParts.join("、")}`);

    return `(${parts.join("、")})`;
    }

    /* 動作例
    const s = "UEは、DCIを受信し（段落[００２７]、[００６５]、[００９８]-[００９９]、図１、６-８）...";
    console.log(extractParagraphAndFigureRefs(s));
    // → (段落[００２７]、[００６５]、[００９８]-[００９９]、図１、６-８) など
    */
   
  // ----------------------------------------
  // グローバルへのエクスポート
  // ----------------------------------------
  root.paragraphExtraction = {
    extractParagraphAndFigureRefs: extractParagraphAndFigureRefs,
  };
})(globalThis);
