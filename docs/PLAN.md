# AI Video Blocker V2 - Landing Page Update Plan

## 1. Task Overview
Update the existing landing page to introduce the concept of "AI slop" and its dangers to children, based on recent research and the open letter from over 200 experts. Add an introductory popup that plays an informative YouTube video to educate parents immediately upon visiting.

## 2. Execution Phases

### Phase 1: Content Update (frontend-specialist & seo-specialist)
- **Hero Section**: 
  - Update the messaging to mention "Rác AI" (AI slop).
  - Highlight that 95% of children's content on YouTube is not high quality.
- **Problem/Features Section**:
  - Add the context of the open letter signed by 200+ organizations (led by Fairplay).
  - Emphasize the dangers: blurring the lines between reality and virtuality, distorting children's perception ("bóp méo nhận thức").
  - Note the massive financial incentives behind AI slop (up to $4.25M/year for top channels).
- **Solution**: 
  - Position the extension as the essential "parental supervision" layer while waiting for platform-level tools.

### Phase 2: Video Popup Implementation (frontend-specialist)
- **UI Component**:
  - Create a new modal (`#videoModal`) to show the YouTube video embed: `https://www.youtube.com/watch?v=LOIRTF_prcY`.
  - Add a checkbox inside the modal: "Không hiển thị lại" (Do not show again).
- **Logic (`script.js`)**:
  - Check `localStorage.getItem('hideVideoPopup')` on page load.
  - If not set to 'true', display the modal.
  - Listen to checkbox changes. If checked, set `localStorage.setItem('hideVideoPopup', 'true')`.
  - Close button and click-outside-to-close functionality.

### Phase 3: Styling & Performance (frontend-specialist & performance-optimizer)
- Style the modal using the existing glassmorphism and rounded themes (`styles.css`).
- Ensure the YouTube iframe is responsive (16:9 aspect ratio).
- Lazy load the iframe or defer its loading to prevent blocking the initial page render.

---
**Status**: Pending User Approval.
