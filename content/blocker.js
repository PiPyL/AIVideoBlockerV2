/**
 * AI Video Blocker — Blocker Module
 * Xử lý ẩn/blur/badge video AI trên YouTube DOM
 */

const AIBlocker = {
  /** CSS class prefix */
  PREFIX: 'aivb',
  playbackGuards: {},
  mediaState: new WeakMap(),
  playerState: null,

  /**
   * Áp dụng blocking cho video element
   * @param {HTMLElement} el - Video element
   * @param {DetectionResult} detection
   * @param {string} blockMode - 'blur' | 'hide' | 'badge'
   */
  blockVideo(el, detection, blockMode = 'blur') {
    if (!el || el.dataset.aivbProcessed === 'true') return;

    el.dataset.aivbProcessed = 'true';
    el.dataset.aivbIsAi = detection.isAI ? 'true' : 'false';
    el.dataset.aivbConfidence = String(Math.round(detection.confidence * 100));
    el.dataset.aivbMethod = detection.method;

    if (!detection.isAI) return;

    el.classList.add(`${this.PREFIX}-detected`);

    switch (blockMode) {
      case 'hide':
        this._applyHide(el);
        break;
      case 'badge':
        this._applyBadge(el, detection);
        break;
      case 'blur':
      default:
        this._applyBlur(el, detection);
        break;
    }
  },

  /**
   * Mode: Blur — Làm mờ video + overlay cảnh báo
   */
  _applyBlur(el, detection) {
    el.classList.add(`${this.PREFIX}-blur`);

    // Tạo overlay cảnh báo
    const overlay = document.createElement('div');
    overlay.className = `${this.PREFIX}-overlay`;
    overlay.innerHTML = `
      <div class="${this.PREFIX}-overlay-content">
        <div class="${this.PREFIX}-shield-icon">🛡️</div>
        <div class="${this.PREFIX}-overlay-title">Video AI Đã Bị Chặn</div>
        <div class="${this.PREFIX}-overlay-subtitle">
          Độ tin cậy: ${Math.round(detection.confidence * 100)}% • ${this._getMethodLabel(detection.method)}
        </div>
        <div class="${this.PREFIX}-overlay-actions">
          <button class="${this.PREFIX}-btn-reveal" data-action="reveal">
            👁️ Hiện tạm thời
          </button>
          <button class="${this.PREFIX}-btn-whitelist" data-action="whitelist">
            ✅ Cho phép channel
          </button>
        </div>
        <div class="${this.PREFIX}-overlay-reasons">
          ${detection.reasons.map(r => `<span class="${this.PREFIX}-reason-tag">${this._escapeHtml(r)}</span>`).join('')}
        </div>
      </div>
    `;

	    // Event handlers
	    overlay.addEventListener('click', (e) => {
	      if (e.target.closest('button')) return;
	      e.preventDefault();
	      e.stopPropagation();
	    }, true);

	    overlay.querySelector('[data-action="reveal"]')?.addEventListener('click', (e) => {
	      e.preventDefault();
	      e.stopPropagation();
      this._revealTemporarily(el, overlay);
    });

    overlay.querySelector('[data-action="whitelist"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._requestWhitelist(el);
    });

    el.style.position = 'relative';
    el.appendChild(overlay);
  },

  /**
   * Mode: Hide — Ẩn hoàn toàn
   */
  _applyHide(el) {
    el.classList.add(`${this.PREFIX}-hidden`);
  },

  /**
   * Mode: Badge — Chỉ gắn nhãn cảnh báo
   */
  _applyBadge(el, detection) {
    const badge = document.createElement('div');
    badge.className = `${this.PREFIX}-badge`;
    badge.innerHTML = `
      <span class="${this.PREFIX}-badge-icon">🤖</span>
      <span class="${this.PREFIX}-badge-text">AI ${Math.round(detection.confidence * 100)}%</span>
    `;
    badge.title = detection.reasons.join('\n');

    // Tìm thumbnail container để gắn badge
    const thumbnail = el.querySelector('#thumbnail, ytd-thumbnail, .ytd-thumbnail');
    if (thumbnail) {
      thumbnail.style.position = 'relative';
      thumbnail.appendChild(badge);
    } else {
      el.style.position = 'relative';
      el.appendChild(badge);
    }
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
    const channelEl = el.querySelector('#channel-name a, ytd-channel-name a');
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
    el.classList.remove(`${this.PREFIX}-detected`, `${this.PREFIX}-blur`, `${this.PREFIX}-hidden`);
    el.dataset.aivbProcessed = 'false';
    el.dataset.aivbIsAi = 'false';

    const overlay = el.querySelector(`.${this.PREFIX}-overlay`);
    if (overlay) overlay.remove();

    const badge = el.querySelector(`.${this.PREFIX}-badge`);
    if (badge) badge.remove();
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
    overlay.innerHTML = `
      <div class="${this.PREFIX}-watch-overlay-content">
        <div class="${this.PREFIX}-shield-icon-large">🛡️</div>
        <h2>Video AI Đã Bị Chặn</h2>
        <p>Video này được phát hiện là nội dung tạo bởi AI</p>
        <p class="${this.PREFIX}-confidence-text">
          Độ tin cậy: ${Math.round(detection.confidence * 100)}% • ${this._getMethodLabel(detection.method)}
        </p>
        <div class="${this.PREFIX}-watch-reasons">
          ${detection.reasons.map(r => `<div class="${this.PREFIX}-reason-item">• ${this._escapeHtml(r)}</div>`).join('')}
        </div>
        <div class="${this.PREFIX}-watch-actions">
          <button class="${this.PREFIX}-btn-watch-reveal" id="aivb-reveal-watch">
            👁️ Hiện video (30 giây)
          </button>
          <button class="${this.PREFIX}-btn-go-back" id="aivb-go-back">
            ← Quay lại
          </button>
        </div>
      </div>
    `;

    player.style.position = 'relative';
    player.appendChild(overlay);

    overlay.querySelector('#aivb-reveal-watch')?.addEventListener('click', () => {
      this._stopPlaybackGuard('watch', true);
      overlay.style.display = 'none';
      setTimeout(() => {
        overlay.style.display = '';
        this._startPlaybackGuard('watch');
      }, 30000);
    });

    overlay.querySelector('#aivb-go-back')?.addEventListener('click', () => {
      window.history.back();
    });
  },

  /**
   * Chặn video trên Shorts page
   */
  blockShortsPage(detection, blockMode = 'blur') {
    const videoId = detection?.videoId || this._getCurrentVideoId();
    const existingMode = document.body.dataset.aivbShortsBlockMode;
    const existingVideoId = document.body.dataset.aivbShortsVideoId;
    if (existingVideoId === videoId && existingMode === blockMode) {
      this._startPlaybackGuard('shorts');
      return;
    }

    this.unblockShortsPage({ restoreMedia: false });

    document.body.dataset.aivbShortsBlocked = 'true';
    document.body.dataset.aivbShortsVideoId = videoId;
    document.body.dataset.aivbShortsBlockMode = blockMode;
    this._startPlaybackGuard('shorts');

    const activeShort = document.querySelector('ytd-reel-video-renderer[is-active], ytd-reel-video-renderer, ytd-shorts');
    if (activeShort) {
      activeShort.classList.remove(`${this.PREFIX}-hidden`, `${this.PREFIX}-blur`);
    }
    document.querySelectorAll(`.${this.PREFIX}-shorts-overlay, .${this.PREFIX}-shorts-badge`).forEach((node) => node.remove());

    if (blockMode === 'badge') {
      const badge = document.createElement('div');
      badge.className = `${this.PREFIX}-shorts-badge`;
      badge.textContent = `🤖 AI ${Math.round(detection.confidence * 100)}%`;
      badge.title = detection.reasons.join('\n');
      document.body.appendChild(badge);
      return;
    }

    if (blockMode === 'hide') {
      if (activeShort) activeShort.classList.add(`${this.PREFIX}-hidden`);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = `${this.PREFIX}-watch-overlay ${this.PREFIX}-shorts-overlay`;
    overlay.innerHTML = `
      <div class="${this.PREFIX}-watch-overlay-content">
        <div class="${this.PREFIX}-shield-icon-large">🛡️</div>
        <h2>Short AI Đã Bị Chặn</h2>
        <p>Short này có dấu hiệu nội dung tạo bởi AI</p>
        <p class="${this.PREFIX}-confidence-text">
          Độ tin cậy: ${Math.round(detection.confidence * 100)}% • ${this._getMethodLabel(detection.method)}
        </p>
        <div class="${this.PREFIX}-watch-reasons">
          ${detection.reasons.map(r => `<div class="${this.PREFIX}-reason-item">• ${this._escapeHtml(r)}</div>`).join('')}
        </div>
        <div class="${this.PREFIX}-watch-actions">
          <button class="${this.PREFIX}-btn-watch-reveal" id="aivb-reveal-shorts">
            👁️ Hiện short (30 giây)
          </button>
          <button class="${this.PREFIX}-btn-go-back" id="aivb-go-back-shorts">
            ← Quay lại
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#aivb-reveal-shorts')?.addEventListener('click', () => {
      this._stopPlaybackGuard('shorts', true);
      overlay.style.display = 'none';
      setTimeout(() => {
        overlay.style.display = '';
        this._startPlaybackGuard('shorts');
      }, 30000);
    });
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
    document.querySelectorAll(`.${this.PREFIX}-shorts-overlay, .${this.PREFIX}-shorts-badge`).forEach((node) => node.remove());
    document.querySelectorAll('ytd-reel-video-renderer, ytd-shorts').forEach((node) => {
      node.classList.remove(`${this.PREFIX}-hidden`, `${this.PREFIX}-blur`);
    });

    delete document.body.dataset.aivbShortsBlocked;
    delete document.body.dataset.aivbShortsVideoId;
    delete document.body.dataset.aivbShortsBlockMode;
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
      'combination': '🧠 Multi-signal',
      'none': '❓ Không xác định'
    };
    return labels[method] || method;
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

    const enforce = () => this._pauseAndMuteMedia();
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

  _pauseAndMuteMedia() {
    document.querySelectorAll('video').forEach((video) => {
      if (!this.mediaState.has(video)) {
        this.mediaState.set(video, {
          muted: video.muted,
          volume: video.volume
        });
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
      this.playerState = {
        player,
        muted: this._callPlayerMethod(player, 'isMuted')
      };
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
      if (!state.muted) video.removeAttribute('muted');
    });

    this.mediaState = new WeakMap();

    const player = this.playerState?.player;
    if (player?.isConnected && this.playerState.muted === false) {
      this._callPlayerMethod(player, 'unMute');
    }
    this.playerState = null;
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
