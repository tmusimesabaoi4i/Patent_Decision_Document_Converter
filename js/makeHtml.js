(function (root) {
  "use strict";

function to_HTML(str) {
  if (str == null) return '<div class="patent-text"></div>';

  const src = String(str)
    .replace(/\r\n?/g, "\n")
    .replace(/^\uFEFF/, ""); // BOM除去

  const lines = src.split("\n");

  // -------------------------
  // utilities
  // -------------------------
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function z2hDigits(s) {
    return String(s).replace(/[０-９]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });
  }

  function normalizeLine(s) {
    // 全角空白は半角へ。前後空白は除去。
    return String(s).replace(/\u3000/g, " ").trim();
  }

  function isAsciiWordChar(ch) {
    return /[A-Za-z0-9]/.test(ch || "");
  }

  function joinWrappedText(a, b) {
    if (!a) return b;
    if (!b) return a;

    const aLast = a[a.length - 1];
    const bFirst = b[0];

    // 英単語の途中で改行されたときだけ空白を入れる
    const needSpace = isAsciiWordChar(aLast) && isAsciiWordChar(bFirst);
    return a + (needSpace ? " " : "") + b;
  }

  // -------------------------
  // heading detection
  // -------------------------
  function isEnglishAllCapsHeading(line) {
    if (!line) return false;
    if (line.length > 140) return false;
    if (/^\[[0-9０-９]{4,}\]/.test(line)) return false;
    if (/^【[0-9０-９]{4,}】/.test(line)) return false;

    // 大文字中心の見出し
    return /^[A-Z][A-Z0-9 \-–—\/(),.&:;']+$/.test(line);
  }

  function isEnglishTitleHeading(line) {
    if (!line) return false;
    if (line.length > 100) return false;
    if (/^\[[0-9０-９]{4,}\]/.test(line)) return false;
    if (/^【[0-9０-９]{4,}】/.test(line)) return false;

    // よくある英文明細書見出し（必要に応じて追加可）
    const known = [
      "Description",
      "Abstract",
      "Claims",
      "Summary",
      "Field of the Disclosure",
      "Background",
      "Brief Description of the Drawings",
      "Detailed Description"
    ];

    for (var i = 0; i < known.length; i++) {
      if (line.toLowerCase() === known[i].toLowerCase()) return true;
    }

    return false;
  }

  function parseJapaneseBracketHeading(line) {
    // 【背景技術】, 【発明の詳細な説明】 など
    // ※ 【０００１】 は段落番号なので除外
    const m = line.match(/^【\s*([^】]+?)\s*】$/);
    if (!m) return null;

    const insideRaw = m[1];
    const insideNoSpace = z2hDigits(insideRaw).replace(/\s+/g, "");
    if (/^\d+$/.test(insideNoSpace)) return null; // 段落番号

    return {
      text: insideRaw.trim()
    };
  }

  function getHeadingTagForEnglish(line) {
    // "Description" は上位見出し、それ以外は通常見出し
    if (line.toLowerCase() === "description") return "h1";
    return "h2";
  }

  function getHeadingTagForJapanese(title) {
    // 必要最低限の階層化（簡易）
    const t = title.replace(/\s+/g, "");
    if (t === "発明の詳細な説明" || t === "発明の概要") return "h1";
    return "h2";
  }

  // -------------------------
  // paragraph marker detection
  // -------------------------
  function parseParagraphMarker(line) {
    // [0016] text...
    var m = line.match(/^\[\s*([0-9０-９]{4,})\s*\]\s*(.*)$/);
    if (m) {
      return {
        no: z2hDigits(m[1]),
        rest: m[2] || "",
        style: "square"
      };
    }

    // 【００１６】 text...
    m = line.match(/^【\s*([0-9０-９]{4,})\s*】\s*(.*)$/);
    if (m) {
      return {
        no: z2hDigits(m[1]),
        rest: m[2] || "",
        style: "jp-bracket"
      };
    }

    return null;
  }

  // -------------------------
  // output builder state
  // -------------------------
  const out = [];
  let currentPara = null; // { no, text, style }
  let pendingMarker = null; // { no, style } // 番号だけ行

  function flushParagraph() {
    if (!currentPara) return;

    const textHtml = esc(currentPara.text || "");
    if (currentPara.no) {
      const label = currentPara.style === "jp-bracket"
        ? "【" + currentPara.no + "】"
        : "[" + currentPara.no + "]";

      out.push(
        '<p class="patent-paragraph" data-para="' + esc(currentPara.no) + '">' +
          '<span class="para-no">' + esc(label) + '</span> ' +
          '<span class="para-text">' + textHtml + "</span>" +
        "</p>"
      );
    } else {
      out.push(
        '<p class="patent-paragraph no-num">' + textHtml + "</p>"
      );
    }

    currentPara = null;
  }

  function startParagraph(no, style, text) {
    currentPara = {
      no: no || null,
      style: style || "plain",
      text: text || ""
    };
  }

  // -------------------------
  // main parse loop
  // -------------------------
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = normalizeLine(raw);

    // 空行
    if (!line) {
      flushParagraph();
      pendingMarker = null;
      continue;
    }

    // 日本語見出し（【背景技術】など）
    const jpHead = parseJapaneseBracketHeading(line);
    if (jpHead) {
      flushParagraph();
      pendingMarker = null;

      const tag = getHeadingTagForJapanese(jpHead.text);
      out.push(
        "<" + tag + ' class="patent-heading">' +
        esc(jpHead.text) +
        "</" + tag + ">"
      );
      continue;
    }

    // 英語見出し（Description / BRIEF ... / DETAILED ...）
    if (isEnglishTitleHeading(line) || isEnglishAllCapsHeading(line)) {
      flushParagraph();
      pendingMarker = null;

      const tag = getHeadingTagForEnglish(line);
      out.push(
        "<" + tag + ' class="patent-heading">' +
        esc(line) +
        "</" + tag + ">"
      );
      continue;
    }

    // 段落番号行
    const marker = parseParagraphMarker(line);
    if (marker) {
      flushParagraph();

      if (marker.rest) {
        startParagraph(marker.no, marker.style, marker.rest);
      } else {
        // 番号だけで本文は次行
        pendingMarker = { no: marker.no, style: marker.style };
      }
      continue;
    }

    // 通常本文
    if (!currentPara) {
      if (pendingMarker) {
        startParagraph(pendingMarker.no, pendingMarker.style, line);
        pendingMarker = null;
      } else {
        startParagraph(null, "plain", line);
      }
    } else {
      currentPara.text = joinWrappedText(currentPara.text, line);
    }
  }

  flushParagraph();

  return '<div class="patent-text">\n' + out.join("\n") + "\n</div>";
}

  root.makeHtml = {
    to_HTML: to_HTML,
  };
})(globalThis);
