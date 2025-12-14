/**
 * 번역 UI 관리 (팝업 메뉴, 번역 결과 표시)
 */
const TranslationUI = {
  menuElement: null,
  popupElement: null,

  // 팝업 메뉴 표시 (복사, 공유, 뜻 보기)
  showPopupMenu(rect, selection) {
    this.hideAll();

    const menu = document.createElement('div');
    menu.className = 'letmeknow-menu';
    menu.innerHTML = `
      <button class="letmeknow-menu-btn" data-action="copy">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        복사
      </button>
      <button class="letmeknow-menu-btn" data-action="share">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
        공유
      </button>
      <button class="letmeknow-menu-btn letmeknow-menu-btn-primary" data-action="translate">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
        </svg>
        뜻 보기
      </button>
    `;

    // 위치 설정
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 8}px`;

    document.body.appendChild(menu);
    this.menuElement = menu;

    // 이벤트 리스너
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.dataset.action;
      this._handleMenuAction(action, selection);
    });

    // 외부 클릭 시 닫기
    setTimeout(() => {
      document.addEventListener('click', this._handleOutsideClick);
    }, 0);
  },

  _handleMenuAction(action, selection) {
    switch (action) {
      case 'copy':
        navigator.clipboard.writeText(selection.text);
        this.hideAll();
        this._showToast('복사되었습니다');
        break;

      case 'share':
        if (navigator.share) {
          navigator.share({ text: selection.text });
        } else {
          navigator.clipboard.writeText(selection.text);
          this._showToast('클립보드에 복사되었습니다');
        }
        this.hideAll();
        break;

      case 'translate':
        this._requestTranslation(selection);
        break;
    }
  },

  // 바로 번역 요청 (메뉴 없이)
  async requestTranslationDirect(rect, selection) {
    this.hideAll();
    this._showLoadingPopup(rect);

    console.log('[LetMeKnow] 선택한 단어:', selection.text);
    console.log('[LetMeKnow] 감지된 문장:', selection.sentence);

    try {
      // 캐시 확인
      let chunks = TranslationCache.get(selection.sentence);
      console.log('[LetMeKnow] 캐시 히트:', chunks ? '있음' : '없음');

      if (!chunks) {
        // API 호출
        const response = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_SENTENCE',
          sentence: selection.sentence,
          selectedWord: selection.text
        });

        if (response.error) {
          throw new Error(response.error);
        }

        chunks = response;
        TranslationCache.set(selection.sentence, chunks);
      }

      // 선택된 단어가 포함된 청크 찾기
      const matchedChunk = TranslationCache.findChunkForWord(selection.sentence, selection.text);
      console.log('[LetMeKnow] 매칭된 청크:', matchedChunk);

      // 결과 표시
      this._showTranslationPopup(selection, chunks, matchedChunk);

    } catch (error) {
      this._showErrorPopup(error.message);
    }
  },

  async _requestTranslation(selection) {
    // 메뉴 숨기고 로딩 팝업 표시
    this.hideMenu();
    this._showLoadingPopup(selection.range.getBoundingClientRect());

    try {
      // 캐시 확인
      let chunks = TranslationCache.get(selection.sentence);

      if (!chunks) {
        // API 호출
        const response = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_SENTENCE',
          sentence: selection.sentence,
          selectedWord: selection.text
        });

        if (response.error) {
          throw new Error(response.error);
        }

        chunks = response;
        TranslationCache.set(selection.sentence, chunks);
      }

      // 선택된 단어가 포함된 청크 찾기
      const matchedChunk = TranslationCache.findChunkForWord(selection.sentence, selection.text);

      // 결과 표시
      this._showTranslationPopup(selection, chunks, matchedChunk);

    } catch (error) {
      this._showErrorPopup(error.message);
    }
  },

  _showLoadingPopup(rect) {
    this.hidePopup();

    const popup = document.createElement('div');
    popup.className = 'letmeknow-popup letmeknow-popup-loading';
    popup.innerHTML = `
      <div class="letmeknow-loading-spinner"></div>
      <span>번역 중...</span>
    `;

    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 8}px`;

    document.body.appendChild(popup);
    this.popupElement = popup;
  },

  _showTranslationPopup(selection, chunks, matchedChunk) {
    this.hidePopup();

    const rect = selection.range.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'letmeknow-popup letmeknow-popup-compact';

    // 선택한 단어의 번역만 표시
    if (matchedChunk) {
      popup.innerHTML = `
        <div class="letmeknow-word-result">
          <span class="letmeknow-word-en">${matchedChunk.en}</span>
          <span class="letmeknow-word-ko">${matchedChunk.ko}</span>
        </div>
        <button class="letmeknow-btn-more" data-word="${selection.text}">
          자세히 보기
        </button>
      `;
    } else {
      // 매칭되는 청크가 없으면 선택한 텍스트 그대로 표시
      popup.innerHTML = `
        <div class="letmeknow-word-result">
          <span class="letmeknow-word-en">${selection.text}</span>
          <span class="letmeknow-word-ko">번역을 찾을 수 없습니다</span>
        </div>
        <button class="letmeknow-btn-more" data-word="${selection.text}">
          자세히 보기
        </button>
      `;
    }

    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 8}px`;

    document.body.appendChild(popup);
    this.popupElement = popup;

    // 자세히 보기 버튼
    popup.querySelector('.letmeknow-btn-more').addEventListener('click', async (e) => {
      const word = e.target.dataset.word;
      await this._showDetailedExplanation(word, selection.sentence, rect);
    });

    // 외부 클릭 시 닫기
    setTimeout(() => {
      document.addEventListener('click', this._handleOutsideClick);
    }, 0);
  },

  async _showDetailedExplanation(word, sentence, rect) {
    this.hidePopup();
    this._showLoadingPopup(rect);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPLAIN_WORD',
        word: word,
        sentence: sentence
      });

      if (response.error) {
        throw new Error(response.error);
      }

      this.hidePopup();

      const popup = document.createElement('div');
      popup.className = 'letmeknow-popup letmeknow-popup-detail';
      popup.innerHTML = `
        <div class="letmeknow-popup-header">
          <span class="letmeknow-popup-title">"${word}" 상세 설명</span>
          <button class="letmeknow-popup-close">&times;</button>
        </div>
        <div class="letmeknow-popup-content">
          <div class="letmeknow-explanation">${this._formatExplanation(response.explanation)}</div>
        </div>
      `;

      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.style.top = `${rect.bottom + window.scrollY + 8}px`;

      document.body.appendChild(popup);
      this.popupElement = popup;

      popup.querySelector('.letmeknow-popup-close').addEventListener('click', () => {
        this.hideAll();
      });

    } catch (error) {
      this._showErrorPopup(error.message);
    }
  },

  _formatExplanation(text) {
    // 마크다운 스타일 포맷팅
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  },

  _showErrorPopup(message) {
    this.hidePopup();

    const popup = document.createElement('div');
    popup.className = 'letmeknow-popup letmeknow-popup-error';
    popup.innerHTML = `
      <div class="letmeknow-popup-header">
        <span class="letmeknow-popup-title">오류</span>
        <button class="letmeknow-popup-close">&times;</button>
      </div>
      <div class="letmeknow-popup-content">
        <p>${message}</p>
      </div>
    `;

    popup.style.left = '50%';
    popup.style.top = '20%';
    popup.style.transform = 'translateX(-50%)';

    document.body.appendChild(popup);
    this.popupElement = popup;

    popup.querySelector('.letmeknow-popup-close').addEventListener('click', () => {
      this.hideAll();
    });
  },

  _showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'letmeknow-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('letmeknow-toast-fade');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  },

  _handleOutsideClick: function(e) {
    if (!e.target.closest('.letmeknow-menu') && !e.target.closest('.letmeknow-popup')) {
      TranslationUI.hideAll();
    }
  },

  hideMenu() {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
    }
    document.removeEventListener('click', this._handleOutsideClick);
  },

  hidePopup() {
    if (this.popupElement) {
      this.popupElement.remove();
      this.popupElement = null;
    }
  },

  hideAll() {
    this.hideMenu();
    this.hidePopup();
    document.removeEventListener('click', this._handleOutsideClick);
  }
};

// 전역으로 노출
window.TranslationUI = TranslationUI;
