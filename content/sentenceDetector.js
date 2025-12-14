/**
 * 문장/문단 경계 감지
 * 선택된 텍스트가 속한 문장을 찾아 반환
 */
const SentenceDetector = {
  // 문장 분리 정규식 (마침표, 물음표, 느낌표 + 공백 또는 끝)
  SENTENCE_REGEX: /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g,

  // 선택된 텍스트가 포함된 문단 찾기 (텍스트 노드 기준)
  findSentence(selection) {
    if (!selection || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText) return null;

    // 선택된 텍스트가 속한 텍스트 노드 찾기
    let textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      // 요소 노드면 첫 번째 텍스트 노드 찾기
      const walker = document.createTreeWalker(
        textNode,
        NodeFilter.SHOW_TEXT,
        null
      );
      textNode = walker.nextNode();
    }

    if (!textNode) return null;

    // 텍스트 노드의 전체 내용을 문단으로 사용
    const paragraphText = textNode.textContent.trim().replace(/\s+/g, ' ');

    return {
      sentence: paragraphText,
      selectedText: selectedText,
      container: textNode.parentElement
    };
  },

  // 텍스트를 문장 단위로 분리
  _splitIntoSentences(text) {
    const matches = text.match(this.SENTENCE_REGEX);
    if (!matches) return [text];

    return matches
      .map(s => s.trim())
      .filter(s => s.length > 0);
  },

  // 적절한 텍스트 컨테이너 찾기 (p, article, section, div 등)
  _findTextContainer(node) {
    // 텍스트 노드면 부모로 이동
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    // 블록 레벨 요소를 찾을 때까지 올라감
    const blockElements = ['P', 'ARTICLE', 'SECTION', 'DIV', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

    while (node && node !== document.body) {
      if (blockElements.includes(node.tagName)) {
        return node;
      }
      node = node.parentElement;
    }

    return node;
  },

  // 페이지의 모든 문장/문단 끝 위치 찾기 (번역 연습 버튼 삽입용)
  findSentenceEndings(container = document.body) {
    const endings = [];

    // 문단 요소들 찾기
    const paragraphs = container.querySelectorAll('p, article > div, .paragraph, .content p');

    paragraphs.forEach((p, index) => {
      const text = p.textContent.trim();
      if (text.length > 20) { // 너무 짧은 문장은 제외
        endings.push({
          element: p,
          text: text,
          index: index
        });
      }
    });

    return endings;
  },

  // 영어 텍스트인지 확인
  isEnglishText(text) {
    // 영어 알파벳 비율로 판단
    const englishChars = text.match(/[a-zA-Z]/g);
    if (!englishChars) return false;

    const ratio = englishChars.length / text.length;
    return ratio > 0.5;
  }
};

// 전역으로 노출
window.SentenceDetector = SentenceDetector;
