document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // 저장된 API 키 불러오기
  chrome.storage.sync.get(['openrouterApiKey'], (result) => {
    if (result.openrouterApiKey) {
      apiKeyInput.value = result.openrouterApiKey;
    }
  });

  // 저장 버튼 클릭
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('API 키를 입력해주세요.', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-or-')) {
      showStatus('유효한 OpenRouter API 키 형식이 아닙니다.', 'error');
      return;
    }

    // API 키 유효성 검사
    saveBtn.disabled = true;
    saveBtn.textContent = '확인 중...';

    try {
      const isValid = await validateApiKey(apiKey);

      if (isValid) {
        chrome.storage.sync.set({ openrouterApiKey: apiKey }, () => {
          showStatus('저장되었습니다!', 'success');
        });
      } else {
        showStatus('API 키가 유효하지 않습니다.', 'error');
      }
    } catch (error) {
      showStatus('API 키 확인 중 오류가 발생했습니다.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;

    setTimeout(() => {
      status.className = 'status';
    }, 3000);
  }

  async function validateApiKey(apiKey) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
});
