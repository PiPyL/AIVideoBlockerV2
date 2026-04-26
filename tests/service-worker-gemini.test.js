const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function createWorkerHarness({ fetchImpl, gemini = {} } = {}) {
  const storageData = {};
  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    URL,
    AbortController,
    Uint8Array,
    Buffer,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    fetch: fetchImpl || (async () => jsonResponse(geminiAllowPayload()))
  });

  context.chrome = {
    storage: {
      local: {
        get: async (key) => {
          if (typeof key === 'string') return { [key]: storageData[key] };
          if (Array.isArray(key)) {
            return Object.fromEntries(key.map((item) => [item, storageData[item]]));
          }
          return { ...storageData };
        },
        set: async (value) => {
          Object.assign(storageData, value);
        }
      },
      onChanged: { addListener: () => {} }
    },
    runtime: {
      onMessage: { addListener: (listener) => { context.__messageListener = listener; } },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      sendMessage: () => {}
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {}
    },
    tabs: {
      query: async () => [],
      sendMessage: async () => {}
    }
  };

  context.importScripts = (...files) => {
    for (const file of files) {
      const localPath = path.join(root, file.replace(/^\//, ''));
      vm.runInContext(fs.readFileSync(localPath, 'utf8'), context, { filename: file });
    }
  };

  vm.runInContext(
    fs.readFileSync(path.join(root, 'background/service-worker.js'), 'utf8'),
    context,
    { filename: 'background/service-worker.js' }
  );

  storageData.settings = {
    ...context.StorageManager.DEFAULT_SETTINGS,
    gemini: {
      ...context.StorageManager.DEFAULT_SETTINGS.gemini,
      enabled: true,
      apiKey: 'test-key',
      ...gemini
    }
  };
  storageData.geminiCache = {};
  storageData.videoCache = {};

  return {
    context,
    storageData,
    send: (message) => context.handleMessage(message, {})
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
  };
}

function imageResponse() {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'image/jpeg' },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
  };
}

function geminiPayload(overrides = {}) {
  return {
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            isAI: false,
            aiConfidence: 0.1,
            childRiskScore: 0.1,
            riskLevel: 'safe',
            riskCategories: [],
            decision: 'allow',
            reason: 'Không thấy dấu hiệu rủi ro rõ.',
            evidence: [],
            ...overrides
          })
        }]
      }
    }]
  };
}

function geminiAllowPayload() {
  return geminiPayload();
}

function classifyPayload(localDetection = {}) {
  return {
    type: 'GEMINI_CLASSIFY_VIDEO',
    payload: {
      videoId: 'SyloKZe6BNE',
      title: 'Example video',
      channel: 'Example Channel',
      description: 'Description',
      captionExcerpt: 'Caption',
      detectorVersion: 7,
      localDetection
    }
  };
}

test('Local block không gọi Gemini', async () => {
  let fetchCount = 0;
  const harness = createWorkerHarness({
    fetchImpl: async () => {
      fetchCount++;
      return jsonResponse(geminiAllowPayload());
    }
  });

  const result = await harness.send(classifyPayload({ shouldBlock: true, isAI: true }));

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'local_block');
  assert.equal(fetchCount, 0);
});

