# SafeKid V2 - Agent Guidelines

## Project Overview
Chrome Extension (Manifest V3) that detects and blocks AI-generated videos on YouTube to protect children.

## Tech Stack
- **Platform:** Chrome Extension (Manifest V3)
- **Language:** Vanilla JavaScript (ES2022+)
- **Styling:** Vanilla CSS with CSS custom properties
- **Storage:** chrome.storage.local
- **Communication:** chrome.runtime message passing

## Architecture
- `content/` — Content scripts injected into YouTube pages
- `background/` — Service worker for coordination
- `popup/` — Popup UI for parental controls
- `styles/` — Injected CSS for blocking/blurring videos
- `utils/` — Shared utilities

## Key Patterns
1. **Multi-layer detection:** YouTube labels → NLP heuristics → keyword matching
2. **XPath over CSS selectors** for YouTube DOM queries (more stable)
3. **MutationObserver** for dynamic content detection
4. **Message passing** between content script ↔ service worker
5. **Password-protected settings** for parental control

## Conventions
- Use `const`/`let`, never `var`
- All user-facing strings must support Vietnamese
- No external dependencies — everything bundled
- All interactive elements must have unique IDs
