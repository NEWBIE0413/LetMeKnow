/**
 * 텍스트 선택(드래그) 감지 및 처리
 */
const SelectionHandler = {
  isEnabled: true,
  currentSelection: null,

  init() {
    document.addEventListener('mouseup', this._handleMouseUp.bind(this));
    document.addEventListener('keyup', this._handleKeyUp.bind(this));
  },

  _handleMouseUp(e) {
    if (!this.isEnabled) return;

    // 약간의 딜레이 후 선택 확인 (드래그 완료 대기)
    setTimeout(() => {
      this._processSelection(e);
    }, 10);
  },

  _handleKeyUp(e) {
    // Shift + 방향키로 선택한 경우
    if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      this._processSelection(e);
    }
  },

  _processSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // 선택된 텍스트가 없거나, LetMeKnow UI 내부 클릭이면 무시
    if (!selectedText || this._isInOwnUI(e.target)) {
      return;
    }

    // 영어 텍스트인지 확인
    if (!SentenceDetector.isEnglishText(selectedText)) {
      return;
    }

    // 문장 정보 가져오기
    const sentenceInfo = SentenceDetector.findSentence(selection);
    if (!sentenceInfo) return;

    this.currentSelection = {
      text: selectedText,
      sentence: sentenceInfo.sentence,
      range: selection.getRangeAt(0).cloneRange()
    };

    // 바로 번역 요청
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    TranslationUI.requestTranslationDirect(rect, this.currentSelection);
  },

  _isInOwnUI(target) {
    return target.closest('.letmeknow-popup') ||
           target.closest('.letmeknow-menu') ||
           target.closest('.letmeknow-practice');
  },

  // 선택 해제
  clearSelection() {
    window.getSelection().removeAllRanges();
    this.currentSelection = null;
  },

  // 활성화/비활성화
  enable() {
    this.isEnabled = true;
  },

  disable() {
    this.isEnabled = false;
  }
};

// 전역으로 노출
window.SelectionHandler = SelectionHandler;
