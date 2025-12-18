(function (root) {
  "use strict";

  /**
   * patTextOps.js
   * ------------------------------------------------------------------------
   * 特許文書向けテキスト整形ユーティリティ（拡張性重視・過剰変換抑制版）
   *
   * 【設計の要点】
   * 1) 正規表現は “複数行リテラル” や “/x のような非対応フラグ” を使わない。
   *    - JS は /x（free-spacing）をサポートしないため、読みやすさのために
   *      「改行・空白を混ぜたリテラル」を書くと、構文エラー/マッチ不整合を招く。
   *    - 代わりに “パーツ配列” で組み立て、RegExp() で生成する。
   *
   * 2) 全角化は “必要な箇所だけ” を狙う（過剰変換しない）。
   *    - IEEE802.11 / WPA-PSK のような技術用語トークンは保護して維持する。
   *
   * 3) fwHead のデフォルトは "head"（見出しマークのみ変換）にする。
   *    - ドット箇条書き行を勝手に fw(line) しない（全角化バグの主因を潰す）。
   * ------------------------------------------------------------------------
   */

  // ======================================================================
  // 依存（Std）
  // ======================================================================

  var Std = root.Std || null;
  if (!Std) {
    // eslint-disable-next-line no-console
    console.warn("patTextOps.js: root.Std が見つかりません。Std を先に読み込んでください。");
    return;
  }

  var joinLines = Std.joinLines;
  var splitLines = Std.splitLines;
  var fwNum = Std.fwNum;     // 数字のみ全角化
  var fwAlnum = Std.fwAlnum; // 英数字を全角化

  // ======================================================================
  // 内部ユーティリティ
  // ======================================================================

  /**
   * 空行判定：空白類のみなら空行
   * @param {string} line
   * @returns {boolean}
   */
  function isBlankLine(line) {
    return /^[ \t\r\n\f\v\u3000]*$/.test(String(line || ""));
  }

  /**
   * すべての空白文字（半角/全角スペース、タブ、改行等）を削除
   * @param {string} s
   * @returns {string}
   */
  function removeWS(s) {
    return String(s || "").replace(/[ \u3000\t\r\n\v\f]+/g, "");
  }

  /**
   * padLeftZero（左ゼロ詰め）
   * - ゼロは半角 "0" を使用（後段で fwNum する運用が多く、ここで全角にしない）
   * @param {number|string} y
   * @param {number} n
   * @returns {string}
   */
  function padLeftZero(y, n) {
    n = Math.floor(Number(n));
    if (!isFinite(n) || n <= 0) return String(y);

    var s = String(y);
    var sign = "";
    if (s.charAt(0) === "-" || s.charAt(0) === "+") {
      sign = s.charAt(0);
      s = s.slice(1);
    }
    if (s.length >= n) return sign + s;

    if (typeof String.prototype.padStart === "function") {
      return sign + s.padStart(n, "0");
    }
    var zeros = new Array(n - s.length + 1).join("0");
    return sign + zeros + s;
  }

  /**
   * 正規表現用エスケープ
   * @param {string} s
   * @returns {string}
   */
  function escapeForRegExp(s) {
    return String(s || "").replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  /**
   * RegExp.flags が無い環境向け：フラグ文字列を復元
   * @param {RegExp} re
   * @returns {string}
   */
  function getRegExpFlags(re) {
    if (re.flags != null) return re.flags;
    var f = "";
    if (re.global) f += "g";
    if (re.ignoreCase) f += "i";
    if (re.multiline) f += "m";
    if (re.unicode) f += "u";
    if (re.sticky) f += "y";
    if (re.dotAll) f += "s";
    return f;
  }

  /**
   * 「必ず global で置換したい」用途のため、g フラグを強制付与して複製
   * @param {RegExp} re
   * @returns {RegExp}
   */
  function ensureGlobal(re) {
    var flags = getRegExpFlags(re);
    if (flags.indexOf("g") === -1) flags += "g";
    return new RegExp(re.source, flags);
  }

  // ======================================================================
  // 過剰変換防止：技術用語トークン保護
  // ======================================================================

  /**
   * 変換から除外したい “技術用語トークン” の既定セット
   * - 追加したい場合は root.patTextOpsConfig.keepTechReList で拡張できる。
   * @type {RegExp[]}
   */
  var DEFAULT_KEEP_TECH_RE_LIST = [
    /IEEE\s*802\.\d+(?:\.\d+)*(?:[a-z])?/gi,
    /\b802\.\d+(?:\.\d+)*(?:[a-z])?\b/gi,
    /\bWPA(?:\d+)?-PSK\b/gi,
    /\b[A-Z]{2,}(?:[0-9]{0,3})?(?:[-\/][A-Z0-9]{2,})+\b/g,
    /\bWi-?Fi\b/gi
  ];

  /**
   * 正規表現リストに一致する箇所を番兵に置換して保護
   * @param {string} text
   * @param {RegExp[]} reList
   * @returns {{ text: string, map: string[] }}
   */
  function protectByRegexList(text, reList) {
    var out = String(text || "");
    var map = [];

    for (var i = 0; i < reList.length; i++) {
      var re = ensureGlobal(reList[i]);
      out = out.replace(re, function (m) {
        var idx = map.length;
        map.push(m);
        // Private Use Area を番兵として使用（通常入力に現れにくい）
        return "\uE000" + idx + "\uE001";
      });
    }
    return { text: out, map: map };
  }

  /**
   * 番兵を元に戻す
   * @param {string} text
   * @param {string[]} map
   * @returns {string}
   */
  function restoreProtected(text, map) {
    return String(text || "").replace(/\uE000(\d+)\uE001/g, function (_m, n) {
      var idx = Number(n);
      return map && map[idx] != null ? map[idx] : _m;
    });
  }

  /**
   * 技術トークン保護付きで変換関数を適用
   * @param {string} text
   * @param {(s:string)=>string} fn
   * @param {RegExp[]} keepList
   * @returns {string}
   */
  function applyWithTechProtection(text, fn, keepList) {
    var p = protectByRegexList(text, keepList);
    var changed = fn(p.text);
    return restoreProtected(changed, p.map);
  }

  // ======================================================================
  // 設定（拡張ポイント）
  // ======================================================================

  /**
   * 呼び出し側で拡張できる設定
   * 例）
   *   root.patTextOpsConfig = {
   *     dotMarks: ["・","●",...],
   *     heading: { maxDigits: 2, maxDepth: 3, alphaMax: 2 },
   *     keepTechReList: [ /.../g, ... ]
   *   };
   */
  var CFG = root.patTextOpsConfig || {};

  // ======================================================================
  // 箇条書き・見出し判定（RegExp ビルダー方式）
  // ======================================================================

  /**
   * ドット箇条書き候補
   * @type {string[]}
   */
  var DOT_MARKS = Array.isArray(CFG.dotMarks) && CFG.dotMarks.length
    ? CFG.dotMarks.slice()
    : ["・", "●", "○", "◆", "◇", "■", "□"];


    
  /**
   * tightBelowBullet 用に “形状で扱う” 記号
   * @type {string[]}
   */
  var DASH_AND_ANGLE_MARKS = ["-", "<"];

  /**
   * 見出しマーク用 RegExp を生成する（拡張性重視）
   *
   * - JS には /x が無いので「読みやすい複数行リテラル」を使わない。
   * - パターン要素を parts[] に積み、最後に join("|") して RegExp を作る。
   *
   * @param {{maxDigits?:number, maxDepth?:number, alphaMax?:number}} opts
   * @returns {RegExp} ^([空白])([見出しマーク])
   */
  function buildHeadingMarkRe(opts) {
    opts = opts || {};
    var maxDigits = Number(opts.maxDigits);
    var maxDepth = Number(opts.maxDepth);
    var alphaMax = Number(opts.alphaMax);

    // デフォルト（実務での誤爆を避ける安全側）
    if (!isFinite(maxDigits) || maxDigits <= 0) maxDigits = 2; // 1〜2桁
    if (!isFinite(maxDepth) || maxDepth < 0) maxDepth = 3;    // 1.2.3 くらいまで
    if (!isFinite(alphaMax) || alphaMax <= 0) alphaMax = 2;    // A / AB 程度

    // 過度に広げると誤爆しやすいので上限を設ける（保守しやすさ）
    if (maxDigits > 4) maxDigits = 4;
    if (maxDepth > 6) maxDepth = 6;
    if (alphaMax > 4) alphaMax = 4;

    var SP0 = "[ \\u3000]*";
    var NUM = "[0-9０-９]";
    var ALPHA = "[A-Za-zＡ-Ｚａ-ｚ]";
    var OPEN_P = "[\\(\\（]";
    var CLOSE_P = "[\\)\\）]";
    var DOT = "[\\.．]";
    var CLOSE_ONLY = "[\\)\\）]";

    // “番号チェーン” (例: 8 / 8.2 / 8.2.3)
    var seg = NUM + "{1," + maxDigits + "}";
    var chain = seg + "(?:" + DOT + seg + "){0," + maxDepth + "}";

    // 数字が単独で来るケースは “後続が区切り” のときだけ拾う（誤爆抑制）
    var delimAfterNum = "(?:[\\s\\u3000]|$|[、,，．。\\.：:;；\\)\\）])";

    // 「第1」系は “後続がそれっぽい語” のときだけ拾う
    var suffixAfterDai = "(?:[\\s\\u3000]|$|[、,，．。\\.：:;；]|[章節条項号編部款頁回図表])";

    var parts = [];

    // (1) (1) / （１）
    parts.push(OPEN_P + seg + CLOSE_P);

    // (2) (A) / （AB）
    parts.push(OPEN_P + ALPHA + "{1," + alphaMax + "}" + CLOSE_P);

    // (3) 1. / 1.2. / 1.2.3.
    parts.push(chain + DOT);

    // (4) 1) / 2） など
    parts.push(seg + CLOSE_ONLY);

    // (5) A. / AB.
    parts.push(ALPHA + "{1," + alphaMax + "}" + DOT);

    // (6) A) / AB）
    parts.push(ALPHA + "{1," + alphaMax + "}" + CLOSE_ONLY);

    // (7) 1 / 1.2.3（ただし後続が区切りのとき）
    parts.push(chain + "(?=" + delimAfterNum + ")");

    // (8) 第1（ただし後続が章/節/条等に続く “らしい” とき）
    parts.push("第" + seg + "(?=" + suffixAfterDai + ")");

    var inner = "(?:" + parts.join("|") + ")";

    // キャプチャ方針：
    //  m[1] = 行頭空白（半角/全角）
    //  m[2] = 見出しマーク本体
    return new RegExp("^(" + SP0 + ")(" + inner + ")");
  }

  /**
   * DOT_MARKS から “行頭ドット箇条書き” 判定用 RegExp を生成
   * @param {string[]} marks
   * @returns {RegExp}
   */
  function buildDotBulletRe(marks) {
    var cls = (marks || []).map(escapeForRegExp).join("");
    return new RegExp("^[ \\u3000]*([" + cls + "])");
  }

  // 見出しマーク判定（拡張可能）
  var HEADING_MARK_RE = buildHeadingMarkRe(CFG.heading || {});

  // tightBelowBullet 用（● を除外したい運用がある場合の互換）
  var DOT_MARKS_FOR_TIGHT = DOT_MARKS.filter(function (ch) { return ch !== "●"; });
  var DOT_BULLET_RE_FOR_TIGHT = buildDotBulletRe(DOT_MARKS_FOR_TIGHT);

  // - / < の行頭判定
  var DASH_ANGLE_RE = new RegExp("^[ \\u3000]*([" + DASH_AND_ANGLE_MARKS.map(escapeForRegExp).join("") + "])");

  // 技術トークン保護リスト（設定で追加可能）
  var KEEP_TECH_RE_LIST = (function () {
    var extra = Array.isArray(CFG.keepTechReList) ? CFG.keepTechReList : [];
    return DEFAULT_KEEP_TECH_RE_LIST.concat(extra);
  })();

  // ======================================================================
  // 1. 空白挿入（先頭）
  // ======================================================================

  /**
   * 行頭に “全角スペース” を count 個挿入
   * @param {string} str
   * @param {number} [count=1]
   * @returns {string}
   */
  function padHead(str, count) {
    var lines = splitLines(String(str || ""));
    var c = typeof count === "number" && count > 0 ? count : 1;
    var pad = new Array(c + 1).join("　");
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === "") continue;
      lines[i] = pad + lines[i];
    }
    return joinLines(lines);
  }

  // ======================================================================
  // 2. 空白削除（条件付き）
  // ======================================================================

  /**
   * 行頭空白を条件付きで削除
   * @param {string} str
   * @param {string|string[]} [mode] 未指定なら ["dot","head","lt"]
   * @returns {string}
   */
  function trimHead(str, mode) {
    var lines = splitLines(String(str || ""));
    var modes;

    if (mode == null) {
      modes = ["dot", "head", "lt"];
    } else if (Array.isArray(mode)) {
      modes = mode.slice();
    } else {
      modes = [mode];
    }

    var useAll = modes.indexOf("all") !== -1;
    var useDot = modes.indexOf("dot") !== -1;
    var useHead = modes.indexOf("head") !== -1;
    var useLt = modes.indexOf("lt") !== -1;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (useAll) {
        lines[i] = line.replace(/^[ \t\u3000]+/, "");
        continue;
      }

      var trimmed = line;

      if (useDot && /^[ \u3000]/.test(trimmed)) {
        for (var d = 0; d < DOT_MARKS.length; d++) {
          var mark = DOT_MARKS[d];
          if (trimmed.indexOf(" " + mark) === 0 || trimmed.indexOf("　" + mark) === 0) {
            trimmed = trimmed.slice(1);
            break;
          }
        }
      }

      if (useHead && /^[ \u3000]/.test(trimmed) && HEADING_MARK_RE.test(trimmed.slice(1))) {
        trimmed = trimmed.slice(1);
      }

      if (useLt && (trimmed.indexOf(" <") === 0 || trimmed.indexOf("　<") === 0)) {
        trimmed = trimmed.slice(1);
      }
      if (useLt && (trimmed.indexOf(" -") === 0 || trimmed.indexOf("　-") === 0)) {
        trimmed = trimmed.slice(1);
      }

      lines[i] = trimmed;
    }

    return joinLines(lines);
  }

  // ======================================================================
  // 10. 箇条書き直下の空行削除
  // ======================================================================

  /**
   * 箇条書き行の直下が空行なら、その空行を1行だけ削除
   * @param {string} str
   * @param {"dot"|"head"|"both"} [mode="both"]
   * @returns {string}
   */
  function tightBelowBullet(str, mode) {
    var lines = splitLines(String(str || ""));
    var n = lines.length;
    var m = mode || "both";
    var useDot = m === "both" || m === "dot";
    var useHead = m === "both" || m === "head";

    var out = [];
    var i = 0;

    while (i < n) {
      var line = lines[i];
      out.push(line);

      var isDotBullet = useDot && DOT_BULLET_RE_FOR_TIGHT.test(line);
      var isHeadBullet = useHead && HEADING_MARK_RE.test(line);
      var isDashOrAngle = DASH_ANGLE_RE.test(line);

      if ((isDotBullet || isHeadBullet || isDashOrAngle) && i + 1 < n) {
        if (isBlankLine(lines[i + 1])) {
          i += 2;
          continue;
        }
      }
      i += 1;
    }

    return joinLines(out);
  }

  // ======================================================================
  // 3. 全角化（条件付き）
  // ======================================================================

  /**
   * 見出し・箇条書き条件に応じて全角化
   *
   * 重要：
   * - デフォルトは "head"（見出しマークのみ変換）
   * - "dot"/"both" で行全体 fw() をする場合でも、技術トークンは保護して戻す
   *
   * @param {string} str
   * @param {"head"|"dot"|"both"} [mode="head"]
   * @returns {string}
   */
  function fwHead(str) {
    var lines = splitLines(String(str || ""));
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === "") continue;
        var mh = HEADING_MARK_RE.exec(line);
        if (mh) {
          var pre = mh[1];
          var mark = mh[2];
          var after = line.slice(pre.length + mark.length);
          lines[i] = pre + fwAlnum(mark) + after;
        }
    }

    return fwLineStartsWithSmallDot(fwLineStartsWithBlackDot(joinLines(lines)));
  }

  /**
   * 行頭が「●」で始まる行だけを全角化する
   * - 「文頭」とは「文字列先頭」または「改行 \n の直後」を指す（= 行の先頭 ^）。
   * - 行頭に空白がある「　●...」「 ●...」は対象外（※必要なら後で拡張可能）。
   * - 変換は Std.fw（文字列全体を全角化する関数）に委譲する想定。
   *
   * @param {string} str 入力文字列
   * @returns {string} 「●」行のみ全角化された文字列
   */
  function fwLineStartsWithBlackDot(str) {
    var s = String(str || "");
    var fw = root.Std && root.Std.fw ? root.Std.fw : null;
    var splitLines = root.Std && root.Std.splitLines ? root.Std.splitLines : null;
    var joinLines = root.Std && root.Std.joinLines ? root.Std.joinLines : null;

    if (!fw || !splitLines || !joinLines) {
      // Std が無い場合は安全側でそのまま返す
      return s;
    }

    var lines = splitLines(s);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line && line.charAt(0) === "●") {
        lines[i] = fw(line);
      }
    }
    return joinLines(lines);
  }
  function fwLineStartsWithSmallDot(str) {
    var s = String(str || "");
    var fw = root.Std && root.Std.fw ? root.Std.fw : null;
    var splitLines = root.Std && root.Std.splitLines ? root.Std.splitLines : null;
    var joinLines = root.Std && root.Std.joinLines ? root.Std.joinLines : null;

    if (!fw || !splitLines || !joinLines) {
      // Std が無い場合は安全側でそのまま返す
      return s;
    }

    var lines = splitLines(s);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line && line.charAt(0) === "・") {
        lines[i] = fw(line);
      }
    }
    return joinLines(lines);
  }

  // ======================================================================
  // 5. 番号全角化（条文番号など）
  // ======================================================================

  /**
   * 条文系番号を全角化（過剰変換抑制）
   * @param {string} str
   * @returns {string}
   */
  function fwNumLaw(str) {
    var s = String(str || "");
    var DIGS_WS = "[0-9０-９\\s\\u3000]+";

    // 第◯条の◯第◯項第◯号
    s = s.replace(new RegExp("第(" + DIGS_WS + ")条の(" + DIGS_WS + ")第(" + DIGS_WS + ")項第(" + DIGS_WS + ")号", "g"),
      function (_all, j, n, k, g) {
        j = removeWS(j); n = removeWS(n); k = removeWS(k); g = removeWS(g);
        return "第" + fwNum(j) + "条の" + fwNum(n) + "第" + fwNum(k) + "項第" + fwNum(g) + "号";
      }
    );

    // 第◯条の◯第◯項
    s = s.replace(new RegExp("第(" + DIGS_WS + ")条の(" + DIGS_WS + ")第(" + DIGS_WS + ")項", "g"),
      function (_all, j, n, k) {
        j = removeWS(j); n = removeWS(n); k = removeWS(k);
        return "第" + fwNum(j) + "条の" + fwNum(n) + "第" + fwNum(k) + "項";
      }
    );

    // 第◯条の◯
    s = s.replace(new RegExp("第(" + DIGS_WS + ")条の(" + DIGS_WS + ")", "g"),
      function (_all, j, n) {
        j = removeWS(j); n = removeWS(n);
        return "第" + fwNum(j) + "条の" + fwNum(n);
      }
    );

    // 第◯条第◯項第◯号
    s = s.replace(new RegExp("第(" + DIGS_WS + ")条第(" + DIGS_WS + ")項第(" + DIGS_WS + ")号", "g"),
      function (_all, j, k, g) {
        j = removeWS(j); k = removeWS(k); g = removeWS(g);
        return "第" + fwNum(j) + "条第" + fwNum(k) + "項第" + fwNum(g) + "号";
      }
    );

    // 第◯条第◯項
    s = s.replace(new RegExp("第(" + DIGS_WS + ")条第(" + DIGS_WS + ")項", "g"),
      function (_all, j, k) {
        j = removeWS(j); k = removeWS(k);
        return "第" + fwNum(j) + "条第" + fwNum(k) + "項";
      }
    );

    // PCT第◯条（出力は ＰＣＴ に統一）
    s = s.replace(new RegExp("(?:PCT|ＰＣＴ)第(" + DIGS_WS + ")条", "g"),
      function (_all, j) {
        j = removeWS(j);
        return "ＰＣＴ第" + fwNum(j) + "条";
      }
    );

    // 第◯条
    s = s.replace(new RegExp("第(" + DIGS_WS + ")条", "g"),
      function (_all, j) {
        j = removeWS(j);
        return "第" + fwNum(j) + "条";
      }
    );

    // 特許法施行規則様式第◯備考◯、◯
    s = s.replace(/特許法施行規則様式第([0-9０-９\s\u3000]+)備考([0-9０-９\s\u3000、,，]+)/g,
      function (_all, j, n) {
        j = removeWS(j); n = removeWS(n);
        return "特許法施行規則様式第" + fwNum(j) + "備考" + fwNum(n);
      }
    );

    // 第◯節/頁/章（英数字）
    s = s.replace(/第([0-9０-９A-Za-zＡ-Ｚａ-ｚ\.．\s\u3000]+)(節|頁|章)/g,
      function (_all, j, suffix) {
        j = removeWS(j);
        return "第" + fwAlnum(j) + suffix;
      }
    );

    // JPGL第◯部
    s = s.replace(/(?:JPGL|ＪＰＧＬ)第([0-9０-９A-Za-zＡ-Ｚａ-ｚ\.．\s\u3000]+)(部)/g,
      function (_all, j, suffix) {
        j = removeWS(j);
        return "ＪＰＧＬ第" + fwAlnum(j) + suffix;
      }
    );

    // 令和YY年MM月DD日
    s = s.replace(/令和([0-9０-９\s\u3000]+)年([0-9０-９\s\u3000]+)月([0-9０-９\s\u3000]+)日/g,
      function (_all, y, m, d) {
        y = padLeftZero(removeWS(y).trim(), 2);
        m = padLeftZero(removeWS(m).trim(), 2);
        d = padLeftZero(removeWS(d).trim(), 2);
        return "令和" + fwNum(y) + "年" + fwNum(m) + "月" + fwNum(d) + "日";
      }
    );

    // キーワード後続番号列：先頭が数字で始まる列のみ（WPA-PSK 等を誤爆させない）
    // -------------------------------
    // 共通定義
    // -------------------------------
    var KEYWORDS_REF_NC   = "(?:引用文献|文献|段落|図|式)";
    var KEYWORDS_CLAIM_NC = "(?:相違点|主張|上記|前記|請求項)";
    var PARTICLE = "(?:は|が|を|に|へ|と|で|の|から|まで|より)";

    var DIG   = "[0-9０-９]";
    var ALPHA = "[A-Za-zＡ-Ｚａ-ｚ]";

    // -------------------------------
    // REF側：[]/【】OK、()（）NG
    // -------------------------------
    // REF側：[]/【】OK、()（）NG
    // - ただし「引用文献1（説明）」のように “説明の丸括弧” が続くのは許可
    // - 「図1(2)」「図1 （2）」「図1(A)」のように “丸括弧＋英数字” が続く場合は部分マッチを防ぐ
    var TOKEN_REF =
      "(?:" +
        DIG + "+(?:" + ALPHA + "+)?" +
        "|\\[" + DIG + "+(?:" + ALPHA + "+)?\\]" +
        "|\\【" + DIG + "+(?:" + ALPHA + "+)?\\】" +
      ")(?![\\s\\u3000]*[\\(\\（](?:" + DIG + "|" + ALPHA + "))";


    var SEP_REF  = "(?:[\\s\\u3000]*(?:及び|又は|[、,，]|[-‐-–—−]|[\\.．])[\\s\\u3000]*)";
    var TAIL_REF = "(" + TOKEN_REF + "(?:" + SEP_REF + TOKEN_REF + ")*)";

    var KEYWORD_REF_RE = new RegExp(
      "(" + KEYWORDS_REF_NC + ")" +
        "(?![\\s\\u3000]*" + PARTICLE + ")" +
        "([\\s\\u3000]*[:：]?[\\s\\u3000]*)" +
        TAIL_REF,
      "g"
    );

    // -------------------------------
    // CLAIM側：従来どおり ()（）も許可
    // -------------------------------
    var TOKEN_CLAIM = "(?:[\\(\\（\\[\\【]?" + DIG + "+(?:" + ALPHA + "+)?[\\)\\）\\]\\】]?)";
    var SEP_CLAIM  = "(?:[\\s\\u3000]*(?:及び|又は|[、,，]|[-‐-–—−]|[\\.．])[\\s\\u3000]*)";
    var TAIL_CLAIM = "(" + TOKEN_CLAIM + "(?:" + SEP_CLAIM + TOKEN_CLAIM + ")*)";

    var KEYWORD_CLAIM_RE = new RegExp(
      "(" + KEYWORDS_CLAIM_NC + ")" +
        "(?![\\s\\u3000]*" + PARTICLE + ")" +
        "([\\s\\u3000]*[:：]?[\\s\\u3000]*)" +
        TAIL_CLAIM,
      "g"
    );

    // -------------------------------
    // 置換（引数は常に 3つ：kw, sep2, tail）
    // -------------------------------
    s = s.replace(KEYWORD_REF_RE, function (_all, kw, sep2, tail) {
      return kw + sep2 + fwAlnum(removeWS(tail));
    });

    s = s.replace(KEYWORD_CLAIM_RE, function (_all, kw, sep2, tail) {
      return kw + sep2 + fwAlnum(removeWS(tail));
    });


    return s;
  }

  // ======================================================================
  // 6. 引用箇所番号全角化（安全側：数字開始のみ）
  // ======================================================================

  /**
   * 図/表/式/段落の参照番号を全角化（安全側）
   * - 「特表(...)」は除外（従来互換）
   * - “数字開始” の参照列のみ対象（WPA-PSK 等の誤爆防止）
   * @param {string} str
   * @returns {string}
   */
  function fwRefLaw(str) {
    var s = String(str || "");

    var DIG = "[0-9０-９]";
    var ALPHA = "[A-Za-zＡ-Ｚａ-ｚ]";
    var TOKEN = "(?:[\\[\\【]?" + DIG + "+(?:" + ALPHA + "+)?[\\]\\】]?)";
    var SEP = "(?:[\\s\\u3000]*(?:及び|又は|[、,，]|[-‐-–—−]|[\\.．])[\\s\\u3000]*)";
    var TAIL = "(" + TOKEN + "(?:" + SEP + TOKEN + ")*)";

    // 表：直前が「特」なら “特表” なのでスキップ
    var reTable = new RegExp("(表)([\\s\\u3000:：]*?)" + TAIL, "g");
    s = s.replace(reTable, function (match, kw, sep2, tail, offset, whole) {
      if (offset > 0 && whole.charAt(offset - 1) === "特") return match;
      return kw + sep2 + fwAlnum(removeWS(tail));
    });

    // 図/式/段落
    var reOther = new RegExp("(図|式|段落)([\\s\\u3000:：]*?)" + TAIL, "g");
    s = s.replace(reOther, function (_all, kw2, sep3, tail2) {
      return kw2 + sep3 + fwAlnum(removeWS(tail2));
    });

    return s;
  }

  // ======================================================================
  // 4. 英字大小（技術トークン保護あり）
  // ======================================================================

  /**
   * 英単語の先頭1文字のみ大文字化（ただし技術トークンは保護）
   * @param {string} str
   * @returns {string}
   */
  function alphaCase(str) {
    var s = String(str || "");

    return applyWithTechProtection(s, function (t) {
      return t.replace(/[a-zA-Z]+/g, function (word) {
        // 既に先頭が大文字なら変更しない（過剰な大小変換を避ける）
        var c0 = word.charAt(0);
        if (c0 >= "A" && c0 <= "Z") return word;
        return c0.toUpperCase() + word.slice(1);
      });
    }, KEEP_TECH_RE_LIST);
  }

  // ======================================================================
  // 7. 空行削除（※圧縮ではなく “全削除”）
  // ======================================================================

  /**
   * 空行（空白のみ行を含む）をすべて削除する
   * @param {string} str
   * @returns {string}
   */
  function tightLines(str) {
    if (str == null || str === "") return "";
    var lines = splitLines(String(str));
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      if (isBlankLine(lines[i])) continue;
      out.push(lines[i]);
    }
    return joinLines(out);
  }

  // ======================================================================
  // 8. 『』内の空白行削除
  // ======================================================================

  /**
   * 開始～終了マーカーに挟まれた範囲の空白行を削除（簡易）
   * @param {string} str
   * @param {string|string[]} startMarker
   * @param {string|string[]} endMarker
   * @returns {string}
   */
  function stripBlankLinesBetween(str, startMarker, endMarker) {
    if (str == null || str === "") return "";
    var s = String(str);

    var starts = Array.isArray(startMarker) ? startMarker : [startMarker];
    var ends = Array.isArray(endMarker) ? endMarker : [endMarker];

    function esc(x) {
      return String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    var result = s;

    for (var i = 0; i < starts.length; i++) {
      for (var j = 0; j < ends.length; j++) {
        var pattern = new RegExp("(" + esc(starts[i]) + ")([\\s\\S]*?)(" + esc(ends[j]) + ")", "g");
        result = result.replace(pattern, function (_all, pre, inner, post) {
          var innerLines = splitLines(inner);
          var outLines = [];
          for (var k = 0; k < innerLines.length; k++) {
            if (!isBlankLine(innerLines[k])) outLines.push(innerLines[k]);
          }
          return pre + joinLines(outLines).trim() + post;
        });
      }
    }

    return result;
  }

  /**
   * 『...』内の空白行を削除
   * @param {string} str
   * @returns {string}
   */
  function tightClaims(str) {
    if (str == null || str === "") return "";
    return stripBlankLinesBetween(String(str), "『", "』");
  }

  // ======================================================================
  // 公開
  // ======================================================================

  root.textUtilsMain = {
    // 空白系
    padHead: padHead,
    trimHead: trimHead,

    // 箇条書き直下の空行詰め
    tightBelowBullet: tightBelowBullet,

    // 全角化・番号処理
    fwHead: fwHead,
    fwNumLaw: fwNumLaw,
    fwRefLaw: fwRefLaw,

    // 大小変換（技術トークン保護あり）
    alphaCase: alphaCase,

    // 行構造
    tightLines: tightLines,
    tightClaims: tightClaims
  };
})(globalThis);
