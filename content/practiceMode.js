/**
 * 번역 연습 모드
 * 문장/문단 끝에 버튼을 삽입하고 사용자가 번역 연습을 할 수 있도록 함
 */
const PracticeMode = {
  isActive: false,
  observedElements: new Set(),
  practiceUI: null,

  init() {
    // 페이지 로드 후 버튼 삽입
    this._insertPracticeButtons();

    // 동적 콘텐츠 대응
    this._observeDOM();
  },

  _insertPracticeButtons() {
    // 모든 텍스트 노드를 순회하며 문단 끝 찾기
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent.trim();
          // 영어 텍스트이고 문장 끝(. ! ?)으로 끝나는 경우
          if (text.length > 30 &&
              SentenceDetector.isEnglishText(text) &&
              /[.!?]$/.test(text)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach((textNode) => {
      // 이미 처리된 텍스트 노드면 스킵
      if (this.observedElements.has(textNode)) return;

      const text = textNode.textContent.trim();
      if (text.length < 30 || !SentenceDetector.isEnglishText(text)) return;

      // 텍스트 노드 뒤에 버튼 삽입
      this._addPracticeButtonAfterText(textNode, text);
      this.observedElements.add(textNode);
    });
  },

  _addPracticeButtonAfterText(textNode, text) {
    // 앱 아이콘 버튼 생성
    const btn = document.createElement('button');
    btn.className = 'letmeknow-icon-btn';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
    `;
    btn.title = 'LetMeKnow';

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showActionMenu(btn, text);
    });

    // 텍스트 노드 바로 뒤에 버튼 삽입
    const parent = textNode.parentElement;
    if (parent) {
      if (textNode.nextSibling) {
        parent.insertBefore(btn, textNode.nextSibling);
      } else {
        parent.appendChild(btn);
      }
    }
  },

  _showActionMenu(anchorBtn, text) {
    // 기존 메뉴 제거
    this._hideActionMenu();

    const menu = document.createElement('div');
    menu.className = 'letmeknow-action-menu';
    menu.innerHTML = `
      <button class="letmeknow-action-item" data-action="view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        번역 보기
      </button>
      <button class="letmeknow-action-item" data-action="practice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        번역 해보기
      </button>
    `;

    // 위치 설정
    const rect = anchorBtn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.zIndex = '999999';

    document.body.appendChild(menu);
    this.actionMenu = menu;

    // 이벤트 리스너
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.letmeknow-action-item');
      if (!item) return;

      const action = item.dataset.action;
      this._hideActionMenu();

      if (action === 'view') {
        this._showTranslationView(text);
      } else if (action === 'practice') {
        this._showPracticeUI(null, text);
      }
    });

    // 외부 클릭 시 닫기
    setTimeout(() => {
      document.addEventListener('click', this._handleMenuOutsideClick);
    }, 0);
  },

  _handleMenuOutsideClick: function(e) {
    if (!e.target.closest('.letmeknow-action-menu') && !e.target.closest('.letmeknow-icon-btn')) {
      PracticeMode._hideActionMenu();
    }
  },

  _hideActionMenu() {
    if (this.actionMenu) {
      this.actionMenu.remove();
      this.actionMenu = null;
    }
    document.removeEventListener('click', this._handleMenuOutsideClick);
  },

  async _showTranslationView(text) {
    // 로딩 모달 표시
    const loading = document.createElement('div');
    loading.className = 'letmeknow-popup letmeknow-popup-loading';
    loading.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999999;';
    loading.innerHTML = `<div class="letmeknow-loading-spinner"></div><span>번역 중...</span>`;
    document.body.appendChild(loading);

    const normalizedText = text.trim().replace(/\s+/g, ' ');

    try {
      // 청크 번역 (캐시 확인)
      let chunks = TranslationCache.get(normalizedText);

      if (!chunks) {
        const chunkResponse = await chrome.runtime.sendMessage({
          type: 'TRANSLATE_SENTENCE',
          sentence: normalizedText,
          selectedWord: ''
        });

        if (chunkResponse.error) {
          throw new Error(chunkResponse.error);
        }

        chunks = chunkResponse;
        TranslationCache.set(normalizedText, chunks);
      }

      // 자연스러운 번역
      const naturalResponse = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_PARAGRAPH',
        text: normalizedText
      });

      if (naturalResponse.error) {
        throw new Error(naturalResponse.error);
      }

      loading.remove();

      // 번역 뷰 표시 (청크 + 자연스러운 번역)
      this._renderTranslationView(normalizedText, chunks, naturalResponse.translation);

    } catch (error) {
      loading.remove();
      alert('번역 오류: ' + error.message);
    }
  },

  _renderTranslationView(originalText, chunks, naturalTranslation) {
    const modal = document.createElement('div');
    modal.className = 'letmeknow-translation-modal';

    // 청크 HTML 생성
    let chunksHtml = '';
    if (chunks.chunks && chunks.chunks.length > 0) {
      chunksHtml = chunks.chunks.map(chunk => `
        <div class="letmeknow-chunk-card">
          <div class="letmeknow-chunk-en">${chunk.en}</div>
          <div class="letmeknow-chunk-ko">${chunk.ko}</div>
        </div>
      `).join('');
    }

    modal.innerHTML = `
      <div class="letmeknow-modal-overlay"></div>
      <div class="letmeknow-modal-content">
        <div class="letmeknow-modal-header">
          <span>번역</span>
          <button class="letmeknow-modal-close">&times;</button>
        </div>
        <div class="letmeknow-modal-body">
          <div class="letmeknow-section">
            <div class="letmeknow-section-title">단어/표현 매핑</div>
            <div class="letmeknow-chunks-grid">${chunksHtml}</div>
          </div>
          <div class="letmeknow-translation-divider"></div>
          <div class="letmeknow-section">
            <div class="letmeknow-section-title">자연스러운 번역</div>
            <div class="letmeknow-translation-result">${naturalTranslation}</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.translationModal = modal;

    // 닫기 이벤트
    modal.querySelector('.letmeknow-modal-close').addEventListener('click', () => {
      this._hideTranslationView();
    });
    modal.querySelector('.letmeknow-modal-overlay').addEventListener('click', () => {
      this._hideTranslationView();
    });
  },

  _hideTranslationView() {
    if (this.translationModal) {
      this.translationModal.remove();
      this.translationModal = null;
    }
  },

  _addPracticeButton(element) {
    // 이미 버튼이 있으면 스킵
    if (element.querySelector('.letmeknow-practice-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'letmeknow-practice-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      번역해보기
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showPracticeUI(element);
    });

    // 문단 끝에 버튼 삽입
    element.style.position = 'relative';
    element.appendChild(btn);
  },

  _showPracticeUI(paragraphElement, providedText = null) {
    // 기존 UI 제거
    this.hidePracticeUI();

    const text = providedText || paragraphElement.textContent
      .replace('번역해보기', '')
      .trim();

    const ui = document.createElement('div');
    ui.className = 'letmeknow-practice';
    ui.innerHTML = `
      <div class="letmeknow-practice-header">
        <span>직접 번역해보세요</span>
        <button class="letmeknow-practice-close">&times;</button>
      </div>
      <div class="letmeknow-practice-original">${text}</div>
      <textarea
        class="letmeknow-practice-input"
        placeholder="한국어로 번역을 입력하세요..."
        rows="4"
      ></textarea>
      <div class="letmeknow-practice-actions">
        <button class="letmeknow-practice-submit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          피드백 받기
        </button>
        <span class="letmeknow-practice-hint">Enter로 제출</span>
      </div>
      <div class="letmeknow-practice-feedback"></div>
    `;

    // UI 삽입 (모달 형태로 body에 추가)
    document.body.appendChild(ui);
    ui.style.position = 'fixed';
    ui.style.top = '50%';
    ui.style.left = '50%';
    ui.style.transform = 'translate(-50%, -50%)';
    ui.style.zIndex = '999999';
    ui.style.maxWidth = '600px';
    ui.style.width = '90%';
    this.practiceUI = ui;

    // 텍스트 영역 포커스
    const textarea = ui.querySelector('.letmeknow-practice-input');
    textarea.focus();

    // 이벤트 리스너
    ui.querySelector('.letmeknow-practice-close').addEventListener('click', () => {
      this.hidePracticeUI();
    });

    ui.querySelector('.letmeknow-practice-submit').addEventListener('click', () => {
      this._submitTranslation(text, textarea.value);
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._submitTranslation(text, textarea.value);
      }
    });
  },

  async _submitTranslation(original, userTranslation) {
    if (!userTranslation.trim()) {
      this._showError('번역을 입력해주세요.');
      return;
    }

    const feedbackContainer = this.practiceUI.querySelector('.letmeknow-practice-feedback');
    const submitBtn = this.practiceUI.querySelector('.letmeknow-practice-submit');

    // 로딩 상태
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="letmeknow-loading-spinner-small"></div> 분석 중...';
    feedbackContainer.innerHTML = '';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'FEEDBACK_TRANSLATION',
        original: original,
        userTranslation: userTranslation
      });

      if (response.error) {
        throw new Error(response.error);
      }

      this._showFeedback(response.feedback);

    } catch (error) {
      this._showError(error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        다시 제출
      `;
    }
  },

  _showFeedback(feedback) {
    const feedbackContainer = this.practiceUI.querySelector('.letmeknow-practice-feedback');

    // 마크다운 스타일 포맷팅
    const formattedFeedback = feedback
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    feedbackContainer.innerHTML = `
      <div class="letmeknow-feedback-content">
        ${formattedFeedback}
      </div>
    `;
    feedbackContainer.classList.add('letmeknow-feedback-visible');
  },

  _showError(message) {
    const feedbackContainer = this.practiceUI.querySelector('.letmeknow-practice-feedback');
    feedbackContainer.innerHTML = `
      <div class="letmeknow-feedback-error">
        ${message}
      </div>
    `;
    feedbackContainer.classList.add('letmeknow-feedback-visible');
  },

  hidePracticeUI() {
    if (this.practiceUI) {
      this.practiceUI.remove();
      this.practiceUI = null;
    }
  },

  _observeDOM() {
    // MutationObserver로 동적으로 추가되는 콘텐츠 감지
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        // 디바운싱
        clearTimeout(this._updateTimeout);
        this._updateTimeout = setTimeout(() => {
          this._insertPracticeButtons();
        }, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

// 전역으로 노출
window.PracticeMode = PracticeMode;
