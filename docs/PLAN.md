# SafeKid Multi-Language Implementation Plan

## Overview
Triển khai hệ thống đa ngôn ngữ (i18n) cho SafeKid — hỗ trợ **Tiếng Việt (VI - default)** và **English (EN)**.

## Phạm vi

### 1. Extension (Chrome Extension)
- **popup/popup.html** — Tất cả UI text (labels, buttons, placeholders, tooltips)
- **popup/popup.js** — Dynamic text (status messages, confirmations, labels)
- **content/blocker.js** — Overlay text (block titles, descriptions, confidence labels)
- **background/service-worker.js** — Context menu items
- **manifest.json** — Sử dụng Chrome i18n API (`chrome.i18n`)

### 2. Website (docs/)
- **docs/index.html** — Landing page
- **docs/guide.html** — User guide
- **docs/privacy.html** — Privacy policy
- **docs/terms.html** — Terms of service
- **docs/script.js** — Dynamic content

## Architecture

### Extension: Chrome i18n API
Chrome hỗ trợ native i18n qua `_locales/` directory:
```
_locales/
  vi/
    messages.json    ← Vietnamese (default)
  en/
    messages.json    ← English
```

- `manifest.json` → `"default_locale": "vi"`
- Sử dụng `chrome.i18n.getMessage('key')` trong JS
- Sử dụng `__MSG_key__` trong HTML/manifest
- Auto-detect ngôn ngữ trình duyệt

### Website: JavaScript-based i18n
- File `docs/i18n.js` chứa translations
- `data-i18n` attribute trên HTML elements
- Language switcher UI trên header
- `localStorage` lưu preference

## Tasks

### Phase 1: Extension i18n (Core) ✅
1. ✅ Tạo `_locales/vi/messages.json` — Tất cả Vietnamese strings
2. ✅ Tạo `_locales/en/messages.json` — Tất cả English strings
3. ✅ Cập nhật `manifest.json` — Thêm `default_locale`, dùng `__MSG_*__`
4. ✅ Cập nhật `popup/popup.html` — Thêm `data-i18n` attributes
5. ✅ Tạo `utils/i18n.js` — Helper function cho i18n
6. ✅ Cập nhật `popup/popup.js` — Dùng i18n cho dynamic strings
7. ✅ Cập nhật `content/blocker.js` — Dùng i18n cho overlay text
8. ✅ Cập nhật `background/service-worker.js` — Dùng i18n cho context menus

### Phase 2: Website i18n ✅
9. ✅ Tạo `docs/i18n.js` — Translation module cho website
10. ✅ Cập nhật `docs/index.html` — Language switcher + data attributes
11. ✅ Cập nhật `docs/guide.html` — i18n support + language switcher
12. ⬜ Cập nhật `docs/privacy.html` — i18n support (optional - legal docs)
13. ⬜ Cập nhật `docs/terms.html` — i18n support (optional - legal docs)
14. ⬜ Cập nhật `docs/script.js` — Integrate i18n
15. ✅ Cập nhật `docs/styles.css` — Language switcher styles

## Notes
- Vietnamese là default — nếu trình duyệt không match, hiện Vietnamese
- Chrome extension dùng browser language auto-detect
- Website dùng localStorage + manual switcher
- Tất cả code comments/variables giữ English
