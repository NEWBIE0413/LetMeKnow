/**
 * LetMeKnow 메인 콘텐츠 스크립트
 * 모든 모듈을 초기화
 */
(function() {
  'use strict';

  // 이미 초기화되었는지 확인
  if (window.letMeKnowInitialized) return;
  window.letMeKnowInitialized = true;

  console.log('[LetMeKnow] 확장 프로그램 로드됨');

  // 모듈 초기화
  function init() {
    // 선택 핸들러 초기화
    if (window.SelectionHandler) {
      SelectionHandler.init();
      console.log('[LetMeKnow] 선택 핸들러 초기화됨');
    }

    // 번역 연습 모드 초기화
    if (window.PracticeMode) {
      PracticeMode.init();
      console.log('[LetMeKnow] 번역 연습 모드 초기화됨');
    }
  }

  // DOM이 준비되면 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ESC 키로 모든 UI 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (window.TranslationUI) {
        TranslationUI.hideAll();
      }
      if (window.PracticeMode) {
        PracticeMode.hidePracticeUI();
      }
    }
  });
})();
