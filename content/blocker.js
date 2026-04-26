/**
 * SafeKid — Blocker Module
 * Xử lý phủ mờ video AI trên YouTube DOM
 */

const AIBlocker = {
  /** CSS class prefix */
  PREFIX: 'aivb',
  playbackGuards: {},
  mediaState: new WeakMap(),
  clickGuards: new WeakMap(),
  previewTargets: new WeakMap(),
  playerState: null,

  /**
   * Áp dụng blocking cho video element
   * @param {HTMLElement} el - Video element
   * @param {DetectionResult} detection
   */
  blockVideo(el, detection) {
    if (!el || el.dataset.aivbProcessed === 'true') return;

    const blocked = this._shouldBlock(detection);
    el.dataset.aivbProcessed = 'true';
    el.dataset.aivbIsAi = blocked ? 'true' : 'false';
    el.dataset.aivbConfidence = String(Math.round(detection.confidence * 100));
    el.dataset.aivbMethod = detection.method;
    el.dataset.aivbRiskLevel = detection.riskLevel || 'safe';

    if (!blocked) return;

    el.classList.add(`${this.PREFIX}-detected`);
    this._applyPreviewOverlay(el, detection);
  },

  /**
   * Phủ đúng vùng preview/thumbnail của card YouTube.
   */
  _applyPreviewOverlay(el, detection) {
    const previewHost = this._findPreviewHost(el) || el;
    if (previewHost.querySelector(`.${this.PREFIX}-preview-overlay`)) {
      this._bindNavigationGuard(el);
      return;
    }

    previewHost.classList.add(`${this.PREFIX}-preview-host`);
    previewHost.dataset.aivbPreviewBlocked = 'true';

    const overlay = document.createElement('div');
    overlay.id = this._createOverlayId('aivb-preview-overlay', el, detection);
    overlay.className = `${this.PREFIX}-preview-overlay`;
    overlay.setAttribute('role', 'note');
    overlay.setAttribute('aria-label', this._getBlockTitle(detection));
    const primaryReason = detection.reasons?.[0] || this._getMethodLabel(detection.method);
    const content = this._createElement('div', `${this.PREFIX}-preview-content`);
    content.append(
      this._createElement('div', `${this.PREFIX}-preview-title`, this._getBlockTitle(detection)),
      this._createElement('div', `${this.PREFIX}-preview-meta`, this._getConfidenceLabel(detection)),
      this._createElement('div', `${this.PREFIX}-preview-reason`, primaryReason)
    );
    overlay.appendChild(content);

    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true);

    previewHost.appendChild(overlay);
    this.previewTargets.set(el, previewHost);
    this._bindNavigationGuard(el);
  },

  /**
   * Hiện video tạm thời (30 giây)
   */
  _revealTemporarily(el, overlay) {
    el.classList.remove(`${this.PREFIX}-blur`);
    overlay.style.display = 'none';

    setTimeout(() => {
      el.classList.add(`${this.PREFIX}-blur`);
      overlay.style.display = '';
    }, 30000);
  },

  /**
   * Yêu cầu whitelist channel (gửi message tới service worker)
   */
  _requestWhitelist(el) {
    const channelEl = el.querySelector('#channel-name a, ytd-channel-name a, a[href^="/@"], a[href*="/@"]');
    const channelName = channelEl?.textContent?.trim();
    const channelUrl = channelEl?.href;

    if (channelName) {
      chrome.runtime.sendMessage({
        type: 'WHITELIST_CHANNEL',
        channel: channelName,
        url: channelUrl
      });
      // Unblock immediately
      this.unblockVideo(el);
    }
  },

  /**
   * Gỡ blocking khỏi video
   */
  unblockVideo(el) {
    if (!el) return;
    el.classList.remove(`${this.PREFIX}-detected`, `${this.PREFIX}-blur`);
    el.dataset.aivbProcessed = 'false';
    el.dataset.aivbIsAi = 'false';

    const previewHost = this.previewTargets.get(el) || el.querySelector(`.${this.PREFIX}-preview-host`);
    if (previewHost) {
      previewHost.classList.remove(`${this.PREFIX}-preview-host`);
      delete previewHost.dataset.aivbPreviewBlocked;
      previewHost.querySelectorAll(`.${this.PREFIX}-preview-overlay`).forEach((node) => node.remove());
    }
    el.querySelectorAll(`.${this.PREFIX}-preview-overlay`).forEach((node) => node.remove());
    this.previewTargets.delete(el);
    this._unbindNavigationGuard(el);

    const overlay = el.querySelector(`.${this.PREFIX}-overlay`);
    if (overlay) overlay.remove();

    // Cleanup legacy badge nodes from older versions.
    const legacyBadge = el.querySelector(`.${this.PREFIX}-badge`);
    if (legacyBadge) legacyBadge.remove();

  },

  _findPreviewHost(el) {
    const selectors = [
      'ytd-thumbnail',
      'yt-thumbnail-view-model',
      '.ytLockupViewModelContentImage yt-thumbnail-view-model',
      '.shortsLockupViewModelHostEndpoint yt-thumbnail-view-model',
      '.shortsLockupViewModelHostThumbnailContainer',
      'a#thumbnail',
      '#thumbnail'
    ];

    for (const selector of selectors) {
      const candidate = el.querySelector?.(selector);
      const host = this._normalizePreviewHost(candidate);
      if (host) return host;
    }

    return null;
  },

  _normalizePreviewHost(candidate) {
    if (!candidate) return null;
    if (candidate.matches?.('a') && candidate.querySelector?.('yt-thumbnail-view-model')) {
      return candidate.querySelector('yt-thumbnail-view-model');
    }
    if (candidate.matches?.('a#thumbnail')) {
      return candidate.closest('ytd-thumbnail') || candidate;
    }
    return candidate;
  },

  _bindNavigationGuard(el) {
    if (!el || this.clickGuards.has(el)) return;

    const guard = (event) => {
      if (event.target?.closest?.(`.${this.PREFIX}-preview-overlay`)) {
        this._blockCardEvent(event, el);
        return;
      }

      const link = event.target?.closest?.('a[href]');
      if (link && this._isVideoNavigationHref(link.getAttribute('href') || link.href || '')) {
        this._blockCardEvent(event, el);
      }
    };

    el.addEventListener('click', guard, true);
    el.addEventListener('auxclick', guard, true);
    this.clickGuards.set(el, guard);
  },

  _unbindNavigationGuard(el) {
    const guard = this.clickGuards.get(el);
    if (!guard) return;

    el.removeEventListener('click', guard, true);
    el.removeEventListener('auxclick', guard, true);
    this.clickGuards.delete(el);
  },

  _blockCardEvent(event, el) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this._flashPreviewOverlay(el);
  },

  _isVideoNavigationHref(href = '') {
    return /(^|\/)watch\?/.test(href) ||
      /[?&]v=[a-zA-Z0-9_-]{11}/.test(href) ||
      /\/shorts\/[a-zA-Z0-9_-]{11}/.test(href);
  },

  _flashPreviewOverlay(el) {
    const previewHost = this.previewTargets.get(el) || el.querySelector(`.${this.PREFIX}-preview-host`);
    const overlay = previewHost?.querySelector(`.${this.PREFIX}-preview-overlay`);
    if (!overlay) return;

    overlay.classList.remove(`${this.PREFIX}-preview-pulse`);
    // Force reflow so repeated blocked clicks replay the pulse.
    void overlay.offsetWidth;
    overlay.classList.add(`${this.PREFIX}-preview-pulse`);
  },

  _createOverlayId(prefix, el, detection = {}) {
    const videoId = detection.videoId || this._getVideoIdFromElement(el) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'video';
    return `${prefix}-${safeId}-${Math.random().toString(36).slice(2, 8)}`;
  },

  _getVideoIdFromElement(el) {
    const link = el?.querySelector?.('a[href*="/watch"], a[href*="/shorts/"]');
    const href = link?.href || '';
    const watchMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];

    const shortsMatch = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return shortsMatch ? shortsMatch[1] : '';
  },

  _createPlaybackOverlayContent(options = {}) {
    const content = this._createElement('div', `${this.PREFIX}-watch-overlay-content`);
    content.append(
      this._createElement('div', `${this.PREFIX}-shield-icon-large`, '🛡️'),
      this._createElement('h2', '', options.title || 'Video Đã Bị Chặn'),
      this._createElement('p', '', options.description || 'Nội dung này không phù hợp với trẻ em'),
      this._createElement('p', `${this.PREFIX}-confidence-text`, options.meta || `Độ tin cậy: ${Math.round((options.confidence || 0) * 100)}% • ${this._getMethodLabel(options.method)}`)
    );

    const reasons = this._createElement('div', `${this.PREFIX}-watch-reasons`);
    (options.reasons || []).forEach((reason) => {
      reasons.appendChild(this._createElement('div', `${this.PREFIX}-reason-item`, `• ${reason}`));
    });
    content.appendChild(reasons);

    const actions = this._createElement('div', `${this.PREFIX}-watch-actions`);
    const backButton = this._createElement('button', `${this.PREFIX}-btn-go-back`, '← Quay lại');
    backButton.id = options.backButtonId;
    actions.appendChild(backButton);
    content.appendChild(actions);

    return content;
  },

  _createElement(tagName, className = '', text = '') {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  },

  /**
   * Chặn video trên trang xem (watch page)
   */
  blockWatchPage(detection) {
    const player = document.querySelector('#movie_player, #player-container-inner, #player');
    if (!player) return;

    const videoId = detection?.videoId || this._getCurrentVideoId();
    const existingOverlay = player.querySelector(`.${this.PREFIX}-watch-overlay`);
    if (existingOverlay && player.dataset.aivbVideoId === videoId) {
      this._startPlaybackGuard('watch');
      return;
    }

    this.unblockWatchPage({ restoreMedia: false });

    player.dataset.aivbProcessed = 'true';
    player.dataset.aivbIsAi = 'true';
    player.dataset.aivbVideoId = videoId;
    document.body.dataset.aivbWatchBlocked = 'true';
    this._startPlaybackGuard('watch');

    const overlay = document.createElement('div');
    overlay.className = `${this.PREFIX}-watch-overlay`;
    overlay.appendChild(this._createPlaybackOverlayContent({
      title: this._getBlockTitle(detection),
      description: this._getBlockDescription(detection),
      confidence: detection.confidence,
      method: detection.method,
      meta: this._getConfidenceLabel(detection),
      reasons: detection.reasons,
      backButtonId: 'aivb-go-back'
    }));

    player.style.position = 'relative';
    player.appendChild(overlay);

    overlay.querySelector('#aivb-go-back')?.addEventListener('click', () => {
      window.history.back();
    });
  },

  /**
   * Chặn video trên Shorts page
   */
  blockShortsPage(detection) {
    const videoId = detection?.videoId || this._getCurrentVideoId();
    const existingVideoId = document.body.dataset.aivbShortsVideoId;
    if (existingVideoId === videoId) {
      this._startPlaybackGuard('shorts');
      return;
    }

    this.unblockShortsPage({ restoreMedia: false });

    document.body.dataset.aivbShortsBlocked = 'true';
    document.body.dataset.aivbShortsVideoId = videoId;
    this._startPlaybackGuard('shorts');

    const activeShort = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer, ytd-shorts');
    if (activeShort) {
      activeShort.classList.remove(`${this.PREFIX}-blur`);
    }
    document.querySelectorAll(`.${this.PREFIX}-shorts-overlay, .${this.PREFIX}-shorts-badge`).forEach((node) => node.remove());

    const overlay = document.createElement('div');
    overlay.className = `${this.PREFIX}-watch-overlay ${this.PREFIX}-shorts-overlay`;
    overlay.appendChild(this._createPlaybackOverlayContent({
      title: this._getBlockTitle(detection).replace('Video', 'Short'),
      description: this._getBlockDescription(detection),
      confidence: detection.confidence,
      method: detection.method,
      meta: this._getConfidenceLabel(detection),
      reasons: detection.reasons,
      backButtonId: 'aivb-go-back-shorts'
    }));

    document.body.appendChild(overlay);

    overlay.querySelector('#aivb-go-back-shorts')?.addEventListener('click', () => {
      window.history.back();
    });
  },

  unblockWatchPage(options = {}) {
    const { restoreMedia = true } = options;
    this._stopPlaybackGuard('watch', restoreMedia);
    document.querySelectorAll(`.${this.PREFIX}-watch-overlay:not(.${this.PREFIX}-shorts-overlay)`).forEach((node) => node.remove());

    const player = document.querySelector('#movie_player, #player-container-inner, #player');
    if (player) {
      delete player.dataset.aivbProcessed;
      delete player.dataset.aivbIsAi;
      delete player.dataset.aivbVideoId;
    }

    delete document.body.dataset.aivbWatchBlocked;
  },

  unblockShortsPage(options = {}) {
    const { restoreMedia = true } = options;
    this._stopPlaybackGuard('shorts', restoreMedia);
    document.querySelectorAll(`.${this.PREFIX}-shorts-overlay`).forEach((node) => node.remove());
    document.querySelectorAll('ytd-reel-video-renderer, ytd-shorts').forEach((node) => {
      node.classList.remove(`${this.PREFIX}-blur`);
    });

    delete document.body.dataset.aivbShortsBlocked;
    delete document.body.dataset.aivbShortsVideoId;
  },

  resetPageBlocks(options = {}) {
    this.unblockWatchPage(options);
    this.unblockShortsPage(options);
  },

  holdPlayback(key = 'pending-scan') {
    this._startPlaybackGuard(key);
  },

  releasePlaybackHold(key = 'pending-scan', options = {}) {
    const { restoreMedia = true } = options;
    this._stopPlaybackGuard(key, restoreMedia);
  },

  /**
   * Helper: Label cho method
   */
  _getMethodLabel(method) {
    const labels = {
      'label': '📋 YouTube Label',
      'keyword': '🔍 Từ khóa AI',
      'pattern': '🧩 Pattern Match',
      'channel': '📺 Channel AI',
      'disclosure': '📣 Disclosure',
      'childRisk': '🛡️ Rủi ro trẻ em',
      'combination': '🧠 Multi-signal',
      'none': '❓ Không xác định'
    };
    return labels[method] || method;
  },

  _shouldBlock(detection = {}) {
    if (typeof detection.shouldBlock === 'boolean') return detection.shouldBlock;
    if (detection.riskLevel) return detection.riskLevel === 'block';
    return Boolean(detection.isAI);
  },

  _getBlockTitle(detection = {}) {
    if ((detection.childRiskScore || 0) >= (detection.syntheticScore || 0)) {
      return 'Video Không Phù Hợp Đã Bị Chặn';
    }
    return 'Video AI Đã Bị Chặn';
  },

  _getBlockDescription(detection = {}) {
    if ((detection.childRiskScore || 0) >= 0.3) {
      return 'Nội dung này có dấu hiệu không phù hợp với trẻ em';
    }
    return 'Video này có dấu hiệu nội dung tạo bởi AI';
  },

  _getConfidenceLabel(detection = {}) {
    const synthetic = Math.round((detection.syntheticScore || 0) * 100);
    const childRisk = Math.round((detection.childRiskScore || 0) * 100);
    if (detection.riskLevel) {
      return `AI ${synthetic}% • Rủi ro ${childRisk}% • ${this._getMethodLabel(detection.method)}`;
    }
    return `${Math.round((detection.confidence || 0) * 100)}% • ${this._getMethodLabel(detection.method)}`;
  },

  /**
   * Helper: Escape HTML
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  _startPlaybackGuard(key) {
    if (this.playbackGuards[key]) return;

    const enforce = () => this._pauseAndMuteMedia(key);
    const onPlay = (event) => {
      if (event.target?.tagName === 'VIDEO') enforce();
    };

    enforce();
    document.addEventListener('play', onPlay, true);
    this.playbackGuards[key] = {
      intervalId: window.setInterval(enforce, 500),
      onPlay
    };
  },

  _stopPlaybackGuard(key, restoreMedia = false) {
    const guard = this.playbackGuards[key];
    if (!guard) {
      if (restoreMedia) this._restoreMediaState();
      return;
    }

    window.clearInterval(guard.intervalId);
    document.removeEventListener('play', guard.onPlay, true);
    delete this.playbackGuards[key];

    if (restoreMedia && Object.keys(this.playbackGuards).length === 0) {
      this._restoreMediaState();
    }
  },

  _pauseAndMuteMedia(key = 'guard') {
    document.querySelectorAll('video').forEach((video) => {
      if (!this.mediaState.has(video)) {
        this.mediaState.set(video, {
          muted: video.muted,
          volume: video.volume,
          autoplay: video.autoplay,
          hadMutedAttribute: video.hasAttribute('muted'),
          shouldResume: key === 'pending-scan' && !video.paused && !video.ended
        });
      } else if (key === 'pending-scan' && !video.paused && !video.ended) {
        this.mediaState.get(video).shouldResume = true;
      }

      try {
        video.pause();
      } catch (e) { /* ignore media pause errors */ }

      video.autoplay = false;
      video.muted = true;
      video.setAttribute('muted', '');
    });

    const player = document.querySelector('#movie_player');
    if (!player) return;

    if (!this.playerState) {
      const playbackState = this._callPlayerMethod(player, 'getPlayerState');
      this.playerState = {
        player,
        muted: this._callPlayerMethod(player, 'isMuted'),
        shouldResume: key === 'pending-scan' && (playbackState === 1 || playbackState === 3)
      };
    } else if (key === 'pending-scan') {
      const playbackState = this._callPlayerMethod(player, 'getPlayerState');
      if (playbackState === 1 || playbackState === 3) {
        this.playerState.shouldResume = true;
      }
    }

    this._callPlayerMethod(player, 'pauseVideo');
    this._callPlayerMethod(player, 'mute');
  },

  _restoreMediaState() {
    document.querySelectorAll('video').forEach((video) => {
      const state = this.mediaState.get(video);
      if (!state) return;

      video.muted = state.muted;
      video.volume = state.volume;
      video.autoplay = state.autoplay;
      if (state.hadMutedAttribute) {
        video.setAttribute('muted', '');
      } else {
        video.removeAttribute('muted');
      }

      if (state.shouldResume && video.isConnected && video.paused && !video.ended) {
        this._resumeVideo(video);
      }
    });

    this.mediaState = new WeakMap();

    const player = this.playerState?.player;
    if (player?.isConnected && this.playerState.muted === false) {
      this._callPlayerMethod(player, 'unMute');
    }
    if (player?.isConnected && this.playerState?.shouldResume) {
      this._callPlayerMethod(player, 'playVideo');
    }
    this.playerState = null;
  },

  _resumeVideo(video) {
    try {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (e) { /* ignore media resume errors */ }
  },

  _callPlayerMethod(player, method) {
    try {
      if (typeof player?.[method] === 'function') {
        return player[method]();
      }
    } catch (e) { /* ignore player API errors */ }
    return undefined;
  },

  _getCurrentVideoId() {
    const watchMatch = location.href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];

    const shortsMatch = location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    return shortsMatch ? shortsMatch[1] : '';
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.AIBlocker = AIBlocker;
}
