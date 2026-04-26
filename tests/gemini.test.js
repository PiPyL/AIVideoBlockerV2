const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

vm.runInThisContext(fs.readFileSync(path.join(root, 'utils/gemini.js'), 'utf8'));

test('Gemini policy block khi AI confidence cao', () => {
  assert.equal(GeminiClassifier.shouldBlockResult({
    isAI: true,
    aiConfidence: 0.8,
    childRiskScore: 0.1,
    decision: 'caution'
  }), true);
});

test('Gemini policy block khi child-risk cao dù không AI', () => {
  assert.equal(GeminiClassifier.shouldBlockResult({
    isAI: false,
    aiConfidence: 0.1,
    childRiskScore: 0.72,
    decision: 'caution'
  }), true);
});

test('Gemini caution không tự block nếu dưới ngưỡng', () => {
  assert.equal(GeminiClassifier.shouldBlockResult({
    isAI: false,
    aiConfidence: 0.4,
    childRiskScore: 0.35,
    decision: 'caution'
  }), false);
});

test('Cache key gồm videoId, model, prompt, thumbnail và detector version', () => {
  const withThumb = GeminiClassifier.getCacheKey({
    videoId: 'SyloKZe6BNE',
    model: 'gemini-3.1-flash-lite-preview',
    promptVersion: 1,
    includeThumbnail: true,
    detectorVersion: 7
  });
  const withoutThumb = GeminiClassifier.getCacheKey({
    videoId: 'SyloKZe6BNE',
    model: 'gemini-3.1-flash-lite-preview',
    promptVersion: 1,
    includeThumbnail: false,
    detectorVersion: 7
  });

  assert.notEqual(withThumb, withoutThumb);
  assert.match(withThumb, /SyloKZe6BNE/);
  assert.match(withThumb, /thumb1/);
  assert.match(withThumb, /d7/);
});

test('Cache TTL giữ block 30 ngày, allow 7 ngày, error 15 phút', () => {
  const now = Date.now();
  assert.equal(GeminiClassifier.isCacheEntryValid({
    status: 'block',
    timestamp: now - 29 * 24 * 60 * 60 * 1000
  }, now), true);
  assert.equal(GeminiClassifier.isCacheEntryValid({
    status: 'allow',
    timestamp: now - 8 * 24 * 60 * 60 * 1000
  }, now), false);
  assert.equal(GeminiClassifier.isCacheEntryValid({
    status: 'error',
    timestamp: now - 16 * 60 * 1000
  }, now), false);
});

test('Request body không có image part khi tắt thumbnail', () => {
  const body = GeminiClassifier.buildRequestBody({
    videoId: 'SyloKZe6BNE',
    title: 'AI video',
    localDetection: {}
  }, GeminiClassifier.normalizeSettings({ includeThumbnail: false }, 7));

  assert.equal(body.contents[0].parts.length, 1);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(body.generationConfig.responseJsonSchema.required.includes('decision'));
});

test('Request body có inline image khi bật thumbnail', () => {
  const body = GeminiClassifier.buildRequestBody({
    videoId: 'SyloKZe6BNE',
    title: 'AI video',
    localDetection: {}
  }, GeminiClassifier.normalizeSettings({ includeThumbnail: true }, 7), {
    data: 'AAEC',
    mimeType: 'image/jpeg'
  });

  assert.equal(body.contents[0].parts.length, 2);
  assert.deepEqual(body.contents[0].parts[1], {
    inline_data: {
      mime_type: 'image/jpeg',
      data: 'AAEC'
    }
  });
});

test('Normalize API response tạo detection block cho AI cao', () => {
  const detection = GeminiClassifier.normalizeApiResponse({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            isAI: true,
            aiConfidence: 0.82,
            childRiskScore: 0.1,
            riskLevel: 'caution',
            riskCategories: [],
            decision: 'caution',
            reason: 'Dấu hiệu video tạo sinh rõ.',
            evidence: ['title có AI video']
          })
        }]
      }
    }]
  }, {
    videoId: 'SyloKZe6BNE',
    model: 'gemini-3.1-flash-lite-preview',
    promptVersion: 1,
    includeThumbnail: false,
    detectorVersion: 7
  });

  assert.equal(detection.shouldBlock, true);
  assert.equal(detection.method, 'gemini');
  assert.equal(detection.signalCounts.strong, 1);
});
