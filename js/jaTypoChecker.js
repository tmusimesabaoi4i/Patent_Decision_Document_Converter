(function (root) {
  "use strict";

  /**
   * 日本語タイポ検出および警告モーダル表示を行うユーティリティ。
   * - app.js からは root.JaTypoChecker 経由で利用する想定。
   * - DOM 操作はブラウザ環境のときのみ実行される。
   */
  function createJaTypoChecker() {
    /**
     * よくある誤記を表す正規表現パターン
     * - 必要に応じて自由に追加・削除可能
     */
    /**
     * よくある誤記を表す正規表現パターン群
     * - 判定はあくまでヒューリスティックなので、誤検出が多いようなら
     *   個々のパターンを無効化 / 調整する想定。
     */
    const typoPatterns = [
    {
      id: "mixedFullHalfSpace",
      // 4桁連続数字（例: 2021）の末尾 "1 ␠ 2" みたいな箇所は検出しない
      // 例）"2021 21th" は除外、"1 2" や "12 3" は検出
      regex: /(?<![0-9０-９]{3})[0-9０-９][ 　]+[0-9０-９]/g,
      message: "数字の間に余分なスペース（半角／全角）が入っている可能性があります。",
    },
    {
        id: "duplicatedComma",
        regex: /、{2,}/g,
        message: "読点「、」が連続しています。打ち過ぎの可能性があります。",
    },
    {
        id: "duplicatedPeriod",
        regex: /。。+/g,
        message: "句点「。」が連続しています。打ち過ぎの可能性があります。",
    },
    {
        id: "spaceBeforePunctuation",
        regex: /[ 　]+[。、，．]/g,
        message: "句読点の直前にスペースが入っています。",
    },
    {
        id: "missingNiBeforeKisaiInvent",
        // 例: 「引用文献１記載された発明」
        // 本来は「引用文献１に記載された発明」と書きたいケースを想定
        // 直前が空白・改行・「に」以外のときにヒットさせる
        regex: /([^\s\nに])[ 　]*記載された発明/g,
        message:
        "「〜に記載された発明」の「に」が抜けている可能性があります（例: 「引用文献１記載された発明」）。",
    },
    {
        id: "missingNiBeforeKisaiNoInvent",
        // 例: 「引用文献１記載の発明」
        // 本来は「引用文献１に記載の発明」と書きたいケースを想定
        regex: /([^\s\nに])[ 　]*記載の発明/g,
        message:
        "「〜に記載の発明」の「に」が抜けている可能性があります（例: 「引用文献１記載の発明」）。",
    },
    {
      id: "duplicatedParticleGeneric",
      // 「〜はは」「〜がが」「〜をを」…のように助詞が 2 回連続しているケースを検出
      // ただし「ことと」「ひとと」「あとと」「もとと」など、
      // “語尾の「と」+ 助詞「と」”で「とと」になる語は誤検出しやすいので除外する。
      regex: /([一-龥ぁ-んァ-ン0-9０-９]{1,8})(は|が|を|に|へ|と|で|から|まで|より|や|か|も)(?<!こと)(?<!ひと)(?<!あと)(?<!もと)\2/g,
      message: "助詞が同じ形で連続しています。不要な助詞が重複している可能性があります（例: 「〜がが」「〜はは」など）。",
    },
    {
        id: "duplicatedKanaWord",
        // 同じ仮名列（2〜4文字）がそのまま 2 回連続
        // 例: 「ああああ」「ていてい」「するするするする」など
        regex: /([ぁ-んァ-ン]{2,4})\1/g,
        message:
        "同じ仮名の並びが連続しています。単語の重複や変換ミスの可能性があります（例: 同じ「ああ」が続けて出現）。",
    },
    ];

    /**
     * 固定フレーズで検出したい誤記・冗長表現
     * - ドメイン固有の NG ワードはここにどんどん足していく想定。
     */
    const typoPhrases = [
    {
        id: "kisaiarete_iiru",
        phrase: "記載されていいる",
        message: "「記載されている」の誤記と考えられます。",
    },
    {
        id: "ito_to_shite",
        phrase: "意図として",
        message: "文脈によっては「意図して」の誤記の可能性があります。",
    },
    {
        id: "suru_koto_ga_dekiru_koto",
        phrase: "することができること",
        message: "「することができる」等に簡略化できる冗長な表現です。",
    },
    {
        id: "suru_tame_tame",
        phrase: "するためため",
        message: "「するため」が重複している可能性があります。",
    },
    {
        id: "ni_oite_ni_oite",
        phrase: "においてにおいて",
        message: "「において」が重複している可能性があります。",
    },
    {
        id: "ni_taisite_ni_taisite",
        phrase: "に対してに対して",
        message: "「に対して」が重複している可能性があります。",
    },
    {
        id: "ni_yori_ni_yori",
        phrase: "によりにより",
        message: "「により」が重複している可能性があります。",
    },
    {
        id: "dekiru_dekiru",
        phrase: "することができることができる",
        message: "「することができる」が重複しています。",
    },
    {
        id: "koku_koku",
        phrase: "告知し告知し",
        message: "同じ動詞が続けて出現しています。文のつなぎに誤りがある可能性があります。",
    },
    {
        id: "to_shite_shite",
        phrase: "としてとして",
        message: "「として」が重複しています。接続の誤りの可能性があります。",
    },
    ];

    /** @type {HTMLElement|null} */
    let modalRoot = null;
    /** @type {HTMLElement|null} */
    let modalBackdrop = null;
    /** @type {HTMLElement|null} */
    let modalDialog = null;
    /** @type {HTMLElement|null} */
    let modalList = null;
    /** @type {HTMLButtonElement|null} */
    let modalCloseBtn = null;
    /** @type {HTMLElement|null} */
    let lastActiveElement = null;

    /**
     * HTML エスケープ用の簡易ヘルパ
     * - モーダルに差し込むテキストは必ずこれを通す
     */
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    /**
     * モーダル用 DOM を 1 回だけ生成する
     * - すでに生成済みの場合は何もしない
     */
    function ensureModalDom() {
      if (typeof document === "undefined") return;
      if (modalRoot) return;

      modalRoot = document.createElement("div");
      modalRoot.id = "ja-typo-modal";
      modalRoot.className = "typo-modal";
      modalRoot.setAttribute("role", "dialog");
      modalRoot.setAttribute("aria-modal", "true");
      modalRoot.setAttribute("aria-hidden", "true");
      modalRoot.setAttribute("aria-labelledby", "ja-typo-modal-title");

      modalRoot.innerHTML = `
        <div class="typo-modal__backdrop" data-typo-modal-close="backdrop"></div>
        <div class="typo-modal__dialog" role="document">
          <header class="typo-modal__header">
            <h2 id="ja-typo-modal-title" class="typo-modal__title">
              日本語のタイポが検出されました
            </h2>
          </header>
          <div class="typo-modal__body">
            <p class="typo-modal__lead">
              以下の箇所にタイポまたは疑わしい表現が見つかりました。
              入力を修正してから再度「Convert」を実行してください。
            </p>
            <ul class="typo-modal__list" id="ja-typo-modal-list"></ul>
          </div>
          <footer class="typo-modal__footer">
            <button
              type="button"
              class="btn btn-secondary typo-modal__close"
              data-typo-modal-close="button"
            >
              閉じる
            </button>
          </footer>
        </div>
      `;

      document.body.appendChild(modalRoot);

      modalBackdrop = /** @type {HTMLElement|null} */ (
        modalRoot.querySelector(".typo-modal__backdrop")
      );
      modalDialog = /** @type {HTMLElement|null} */ (
        modalRoot.querySelector(".typo-modal__dialog")
      );
      modalList = /** @type {HTMLElement|null} */ (
        modalRoot.querySelector("#ja-typo-modal-list")
      );
      modalCloseBtn = /** @type {HTMLButtonElement|null} */ (
        modalRoot.querySelector(".typo-modal__close")
      );

      if (modalBackdrop) {
        modalBackdrop.addEventListener("click", () => closeModal());
      }
      if (modalCloseBtn) {
        modalCloseBtn.addEventListener("click", () => closeModal());
      }

      // Esc キーで閉じる
      modalRoot.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeModal();
        }
      });
    }

    /**
     * テキスト全体に対してタイポ検査を行う
     * @param {string} text 検査対象テキスト
     * @returns {{hasError: boolean, items: Array<{type: "pattern"|"phrase", id: string, message: string, match: string, index: number, context: string}>}}
     */
    function check(text) {
      /** @type {Array<{type: "pattern"|"phrase", id: string, message: string, match: string, index: number, context: string}>} */
      const items = [];

      if (!text) {
        return { hasError: false, items };
      }

      // 正規表現パターンでの検出
      typoPatterns.forEach((pattern) => {
        let match;
        pattern.regex.lastIndex = 0; // 念のためリセット
        while ((match = pattern.regex.exec(text)) != null) {
          const matchedText = match[0];
          const index = match.index;
          const contextStart = Math.max(0, index - 15);
          const contextEnd = Math.min(text.length, index + matchedText.length + 15);
          const context = text.slice(contextStart, contextEnd).replace(/\r?\n/g, " ");

          items.push({
            type: "pattern",
            id: pattern.id,
            message: pattern.message,
            match: matchedText,
            index,
            context,
          });
        }
      });

      // 固定フレーズでの検出
      typoPhrases.forEach((phraseDef) => {
        let searchIndex = 0;
        const phrase = phraseDef.phrase;
        while (true) {
          const foundIndex = text.indexOf(phrase, searchIndex);
          if (foundIndex === -1) break;

          const contextStart = Math.max(0, foundIndex - 15);
          const contextEnd = Math.min(text.length, foundIndex + phrase.length + 15);
          const context = text.slice(contextStart, contextEnd).replace(/\r?\n/g, " ");

          items.push({
            type: "phrase",
            id: phraseDef.id,
            message: phraseDef.message,
            match: phrase,
            index: foundIndex,
            context,
          });

          searchIndex = foundIndex + phrase.length;
        }
      });

      return {
        hasError: items.length > 0,
        items,
      };
    }

    /**
     * 検査結果をモーダルで表示する
     * @param {{hasError: boolean, items: any[]}} result check() の結果オブジェクト
     */
    function openModal(result) {
      if (!result || !result.hasError) return;
      if (typeof document === "undefined") return;

      ensureModalDom();
      if (!modalRoot || !modalList) return;

      // リストを初期化
      modalList.innerHTML = "";

      result.items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "typo-modal__item";

        li.innerHTML = `
          <p class="typo-modal__item-main">${escapeHtml(item.message)}</p>
          <p class="typo-modal__item-sub">
            <span class="typo-modal__badge">該当箇所:</span>
            <span class="typo-modal__excerpt">${escapeHtml(item.context)}</span>
          </p>
        `;

        modalList.appendChild(li);
      });

      // フォーカス復帰用にアクティブ要素を保存
      lastActiveElement = /** @type {HTMLElement|null} */ (document.activeElement);

      modalRoot.classList.add("typo-modal--open");
      modalRoot.setAttribute("aria-hidden", "false");

      // ダイアログにフォーカスを移動
      if (modalDialog && typeof modalDialog.focus === "function") {
        modalDialog.setAttribute("tabindex", "-1");
        modalDialog.focus();
      }
    }

    /**
     * モーダルを閉じる
     */
    function closeModal() {
      if (!modalRoot) return;

      modalRoot.classList.remove("typo-modal--open");
      modalRoot.setAttribute("aria-hidden", "true");

      // 可能であれば元のフォーカス位置に戻す
      if (lastActiveElement && typeof lastActiveElement.focus === "function") {
        lastActiveElement.focus();
      }
      lastActiveElement = null;
    }

    // 公開 API
    return {
      /**
       * タイポ検査のみ行い、結果オブジェクトを返す
       */
      check,

      /**
       * 検査結果をモーダル表示する
       */
      openModal,

      /**
       * モーダルを閉じる
       */
      closeModal,

      /**
       * テキストにタイポが含まれるかどうかだけを知りたい場合のヘルパ
       */
      hasError(text) {
        const result = check(text);
        return result.hasError;
      },
    };
  }

  // グローバルにエクスポート
  // - app.js 側から root.JaTypoChecker として参照される
  root.JaTypoChecker = createJaTypoChecker();
})(globalThis);
