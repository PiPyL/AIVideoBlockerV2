const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

vm.runInThisContext(fs.readFileSync(path.join(root, 'utils/storage.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(root, 'content/detector.js'), 'utf8'));

const settings = {
  ...StorageManager.DEFAULT_SETTINGS,
  syntheticKeywords: StorageManager.DEFAULT_SETTINGS.aiKeywords,
  sensitivity: 'medium',
  detectionProfile: 'recall-first'
};

function analyzeText({ title = '', description = '', channel = '' }) {
  const info = AIDetector._normalizeVideoInfo({
    title,
    description,
    channel,
    channelUrl: '',
    videoId: 'abc123',
    badges: []
  });

  const signals = [
    ...AIDetector._detectSyntheticTextSignals(info, settings, 'test'),
    ...AIDetector._checkChannelSignals(info),
    ...AIDetector._detectChildRiskSignals(info, settings, 'test')
  ];

  return AIDetector._scoreSignals(signals, settings, info);
}

test('AI rõ ràng nhưng nội dung an toàn vẫn bị block theo mục tiêu chặn video AI', () => {
  const result = analyzeText({
    title: 'Made with AI - peaceful learning song for kids',
    description: 'A calm educational animation.'
  });

  assert.equal(result.isAI, true);
  assert.equal(result.shouldBlock, true);
  assert.equal(result.riskLevel, 'caution');
  assert.ok(result.syntheticScore >= 0.55);
  assert.equal(result.childRiskScore, 0);
});

test('Không AI nhưng có bạo lực/máu me bị block theo child-risk', () => {
  const result = analyzeText({
    title: 'Real fight with blood and knife attack',
    description: 'Violent scene compilation.'
  });

  assert.equal(result.isAI, false);
  assert.equal(result.shouldBlock, true);
  assert.equal(result.riskLevel, 'block');
  assert.ok(result.riskCategories.includes('violence'));
  assert.ok(result.childRiskScore >= 0.55);
});

test('AI kết hợp nội dung kinh dị trẻ em bị block', () => {
  const result = analyzeText({
    title: 'AI generated cartoon horror with blood',
    description: 'Scary kids cartoon monster story.'
  });

  assert.equal(result.isAI, true);
  assert.equal(result.shouldBlock, true);
  assert.equal(result.riskLevel, 'block');
  assert.ok(result.syntheticScore >= 0.55);
  assert.ok(result.childRiskScore >= 0.3);
});

test('Metadata thiếu không được coi là hoàn chỉnh để cache safe dài', () => {
  const result = analyzeText({
    title: '',
    description: '',
    channel: ''
  });

  assert.equal(result.shouldBlock, false);
  assert.equal(result.metadataComplete, false);
});

test('Từ dễ false-positive không tự block nếu thiếu ngữ cảnh AI/rủi ro', () => {
  const result = analyzeText({
    title: 'Runway fashion show generated title sequence',
    description: 'Behind the scenes from a design studio.'
  });

  assert.equal(result.isAI, false);
  assert.equal(result.shouldBlock, false);
  assert.equal(result.riskLevel, 'safe');
});

test('Title dạng Cat Videos AI được nhận diện và block', () => {
  const result = analyzeText({
    title: 'Kitten and Mom Stop Crocodile to Rescue Animal | Cat Videos AI Heartwarming Story',
    description: ''
  });

  assert.equal(result.isAI, true);
  assert.equal(result.shouldBlock, true);
  assert.ok(result.syntheticScore >= 0.42);
});

test('Caption bổ sung có thể nâng safe result thành block', () => {
  const base = analyzeText({
    title: 'Funny story time',
    description: 'A normal video.'
  });

  const enriched = AIDetector.enrichWithText(base, 'The scene shows blood, knife attack, and gore.', settings, 'caption');

  assert.equal(base.shouldBlock, false);
  assert.equal(enriched.shouldBlock, true);
  assert.equal(enriched.riskLevel, 'block');
  assert.ok(enriched.riskCategories.includes('violence'));
});
