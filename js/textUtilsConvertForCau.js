// ファイル名例: textUtilsConvertForCau.js

(function (root) {
  "use strict";

  // ============================================================
  // 数値・英数字の全角／半角変換ヘルパ
  // ============================================================

  /**
   * 半角数字 0-9 → 全角数字 ０-９ に変換するヘルパ。
   * すでに全角数字の場合はそのまま返す。
   */
  function toFullDigitChar(ch) {
    var code = ch.charCodeAt(0);

    // 半角 '0'〜'9'
    if (code >= 0x30 && code <= 0x39) {
      return String.fromCharCode(code + 0xFEE0);
    }

    // すでに全角 '０'〜'９' はそのまま
    if (code >= 0xFF10 && code <= 0xFF19) {
      return ch;
    }

    return ch;
  }

  /**
   * 文字列中の数字だけを全角数字に変換する。
   */
  function toFullDigits(str) {
    return String(str).replace(/[0-9０-９]/g, function (ch) {
      return toFullDigitChar(ch);
    });
  }

  /**
   * 全角英数字（０-９, Ａ-Ｚ, ａ-ｚ）を半角英数字に変換するヘルパ
   * @param {string} c - 1文字
   * @returns {string} 半角に変換された文字（または元の文字）
   */
  function toHalfAlnumChar(c) {
    var code = c.charCodeAt(0);
    // 全角数字（０-９）
    if (code >= 0xff10 && code <= 0xff19) {
      return String.fromCharCode(code - 0xff10 + 0x30);
    }
    // 全角大文字（Ａ-Ｚ）
    if (code >= 0xff21 && code <= 0xff3a) {
      return String.fromCharCode(code - 0xff21 + 0x41);
    }
    // 全角小文字（ａ-ｚ）
    if (code >= 0xff41 && code <= 0xff5a) {
      return String.fromCharCode(code - 0xff41 + 0x61);
    }
    return c;
  }

  /**
   * 半角英数字 (0-9, A-Z, a-z) を全角英数字に変換するヘルパ
   * @param {string} c - 1文字
   * @returns {string} 全角に変換された文字（または元の文字）
   */
  function toFullAlnumChar(c) {
    var code = c.charCodeAt(0);
    // 半角数字（0-9）
    if (code >= 0x30 && code <= 0x39) {
      return String.fromCharCode(code - 0x30 + 0xff10);
    }
    // 半角大文字（A-Z）
    if (code >= 0x41 && code <= 0x5a) {
      return String.fromCharCode(code - 0x41 + 0xff21);
    }
    // 半角小文字（a-z）
    if (code >= 0x61 && code <= 0x7a) {
      return String.fromCharCode(code - 0x61 + 0xff41);
    }
    return c;
  }

  /**
   * 文字列を改行単位で分割する。
   * Windows / macOS / Unix などの代表的な改行コードに対応。
   *
   * @param {string} str - 入力文字列
   * @returns {string[]} 行ごとの配列
   */
  function splitLines(str) {
    return String(str).split(/\r\n|\r|\n/);
  }

  /**
   * 行配列を単純に "\n" で結合して 1 つの文字列に戻す。
   * 元の改行コードは保持しない（LF 固定）。
   *
   * @param {string[]} lines - 行配列
   * @returns {string} 結合した文字列
   */
  function joinLines(lines) {
    return lines.join("\n");
  }

  /**
   * 文字列中の「全角英数字」を半角英数字に変換する。
   * @param {string} text
   * @returns {string}
   */
  function toHalfAlnumStr(text) {
    return String(text).replace(/[０-９Ａ-Ｚａ-ｚ]/g, toHalfAlnumChar);
  }

  /**
   * 文字列中の「半角数字（0-9）」のみを全角数字に変換する。
   * @param {string} text
   * @returns {string}
   */
  function toFullNumStr(text) {
    return String(text).replace(/[0-9]/g, toFullAlnumChar);
  }

  // ============================================================
  // ＜補正の示唆＞ ブロック用
  // ============================================================

  /**
   * 「<補正の示唆>」以降に現れる
   *   "(１)fewofwKAoefwp"
   * のような行を変換する。
   *
   * 仕様：
   *   - 行頭の "(数字)" / "（数字）" を検出し、
   *       * 数字は全角数字に統一
   *       * 括弧は半角 "(" ")" に統一
   *   - それ以降のテキストについて：
   *       * 全角英数字は半角に
   *       * 行頭、またはカンマの直後の英字を大文字化
   *
   * 例：
   *   (１)fewofwKAoefwp  → (１)FewofwKAoefwp
   *   (２)geijgjiOas,f   → (２)GeijgjiOas,F
   *   (３)あああＡ      → (３)あああA
   *
   * @param {string} line
   * @returns {string}
   */
  function convertSuggestionNumberLineToFullWidth(line) {
    var s = String(line);

    // 先頭の空白＋括弧数字括弧をキャプチャ
    var m = /^([ \t\u3000]*)([（(])([0-9０-９]+)([)）])(.*)$/.exec(s);
    if (!m) {
      return s;
    }

    var indent = m[1] || "";
    var digits = m[3] || "";
    var rest = m[5] || "";

    // 数字は全角に統一
    var fullDigits = toFullDigits(digits);

    // 後半部はまず全角英数字を半角に
    var normalizedRest = toHalfAlnumStr(rest);

    // 行頭およびカンマの直後の英字を大文字化
    normalizedRest = normalizedRest.replace(
      /(^|[,\s])([a-zA-Z])/g,
      function (_all, sep, ch) {
        return sep + ch.toUpperCase();
      }
    );

    // 括弧は半角 "(" ")" に統一
    return indent + "(" + fullDigits + ")" + normalizedRest;
  }

  /**
   * 「補正の示唆番号行」かどうか簡易判定。
   * 行頭に "(数字)" もしくは "（数字）" があれば true。
   */
  function isSuggestionNumberLine(line) {
    var s = String(line);
    return /^[ \t\u3000]*[（(][0-9０-９]+[)）]/.test(s);
  }

  // ============================================================
  // ＜ファミリー文献情報＞ ブロック用
  // ============================================================

  /**
   * ファミリー文献情報ブロック内の「番号行」かどうかを判定。
   * 例： "１.GこれKご" / "1.Gtext"
   */
  function isFamilyInfoHeadLine(line) {
    return /^[ 　]*[0-9０-９]+[\.．]/.test(String(line));
  }

  /**
   * ファミリー文献情報ブロック内の「本文行（番号行の次以降）」かどうかを判定。
   * 例： "　FgkrこけおR" （文頭は半角スペース想定だが、全角も許容）
   */
  function isFamilyInfoBodyLine(line) {
    // 行頭に空白があり、そのあとに何か非空白文字が続く行
    return /^[ 　\t]+.*\S.*$/.test(String(line));
  }

  /**
   * ファミリー文献情報ブロックの「番号行」を整形する。
   *
   * 仕様：
   *   - 行頭の「数字＋ドット」部分は
   *       * 数字のみ全角に統一（ドットは元のまま）
   *   - それ以降の文字列は英数字のみ半角に変換（日本語はそのまま）
   *
   * 例：
   *   "1.GこれKご"   → "１.GこれKご"
   *   "１．ｇらえｊ" → "１．gらえj"
   *
   * @param {string} line
   * @returns {string}
   */
  function convertFamilyInfoHeadLine(line) {
    var s = String(line);
    var m = /^([ 　]*)([0-9０-９]+)([\.．])(.*)$/.exec(s);
    if (!m) return s;

    var indent = m[1] || "";
    var nums = m[2] || "";
    var dot = m[3] || "";
    var rest = m[4] || "";

    // 数字は全角に揃える
    var fullNums = toFullDigits(nums);

    // 本文部は英数字のみ半角に
    var normalizedRest = toHalfAlnumStr(rest);

    return indent + fullNums + dot + normalizedRest;
  }

  /**
   * ファミリー文献情報ブロックの「本文行（番号行の次以降）」を整形する。
   *
   * 仕様：
   *   - 行頭にある空白の個数・種別（半角/全角）にかかわらず、
   *     一律「全角スペース4個」のインデントに揃える
   *   - 本文部は英数字のみ半角に変換する
   *
   * 例：
   *   "　FgkrこけおR" → "　　　FgkrこけおR"
   *
   * @param {string} line
   * @returns {string}
   */
  function convertFamilyInfoBodyLine(line) {
    var s = String(line);

    // 行頭の空白（全角/半角/タブ）をすべて取り除く
    var body = s.replace(/^[ 　\t]+/, "");

    // 英数字のみ半角化
    var normalizedBody = toHalfAlnumStr(body);

    // ファミリー文献情報の本文行の標準インデント（全角スペース4つ）
    var INDENT = "　　　";

    return INDENT + normalizedBody;
  }

  // ============================================================
  // 行単位の共通変換
  // ============================================================

  /**
   * 単一行をルールベースで整形する。
   *
   * 処理の流れ：
   *   1. 行が完全空行ならそのまま返す
   *   2. 特定の固定文言（署名・TEL・メールアドレス）は、行頭空白も含めて完全一致で置換
   *   3. それ以外は全角英数字→半角化 → 数字だけ全角に戻す
   *
   * @param {string} str - 1 行分の文字列
   * @returns {string} 整形済みの 1 行分の文字列
   */
  function convertEachLine_ForCau(str) {
    var raw = str == null ? "" : String(str);

    // 完全な空行はそのまま空行として返す
    if (raw === "") {
      return "";
    }

    // ------------------------------
    // 固定文言に対する完全一致マッチ
    // （元データは行頭に全角スペース付きで入ってくる想定）
    // ------------------------------
    if (raw === "　審査第四部伝送システム(PA5J) 飯星 陽平(いいほし ようへい)") {
      // 行頭インデント無し＋前に 1 行改行を付与
      return "\n審査第四部伝送システム(PA5J) 飯星 陽平(いいほし ようへい)";
    }

    if (raw === "　TEL.03-3581-1101 内線3534") {
      // 行頭の空白はすべて削除して返す
      return "TEL.03-3581-1101 内線3534";
    }

    if (raw === "　※●●●●@Jpo.Go.Jp (上記「●●●●」に置き換えて、「PA5J」と入力ください。)") {
      // 行頭空白削除＋メールドメインを小文字 jpo.go.jp に修正
      return "※●●●●@jpo.go.jp (上記「●●●●」に置き換えて、「PA5J」と入力ください。)";
    }

    // ------------------------------
    // 上記以外の行は、まず全角英数字を半角に正規化
    // ------------------------------
    var s = toHalfAlnumStr(raw);

    // （ここに DB 名や IPC 行など追加ルールがあれば挿入）

    // ------------------------------
    // デフォルト：数字だけ全角に戻す
    // ------------------------------
    return toFullNumStr(s);
  }

  // ============================================================
  // メイン：<補正をする際の注意> ブロック全体の変換
  // ============================================================

  /**
   * 「<補正をする際の注意>」ブロックを対象に、
   *   - ＜補正の示唆＞ ブロック
   *   - ＜ファミリー文献情報＞ ブロック
   * を行単位で整形する。
   *
   * 終了条件：
   *   行頭に空白（半角/全角）があり、
   *   「この拒絶理由通知の内容に関するお問合せ」で始まる行を
   *   「＜補正の示唆＞／＜ファミリー文献情報＞ブロックの終端」とみなす。
   *
   * この終端行自体および、それ以降の行（メール案内・署名など）は
   * ブロック外として通常の行処理（convertEachLine_ForCau）に通す。
   *
   * 実装方針：
   *   - 「pre + <補正をする際の注意> + tail」の 3 分割でテキストを扱う
   *   - tail 部分のみ processCauTail() に通して整形する
   *   - 「<補正をする際の注意>」が存在しない場合は全文を processCauTail() に通す
   *
   * @param {string} text - 全文テキスト
   * @returns {string} 整形済みテキスト
   */
  function convertForCau(text) {
    var input = String(text);

    // ([\s\S]*?)             → pre: 先頭〜最初の "<補正をする際の注意>" 直前まで
    // (<補正をする際の注意>) → marker
    // ([\s\S]*)              → tail: マーカー直後〜全文末尾まで（変換対象）
    var pattern = /([\s\S]*?)(<補正をする際の注意>)([\s\S]*)/;

    if (pattern.test(input)) {
      return input.replace(pattern, function (_all, pre, marker, tail) {
        var convertedTail = processCauTail(marker, tail);
        return pre + marker + convertedTail;
      });
    }

    // 「<補正をする際の注意>」自体が無い場合：
    // 全文を対象に（安全側に）processCauTail() を適用する。
    return processCauTail("", input);
  }

  /**
   * 「取得先 <http:...>」で囲まれたURL部分だけをすべて小文字化して返す
   * - 文字列中に複数あっても全件処理（/g）
   * - 「取得先 < ... >」の外側は一切変更しない
   *
   * @param {string} str
   * @returns {string}
   */
  function lcKenshuSakiUrl(str) {
    if (typeof str !== "string" || str.length === 0) return str;

    // 「取得先 <」 + URL(http/https) + 「>」 を検出
    // front : 「取得先 <」側（空白含む）
    // __all  : マッチ全体
    // rear  : 「>」側（空白含む）
    const re = /(取得先\s*<)([\S]+)(>)/g;

    return str.replace(re, function (__all, front, url, rear) {
      // URL部分だけ小文字化して、元の文字列（front/rear）に戻す
      return front + url.toLowerCase() + rear;
    });
  }


  /**
   * 実際の行ごとの処理本体。
   *
   * - ＜補正の示唆＞／＜ファミリー文献情報＞の開始を検出して
   *   inSuggestion / inFamilyInfo フラグを切り替え
   * - inSuggestion 中の番号行は convertSuggestionNumberLineToFullWidth() で整形
   * - inFamilyInfo 中の番号行／本文行は専用整形関数で処理
   * - 行頭に「この拒絶理由通知の内容に関するお問合せ…」を含む行を
   *   ブロックの終端とみなし、inSuggestion / inFamilyInfo を解除。
   *   もし inFamilyInfo → false に切り替わる場合は、その直前に空行を 1 行挿入。
   * - 上記いずれにも該当しない行は convertEachLine_ForCau() に委譲。
   *
   * @param {string} _marker - 未使用（将来拡張用）
   * @param {string} tail    - 処理対象部分
   * @returns {string}
   */
  function processCauTail(_marker, tail) {
    var lines = splitLines(tail);
    var outLines = [];

    var inSuggestion = false;   // ＜補正の示唆＞ ブロック内かどうか
    var inFamilyInfo = false;   // ＜ファミリー文献情報＞ ブロック内かどうか

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var headTrimmed = line.replace(/^[ \t\u3000]+/, "");

      // ------------------------------------
      // ブロック開始行の検出
      // （ASCII "<補正の示唆>" と全角 "＜補正の示唆＞" の両方を許容）
      // ------------------------------------
      if (
        headTrimmed.indexOf("<補正の示唆>") === 0 ||
        headTrimmed.indexOf("＜補正の示唆＞") === 0
      ) {
        inSuggestion = true;
        inFamilyInfo = false;
        outLines.push(convertEachLine_ForCau(line));
        continue;
      }

      if (
        headTrimmed.indexOf("<ファミリー文献情報>") === 0 ||
        headTrimmed.indexOf("＜ファミリー文献情報＞") === 0
      ) {
        inSuggestion = false;
        inFamilyInfo = true;
        outLines.push(convertEachLine_ForCau(line));
        continue;
      }

      // ------------------------------------
      // ブロック終端行の検出：
      // 「この拒絶理由通知の内容に関するお問合せ…」で始まる行
      // ------------------------------------
      if (/^この拒絶理由通知の内容に関するお問合せ/.test(headTrimmed)) {
        // ＜ファミリー文献情報＞ から抜ける場合は、その直前に空行を 1 行挿入
        if (inFamilyInfo) {
          inFamilyInfo = false;
          if (outLines.length > 0 && outLines[outLines.length - 1] !== "") {
            outLines.push(""); // 空行を挿入
          }
        } else {
          outLines.push(""); // 空行を挿入
        }
        // ＜補正の示唆＞ もここで終了
        inSuggestion = false;

        // この行自体は通常行として変換（インデントや数字整形のみ）
        outLines.push(convertEachLine_ForCau(line));
        continue;
      }

      // ------------------------------------
      // ＜補正の示唆＞ ブロック内の "(数字)" 行を変換
      // ------------------------------------
      if (inSuggestion && isSuggestionNumberLine(line)) {
        outLines.push(convertSuggestionNumberLineToFullWidth(line));
        continue;
      }

      // ------------------------------------
      // ＜ファミリー文献情報＞ ブロック内の整形
      // ------------------------------------
      if (inFamilyInfo) {
        // ブロック内の空行は削除
        if (line.trim() === "") {
          continue;
        }

        if (isFamilyInfoHeadLine(line)) {
          // 「１.GこれKご」などの番号行
          outLines.push(convertFamilyInfoHeadLine(line));
          continue;
        } else if (isFamilyInfoBodyLine(line)) {
          // インデントつき本文行
          outLines.push(convertFamilyInfoBodyLine(line));
          continue;
        }
        // それ以外（想定外の行）は通常処理へフォールバック
      }

      // ------------------------------------
      // 上記いずれにも該当しない行は従来どおり行単位整形
      // ------------------------------------
      outLines.push(convertEachLine_ForCau(line));
    }

    return joinLines(outLines);
  }

  // ============================================================
  // その他の後処理（記・引用文献等一覧など）
  // ============================================================

  /**
   * その他（「記」や <引用文献等一覧> 等）の整形。
   *
   * - 行頭の空白（半角/全角）は無視してパターン判定する。
   * - 該当行は所定のレイアウトに置換。
   * - 最後に < / > を全角に変換する。
   */
  function convertForOther(text) {
    var lines = splitLines(lcKenshuSakiUrl(text));
    var outLines = lines.map(function (line) {
      var raw = String(line);
      // 行頭の空白を除いた版
      var headTrimmed = raw.replace(/^[ \u3000]+/, "");

      if (headTrimmed === "SA WG1-4、6") {
        return "　　　　　　　　　　　　　　　SA  WG1-4、6";
      }

      if (headTrimmed === "CT WG1、4") {
        return "　　　　　　　　　　　　　　　CT  WG1、4";
      }

      if (headTrimmed === "記 (引用文献等については引用文献等一覧参照)") {
        return "　　　　　記　　　（引用文献等については引用文献等一覧参照）";
      }

      if (headTrimmed === "記") {
        return "　　　　　　　　　　　　　　　　　記";
      }

      if (headTrimmed === "------------------------------------") {
        return "－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－－";
      }

      if (headTrimmed === "<最後の拒絶理由通知とする理由>") {
        return "　　　　　　　　　　＜最後の拒絶理由通知とする理由＞";
      }

      if (headTrimmed === "<引用文献等一覧>") {
        return "　　　　　　　　　　　　　<引用文献等一覧>";
      }

      return raw;
    });

    return joinLines(outLines)
      .replace(/[<>]/g, function (c) {
        return c === "<" ? "＜" : "＞";
      })
      .replace(/[、。]/g, function (c) {
        // 将来ここで句読点の正規化をしたくなったら書き換え
        return c === "、" ? "、" : "。";
      });
  }

  // ============================================================
  // 柔軟な略語置換（3GPP / 無線系）
  // ============================================================

  /**
   * 柔軟なマッチングで置換を行う（-/_/大文字小文字を無視）
   * @param {string} str - 入力文字列
   * @returns {string} - 置換後の文字列
   */
  function applyFlexibleMap(str) {
    /**
     * ============================================================
     * 1) 通常マップ（広範囲）
     *    - 空白 / ハイフン / アンダースコアを normalize() で吸収
     *    - 例: "rrc setup request" / "rrc-setup-request" / "rrc_setup_request"
     *      -> 同一キー扱い
     * ============================================================
     */
    const replaceMap = {
      // ============================================================
      // 基本 / プラットフォーム / OS
      // ============================================================
      gnb: "gNB",
      pa5j: "PA5J",

      ios: "iOS",
      ipados: "iPadOS",
      macos: "macOS",
      watchos: "watchOS",
      tvos: "tvOS",
      android: "Android",
      androidos: "Android",
      wearos: "Wear OS",
      harmonyos: "HarmonyOS",

      wifi: "Wi-Fi",
      wlan: "WLAN",
      bluetooth: "Bluetooth",
      ble: "BLE",
      nfc: "NFC",
      uwb: "UWB",

      gnss: "GNSS",
      gps: "GPS",
      glonass: "GLONASS",
      galileo: "Galileo",
      beidou: "BeiDou",
      qzss: "QZSS",

      appleid: "Apple ID",
      icloud: "iCloud",
      airdrop: "AirDrop",
      airplay: "AirPlay",
      facetime: "FaceTime",
      imessage: "iMessage",
      appstore: "App Store",
      googleplay: "Google Play",
      playstore: "Play Store",

      // ============================================================
      // 標準化団体 / 仕様文書
      // ============================================================
      "3gpp": "3GPP",
      etsi: "ETSI",
      itu: "ITU",
      ietf: "IETF",
      ieee: "IEEE",

      // ============================================================
      // RAT / 無線方式 / 3GPP世代
      // ============================================================
      lte: "LTE",
      ltea: "LTE-A",
      lteadvanced: "LTE-Advanced",
      lteapro: "LTE-A Pro",

      nr: "NR",
      "5g": "5G",
      "5gc": "5GC",

      emtc: "eMTC",
      nbiot: "NB-IoT",
      catm1: "Cat-M1",
      cat1: "Cat-1",
      redcap: "RedCap",

      umts: "UMTS",
      wcdma: "WCDMA",
      hspa: "HSPA",
      hsdpa: "HSDPA",
      hsupa: "HSUPA",
      gsm: "GSM",
      geran: "GERAN",
      utran: "UTRAN",
      eutran: "E-UTRAN",
      eutra: "E-UTRA",

      embb: "eMBB",
      urllc: "URLLC",
      mmtc: "mMTC",
      ciot: "CIoT",
      lpwa: "LPWA",

      // ============================================================
      // RAN ノード / 構成 / O-RAN / WG
      // ============================================================
      enb: "eNB",
      ngenb: "ng-eNB",
      enodeb: "eNodeB",
      gnodeb: "gNodeB",

      cucp: "CU-CP",
      cuup: "CU-UP",
      gnbdu: "gNB-DU",
      gnbcu: "gNB-CU",
      gnbcucp: "gNB-CU-CP",
      gnbcuup: "gNB-CU-UP",

      oran: "O-RAN",
      ric: "RIC",
      nearrtric: "Near-RT RIC",
      nonrtric: "Non-RT RIC",
      smo: "SMO",
      e2ap: "E2AP",
      a1: "A1",
      o1: "O1",
      o2: "O2",

      ran1: "RAN1",
      ran2: "RAN2",
      ran3: "RAN3",
      sa2: "SA2",
      sa3: "SA3",
      ct1: "CT1",
      ct3: "CT3",

      // ============================================================
      // セル / CA・DC / TAG・TMG
      // ============================================================
      mrdc: "MR-DC",
      endc: "EN-DC",
      nrdc: "NR-DC",
      nedc: "NE-DC",

      mcg: "MCG",
      scg: "SCG",
      spcell: "SpCell",
      pscell: "PSCell",
      pcell: "PCell",
      scell: "SCell",
      servingcell: "ServingCell",

      tag: "TAG",
      ptag: "pTAG",
      stag: "sTAG",
      pstag: "psTAG",
      tmg: "TMG",
      tmgs: "TMGs",
      trp: "TRP",
      multitrp: "multi-TRP",

      // ============================================================
      // 物理層 / 多重 / 変調 / チャネル / 信号
      // ============================================================
      mimo: "MIMO",
      beamforming: "Beamforming",
      tdd: "TDD",
      fdd: "FDD",
      ofdm: "OFDM",
      ofdma: "OFDMA",
      scfdma: "SC-FDMA",
      qam: "QAM",
      qpsk: "QPSK",
      bpsk: "BPSK",
      ldpc: "LDPC",
      polar: "Polar",
      fec: "FEC",

      pucch: "PUCCH",
      pusch: "PUSCH",
      pdcch: "PDCCH",
      pdsch: "PDSCH",
      pbch: "PBCH",
      prach: "PRACH",
      srs: "SRS",
      ssb: "SSB",
      csirs: "CSI-RS",
      dmrs: "DMRS",
      ptrs: "PTRS",
      prs: "PRS",
      trs: "TRS",

      dci: "DCI",
      uci: "UCI",
      harq: "HARQ",
      bwp: "BWP",
      cce: "CCE",
      coreset: "CORESET",
      searchspace: "SearchSpace",
      mcs: "MCS",
      tbs: "TBS",
      cqi: "CQI",
      pmi: "PMI",
      cri: "CRI",


      // ランダムアクセス / 同期
      rach: "RACH",
      cfra: "CFRA",
      cbra: "CBRA",
      timingadvance: "Timing Advance",
      preamble: "Preamble",

      // ============================================================
      // 測定 / 品質
      // ============================================================
      rsrp: "RSRP",
      rsrq: "RSRQ",
      sinr: "SINR",
      snr: "SNR",

      // ============================================================
      // L2/L3 / RAN プロトコル / インタフェース
      // ============================================================
      rlc: "RLC",
      mac: "MAC",
      pdcp: "PDCP",
      rrc: "RRC",
      nas: "NAS",

      s1ap: "S1AP",
      x2ap: "X2AP",
      xnap: "XnAP",
      ngap: "NGAP",
      f1ap: "F1AP",
      e1ap: "E1AP",

      s1: "S1",
      x2: "X2",
      xn: "Xn",
      e1: "E1",
      f1: "F1",
      f1c: "F1-C",
      f1u: "F1-U",
      ngc: "NG-C",
      ngu: "NG-U",

      n1: "N1",
      n2: "N2",
      n3: "N3",
      n4: "N4",
      n6: "N6",
      n8: "N8",
      n10: "N10",
      n11: "N11",
      n12: "N12",
      n13: "N13",
      n14: "N14",
      n15: "N15",
      n16: "N16",

      gtp: "GTP",
      gtpc: "GTP-C",
      gtpu: "GTP-U",
      sctp: "SCTP",
      udp: "UDP",
      tcp: "TCP",
      ipv4: "IPv4",
      ipv6: "IPv6",

      // ============================================================
      // RRC 状態 / 手順 / シグナリング（重要）
      // ============================================================
      idle: "IDLE",
      inactive: "INACTIVE",
      connected: "CONNECTED",

      mib: "MIB",
      sib: "SIB",
      sib1: "SIB1",
      sib2: "SIB2",
      sib3: "SIB3",
      sib4: "SIB4",
      sib5: "SIB5",

      "rrc setup request": "RRC Setup Request",
      "rrc setup": "RRC Setup",
      "rrc setup complete": "RRC Setup Complete",
      "rrc reject": "RRC Reject",

      "rrc resume request": "RRC Resume Request",
      "rrc resume": "RRC Resume",
      "rrc resume complete": "RRC Resume Complete",

      "rrc release": "RRC Release",

      "rrc reconfiguration": "RRC Reconfiguration",
      "rrc reconfiguration complete": "RRC Reconfiguration Complete",

      "rrc reestablishment request": "RRC Reestablishment Request",
      "rrc reestablishment": "RRC Reestablishment",
      "rrc reestablishment complete": "RRC Reestablishment Complete",
      "rrc reestablishment reject": "RRC Reestablishment Reject",

      "security mode command": "Security Mode Command",
      "security mode complete": "Security Mode Complete",
      "security mode failure": "Security Mode Failure",

      "ue capability enquiry": "UE Capability Enquiry",
      "ue capability information": "UE Capability Information",
      "measurement report": "Measurement Report",
      "counter check": "Counter Check",
      "counter check response": "Counter Check Response",
      "ul information transfer": "UL Information Transfer",
      "dl information transfer": "DL Information Transfer",

      "rrc connection reconfiguration": "RRCConnectionReconfiguration",
      "rrc connection reconfiguration complete": "RRCConnectionReconfigurationComplete",
      "rrc connection reestablishment": "RRCConnectionReestablishment",
      "rrc connection reestablishment request": "RRCConnectionReestablishmentRequest",
      "rrc connection reestablishment complete": "RRCConnectionReestablishmentComplete",
      "rrc connection release": "RRCConnectionRelease",
      "rrc connection setup": "RRCConnectionSetup",
      "rrc connection setup complete": "RRCConnectionSetupComplete",
      "rrc connection request": "RRCConnectionRequest",

      // ============================================================
      // NAS / Mobility / 状態遷移 / 手順
      // ============================================================
      registration: "Registration",
      deregistration: "Deregistration",
      attach: "Attach",
      detach: "Detach",
      paging: "Paging",
      handover: "Handover",
      reselection: "Reselection",
      rlf: "RLF",
      "radio link failure": "Radio Link Failure",
      rlm: "RLM",
      bfd: "BFD",
      outofsync: "out-of-sync",
      insync: "in-sync",
      meas: "Meas",
      measid: "MeasId",
      measobject: "MeasObject",
      reportconfig: "ReportConfig",
      eventa1: "Event A1",
      eventa2: "Event A2",
      eventa3: "Event A3",
      eventa4: "Event A4",
      eventa5: "Event A5",

      // ============================================================
      // EPC / 5GC / IMS / 音声
      // ============================================================
      epc: "EPC",
      mme: "MME",
      sgw: "SGW",
      sgateway: "SGW",
      pgw: "PGW",
      pgateway: "PGW",
      hss: "HSS",
      pcrf: "PCRF",

      amf: "AMF",
      smf: "SMF",
      upf: "UPF",
      ausf: "AUSF",
      udm: "UDM",
      udr: "UDR",
      pcf: "PCF",
      nrf: "NRF",
      nef: "NEF",
      nssf: "NSSF",
      ladn: "LADN",
      smsf: "SMSF",
      sepp: "SEPP",
      scp: "SCP",
      bsf: "BSF",
      nwdaf: "NWDAF",
      ims: "IMS",
      volte: "VoLTE",
      vonr: "VoNR",
      vowifi: "VoWiFi",
      csfb: "CSFB",
      srvcc: "SRVCC",
      esrvcc: "eSRVCC",

      // ============================================================
      // QoS / セッション / ベアラ
      // ============================================================
      qos: "QoS",
      qci: "QCI",
      "5qi": "5QI",
      qfi: "QFI",
      ambr: "AMBR",
      gbr: "GBR",
      nongbr: "non-GBR",
      arp: "ARP",
      reflectiveqos: "Reflective QoS",
      pdu: "PDU",
      "pdu session": "PDU Session",
      srb: "SRB",
      drb: "DRB",
      erab: "E-RAB",

      // ============================================================
      // 識別子 / 加入者情報 / セル識別
      // ============================================================
      esim: "eSIM",
      euicc: "eUICC",
      imsi: "IMSI",
      imei: "IMEI",
      meid: "MEID",
      iccid: "ICCID",
      msisdn: "MSISDN",
      guti: "GUTI",
      supi: "SUPI",
      suci: "SUCI",
      tmsi: "TMSI",
      ptmsi: "P-TMSI",
      stmsi: "S-TMSI",
      plmn: "PLMN",
      tai: "TAI",
      cgi: "CGI",
      ecgi: "ECGI",
      ncgi: "NCGI",
      pci: "PCI",
      arfcn: "ARFCN",
      earfcn: "EARFCN",
      nrarfcn: "NR-ARFCN",

      // ============================================================
      // セキュリティ / 鍵 / 認証
      // ============================================================
      aka: "AKA",
      eap: "EAP",
      tls: "TLS",
      kasme: "KASME",
      kamf: "KAMF",
      kenb: "KeNB",
      kgnb: "KgNB",
      knas: "KNAS",
      knasenc: "KNASenc",
      knasint: "KNASint",
      krrcenc: "KRRCenc",
      krrcint: "KRRCint",
      kupenc: "KUPenc",

      // ============================================================
      // スライシング / 仮想化 / MEC / クラウド
      // ============================================================
      snssai: "S-NSSAI",
      sst: "SST",
      nsi: "NSI",
      mec: "MEC",
      nfv: "NFV",
      sdn: "SDN",
      vnf: "VNF",
      cnf: "CNF",

      // ============================================================
      // V2X / NTN / サイドリンク
      // ============================================================
      v2x: "V2X",
      ltev2x: "LTE-V2X",
      nrv2x: "NR-V2X",
      sidelink: "Sidelink",
      pc5: "PC5",
      ntn: "NTN",

      // ============================================================
      // 開発 / API / 一般IT
      // ============================================================
      api: "API",
      sdk: "SDK",
      cli: "CLI",
      gui: "GUI",
      json: "JSON",
      xml: "XML",
      yaml: "YAML",
      http: "HTTP",
      https: "HTTPS",
      rest: "REST",
      grpc: "gRPC",
      websocket: "WebSocket",
      sql: "SQL",
      nosql: "NoSQL",
      uuid: "UUID",
      jwt: "JWT",
      oauth: "OAuth",
      oauth2: "OAuth 2.0",
      openid: "OpenID",
      openidconnect: "OpenID Connect",
    };

    /**
     * ============================================================
     * 2) 条件付き短縮語マップ（誤爆しやすい短語を分離）
     *    - 単語境界相当（前後が英数字でない）でのみ適用
     *    - 通常 replaceMap に入れない
     * ============================================================
     */
    const conditionalShortMap = {
      tr: "TR",
      ts: "TS",
      ip: "IP",
      ho: "HO",
      ra: "RA",

      du: "DU",
      cu: "CU",
      ue: "UE",
      ca: "CA",
      dc: "DC",

      rv: "RV",
      ri: "RI",
      li: "LI",
      ta: "TA",

      af: "AF",
      dn: "DN",
      ck: "CK",
      ik: "IK",
      sd: "SD",

      ui: "UI",
      ux: "UX",
    };

    /**
     * `nr` が `snr` を壊さないようにするキー（境界制御必須）
     * 例: "snr" 内の "nr" は不適用 / "nr rrc" の "nr" は適用
     */
    const boundarySensitiveKeys = new Set(["nr"]);

    // 正規化関数：空白 / ハイフン / アンダースコア除去＋小文字化
    const normalize = (s) => String(s).replace(/[\s\-_]/g, "").toLowerCase();

    // ---- ここからロジック（空白対応 + 最長一致 + boundarySensitive + conditionalShort） ----

    function createTrieNode() {
      return { next: Object.create(null), entry: null };
    }

    function isAsciiWordChar(ch) {
      return !!ch && /[A-Za-z0-9]/.test(ch);
    }

    function hasAsciiTokenBoundary(chunk, startOrig, endOrigExcl) {
      const prev = startOrig > 0 ? chunk[startOrig - 1] : "";
      const next = endOrigExcl < chunk.length ? chunk[endOrigExcl] : "";
      return !isAsciiWordChar(prev) && !isAsciiWordChar(next);
    }

    // 正規化後キーごとのエントリを統合（通常/条件付きを区別）
    // ※ normalize衝突を検出（重複防止）
    const entryMap = Object.create(null);

    function putEntry(srcType, rawKey, value, options) {
      const nk = normalize(rawKey);
      if (!nk) return;

      if (Object.prototype.hasOwnProperty.call(entryMap, nk)) {
        throw new Error(
          "[applyFlexibleMap] normalized key collision: '" +
            rawKey +
            "' (" +
            nk +
            ") conflicts with existing key from " +
            entryMap[nk].srcType
        );
      }

      entryMap[nk] = {
        key: nk,
        value: value,
        srcType: srcType, // "normal" | "conditionalShort"
        boundarySensitive: !!options.boundarySensitive,
        conditionalShort: !!options.conditionalShort,
      };
    }

    for (const key in replaceMap) {
      if (!Object.prototype.hasOwnProperty.call(replaceMap, key)) continue;
      putEntry("normal", key, replaceMap[key], {
        boundarySensitive: boundarySensitiveKeys.has(normalize(key)),
        conditionalShort: false,
      });
    }

    for (const key in conditionalShortMap) {
      if (!Object.prototype.hasOwnProperty.call(conditionalShortMap, key)) continue;
      putEntry("conditionalShort", key, conditionalShortMap[key], {
        boundarySensitive: true, // 短語は境界必須
        conditionalShort: true,
      });
    }

    // Trie 構築（最長一致）
    const trieRoot = createTrieNode();
    for (const nk in entryMap) {
      if (!Object.prototype.hasOwnProperty.call(entryMap, nk)) continue;
      let node = trieRoot;
      for (let i = 0; i < nk.length; i++) {
        const ch = nk[i];
        if (!node.next[ch]) node.next[ch] = createTrieNode();
        node = node.next[ch];
      }
      node.entry = entryMap[nk];
    }

    // chunk（英数字+空白+_- の連続）内で、正規化位置 i からの「適用可能な最長一致」を返す
    function findLongestApplicableMatch(chunk, norm, normToOrig, i) {
      let node = trieRoot;
      let best = null;

      for (let j = i; j < norm.length; j++) {
        node = node.next[norm[j]];
        if (!node) break;

        if (node.entry) {
          const end = j + 1;
          const startOrig = normToOrig[i];
          const endOrigExcl = normToOrig[end - 1] + 1;

          // 境界制御（nr, 条件付き短語など）
          if (node.entry.boundarySensitive) {
            if (!hasAsciiTokenBoundary(chunk, startOrig, endOrigExcl)) {
              continue;
            }
          }

          // 条件付き短語は、さらに「元表記スパンの中に空白/ハイフン/アンダースコアを含まない」制約を入れる
          // （例: "H O" を "HO" にしない、"R-A" を "RA" にしない）
          if (node.entry.conditionalShort) {
            const rawSpan = chunk.slice(startOrig, endOrigExcl);
            if (/[\s\-_]/.test(rawSpan)) {
              continue;
            }
          }

          best = {
            value: node.entry.value,
            end: end,
          };
        }
      }

      return best;
    }

    // 英数字/空白/_/- を含む chunk を左→右に最長一致で置換（部分置換あり）
    // ※ 部分置換時も boundarySensitive / conditionalShort で誤爆抑制
    function replaceChunkByOrder(chunk) {
      const chars = String(chunk);
      let norm = "";
      const normToOrig = []; // norm[k] -> chars index

      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "-" || c === "_") {
          continue;
        }
        norm += c.toLowerCase();
        normToOrig.push(i);
      }

      if (!norm) return chunk;

      let out = "";
      let origCursor = 0;
      let i = 0;

      while (i < norm.length) {
        const m = findLongestApplicableMatch(chars, norm, normToOrig, i);

        if (!m) {
          // この正規化文字1文字だけ元のまま出す（間の区切りも保持）
          const nextOrigExcl = normToOrig[i] + 1;
          out += chars.slice(origCursor, nextOrigExcl);
          origCursor = nextOrigExcl;
          i += 1;
          continue;
        }

        const startOrig = normToOrig[i];
        const endOrigExcl = normToOrig[m.end - 1] + 1;

        // マッチ前の生文字列（区切り等を含む）を保持
        if (origCursor < startOrig) {
          out += chars.slice(origCursor, startOrig);
        }

        out += m.value;
        origCursor = endOrigExcl;
        i = m.end;
      }

      // chunk末尾の残り
      if (origCursor < chars.length) {
        out += chars.slice(origCursor);
      }

      return out;
    }

    // 文字列全体から「英数字で始まる、英数字/空白/_/- の連続塊」を抽出して処理
    // 空白を含む句（例: "rrc setup request"）にも対応
    return String(str).replace(/[A-Za-z0-9][A-Za-z0-9\s_-]*/g, function (chunk) {
      return replaceChunkByOrder(chunk);
    });
  }

  // ----------------------------------------
  // グローバルへのエクスポート
  // ----------------------------------------
  root.textUtilsConvertForCau = {
    convertForCau: convertForCau,
    convertForOther: convertForOther,
    applyFlexibleMap: applyFlexibleMap,
  };
})(globalThis);
