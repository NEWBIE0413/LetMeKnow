/**
 * 번역 캐시 관리
 * 문장 단위로 청크 번역을 캐싱하여 API 호출 최소화
 */
const TranslationCache = {
  cache: new Map(),

  // 문장의 해시 생성 (캐시 키로 사용)
  _hashSentence(sentence) {
    // 정규화: 공백 통일, 소문자 변환
    return sentence
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');  // 여러 공백을 하나로
  },

  // 캐시에서 문장 번역 가져오기
  get(sentence) {
    const key = this._hashSentence(sentence);
    const cached = this.cache.get(key);

    if (cached) {
      // 30분 이내의 캐시만 유효
      if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
        return cached.data;
      }
      // 만료된 캐시 삭제
      this.cache.delete(key);
    }
    return null;
  },

  // 캐시에 문장 번역 저장
  set(sentence, data) {
    const key = this._hashSentence(sentence);
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });

    // 캐시 크기 제한 (최대 100개)
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  },

  // 특정 단어가 포함된 청크 찾기
  findChunkForWord(sentence, word) {
    const cached = this.get(sentence);
    if (!cached || !cached.chunks) return null;

    const wordLower = word.toLowerCase();

    for (const chunk of cached.chunks) {
      if (chunk.en.toLowerCase().includes(wordLower)) {
        return chunk;
      }
    }
    return null;
  },

  // 캐시 전체 클리어
  clear() {
    this.cache.clear();
  }
};

// 전역으로 노출
window.TranslationCache = TranslationCache;
