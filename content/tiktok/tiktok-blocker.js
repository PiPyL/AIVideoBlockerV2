/**
 * SafeKid — TikTok Blocker Module
 * Handles overlay creation, video pausing, and click guards on TikTok.
 *
 * CSS prefix: safekid-tt-  (avoids collision with YouTube's aivb- prefix)
 */

const TikTokBlocker = {
  PREFIX: 'safekid-tt',

  /** WeakMap to track click guard listeners per element */
  clickGuards: new WeakMap(),
  /** WeakMap to track saved media state per <video> element */
  mediaState: new WeakMap(),

  // ==================== FEED VIDEO ITEMS ====================

  /**
   * Block a video item in the feed / search / profile grid.
   * @param {HTMLElement} el — video item container
   * @param {string} username — normalized TikTok username
   * @param {string} reason — display reason for blocking
   */
  blockVideoItem(el, username, reason) {
    if (!el || el.dataset.safekidTtProcessed === 'blocked') return;
    el.dataset.safekidTtProcessed = 'blocked';
    el.dataset.safekidTtUsername = username || '';

    // Pause any video inside this item
    this._pauseVideosIn(el);

    // Apply overlay
    el.classList.add(`${this.PREFIX}-blocked`);
    el.style.position = 'relative';

    const overlay = this._createCompactOverlay(username, reason);
    el.appendChild(overlay);

    // Click guard — prevent navigation
    this._bindClickGuard(el);
  },

  /**
   * Remove blocking from a video item.
   * @param {HTMLElement} el
   */
  unblockVideoItem(el) {
    if (!el) return;
    el.classList.remove(`${this.PREFIX}-blocked`);
    delete el.dataset.safekidTtProcessed;
    delete el.dataset.safekidTtUsername;

    el.querySelectorAll(`.${this.PREFIX}-overlay`).forEach(n => n.remove());
    this._unbindClickGuard(el);
    this._resumeVideosIn(el);
  },

  // ==================== FULL-PAGE OVERLAYS ====================

  /**
   * Block a video detail page (/@user/video/ID).
   * @param {string} username
   * @param {string} reason
   */
  blockVideoPage(username, reason) {
    if (document.querySelector(`.${this.PREFIX}-fullpage-overlay[data-surface="video"]`)) return;

    this._pauseAllPageVideos();
    document.body.dataset.safekidTtVideoBlocked = 'true';

    const overlay = this._createFullPageOverlay(username, reason, 'video');
    document.body.appendChild(overlay);
  },

  /** Remove video page blocking. */
  unblockVideoPage() {
    document.querySelectorAll(`.${this.PREFIX}-fullpage-overlay[data-surface="video"]`).forEach(n => n.remove());
    delete document.body.dataset.safekidTtVideoBlocked;
    this._resumeAllPageVideos();
  },

  /**
   * Block a profile page (/@user).
   * @param {string} username
   * @param {string} reason
   */
  blockProfilePage(username, reason) {
    if (document.querySelector(`.${this.PREFIX}-fullpage-overlay[data-surface="profile"]`)) return;

    document.body.dataset.safekidTtProfileBlocked = 'true';

    const overlay = this._createFullPageOverlay(username, reason, 'profile');
    document.body.appendChild(overlay);
  },

  /** Remove profile page blocking. */
  unblockProfilePage() {
    document.querySelectorAll(`.${this.PREFIX}-fullpage-overlay[data-surface="profile"]`).forEach(n => n.remove());
    delete document.body.dataset.safekidTtProfileBlocked;
  },

  /** Remove all full-page overlays. */
  unblockAllPages() {
    this.unblockVideoPage();
    this.unblockProfilePage();
  },

  // ==================== OVERLAY CREATION ====================

  /**
   * Create a compact overlay for feed video items.
   */
  _createCompactOverlay(username, reason) {
    const overlay = document.createElement('div');
    overlay.className = `${this.PREFIX}-overlay`;
    overlay.setAttribute('role', 'note');
    overlay.setAttribute('aria-label', reason || 'Kênh bị chặn');

    const content = document.createElement('div');
    content.className = `${this.PREFIX}-overlay-content`;

    const shield = document.createElement('div');
    shield.className = `${this.PREFIX}-shield-icon`;
    shield.textContent = '🛡️';

    const title = document.createElement('div');
    title.className = `${this.PREFIX}-overlay-title`;
    title.textContent = 'Kênh bị chặn';

    const meta = document.createElement('div');
    meta.className = `${this.PREFIX}-overlay-meta`;
    meta.textContent = username ? `@${username}` : '';

    const reasonEl = document.createElement('div');
    reasonEl.className = `${this.PREFIX}-overlay-reason`;
    reasonEl.textContent = reason || '';

    content.append(shield, title, meta, reasonEl);
    overlay.appendChild(content);

    // Block clicks on overlay
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true);

    return overlay;
  },

  /**
   * Create a full-page overlay for video detail / profile pages.
   * @param {string} username
   * @param {string} reason
   * @param {'video'|'profile'} surface
   */
  _createFullPageOverlay(username, reason, surface) {
    const overlay = document.createElement('div');
    overlay.className = `${this.PREFIX}-fullpage-overlay`;
    overlay.dataset.surface = surface;

    const content = document.createElement('div');
    content.className = `${this.PREFIX}-fullpage-content`;

    const shield = document.createElement('div');
    shield.className = `${this.PREFIX}-shield-icon-large`;
    shield.textContent = '🛡️';

    const heading = document.createElement('h2');
    heading.textContent = surface === 'profile' ? 'Trang kênh bị chặn' : 'Video bị chặn';

    const desc = document.createElement('p');
    desc.textContent = reason || 'Nội dung từ kênh này đã bị phụ huynh chặn';

    const userLabel = document.createElement('p');
    userLabel.className = `${this.PREFIX}-username-label`;
    userLabel.textContent = username ? `@${username}` : '';

    const actions = document.createElement('div');
    actions.className = `${this.PREFIX}-actions`;

    const backBtn = document.createElement('button');
    backBtn.className = `${this.PREFIX}-btn-go-back`;
    backBtn.id = `safekid-tt-go-back-${surface}`;
    backBtn.textContent = '← Quay lại';
    backBtn.addEventListener('click', () => {
      window.history.back();
    });

    actions.appendChild(backBtn);
    content.append(shield, heading, desc, userLabel, actions);
    overlay.appendChild(content);

    // Block clicks on overlay background
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    return overlay;
  },

  // ==================== CLICK GUARD ====================

  _bindClickGuard(el) {
    if (!el || this.clickGuards.has(el)) return;

    const guard = (event) => {
      // Allow clicks inside overlay buttons
      if (event.target?.closest?.(`.${this.PREFIX}-btn-go-back`)) return;

      // Block clicks on overlay
      if (event.target?.closest?.(`.${this.PREFIX}-overlay`)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      // Block video navigation links
      const link = event.target?.closest?.('a[href]');
      if (link) {
        const href = link.getAttribute('href') || '';
        if (href.startsWith('/@') || href.includes('/video/')) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
      }
    };

    el.addEventListener('click', guard, true);
    el.addEventListener('auxclick', guard, true);
    this.clickGuards.set(el, guard);
  },

  _unbindClickGuard(el) {
    const guard = this.clickGuards.get(el);
    if (!guard) return;
    el.removeEventListener('click', guard, true);
    el.removeEventListener('auxclick', guard, true);
    this.clickGuards.delete(el);
  },

  // ==================== MEDIA CONTROL ====================

  _pauseVideosIn(container) {
    if (!container) return;
    container.querySelectorAll('video').forEach(video => {
      if (!this.mediaState.has(video)) {
        this.mediaState.set(video, {
          muted: video.muted,
          paused: video.paused
        });
      }
      try { video.pause(); } catch { /* ignore */ }
      video.muted = true;
    });
  },

  _resumeVideosIn(container) {
    if (!container) return;
    container.querySelectorAll('video').forEach(video => {
      const state = this.mediaState.get(video);
      if (state) {
        video.muted = state.muted;
        if (!state.paused && video.paused) {
          try { video.play()?.catch(() => {}); } catch { /* ignore */ }
        }
        this.mediaState.delete(video);
      }
    });
  },

  _pauseAllPageVideos() {
    document.querySelectorAll('video').forEach(video => {
      if (!this.mediaState.has(video)) {
        this.mediaState.set(video, {
          muted: video.muted,
          paused: video.paused
        });
      }
      try { video.pause(); } catch { /* ignore */ }
      video.muted = true;
    });
  },

  _resumeAllPageVideos() {
    document.querySelectorAll('video').forEach(video => {
      const state = this.mediaState.get(video);
      if (state) {
        video.muted = state.muted;
        if (!state.paused && video.paused) {
          try { video.play()?.catch(() => {}); } catch { /* ignore */ }
        }
        this.mediaState.delete(video);
      }
    });
    this.mediaState = new WeakMap();
  }
};

// Export for content scripts
if (typeof globalThis !== 'undefined') {
  globalThis.TikTokBlocker = TikTokBlocker;
}
