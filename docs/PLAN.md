# Kế hoạch tích hợp Provider OpenRouter (AI Video Blocker V2)

## 1. Mục tiêu và Định hướng
- **Mục tiêu**: Thêm tuỳ chọn provider OpenRouter để tận dụng các model AI miễn phí, giúp phụ huynh không cần trả phí API mà vẫn sử dụng được tính năng phân loại video nâng cao.
- **Đối tượng**: Phụ huynh không rành công nghệ, do đó UI/UX phải thật đơn giản, mặc định hoạt động ngay. Các phần cấu hình sâu (API Key, Model, Fallback) sẽ được gom vào một giao diện thu gọn/mở rộng (collapsible).
- **Tính năng nổi bật**: Tự động chuyển đổi (auto-fallback) sang các model miễn phí khác trên OpenRouter nếu model hiện tại gặp lỗi (hết quota, timeout).

## 2. Các thay đổi về cấu trúc và Storage (`utils/storage.js`)
- Bổ sung cấu hình cho OpenRouter vào `DEFAULT_SETTINGS`:
  ```javascript
  activeProvider: 'gemini', // 'gemini' | 'openrouter'
  openrouter: {
    enabled: false,
    hasApiKey: false,
    model: 'google/gemini-2.0-flash-lite-preview-02-05:free', // Default free model
    autoFallback: true,
    fallbackModels: [
      'meta-llama/llama-3-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'qwen/qwen-2.5-72b-instruct:free'
    ],
    timeoutMs: 5000
  }
  ```
- Cập nhật các hàm update settings để xử lý việc lưu/xóa key của OpenRouter song song với Gemini.

## 3. Tạo tiện ích OpenRouter (`utils/openrouter.js`)
- Tạo module `OpenRouterClassifier` với vai trò tương tự `GeminiClassifier`.
- **Định dạng Prompt**: Chuyển đổi prompt hiện tại sang định dạng tin nhắn của OpenAI (`[{role: 'system', content: '...'}, {role: 'user', content: '...'}]`).
- **Response Format**: Sử dụng `response_format: { type: "json_object" }` để ép model trả về JSON schema mong muốn.
- **Hàm Normalization**: Xử lý JSON trả về và chuẩn hoá thành object `detection` tương đồng với Gemini.

## 4. Xử lý logic Background (`background/service-worker.js`)
- Thêm các hàm lưu trữ bảo mật (IndexedDB) cho `openrouterApiKey` tương tự như `geminiApiKey`.
- Cập nhật logic `handleMessage`:
  - Thêm xử lý `TEST_OPENROUTER_KEY`, `SAVE_OPENROUTER_KEY`, `CLEAR_OPENROUTER_KEY`.
  - Thay đổi luồng xử lý nhận diện video (`AI_CLASSIFY_VIDEO` hoặc giữ nguyên nhưng đổi ruột): Kiểm tra `activeProvider`. Nếu là `openrouter`, gọi hàm `runOpenRouterClassification`.
- **Logic Fallback (OpenRouter)**:
  - Nếu call request tới model chính bị lỗi HTTP (429, 503, 502) hoặc timeout, tiến hành bắt lỗi (`catch`).
  - Lặp qua mảng `fallbackModels` nếu tính năng `autoFallback` được bật, thử gọi lại API cho đến khi thành công hoặc hết model thì mới trả về lỗi.

## 5. UI/UX Popup (`popup/popup.html` và `popup/popup.js`)
- **HTML**:
  - Gói toàn bộ phần cài đặt API vào một thẻ `<details class="advanced-settings">` hoặc sử dụng một nút chuyển đổi (toggle) để giấu đi mặc định. Tiêu đề hiển thị thân thiện: "⚙️ Cài đặt AI nâng cao (Dành cho người có chuyên môn)".
  - Trong phần nội dung mở rộng, tạo UI chọn Provider (Radio button hoặc Select: Gemini / OpenRouter).
  - Khối giao diện của OpenRouter:
    - Input nhập OpenRouter API Key.
    - Select box chọn model chính (hiển thị danh sách các model miễn phí).
    - Checkbox cho tuỳ chọn "Tự động đổi sang model miễn phí khác nếu lỗi".
    - Các nút "Kiểm tra API Key", "Xóa API Key".
- **JS**:
  - Xử lý ẩn/hiện logic form dựa trên provider đang chọn.
  - Gửi message test key của OpenRouter, hiển thị thông báo thành công / thất bại phù hợp.
  - Cập nhật thống kê: thêm OpenRouter vào `methodBreakdown` (nếu cần phân biệt) hoặc giữ chung.

## 6. Kế hoạch triển khai (Phase 2 - Triển khai)
- **Frontend Specialist**: Chỉnh sửa HTML/CSS ở `popup/popup.html`, `popup/popup.css` để làm giao diện thu gọn, thiết kế UI OpenRouter, logic JS tại `popup/popup.js`.
- **Backend Specialist**: Triển khai `utils/openrouter.js`, sửa đổi `background/service-worker.js` và `utils/storage.js` để tích hợp OpenRouter API, tính năng fallback, và IndexedDB key storage.
- **Test Engineer**: Test thử luồng nhận diện bằng OpenRouter, cố tình làm lỗi model để test auto-fallback, đảm bảo hệ thống không bị crash nếu response của OpenRouter API không phải JSON hợp lệ.

Kế hoạch này đảm bảo hoàn thành tất cả các yêu cầu của người dùng, đặc biệt là UI/UX tối giản cho phụ huynh và tính năng fallback cho model OpenRouter miễn phí.
