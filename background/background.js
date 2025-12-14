const MODEL = 'google/gemini-2.0-flash-001';

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRANSLATE_SENTENCE') {
    handleTranslateSentence(request.sentence, request.selectedWord)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // 비동기 응답을 위해 true 반환
  }

  if (request.type === 'EXPLAIN_WORD') {
    handleExplainWord(request.word, request.sentence)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.type === 'FEEDBACK_TRANSLATION') {
    handleFeedbackTranslation(request.original, request.userTranslation)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.type === 'TRANSLATE_PARAGRAPH') {
    handleTranslateParagraph(request.text)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// API 키 가져오기
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['openrouterApiKey'], (result) => {
      resolve(result.openrouterApiKey);
    });
  });
}

// OpenRouter API 호출
async function callOpenRouter(messages) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('API 키가 설정되지 않았습니다. 확장 프로그램 아이콘을 클릭하여 API 키를 설정해주세요.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://letmeknow',
      'X-Title': 'LetMeKnow'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: messages,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API 호출 실패');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// 문장을 청크 단위로 번역
async function handleTranslateSentence(sentence, selectedWord) {
  const prompt = `영어 문장을 단어/표현 단위로 쪼개서 한국어와 1:1 매핑하세요.

규칙:
1. 최대한 작은 단위로 분리 (1~2단어가 이상적)
2. 관용구/숙어는 하나로 묶기
3. 관사(a, an, the)는 명사와 분리
4. 전치사는 단독으로 분리
5. JSON만 응답

문장: "${sentence}"

응답: {"chunks": [{"en": "단어", "ko": "뜻"}, ...]}`;

  const response = await callOpenRouter([
    { role: 'user', content: prompt }
  ]);

  console.log('[LetMeKnow] 원본 AI 응답:', response);
  console.log('[LetMeKnow] 응답 타입:', typeof response);
  console.log('[LetMeKnow] 응답 길이:', response?.length);

  try {
    // JSON 파싱 시도
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    console.log('[LetMeKnow] JSON 매칭 결과:', jsonMatch ? jsonMatch[0] : 'null');

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[LetMeKnow] 파싱 성공:', parsed);
      return parsed;
    }
    throw new Error('JSON 매칭 실패 - 응답에서 JSON 형식을 찾을 수 없음');
  } catch (e) {
    console.error('[LetMeKnow] 파싱 에러:', e.message);
    console.error('[LetMeKnow] 파싱 실패한 응답 전문:', response);
    return {
      error: `AI 응답 파싱 실패: ${e.message}`,
      raw: response,
      debugInfo: {
        responseType: typeof response,
        responseLength: response?.length,
        first100Chars: response?.substring(0, 100)
      }
    };
  }
}

// 단어 상세 설명
async function handleExplainWord(word, sentence) {
  const prompt = `당신은 영어 교육 전문가입니다. 다음 문장에서 "${word}"라는 단어/표현의 의미를 설명해주세요.

문장: "${sentence}"

다음 형식으로 응답해주세요:
1. **이 문맥에서의 뜻**: (이 문장에서 사용된 정확한 의미)
2. **다른 뜻들**: (해당 단어의 다른 일반적인 뜻들을 나열)
3. **이렇게 쓰인 이유**: (왜 이 문맥에서 이런 뜻으로 사용되었는지 설명)
4. **예문**: (비슷한 용법의 예문 1개)`;

  const response = await callOpenRouter([
    { role: 'user', content: prompt }
  ]);

  return { explanation: response };
}

// 번역 피드백
async function handleFeedbackTranslation(original, userTranslation) {
  const prompt = `당신은 영어 번역 교육 전문가입니다. 사용자의 번역을 분석하고 상세한 피드백을 제공해주세요.

원문: "${original}"
사용자 번역: "${userTranslation}"

다음 형식으로 상세히 피드백해주세요:

1. **전체 평가**: (훌륭함/좋음/보통/아쉬움 중 하나 + 한 줄 코멘트)
2. **잘한 점**: (구체적으로 어떤 부분을 잘 번역했는지)
3. **개선할 점**: (틀린 부분이나 어색한 표현이 있다면 지적)
4. **추천 번역**: (자연스러운 한국어 번역 제안)
5. **학습 포인트**: (이 문장에서 배울 수 있는 문법/표현/어휘 팁)`;

  const response = await callOpenRouter([
    { role: 'user', content: prompt }
  ]);

  return { feedback: response };
}

// 문단 자연스러운 번역
async function handleTranslateParagraph(text) {
  const prompt = `다음 영어 문단을 자연스러운 한국어로 번역해주세요.
직역이 아닌, 한국어로 읽었을 때 자연스럽게 느껴지도록 의역해주세요.
번역문만 출력하세요.

${text}`;

  const response = await callOpenRouter([
    { role: 'user', content: prompt }
  ]);

  return { translation: response };
}
