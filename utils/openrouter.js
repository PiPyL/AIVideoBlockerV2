/**
 * SafeKid — OpenRouter classification helpers
 * Chứa logic thuần để gọi OpenRouter API.
 */

const OpenRouterClassifier = {
  DEFAULT_MODEL: 'google/gemini-2.0-flash-lite-preview-02-05:free',
  PROMPT_VERSION: 1,
  MAX_CAPTION_CHARS: 4000,
  CACHE_TTL: {
    block: 30 * 24 * 60 * 60 * 1000,
    allow: 7 * 24 * 60 * 60 * 1000,
    error: 15 * 60 * 1000
  },
  RISK_CATEGORIES: [
    'sexual',
    'violence',
    'horror',
    'self_harm',
    'dangerous_acts',
    'drugs',
    'profanity',
    'disturbing_kids_content'
  ],

  normalizeSettings(openrouterSettings = {}, detectorVersion = 7) {
    const defaults = {
      enabled: false,
      apiKey: '',
      model: this.DEFAULT_MODEL,
      autoFallback: true,
      fallbackModels: [],
      timeoutMs: 5000
    };
    const merged = { ...defaults, ...(openrouterSettings || {}) };
    return {
      ...merged,
      enabled: Boolean(merged.enabled),
      apiKey: String(merged.apiKey || '').trim(),
      model: String(merged.model || this.DEFAULT_MODEL).trim(),
      timeoutMs: Math.max(1000, Number(merged.timeoutMs || defaults.timeoutMs)),
      detectorVersion: Number(detectorVersion || 7)
    };
  },

  getCacheKey({ videoId, model, promptVersion, detectorVersion }) {
    return [
      'openrouter',
      String(videoId || ''),
      String(model || this.DEFAULT_MODEL).replace(/\//g, '_'),
      `p${Number(promptVersion || this.PROMPT_VERSION)}`,
      `d${Number(detectorVersion || 7)}`
    ].join(':');
  },

  isCacheEntryValid(entry = {}, now = Date.now()) {
    if (!entry || !entry.timestamp) return false;
    const status = entry.status || (entry.detection?.shouldBlock ? 'block' : 'allow');
    const ttl = this.CACHE_TTL[status] || this.CACHE_TTL.allow;
    return now - Number(entry.timestamp) < ttl;
  },

  getCacheStatusForDetection(detection = {}) {
    return this.shouldBlockResult(detection) ? 'block' : 'allow';
  },

  shouldBlockResult(result = {}) {
    if (result.decision === 'block') return true;
    if (Boolean(result.isAI) && Number(result.aiConfidence ?? result.syntheticScore ?? 0) >= 0.65) return true;
    if (Number(result.childRiskScore || 0) >= 0.55) return true;
    return Boolean(result.shouldBlock);
  },

  buildSystemPrompt() {
    return [
      'Bạn là bộ phân loại an toàn cho extension phụ huynh trên YouTube.',
      'Mục tiêu: phát hiện video AI/tổng hợp và nội dung không phù hợp với trẻ dưới 13 tuổi.',
      'Chỉ dựa trên metadata/caption/thumbnail được cung cấp. Không bịa thêm sự kiện ngoài input.',
      'Chặn nếu video có khả năng AI/tổng hợp cao hoặc có rủi ro trẻ em cao.',
      'Child-risk gồm sexual, violence, horror, self_harm, dangerous_acts, drugs, profanity, disturbing_kids_content.',
      'Trả về JSON object đúng schema. reason và evidence phải ngắn gọn bằng tiếng Việt, không chứa dữ liệu nhạy cảm thừa.'
    ].join('\n');
  },

  buildUserPrompt(input = {}, settings = {}) {
    const payload = {
      videoId: String(input.videoId || ''),
      title: this.truncate(input.title, 500),
      channel: this.truncate(input.channel || input.channelName || '', 200),
      description: this.truncate(input.description || '', 2500),
      captionExcerpt: this.truncate(input.captionExcerpt || input.caption || '', this.MAX_CAPTION_CHARS),
      localScores: {
        isAI: Boolean(input.localDetection?.isAI),
        shouldBlock: Boolean(input.localDetection?.shouldBlock),
        syntheticScore: this.clamp01(input.localDetection?.syntheticScore),
        childRiskScore: this.clamp01(input.localDetection?.childRiskScore),
        riskLevel: input.localDetection?.riskLevel || 'safe',
        riskCategories: Array.isArray(input.localDetection?.riskCategories)
          ? input.localDetection.riskCategories.slice(0, 8)
          : [],
        reasons: Array.isArray(input.localDetection?.reasons)
          ? input.localDetection.reasons.slice(0, 6)
          : []
      }
    };
    return JSON.stringify(payload);
  },

  buildRequestBody(input = {}, settings = {}) {
    return {
      model: settings.model || this.DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt()
        },
        {
          role: 'user',
          content: this.buildUserPrompt(input, settings)
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      top_p: 0.2,
      max_tokens: 512
    };
  },

  buildTestRequestBody(model) {
    return {
      model: model || this.DEFAULT_MODEL,
      messages: [
        { role: 'user', content: 'Return {"ok":true} as JSON.' }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 32
    };
  },

  normalizeApiResponse(apiResponse = {}, input = {}) {
    const text = this.extractResponseText(apiResponse);
    if (!text) throw new Error('OpenRouter response missing text');

    const parsed = this.parseJsonText(text);
    this.assertResponseSchema(parsed);
    const aiConfidence = this.clamp01(parsed.aiConfidence);
    const childRiskScore = this.clamp01(parsed.childRiskScore);
    const riskCategories = this.normalizeRiskCategories(parsed.riskCategories);
    const riskLevel = this.normalizeRiskLevel(parsed.riskLevel);
    const decision = this.normalizeDecision(parsed.decision, riskLevel);
    const detection = {
      isAI: Boolean(parsed.isAI),
      aiConfidence,
      syntheticScore: aiConfidence,
      childRiskScore,
      riskLevel,
      riskCategories,
      decision,
      reason: this.truncate(parsed.reason || '', 240),
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(item => this.truncate(item, 160)).slice(0, 4) : [],
      confidence: Math.max(aiConfidence, childRiskScore),
      method: 'openrouter',
      videoId: input.videoId || '',
      title: input.title || '',
      channelName: input.channel || input.channelName || '',
      detectorVersion: input.detectorVersion,
      openrouter: {
        model: input.model,
        promptVersion: this.PROMPT_VERSION
      }
    };

    detection.shouldBlock = this.shouldBlockResult(detection);
    detection.reasons = this.buildReasons(detection);
    detection.signalCounts = this.buildSignalCounts(detection);
    detection.axisSignalCounts = this.buildAxisSignalCounts(detection);
    detection.signals = this.buildSignals(detection);
    return detection;
  },

  extractResponseText(apiResponse = {}) {
    return apiResponse.choices?.[0]?.message?.content || '';
  },

  parseJsonText(text = '') {
    const cleaned = String(text)
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  },

  assertResponseSchema(parsed = {}) {
    const required = [
      'isAI',
      'aiConfidence',
      'childRiskScore',
      'riskLevel',
      'riskCategories',
      'decision',
      'reason',
      'evidence'
    ];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
        throw new Error(`OpenRouter response schema mismatch: ${key}`);
      }
    }
    if (!Array.isArray(parsed.riskCategories) || !Array.isArray(parsed.evidence)) {
      throw new Error('OpenRouter response schema mismatch: arrays');
    }
  },

  buildReasons(detection = {}) {
    const reasons = [];
    if (detection.reason) reasons.push(`OpenRouter: ${detection.reason}`);
    for (const evidence of detection.evidence || []) {
      if (evidence && reasons.length < 5) reasons.push(`OpenRouter evidence: ${evidence}`);
    }
    if (reasons.length === 0) {
      if (detection.isAI) reasons.push('OpenRouter đánh giá video có khả năng AI/tổng hợp cao');
      if (detection.childRiskScore >= 0.55) reasons.push('OpenRouter đánh giá rủi ro trẻ em cao');
    }
    return reasons;
  },

  buildSignalCounts(detection = {}) {
    const counts = { strong: 0, medium: 0, weak: 0 };
    for (const signal of this.buildSignals(detection)) {
      counts[signal.strength] = (counts[signal.strength] || 0) + 1;
    }
    return counts;
  },

  buildAxisSignalCounts(detection = {}) {
    const counts = {
      synthetic: { strong: 0, medium: 0, weak: 0 },
      childRisk: { strong: 0, medium: 0, weak: 0 }
    };
    for (const signal of this.buildSignals(detection)) {
      counts[signal.axis][signal.strength] = (counts[signal.axis][signal.strength] || 0) + 1;
    }
    return counts;
  },

  buildSignals(detection = {}) {
    const signals = [];
    if (detection.aiConfidence > 0 || detection.isAI) {
      signals.push({
        type: 'openrouterSynthetic',
        axis: 'synthetic',
        strength: this.scoreToStrength(detection.aiConfidence),
        method: 'openrouter',
        weight: detection.aiConfidence
      });
    }
    if (detection.childRiskScore > 0 || detection.riskCategories?.length) {
      signals.push({
        type: 'openrouterChildRisk',
        axis: 'childRisk',
        category: detection.riskCategories?.[0],
        strength: this.scoreToStrength(detection.childRiskScore),
        method: 'openrouter',
        weight: detection.childRiskScore
      });
    }
    return signals;
  },

  scoreToStrength(score = 0) {
    const value = Number(score || 0);
    if (value >= 0.65) return 'strong';
    if (value >= 0.35) return 'medium';
    return 'weak';
  },

  normalizeRiskCategories(categories = []) {
    if (!Array.isArray(categories)) return [];
    const allowed = new Set(this.RISK_CATEGORIES);
    return [...new Set(categories.filter(category => allowed.has(category)))];
  },

  normalizeRiskLevel(value = 'safe') {
    return ['safe', 'caution', 'block'].includes(value) ? value : 'safe';
  },

  normalizeDecision(value = 'allow', riskLevel = 'safe') {
    if (['allow', 'caution', 'block'].includes(value)) return value;
    if (riskLevel === 'block') return 'block';
    if (riskLevel === 'caution') return 'caution';
    return 'allow';
  },

  clamp01(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  },

  truncate(value = '', max = 1000) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max) : text;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.OpenRouterClassifier = OpenRouterClassifier;
}
