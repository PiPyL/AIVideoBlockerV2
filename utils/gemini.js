/**
 * SafeKid — Gemini classification helpers
 * Chứa logic thuần để service worker gọi API và unit test không cần Chrome runtime.
 */

const GeminiClassifier = {
  DEFAULT_MODEL: 'gemini-3.1-flash-lite-preview',
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

  normalizeSettings(geminiSettings = {}, detectorVersion = 7) {
    const defaults = {
      enabled: false,
      apiKey: '',
      model: this.DEFAULT_MODEL,
      includeThumbnail: false,
      timeoutMs: 3500,
      thumbnailTimeoutMs: 6000,
      maxCaptionChars: this.MAX_CAPTION_CHARS,
      promptVersion: this.PROMPT_VERSION
    };
    const merged = { ...defaults, ...(geminiSettings || {}) };
    const includeThumbnail = Boolean(merged.includeThumbnail);
    return {
      ...merged,
      enabled: Boolean(merged.enabled),
      apiKey: String(merged.apiKey || '').trim(),
      model: this.normalizeModel(merged.model),
      includeThumbnail,
      timeoutMs: Math.max(1000, Number(merged.timeoutMs || defaults.timeoutMs)),
      thumbnailTimeoutMs: Math.max(2000, Number(merged.thumbnailTimeoutMs || defaults.thumbnailTimeoutMs)),
      maxCaptionChars: Math.max(500, Math.min(8000, Number(merged.maxCaptionChars || defaults.maxCaptionChars))),
      promptVersion: Number(merged.promptVersion || this.PROMPT_VERSION),
      detectorVersion: Number(detectorVersion || 7)
    };
  },

  normalizeModel(model = '') {
    return String(model || this.DEFAULT_MODEL).replace(/^models\//, '').trim() || this.DEFAULT_MODEL;
  },

  getEffectiveTimeoutMs(geminiSettings = {}) {
    return geminiSettings.includeThumbnail
      ? Number(geminiSettings.thumbnailTimeoutMs || 6000)
      : Number(geminiSettings.timeoutMs || 3500);
  },

  getCacheKey({ videoId, model, promptVersion, includeThumbnail, detectorVersion }) {
    return [
      'gemini',
      String(videoId || ''),
      this.normalizeModel(model),
      `p${Number(promptVersion || this.PROMPT_VERSION)}`,
      includeThumbnail ? 'thumb1' : 'thumb0',
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

  buildPrompt(input = {}, settings = {}) {
    const maxCaptionChars = Number(settings.maxCaptionChars || this.MAX_CAPTION_CHARS);
    const payload = {
      videoId: String(input.videoId || ''),
      title: this.truncate(input.title, 500),
      channel: this.truncate(input.channel || input.channelName || '', 200),
      description: this.truncate(input.description || '', 2500),
      captionExcerpt: this.truncate(input.captionExcerpt || input.caption || '', maxCaptionChars),
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

    return [
      'Bạn là bộ phân loại an toàn cho extension phụ huynh trên YouTube.',
      'Mục tiêu: phát hiện video ĐƯỢC TẠO BẰNG AI (Generative AI, Deepfake) và nội dung không phù hợp với trẻ dưới 13 tuổi.',
      'QUY TẮC LOẠI TRỪ (KHÔNG CHẶN):',
      '1. Âm nhạc: Nhạc điện tử (EDM), Vocaloid, Auto-tune, nhạc cụ tổng hợp (synthesizer).',
      '2. Hình ảnh: Gameplay video game, hoạt hình truyền thống/3D, Anime, CGI, VFX, Virtual YouTuber (VTuber).',
      '3. Tin tức/Giáo dục: Video do người thật làm để review, hướng dẫn, tin tức bàn luận về chủ đề AI.',
      'CHỈ CHẶN lỗi AI khi có bằng chứng rõ ràng video là "AI slop" (kênh rác dùng AI voice/video tự động sản xuất hàng loạt), Deepfake lừa đảo, hoặc nội dung Generative AI cố tình giả mạo thật.',
      'Chỉ dựa trên thông tin được cung cấp. Tuyệt đối KHÔNG tự kết luận video được YouTube gắn nhãn nếu input không ghi rõ.',
      'Child-risk gồm sexual, violence, horror, self_harm, dangerous_acts, drugs, profanity, disturbing_kids_content.',
      'Trả về JSON đúng schema. reason và evidence phải ngắn, không chứa dữ liệu nhạy cảm thừa.',
      '',
      JSON.stringify(payload)
    ].join('\n');
  },

  buildRequestBody(input = {}, settings = {}, thumbnail = null) {
    const parts = [{ text: this.buildPrompt(input, settings) }];
    if (thumbnail?.data) {
      parts.push({
        inline_data: {
          mime_type: thumbnail.mimeType || 'image/jpeg',
          data: thumbnail.data
        }
      });
    }

    return {
      contents: [{
        role: 'user',
        parts
      }],
      generationConfig: {
        temperature: 0,
        topP: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
        responseJsonSchema: this.getResponseSchema()
      }
    };
  },

  buildTestRequestBody() {
    return {
      contents: [{
        role: 'user',
        parts: [{ text: 'Return {"ok":true} as JSON.' }]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 32,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' }
          },
          required: ['ok'],
          additionalProperties: false
        }
      }
    };
  },

  getResponseSchema() {
    return {
      type: 'object',
      properties: {
        isAI: {
          type: 'boolean',
          description: 'Video có khả năng là AI-generated, synthetic, deepfake, text-to-video, image-to-video hoặc nội dung tổng hợp.'
        },
        aiConfidence: {
          type: 'number',
          description: 'Độ tin cậy 0-1 cho khả năng AI/tổng hợp.'
        },
        childRiskScore: {
          type: 'number',
          description: 'Điểm rủi ro 0-1 đối với trẻ dưới 13 tuổi.'
        },
        riskLevel: {
          type: 'string',
          enum: ['safe', 'caution', 'block']
        },
        riskCategories: {
          type: 'array',
          items: {
            type: 'string',
            enum: this.RISK_CATEGORIES
          }
        },
        decision: {
          type: 'string',
          enum: ['allow', 'caution', 'block']
        },
        reason: {
          type: 'string',
          description: 'Lý do ngắn gọn bằng tiếng Việt.'
        },
        evidence: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tối đa 4 bằng chứng ngắn từ metadata/caption.'
        }
      },
      required: [
        'isAI',
        'aiConfidence',
        'childRiskScore',
        'riskLevel',
        'riskCategories',
        'decision',
        'reason',
        'evidence'
      ],
      additionalProperties: false
    };
  },

  normalizeApiResponse(apiResponse = {}, input = {}) {
    const text = this.extractResponseText(apiResponse);
    if (!text) throw new Error('Gemini response missing text');

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
      method: 'gemini',
      videoId: input.videoId || '',
      title: input.title || '',
      channelName: input.channel || input.channelName || '',
      detectorVersion: input.detectorVersion,
      gemini: {
        model: input.model,
        promptVersion: input.promptVersion,
        includeThumbnail: Boolean(input.includeThumbnail)
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
    const parts = apiResponse.candidates?.[0]?.content?.parts || [];
    return parts
      .map(part => part.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
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
        throw new Error(`Gemini response schema mismatch: ${key}`);
      }
    }
    if (!Array.isArray(parsed.riskCategories) || !Array.isArray(parsed.evidence)) {
      throw new Error('Gemini response schema mismatch: arrays');
    }
  },

  buildReasons(detection = {}) {
    const reasons = [];
    if (detection.reason) reasons.push(`Gemini: ${detection.reason}`);
    for (const evidence of detection.evidence || []) {
      if (evidence && reasons.length < 5) reasons.push(`Gemini evidence: ${evidence}`);
    }
    if (reasons.length === 0) {
      if (detection.isAI) reasons.push('Gemini đánh giá video có khả năng AI/tổng hợp cao');
      if (detection.childRiskScore >= 0.55) reasons.push('Gemini đánh giá rủi ro trẻ em cao');
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
        type: 'geminiSynthetic',
        axis: 'synthetic',
        strength: this.scoreToStrength(detection.aiConfidence),
        method: 'gemini',
        weight: detection.aiConfidence
      });
    }
    if (detection.childRiskScore > 0 || detection.riskCategories?.length) {
      signals.push({
        type: 'geminiChildRisk',
        axis: 'childRisk',
        category: detection.riskCategories?.[0],
        strength: this.scoreToStrength(detection.childRiskScore),
        method: 'gemini',
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
  globalThis.GeminiClassifier = GeminiClassifier;
}
