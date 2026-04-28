/**
 * SafeKid — Shadow DOM Traversal Utilities
 * Cho phép query elements bên trong shadow roots.
 * Cần thiết cho YouTube Kids (dùng Shadow DOM rộng rãi).
 */

const ShadowDomHelper = {
  /**
   * Deep querySelector — traverse qua shadow roots.
   * @param {string} selector - CSS selector
   * @param {Element|Document} root - Root element (default: document)
   * @returns {Element|null}
   */
  deepQuery(selector, root = document) {
    // Thử query thông thường trước (nhanh nhất)
    const result = root.querySelector(selector);
    if (result) return result;

    // Traverse shadow roots
    return this._walkShadowRoots(root, (shadowRoot) => {
      return shadowRoot.querySelector(selector);
    });
  },

  /**
   * Deep querySelectorAll — trả về tất cả matches kể cả trong shadow DOM.
   * @param {string} selector - CSS selector
   * @param {Element|Document} root - Root element (default: document)
   * @returns {Element[]}
   */
  deepQueryAll(selector, root = document) {
    const results = [...root.querySelectorAll(selector)];

    this._walkShadowRoots(root, (shadowRoot) => {
      results.push(...shadowRoot.querySelectorAll(selector));
      return null; // continue walking — don't short-circuit
    });

    return results;
  },

  /**
   * Tìm closest ancestor qua shadow DOM boundaries.
   * Hữu ích khi cần tìm parent video card từ một element con.
   * @param {Element} el - Element bắt đầu
   * @param {string} selector - CSS selector
   * @returns {Element|null}
   */
  deepClosest(el, selector) {
    let current = el;
    while (current) {
      if (current.matches && current.matches(selector)) return current;

      // Nếu đang ở trong shadow root, nhảy ra host element
      if (current.parentNode) {
        current = current.parentNode;
      } else if (current.host) {
        current = current.host;
      } else {
        break;
      }
    }
    return null;
  },

  /**
   * Observe mutations bên trong shadow roots.
   * @param {Element} root - Root element to observe
   * @param {MutationCallback} callback
   * @param {MutationObserverInit} config
   * @returns {MutationObserver[]} — array of observers (cần disconnect tất cả)
   */
  observeWithShadow(root, callback, config = { childList: true, subtree: true }) {
    const observers = [];

    // Observer cho root chính
    const mainObserver = new MutationObserver(callback);
    mainObserver.observe(root, config);
    observers.push(mainObserver);

    // Observe tất cả shadow roots hiện tại
    this._walkShadowRoots(root, (shadowRoot) => {
      const shadowObserver = new MutationObserver(callback);
      shadowObserver.observe(shadowRoot, config);
      observers.push(shadowObserver);
      return null; // continue walking
    });

    return observers;
  },

  /**
   * Inject style vào shadow root (nếu có).
   * YouTube Kids shadow DOM cần styles injected trực tiếp.
   * @param {Element} host - Host element có shadowRoot
   * @param {string} cssText - CSS text
   * @param {string} styleId - ID để tránh duplicate injection
   */
  injectStyleIntoShadow(host, cssText, styleId = 'aivb-injected-style') {
    if (!host?.shadowRoot) return false;

    // Tránh inject trùng
    if (host.shadowRoot.querySelector(`style#${styleId}`)) return false;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = cssText;
    host.shadowRoot.appendChild(style);
    return true;
  },

  /**
   * Walk through all shadow roots recursively.
   * @param {Element|Document} root
   * @param {function(ShadowRoot): *} callback - Return truthy to stop walking
   * @returns {*} — first truthy result from callback, or null
   * @private
   */
  _walkShadowRoots(root, callback) {
    // Nếu root là ShadowRoot hoặc Document, query trực tiếp
    const elements = root.querySelectorAll('*');
    for (const el of elements) {
      if (!el.shadowRoot) continue;

      const result = callback(el.shadowRoot);
      if (result) return result;

      // Recurse into nested shadow roots
      const nested = this._walkShadowRoots(el.shadowRoot, callback);
      if (nested) return nested;
    }
    return null;
  },

  /**
   * Lấy tất cả shadow roots trong cây DOM.
   * @param {Element|Document} root
   * @returns {ShadowRoot[]}
   */
  getAllShadowRoots(root = document) {
    const roots = [];
    this._walkShadowRoots(root, (shadowRoot) => {
      roots.push(shadowRoot);
      return null; // continue
    });
    return roots;
  }
};

// Export cho content scripts
if (typeof globalThis !== 'undefined') {
  globalThis.ShadowDomHelper = ShadowDomHelper;
}