test('Thiếu API key thì fallback local và không gọi API', async () => {
  let fetchCount = 0;
  const harness = createWorkerHarness({
    gemini: { apiKey: '' },
    fetchImpl: async () => {
      fetchCount++;
      return jsonResponse(geminiAllowPayload());
    }
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'missing_api_key');
  assert.equal(fetchCount, 0);
});

test('Watch safe gửi request nền và cache allow', async () => {
  let requestBody = null;
  const harness = createWorkerHarness({
    fetchImpl: async (url, options) => {
      requestBody = JSON.parse(options.body);
      return jsonResponse(geminiAllowPayload());
    }
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));
  const cacheEntries = Object.values(harness.storageData.geminiCache);

  assert.equal(result.ok, true);
  assert.equal(result.detection.shouldBlock, false);
  assert.equal(cacheEntries.length, 1);
  assert.equal(cacheEntries[0].status, 'allow');
  assert.equal(requestBody.contents[0].parts.length, 1);
});

test('Gemini AI confidence cao thì block và cache block', async () => {
  const harness = createWorkerHarness({
    fetchImpl: async () => jsonResponse(geminiPayload({
      isAI: true,
      aiConfidence: 0.82,
      decision: 'caution',
      reason: 'Video có dấu hiệu tạo sinh.'
    }))
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));
  const cacheEntries = Object.values(harness.storageData.geminiCache);

  assert.equal(result.ok, true);
  assert.equal(result.detection.shouldBlock, true);
  assert.equal(result.detection.method, 'gemini');
  assert.equal(cacheEntries[0].status, 'block');
});

test('Gemini child-risk cao thì block dù không AI', async () => {
  const harness = createWorkerHarness({
    fetchImpl: async () => jsonResponse(geminiPayload({
      isAI: false,
      aiConfidence: 0.1,
      childRiskScore: 0.76,
      riskLevel: 'block',
      riskCategories: ['violence'],
      decision: 'block',
      reason: 'Có nội dung bạo lực.'
    }))
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));

  assert.equal(result.detection.shouldBlock, true);
  assert.equal(result.detection.riskCategories.includes('violence'), true);
});

test('429 tạo transient cache và lần sau không gọi lại ngay', async () => {
  let fetchCount = 0;
  const harness = createWorkerHarness({
    fetchImpl: async () => {
      fetchCount++;
      return jsonResponse({ error: { message: 'quota' } }, 429);
    }
  });

  const first = await harness.send(classifyPayload({ shouldBlock: false }));
  const second = await harness.send(classifyPayload({ shouldBlock: false }));
  const cacheEntries = Object.values(harness.storageData.geminiCache);

  assert.equal(first.ok, false);
  assert.equal(first.reason, 'rate_limited');
  assert.equal(second.cached, true);
  assert.equal(cacheEntries[0].status, 'error');
  assert.equal(fetchCount, 1);
});

test('Invalid JSON/schema mismatch fallback và cache transient', async () => {
  const harness = createWorkerHarness({
    fetchImpl: async () => jsonResponse({
      candidates: [{ content: { parts: [{ text: 'not-json' }] } }]
    })
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));
  const cacheEntries = Object.values(harness.storageData.geminiCache);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_response');
  assert.equal(cacheEntries[0].status, 'error');
});

test('Schema mismatch fallback và cache transient', async () => {
  const harness = createWorkerHarness({
    fetchImpl: async () => jsonResponse({
      candidates: [{ content: { parts: [{ text: '{}' }] } }]
    })
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));
  const cacheEntries = Object.values(harness.storageData.geminiCache);

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_response');
  assert.equal(cacheEntries[0].status, 'error');
});

test('Invalid API key không tạo cache video', async () => {
  const harness = createWorkerHarness({
    fetchImpl: async () => jsonResponse({ error: { message: 'invalid' } }, 403)
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_api_key');
  assert.equal(Object.keys(harness.storageData.geminiCache).length, 0);
});

test('Feed/search dùng cache Gemini theo videoId mà không gọi API', async () => {
  let fetchCount = 0;
  const harness = createWorkerHarness({
    fetchImpl: async () => {
      fetchCount++;
      return jsonResponse(geminiAllowPayload());
    }
  });
  const settings = await harness.context.StorageManager.getSettings();
  const geminiSettings = harness.context.GeminiClassifier.normalizeSettings(settings.gemini, 7);
  const cacheKey = harness.context.GeminiClassifier.getCacheKey({
    videoId: 'SyloKZe6BNE',
    model: geminiSettings.model,
    promptVersion: geminiSettings.promptVersion,
    includeThumbnail: geminiSettings.includeThumbnail,
    detectorVersion: 7
  });
  harness.storageData.geminiCache[cacheKey] = {
    status: 'block',
    timestamp: Date.now(),
    detection: {
      videoId: 'SyloKZe6BNE',
      shouldBlock: true,
      isAI: true,
      method: 'gemini',
      riskLevel: 'caution',
      signalCounts: { strong: 1, medium: 0, weak: 0 },
      riskCategories: []
    }
  };

  const result = await harness.send({
    type: 'GET_GEMINI_CACHE_BATCH',
    videoIds: ['SyloKZe6BNE']
  });

  assert.equal(result.detections.SyloKZe6BNE.shouldBlock, true);
  assert.equal(fetchCount, 0);
});

test('Thumbnail option bật thì payload có image part', async () => {
  let apiRequestBody = null;
  const harness = createWorkerHarness({
    gemini: { includeThumbnail: true },
    fetchImpl: async (url, options) => {
      if (String(url).includes('i.ytimg.com')) return imageResponse();
      apiRequestBody = JSON.parse(options.body);
      return jsonResponse(geminiAllowPayload());
    }
  });

  const result = await harness.send(classifyPayload({ shouldBlock: false }));

  assert.equal(result.ok, true);
  assert.equal(apiRequestBody.contents[0].parts.length, 2);
  assert.ok(apiRequestBody.contents[0].parts[1].inline_data.data);
});
