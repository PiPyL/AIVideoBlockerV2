/**
 * SafeKid — i18n Helper
 * Provides localization utilities with manual language override.
 * Loads _locales messages at runtime to support dynamic switching.
 */

const I18n = {
  _currentLang: null,
  _messages: {},
  _ready: false,

  /**
   * Initialize i18n: load stored preference and message bundles.
   * Must be called before using t() for override mode.
   */
  async init() {
    // Load saved language preference
    const stored = await new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['preferredLanguage'], (result) => {
          resolve(result.preferredLanguage || null);
        });
      } else {
        resolve(null);
      }
    });

    this._currentLang = stored || this._detectBrowserLang();

    // Load both message bundles
    await Promise.all([
      this._loadMessages('vi'),
      this._loadMessages('en')
    ]);

    this._ready = true;
  },

  /**
   * Load messages.json for a specific locale.
   */
  async _loadMessages(lang) {
    try {
      const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
      const resp = await fetch(url);
      if (resp.ok) {
        this._messages[lang] = await resp.json();
      }
    } catch (e) {
      // Fallback: messages won't be available for this locale
    }
  },

  /**
   * Detect browser language, return 'vi' or 'en'.
   */
  _detectBrowserLang() {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
      const lang = chrome.i18n.getUILanguage().split('-')[0];
      return lang === 'vi' ? 'vi' : 'en';
    }
    return 'vi';
  },

  /**
   * Get localized message by key.
   * Uses loaded messages with language override.
   * @param {string} key - Message key from _locales messages
   * @param {string|string[]} [substitutions] - Optional substitution values
   * @returns {string} Localized string or key if not found
   */
  t(key, substitutions) {
    // If messages are loaded, use override mode
    if (this._ready && this._messages[this._currentLang]) {
      const entry = this._messages[this._currentLang][key];
      if (entry && entry.message) {
        let msg = entry.message;
        // Handle Chrome i18n $1, $2... substitutions
        if (substitutions) {
          const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
          subs.forEach((sub, i) => {
            msg = msg.replace(new RegExp(`\\$${i + 1}`, 'g'), sub);
          });
        }
        return msg;
      }
    }

    // Fallback: try chrome.i18n API
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key, substitutions);
      return msg || key;
    }
    return key;
  },

  /**
   * Apply translations to all elements with data-i18n attribute.
   * Supports:
   *   data-i18n="key" -> sets textContent
   *   data-i18n-placeholder="key" -> sets placeholder
   *   data-i18n-aria="key" -> sets aria-label
   *   data-i18n-title="key" -> sets title attribute
   *   data-i18n-html="key" -> sets innerHTML (use sparingly)
   * @param {HTMLElement} [root=document] - Root element to search within
   */
  applyToDOM(root = document) {
    // Text content
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = this.t(key);
    });

    // Placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = this.t(key);
    });

    // Aria-label
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', this.t(key));
    });

    // Title attribute
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = this.t(key);
    });

    // innerHTML (for keys with embedded HTML)
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = this.t(key);
    });
  },

  /**
   * Get current language code.
   * @returns {string} Language code: 'vi' or 'en'
   */
  getLanguage() {
    return this._currentLang || this._detectBrowserLang();
  },

  /**
   * Switch language and persist preference.
   * @param {string} lang - 'vi' or 'en'
   */
  async setLanguage(lang) {
    if (lang !== 'vi' && lang !== 'en') return;
    this._currentLang = lang;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await new Promise(resolve => {
        chrome.storage.local.set({ preferredLanguage: lang }, resolve);
      });
    }

    // Re-apply all translations on the page
    this.applyToDOM();
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.I18n = I18n;
}
