# AI Video Blocker V2 - Landing Page Implementation Plan

## 1. Project Overview & Target Audience
- **Product:** AI Video Blocker V2 (Chrome Extension).
- **Goal:** Create an impressive, high-converting landing page for the extension.
- **Target Audience:** Parents with young children who are concerned about the negative impacts of AI-generated "slop" content on YouTube.
- **Key Selling Points:** 
  - Multi-layer AI detection (YouTube labels, NLP heuristics, keyword matching).
  - Password-protected parental controls.
  - Automatic blurring/blocking of harmful AI videos.
  - 100% private, no data tracking.

## 2. Design System (UI/UX Pro Max)
- **Theme:** "Parental Control / Child Protection" - Playful, safe, friendly, yet highly professional and trustworthy.
- **Primary Colors:** Trustworthy Blue (`#3B82F6`) combined with Safe Green (`#10B981`) and soft pastel accents for a kid-friendly vibe.
- **Typography:** 
  - Headings: `Baloo 2` (Friendly, rounded, approachable).
  - Body: `Comic Neue` or `Inter` (Legible, clean).
- **UI Style:** Soft glassmorphism, rounded corners (large border-radius), playful micro-animations (bouncing icons, smooth transitions 200-300ms).
- **Tech Stack:** HTML5 + Vanilla CSS (or Tailwind CSS if preferred for rapid development) to match the extension's vanilla approach, but using a modern bundler like Vite if necessary.

## 3. Landing Page Structure (Page Sections)
1. **Hero Section:** 
   - Clear headline: "Bảo vệ trẻ em khỏi video AI độc hại trên YouTube."
   - Subheadline: "Tiện ích mở rộng tự động phát hiện và chặn nội dung AI không phù hợp, giúp môi trường mạng của con bạn an toàn hơn."
   - CTA (Call to Action): "Thêm vào Chrome miễn phí" (Large, pulsing button).
   - Visual: A high-quality illustration/mockup of a child watching YouTube safely, with a "shield" icon blocking AI content.
2. **Problem & Solution (Social Proof / Empathy):**
   - Address the parent's pain point: "Bạn có biết 70% video đề xuất cho trẻ em hiện nay là do AI tạo ra với nội dung vô nghĩa?"
   - Show how the extension solves it with a before/after visual (Blurred video vs Clean feed).
3. **Key Features (Grid Layout):**
   - 🛡️ *Phát hiện đa lớp*: Sử dụng AI để đánh bại AI (nhãn YouTube, NLP, từ khóa).
   - 🔒 *Kiểm soát của phụ huynh*: Cài đặt được bảo vệ bằng mật khẩu.
   - ⚡ *Hoạt động ngầm*: Nhẹ, nhanh, không làm chậm trình duyệt.
   - 🕵️ *Bảo mật 100%*: Không thu thập dữ liệu cá nhân.
4. **How It Works (3 Simple Steps):**
   - Step 1: Cài đặt tiện ích.
   - Step 2: Đặt mật khẩu phụ huynh.
   - Step 3: Yên tâm để trẻ khám phá YouTube.
5. **Testimonials / Social Proof:**
   - Quotes from "parents" (mockups) praising the peace of mind.
6. **Footer / Final CTA:**
   - Bottom CTA to install.
   - Links to Privacy Policy, Terms, and Contact.

## 4. Execution Phases (Phase 2 Orchestration)

To execute this plan, we will utilize the following agents in parallel:
- **`frontend-specialist`**: Implement the HTML/CSS layout, responsive design, animations, and typography based on the design system.
- **`seo-specialist`**: Ensure meta tags, schema markup, and content structure are optimized for search engines (Google Search for parents looking for YouTube blockers).
- **`performance-optimizer`**: Ensure the landing page loads blazingly fast (Lighthouse score 95+) with optimized images and minimal blocking scripts.

## 5. Pre-Delivery Checklist
- [ ] No emojis as icons (use SVGs like Heroicons/Lucide).
- [ ] Ensure WCAG AA accessibility (high contrast for older parents).
- [ ] Mobile-first responsive design (375px to 1440px).
- [ ] Clean and descriptive SEO meta tags in Vietnamese.
