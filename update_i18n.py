import re
import json

i18n_keys = {
    # Nav
    "navFeatures": {"vi": "Tính năng", "en": "Features"},
    "navHowItWorks": {"vi": "Cách hoạt động", "en": "How It Works"},
    "navGuide": {"vi": "Hướng dẫn", "en": "Guide"},
    "navFaq": {"vi": "Hỏi đáp", "en": "FAQ"},
    "btnInstall": {"vi": "Cài đặt miễn phí", "en": "Install Free"},

    # Hero
    "heroTitle": {"vi": "Hỗ trợ chặn kênh/video không phù hợp với trẻ em", "en": "Block inappropriate channels and videos for children"},
    "heroSubtitle": {"vi": "SafeKid hỗ trợ chặn kênh hoặc video không phù hợp với trẻ em do phụ huynh tự thiết lập hoặc thông qua cơ chế tự động phát hiện. Hoạt động trên cả <strong>YouTube</strong> và <strong>YouTube Kids</strong> — miễn phí, riêng tư 100%.", "en": "SafeKid helps block inappropriate channels or videos for children through parental controls or automatic detection. Works on both <strong>YouTube</strong> and <strong>YouTube Kids</strong> — 100% free and private."},
    "heroBtnDownload": {"vi": "Tải file ZIP miễn phí", "en": "Download ZIP Free"},
    "heroTrust1": {"vi": "Bảo mật 100%", "en": "100% Secure"},
    "heroTrust2": {"vi": "YouTube & YouTube Kids", "en": "YouTube & YouTube Kids"},
    "heroTrust3": {"vi": "Tích hợp AI", "en": "AI Integrated"},
    "mockupSafe": {"vi": "Kênh thiếu nhi an toàn", "en": "Safe Kids Channel"},
    "mockupBlocked": {"vi": "Đã chặn Video AI", "en": "Blocked AI Video"},
    "mockupSpam": {"vi": "Spam content...", "en": "Spam content..."},
    "noticePrefix": {"vi": "Lưu ý:", "en": "Note:"},
    "noticeText": {"vi": "Cơ chế phát hiện video AI hiện đang trong quá trình hoàn thiện nên có thể xảy ra sai sót. SafeKid đang không ngừng nâng cấp công nghệ để liên tục cải thiện hiệu quả bảo vệ trong tương lai.", "en": "The AI video detection mechanism is still in development and may have errors. SafeKid is constantly upgrading its technology to continuously improve protection efficiency in the future."},

    # Features
    "featSectionTitle": {"vi": "Hành động ngay trước vấn nạn \"Rác AI\"", "en": "Act Now Against \"AI Slop\""},
    "featSectionDesc": {"vi": "Theo thư ngỏ từ hơn 200 chuyên gia, nội dung AI độc hại đang thu lợi nhuận khổng lồ trên sự an toàn của trẻ. SafeKid là giải pháp tức thời cho cha mẹ.", "en": "According to an open letter from over 200 experts, harmful AI content is making huge profits at the expense of children's safety. SafeKid is the immediate solution for parents."},
    "feat1Title": {"vi": "Phát hiện đa lớp thông minh", "en": "Smart Multi-layer Detection"},
    "feat1Desc": {"vi": "Hệ thống 3 tầng: nhãn dán YouTube → phân tích ngôn ngữ NLP & keyword → AI phân tích sâu (Gemini/OpenRouter). Kết hợp tiêu đề, mô tả và phụ đề video để không bỏ sót.", "en": "3-tier system: YouTube labels → NLP & keyword analysis → Deep AI analysis (Gemini/OpenRouter). Combines video title, description, and subtitles to ensure nothing is missed."},
    "featNewBadge": {"vi": "Mới", "en": "New"},
    "feat2Title": {"vi": "Chế độ \"Chỉ kênh đã duyệt\"", "en": "\"Approved Channels Only\" Mode"},
    "feat2Desc": {"vi": "Con bạn CHỈ xem được các kênh mà bạn đã kiểm duyệt và phê duyệt. Mọi kênh lạ đều bị chặn hoàn toàn — an toàn tuyệt đối cho trẻ nhỏ.", "en": "Your child can ONLY watch channels you have reviewed and approved. All unknown channels are completely blocked — absolute safety for young children."},
    "feat3Title": {"vi": "Kiểm soát phụ huynh toàn diện", "en": "Comprehensive Parental Controls"},
    "feat3Desc": {"vi": "Mật khẩu bảo vệ mọi cài đặt. Danh sách chặn/cho phép kênh linh hoạt. Chuột phải vào video để chặn hoặc cho phép kênh ngay lập tức.", "en": "Password protects all settings. Flexible allowed/blocked channel lists. Right-click on a video to instantly block or allow a channel."},
    "feat4Title": {"vi": "Hỗ trợ YouTube Kids", "en": "YouTube Kids Support"},
    "feat4Desc": {"vi": "Không chỉ YouTube.com — SafeKid còn bảo vệ trẻ trên YouTube Kids với công nghệ deep traversal, đảm bảo không lọt nội dung độc hại trên mọi nền tảng.", "en": "Not just YouTube.com — SafeKid also protects children on YouTube Kids with deep traversal technology, ensuring no harmful content slips through on any platform."},
    "feat5Title": {"vi": "Lọc 8 loại nội dung nguy hại", "en": "Filters 8 Types of Harmful Content"},
    "feat5Desc": {"vi": "Tự động phát hiện: tình dục, bạo lực, kinh dị, tự gây hại, hành vi nguy hiểm, ma túy, ngôn ngữ tục tĩu và hoạt hình biến thái (Elsagate).", "en": "Automatically detects: sexual content, violence, horror, self-harm, dangerous behavior, drugs, profanity, and disturbing animations (Elsagate)."},
    "feat6Title": {"vi": "Siêu mượt, siêu nhẹ", "en": "Ultra-smooth, Ultra-light"},
    "feat6Desc": {"vi": "Hoạt động ngầm với hiệu năng tối ưu, không làm chậm trình duyệt. Cache thông minh giúp scan nhanh hơn theo thời gian sử dụng.", "en": "Runs in the background with optimal performance, without slowing down your browser. Smart cache makes scanning faster over time."},

    # How it Works
    "howTitle": {"vi": "Cách thức hoạt động", "en": "How It Works"},
    "howSubtitle": {"vi": "Bảo vệ con yêu chỉ trong 4 bước đơn giản.", "en": "Protect your beloved child in just 4 simple steps."},
    "how1Title": {"vi": "Cài đặt tiện ích", "en": "Install Extension"},
    "how1Desc": {"vi": "Tải file ZIP và thêm SafeKid vào Chrome hoàn toàn miễn phí.", "en": "Download the ZIP file and add SafeKid to Chrome completely free."},
    "how2Title": {"vi": "Thiết lập bảo mật", "en": "Setup Security"},
    "how2Desc": {"vi": "Tạo mật khẩu phụ huynh và thêm các kênh an toàn vào danh sách cho phép.", "en": "Create a parental password and add safe channels to the allowed list."},
    "how3Title": {"vi": "Kích hoạt AI", "en": "Activate AI"},
    "how3Desc": {"vi": "Thêm API key Gemini hoặc OpenRouter để tăng độ chính xác. Có nhiều model <strong>miễn phí</strong>!", "en": "Add a Gemini or OpenRouter API key to increase accuracy. Many models are <strong>free</strong>!"},
    "how4Title": {"vi": "Tận hưởng an toàn", "en": "Enjoy Safety"},
    "how4Desc": {"vi": "SafeKid tự động chặn video AI độc hại. Bạn yên tâm, con vui chơi!", "en": "SafeKid automatically blocks harmful AI videos. You can relax while your child has fun!"},

    # FAQ
    "faqTitle": {"vi": "Câu hỏi thường gặp", "en": "Frequently Asked Questions"},
    "faqSubtitle": {"vi": "Giải đáp mọi thắc mắc về SafeKid.", "en": "Answers to all your questions about SafeKid."},
    "faq1Q": {"vi": "SafeKid có miễn phí không?", "en": "Is SafeKid free?"},
    "faq1A": {"vi": "Hoàn toàn miễn phí. Bạn chỉ cần tải file ZIP và cài đặt thủ công vào Chrome. Không có phí ẩn, không quảng cáo, không thu thập dữ liệu.", "en": "Completely free. You just need to download the ZIP file and install it manually in Chrome. No hidden fees, no ads, no data collection."},
    "faq2Q": {"vi": "Tại sao chưa có trên Chrome Web Store?", "en": "Why isn't it on the Chrome Web Store yet?"},
    "faq2A": {"vi": "SafeKid đang chờ duyệt trên Chrome Web Store. Hiện tại bạn cài đặt bằng cách load unpacked — hướng dẫn chi tiết sẽ hiện khi bạn nhấn nút <strong>\"Tải file ZIP\"</strong>.", "en": "SafeKid is currently pending review on the Chrome Web Store. For now, you install by loading unpacked — detailed instructions will appear when you click the <strong>\"Download ZIP Free\"</strong> button."},
    "faq3Q": {"vi": "AI phát hiện có chính xác 100% không?", "en": "Is the AI detection 100% accurate?"},
    "faq3A": {"vi": "Không có hệ thống nào hoàn hảo. SafeKid sử dụng 3 tầng phát hiện (labels + NLP + AI) và liên tục cải thiện. Bạn có thể bổ sung bằng chế độ <strong>\"Chỉ kênh đã duyệt\"</strong> để đảm bảo an toàn tuyệt đối — chỉ cho con xem các kênh bạn đã kiểm duyệt.", "en": "No system is perfect. SafeKid uses 3 layers of detection (labels + NLP + AI) and is continuously improving. You can supplement this with the <strong>\"Approved Channels Only\"</strong> mode to ensure absolute safety — only letting your child watch channels you've reviewed."},
    "faq4Q": {"vi": "Dữ liệu của tôi có bị thu thập không?", "en": "Is my data collected?"},
    "faq4A": {"vi": "<strong>KHÔNG.</strong> Mọi dữ liệu xử lý tại local trên máy bạn. API key được lưu trong bộ nhớ bảo mật riêng (IndexedDB). SafeKid không gửi bất kỳ dữ liệu cá nhân nào ra bên ngoài.", "en": "<strong>NO.</strong> All data is processed locally on your device. The API key is stored in secure local storage (IndexedDB). SafeKid does not send any personal data externally."},
    "faq5Q": {"vi": "SafeKid có hoạt động trên YouTube Kids không?", "en": "Does SafeKid work on YouTube Kids?"},
    "faq5A": {"vi": "<strong>CÓ!</strong> SafeKid hỗ trợ cả <code>youtube.com</code> và <code>youtubekids.com</code> với công nghệ nhận diện platform tự động. Danh sách kênh được đồng bộ giữa 2 nền tảng.", "en": "<strong>YES!</strong> SafeKid supports both <code>youtube.com</code> and <code>youtubekids.com</code> with automatic platform detection technology. The channel list is synchronized between both platforms."},
    "faq6Q": {"vi": "Cần API key để sử dụng không?", "en": "Do I need an API key to use it?"},
    "faq6A": {"vi": "<strong>Không bắt buộc.</strong> SafeKid hoạt động tốt chỉ với bộ lọc local (labels + keywords). API key giúp tăng thêm độ chính xác với phân tích AI. OpenRouter cung cấp nhiều model hoàn toàn miễn phí như Gemma 4, Qwen3, GPT-OSS.", "en": "<strong>Not required.</strong> SafeKid works well with just the local filters (labels + keywords). An API key increases accuracy with AI analysis. OpenRouter provides many completely free models like Gemma 4, Qwen3, GPT-OSS."},

    # CTA
    "ctaTitle": {"vi": "Hãy để con có một tuổi thơ kỹ thuật số an toàn", "en": "Give your child a safe digital childhood"},
    "ctaDesc": {"vi": "Tham gia cùng hàng ngàn phụ huynh đang bảo vệ con em mình trên Internet.", "en": "Join thousands of parents protecting their children on the Internet."},
    "ctaBtn": {"vi": "Tải về máy ngay (File ZIP)", "en": "Download Now (ZIP File)"},

    # Footer & Modals
    "footerCopyright": {"vi": "© 2026 AutoWork Team. Đảm bảo quyền riêng tư và an toàn.", "en": "© 2026 AutoWork Team. Ensuring privacy and safety."},
    "footerGuide": {"vi": "Hướng dẫn sử dụng", "en": "User Guide"},
    "footerPrivacy": {"vi": "Chính sách bảo mật", "en": "Privacy Policy"},
    "footerTerms": {"vi": "Điều khoản", "en": "Terms of Service"},
    "footerContact": {"vi": "Liên hệ", "en": "Contact Us"},
    "contactTitle": {"vi": "Thông tin liên hệ", "en": "Contact Information"},
    "contactDesc": {"vi": "Nếu bạn cần hỗ trợ hoặc có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua:", "en": "If you need support or have any questions, please contact us via:"},
    "contactEmail": {"vi": "Email:", "en": "Email:"},
    "contactPhone": {"vi": "SĐT / Zalo:", "en": "Phone / Zalo:"},
    "installTitle": {"vi": "Hướng dẫn cài đặt thủ công", "en": "Manual Installation Guide"},
    "installDesc": {"vi": "Do tiện ích đang chờ duyệt trên Chrome Store, bạn vui lòng cài đặt theo 4 bước đơn giản sau:", "en": "Because the extension is pending review on the Chrome Store, please install it following these 4 simple steps:"},
    "installStep1": {"vi": "Tải và giải nén", "en": "Download and Extract"},
    "installStep1Desc": {"vi": "Tải file ZIP bên dưới về máy tính và giải nén ra một thư mục.", "en": "Download the ZIP file below to your computer and extract it to a folder."},
    "installStep1Btn": {"vi": "Click để tải file ZIP", "en": "Click to download ZIP file"},
    "installStep2": {"vi": "Mở trang Quản lý tiện ích", "en": "Open Extensions Manager"},
    "installStep2Desc": {"vi": "Mở trình duyệt, copy và dán đường dẫn này vào thanh địa chỉ: <code class=\"highlight-code\">chrome://extensions/</code> (sau đó nhấn Enter).", "en": "Open your browser, copy and paste this path into the address bar: <code class=\"highlight-code\">chrome://extensions/</code> (then press Enter)."},
    "installStep3": {"vi": "Bật Chế độ nhà phát triển", "en": "Enable Developer Mode"},
    "installStep3Desc": {"vi": "Nhìn lên góc <strong>phải, phía trên</strong> màn hình và bật công tắc <strong>Chế độ dành cho nhà phát triển</strong> (Developer mode).", "en": "Look to the <strong>top right</strong> corner of the screen and turn on the <strong>Developer mode</strong> switch."},
    "installStep4": {"vi": "Tải thư mục lên", "en": "Load Folder"},
    "installStep4Desc": {"vi": "Nhấn vào nút <strong>Tải tiện ích đã giải nén</strong> (Load unpacked) ở góc trái và chọn thư mục bạn vừa giải nén ở Bước 1. Xong!", "en": "Click the <strong>Load unpacked</strong> button on the left and select the folder you extracted in Step 1. Done!"},
    "videoWarnTitle": {"vi": "Cảnh báo \"Rác AI\" trên YouTube", "en": "Warning: \"AI Slop\" on YouTube"},
    "videoWarnDesc": {"vi": "Sự bùng nổ của AI là không thể đảo ngược, nhưng an toàn của trẻ không thể bị đánh đổi.", "en": "The explosion of AI is irreversible, but children's safety cannot be compromised."},
    "videoWatchOnYT": {"vi": "Xem trên YouTube", "en": "Watch on YouTube"},
    "videoDontShow": {"vi": "Không hiển thị lại thông báo này", "en": "Don't show this message again"},
    "videoGotIt": {"vi": "Tôi đã hiểu", "en": "I got it"},

    # Guide Page
    "guideHeroTitle": {"vi": "Hướng dẫn sử dụng SafeKid", "en": "SafeKid User Guide"},
    "guideHeroSubtitle": {"vi": "Toàn bộ hướng dẫn cách cài đặt, cấu hình và sử dụng SafeKid. Extension hỗ trợ chặn kênh hoặc video không phù hợp với trẻ em do phụ huynh tự thiết lập hoặc cơ chế tự động phát hiện.", "en": "Complete guide on how to install, configure, and use SafeKid. The extension supports blocking channels or videos unsuitable for children through parental setup or automatic detection."},
    "guideTocTitle": {"vi": "Mục lục", "en": "Table of Contents"},
    "guideToc1": {"vi": "1. Cài đặt tiện ích", "en": "1. Install Extension"},
    "guideToc2": {"vi": "2. Tab Tổng quan — Cài đặt cơ bản", "en": "2. Overview Tab — Basic Settings"},
    "guideToc3": {"vi": "3. Tab Quản lý nâng cao", "en": "3. Advanced Management Tab"},
    "guideToc4": {"vi": "4. Chuột phải — Chặn/Cho phép nhanh", "en": "4. Right-click — Quick Block/Allow"},
    "guideToc5": {"vi": "5. Màn hình chặn video", "en": "5. Video Block Screen"},
    "guideToc6": {"vi": "6. Câu hỏi thường gặp", "en": "6. Frequently Asked Questions"},

    "guideSec1Title": {"vi": "1. Cài đặt tiện ích", "en": "1. Install Extension"},
    "guideSec1Step1": {"vi": "Tải và giải nén", "en": "Download and extract"},
    "guideSec1Step1Desc": {"vi": "Tải file <strong>safekid-extension.zip</strong> từ trang chủ và giải nén ra một thư mục.", "en": "Download the <strong>safekid-extension.zip</strong> file from the homepage and extract it to a folder."},
    "guideSec1Step2": {"vi": "Mở Quản lý tiện ích", "en": "Open Extensions Manager"},
    "guideSec1Step2Desc": {"vi": "Trên trình duyệt Chrome, gõ <code>chrome://extensions/</code> vào thanh địa chỉ rồi nhấn Enter.", "en": "In the Chrome browser, type <code>chrome://extensions/</code> into the address bar and press Enter."},
    "guideSec1Step3": {"vi": "Bật Chế độ nhà phát triển", "en": "Enable Developer Mode"},
    "guideSec1Step3Desc": {"vi": "Bật công tắc <strong>\"Developer mode\"</strong> (Chế độ nhà phát triển) ở góc trên bên phải.", "en": "Turn on the <strong>\"Developer mode\"</strong> switch in the top right corner."},
    "guideSec1Step4": {"vi": "Tải thư mục lên", "en": "Load folder"},
    "guideSec1Step4Desc": {"vi": "Nhấn nút <strong>\"Load unpacked\"</strong> (Tải tiện ích đã giải nén) → chọn thư mục vừa giải nén.", "en": "Click the <strong>\"Load unpacked\"</strong> button → select the extracted folder."},
    "guideSec1Tip": {"vi": "<strong>Mẹo:</strong> Sau khi cài đặt, hãy nhấp vào biểu tượng mảnh ghép trên Chrome và \"Ghim\" biểu tượng SafeKid lên thanh công cụ để dễ dàng truy cập.", "en": "<strong>Tip:</strong> After installing, click the puzzle piece icon in Chrome and \"Pin\" the SafeKid icon to the toolbar for easy access."},

    "guideSec2Title": {"vi": "2. Tab Tổng quan", "en": "2. Overview Tab"},
    "guideSec2Desc": {"vi": "Đây là màn hình chính khi bạn nhấn vào biểu tượng SafeKid. Tại đây bạn có thể điều chỉnh các cài đặt phát hiện và kiểm soát quá trình hoạt động.", "en": "This is the main screen when you click the SafeKid icon. Here you can adjust detection settings and control operations."},
    "guideSec2ImgAlt": {"vi": "Tab Tổng quan SafeKid", "en": "SafeKid Overview Tab"},
    "guideSec2ImgCap": {"vi": "Màn hình Tab Tổng quan", "en": "Overview Tab Screen"},
    "guideSec2Sub1": {"vi": "Bật/Tắt SafeKid", "en": "Enable/Disable SafeKid"},
    "guideSec2Sub1Title": {"vi": "Công tắc chính (góc trên phải)", "en": "Main switch (top right)"},
    "guideSec2Sub1Desc": {"vi": "Bật để SafeKid tự động quét và chặn nội dung độc hại trên YouTube & YouTube Kids. Tắt nếu muốn tạm dừng toàn bộ tính năng bảo vệ.", "en": "Turn on for SafeKid to automatically scan and block harmful content on YouTube & YouTube Kids. Turn off to pause all protection features."},
    "guideSec2Sub2": {"vi": "Thanh thống kê", "en": "Statistics bar"},
    "guideSec2Sub2Desc": {"vi": "Hiển thị 3 con số quan trọng về hoạt động của extension:", "en": "Displays 3 important numbers about the extension's activity:"},
    "guideSec2Sub2Li1": {"vi": "<strong>Đã chặn:</strong> Tổng số video đã bị phát hiện và ngăn chặn.", "en": "<strong>Blocked:</strong> Total number of videos detected and blocked."},
    "guideSec2Sub2Li2": {"vi": "<strong>Đã quét:</strong> Tổng số video SafeKid đã kiểm tra.", "en": "<strong>Scanned:</strong> Total number of videos SafeKid has checked."},
    "guideSec2Sub2Li3": {"vi": "<strong>Phát hiện:</strong> Tỷ lệ phần trăm video bị phát hiện là độc hại/AI so với tổng số.", "en": "<strong>Detection rate:</strong> Percentage of videos detected as harmful/AI compared to the total."},
    "guideSec2Sub3": {"vi": "Độ nhạy phát hiện", "en": "Detection Sensitivity"},
    "guideSec2Sub3Low": {"vi": "Thấp", "en": "Low"},
    "guideSec2Sub3LowDesc": {"vi": "Chỉ chặn khi rất chắc chắn video là độc hại hoặc AI. Ít gây phiền hà (chặn nhầm) nhưng có thể vô tình lọt nội dung xấu.", "en": "Only blocks when highly certain the video is harmful or AI. Less annoying (fewer false positives) but might occasionally let bad content slip through."},
    "guideSec2Sub3Med": {"vi": "Trung bình", "en": "Medium"},
    "guideSec2Sub3MedDesc": {"vi": "Cân bằng giữa chặn và cho phép. Phù hợp cho đa số người dùng trưởng thành.", "en": "Balance between blocking and allowing. Suitable for most adult users."},
    "guideSec2Sub3High": {"vi": "Cao", "en": "High"},
    "guideSec2Sub3Rec": {"vi": "Khuyên dùng", "en": "Recommended"},
    "guideSec2Sub3HighDesc": {"vi": "Chặn ngay cả khi có những nghi ngờ nhỏ. An toàn nhất cho trẻ em, mặc dù có thể chặn nhầm một số video bình thường.", "en": "Blocks even on slight suspicion. Safest for children, although it may falsely block some normal videos."},
    "guideSec2Sub4": {"vi": "Hồ sơ nhận diện", "en": "Detection Profile"},
    "guideSec2Sub4Bal": {"vi": "Cân bằng", "en": "Balanced"},
    "guideSec2Sub4BalDesc": {"vi": "Giảm tỷ lệ chặn nhầm, chỉ lọc các nội dung rõ ràng vi phạm. Phù hợp khi bạn muốn trải nghiệm YouTube ít bị gián đoạn.", "en": "Reduces false positives, only filtering out explicitly violating content. Suitable if you want a less interrupted YouTube experience."},
    "guideSec2Sub4AI": {"vi": "Ưu tiên bắt AI", "en": "Prioritize Catching AI"},
    "guideSec2Sub4Def": {"vi": "Mặc định", "en": "Default"},
    "guideSec2Sub4AIDesc": {"vi": "Tăng cường độ nhạy với các dấu hiệu nội dung tạo tự động (AI slop). An toàn hơn cho trẻ nhỏ khỏi rác nội dung.", "en": "Increases sensitivity to signs of auto-generated content (AI slop). Safer for young children from content trash."},
    "guideSec2Sub5": {"vi": "Phân tích AI nâng cao (Tùy chọn)", "en": "Advanced AI Analysis (Optional)"},
    "guideSec2Sub5Title": {"vi": "Kết nối AI của bên thứ 3", "en": "Connect 3rd-party AI"},
    "guideSec2Sub5Desc": {"vi": "SafeKid có thể kết nối với các mô hình AI lớn (như Gemini) để phân tích ngữ cảnh video một cách vô cùng chính xác. Đây là tính năng <strong>tùy chọn</strong> — SafeKid vẫn tự động bảo vệ rất tốt bằng bộ lọc thông minh tích hợp sẵn.", "en": "SafeKid can connect with large AI models (like Gemini) to analyze video context with extreme accuracy. This is an <strong>optional</strong> feature — SafeKid already protects very well with its built-in smart filters."},
    "guideSec2Sub5Li1": {"vi": "<strong>OpenRouter:</strong> Hỗ trợ nhiều model miễn phí hoàn toàn, khuyên dùng để tăng hiệu quả lọc mà không tốn kém.", "en": "<strong>OpenRouter:</strong> Supports many completely free models, recommended for increasing filter efficiency at no cost."},
    "guideSec2Sub5Li2": {"vi": "<strong>Gemini API:</strong> Cần tạo khóa API từ Google AI Studio. Có độ chính xác cao.", "en": "<strong>Gemini API:</strong> Requires creating an API key from Google AI Studio. High accuracy."},
    "guideSec2Sub5Li3": {"vi": "<strong>Phân tích thumbnail:</strong> Bật để AI xem trực tiếp cả hình ảnh. Chính xác hơn nhưng tốn nhiều thời gian xử lý hơn.", "en": "<strong>Thumbnail Analysis:</strong> Turn on for AI to directly view images. More accurate but takes more processing time."},

    "guideSec3Title": {"vi": "3. Tab Quản lý nâng cao", "en": "3. Advanced Management Tab"},
    "guideSec3Desc": {"vi": "Tab dành riêng cho phụ huynh quản lý danh sách kênh an toàn, kênh bị cấm, đặt mật khẩu bảo vệ và các cấu hình chuyên sâu.", "en": "A tab dedicated to parents for managing safe channels, banned channels, setting up password protection, and deep configurations."},
    "guideSec3ImgAlt": {"vi": "Tab Quản lý nâng cao SafeKid", "en": "SafeKid Advanced Management Tab"},
    "guideSec3ImgCap": {"vi": "Màn hình Tab Quản lý nâng cao", "en": "Advanced Management Tab Screen"},
    "guideSec3Sub1": {"vi": "Mật khẩu phụ huynh", "en": "Parental Password"},
    "guideSec3Sub1Title": {"vi": "Bảo vệ bằng mật khẩu", "en": "Password Protection"},
    "guideSec3Sub1Desc": {"vi": "Khóa các cài đặt quan trọng bằng mật khẩu (tối thiểu 4 ký tự) để ngăn trẻ em vô tình tắt lớp bảo vệ. Khi thiết lập:", "en": "Locks important settings with a password (minimum 4 characters) to prevent children from accidentally turning off protection. When set up:"},
    "guideSec3Sub1Li1": {"vi": "Mỗi lần mở bảng điều khiển (popup), SafeKid sẽ yêu cầu nhập mật khẩu.", "en": "Every time you open the dashboard (popup), SafeKid will require the password."},
    "guideSec3Sub1Li2": {"vi": "Trẻ em không thể gỡ bỏ kênh khỏi danh sách chặn hoặc thay đổi độ nhạy.", "en": "Children cannot remove channels from the block list or change the sensitivity."},
    "guideSec3Sub1Li3": {"vi": "Phụ huynh có thể xóa bỏ mật khẩu bất kỳ lúc nào để tắt tính năng khóa.", "en": "Parents can remove the password at any time to disable the lock feature."},
    "guideSec3Warn": {"vi": "<strong>Lưu ý quan trọng:</strong> Hãy ghi nhớ mật khẩu! Nếu quên, cách duy nhất để khôi phục là bạn phải gỡ bỏ hoàn toàn tiện ích SafeKid khỏi Chrome và tiến hành cài đặt lại từ đầu.", "en": "<strong>Important note:</strong> Remember your password! If you forget it, the only way to recover is to completely remove the SafeKid extension from Chrome and reinstall it from scratch."},
    "guideSec3Sub2": {"vi": "Kênh được phép xem (Whitelist)", "en": "Allowed Channels (Whitelist)"},
    "guideSec3Sub2Title": {"vi": "Danh sách kênh an toàn tuyệt đối", "en": "Absolutely safe channels list"},
    "guideSec3Sub2Desc": {"vi": "Thêm tên các kênh YouTube mà bạn hoàn toàn tin tưởng (ví dụ: VTV, HTV3, kênh hoạt hình chính thức). Video từ các kênh này sẽ <strong>không bao giờ bị SafeKid chặn</strong>, bất kể chúng có đặc điểm giống AI hay không.", "en": "Add the names of YouTube channels you fully trust (e.g., official cartoon channels). Videos from these channels will <strong>never be blocked by SafeKid</strong>, regardless of whether they have AI-like traits."},
    "guideSec3Sub2Li1": {"vi": "Vui lòng nhập đúng Tên kênh hiển thị trên YouTube (phân biệt hoa thường không quan trọng).", "en": "Please enter the exact Displayed Channel Name on YouTube (case insensitive)."},
    "guideSec3Sub2Li2": {"vi": "Nhanh nhất là dùng tính năng \"Chuột phải\" để thêm kênh ngay khi đang xem.", "en": "The fastest way is to use the \"Right-click\" feature to add a channel while watching."},
    "guideSec3Sub2Li3": {"vi": "Nhấn biểu tượng thùng rác để gỡ bỏ kênh.", "en": "Click the trash icon to remove a channel."},
    "guideSec3Sub3": {"vi": "Chế độ \"Chỉ cho phép xem kênh trong danh sách\"", "en": "\"Approved Channels Only\" Mode"},
    "guideSec3Sub3Title": {"vi": "Chế độ an toàn tối đa (Whitelist-only)", "en": "Maximum safety mode (Whitelist-only)"},
    "guideSec3Sub3Desc": {"vi": "Khi công tắc này được bật, SafeKid chuyển sang mức độ kiểm soát cao nhất:", "en": "When this switch is on, SafeKid switches to the highest level of control:"},
    "guideSec3Sub3Li1": {"vi": "<strong>Mọi video</strong> từ bất kỳ kênh nào KHÔNG có trong danh sách Whitelist sẽ bị chặn hiển thị.", "en": "<strong>All videos</strong> from any channel NOT in the Whitelist will be blocked from displaying."},
    "guideSec3Sub3Li2": {"vi": "Thậm chí cả video người thật 100% cũng bị chặn nếu kênh đó chưa được bạn phê duyệt.", "en": "Even 100% real human videos will be blocked if that channel hasn't been approved by you."},
    "guideSec3Sub3Li3": {"vi": "Con bạn chỉ có thể nhìn thấy nội dung từ những kênh nằm trong \"Danh sách kênh được phép xem\".", "en": "Your child can only see content from channels located in the \"Allowed channels list\"."},
    "guideSec3Tip": {"vi": "<strong>Mẹo của chuyên gia:</strong> Chế độ này là giải pháp \"vàng\" cho trẻ nhỏ (dưới 6 tuổi) khi bạn chỉ muốn con xem các kênh giáo dục, ca nhạc thiếu nhi mà chính bạn đã tự tay chọn lọc kỹ càng.", "en": "<strong>Pro Tip:</strong> This mode is the \"golden\" solution for young children (under 6) when you only want them to watch educational and children's music channels that you have hand-picked yourself."},
    "guideSec3Sub4": {"vi": "Channel luôn chặn (Blacklist)", "en": "Always Blocked Channels (Blacklist)"},
    "guideSec3Sub4Title": {"vi": "Danh sách kênh bị cấm", "en": "Banned channels list"},
    "guideSec3Sub4Desc": {"vi": "Ghi danh các kênh mà bạn muốn <strong>loại bỏ vĩnh viễn</strong>. Toàn bộ video từ các kênh trong danh sách này sẽ bị SafeKid che khuất lập tức, dù nội dung thực sự của video đó là gì.", "en": "Log the channels you want to <strong>permanently eliminate</strong>. All videos from channels in this list will be immediately obscured by SafeKid, no matter what the actual content of that video is."},

    "guideSec4Title": {"vi": "4. Menu chuột phải (Context Menu)", "en": "4. Right-click Menu (Context Menu)"},
    "guideSec4Desc": {"vi": "Khi đang ở trang YouTube hoặc YouTube Kids, bạn chỉ cần nhấn chuột phải vào bất kỳ đâu trên trang để truy cập nhanh các tùy chọn quản lý của SafeKid.", "en": "When on a YouTube or YouTube Kids page, simply right-click anywhere on the page to quickly access SafeKid's management options."},
    "guideSec4ImgAlt": {"vi": "Menu chuột phải SafeKid trên YouTube", "en": "SafeKid Right-click menu on YouTube"},
    "guideSec4ImgCap": {"vi": "Menu chuột phải SafeKid hiển thị trực tiếp trên YouTube", "en": "SafeKid right-click menu displaying directly on YouTube"},
    "guideSec4Allow": {"vi": "Cho phép channel này", "en": "Allow this channel"},
    "guideSec4AllowDesc": {"vi": "Ngay lập tức đưa kênh của video đang xem vào danh sách an toàn (Whitelist).", "en": "Immediately adds the channel of the currently viewed video to the safe list (Whitelist)."},
    "guideSec4Block": {"vi": "Chặn channel này", "en": "Block this channel"},
    "guideSec4BlockDesc": {"vi": "Đưa kênh của video đang xem vào danh sách luôn bị cấm (Blacklist).", "en": "Adds the channel of the currently viewed video to the always banned list (Blacklist)."},
    "guideSec4BlockVid": {"vi": "Chặn video này", "en": "Block this video"},
    "guideSec4BlockVidDesc": {"vi": "Chỉ chặn thủ công một video cụ thể này mà không gây ảnh hưởng tới các video khác của kênh.", "en": "Manually blocks only this specific video without affecting other videos from the channel."},
    "guideSec4Tip": {"vi": "<strong>Thao tác nhanh:</strong> Đây là cách tiết kiệm thời gian nhất! Thay vì mở bảng điều khiển để gõ tên kênh, hãy cứ chuột phải trực tiếp khi thấy video để kiểm soát.", "en": "<strong>Quick Action:</strong> This is the most time-saving method! Instead of opening the dashboard to type the channel name, just right-click directly when you see a video to control it."},

    "guideSec5Title": {"vi": "5. Khi video bị chặn", "en": "5. When a video is blocked"},
    "guideSec5Sub1": {"vi": "1. Trên trang chủ và danh sách gợi ý", "en": "1. On homepage and recommended lists"},
    "guideSec5Sub1Desc": {"vi": "Những video độc hại/AI sẽ tự động bị phủ một lớp mờ dày đặc trên ảnh thu nhỏ (thumbnail) kèm theo các thông tin:", "en": "Harmful/AI videos will automatically be covered with a thick blur layer over the thumbnail along with information:"},
    "guideSec5Sub1Li1": {"vi": "<strong>Trạng thái:</strong> \"Đã Chặn Video AI\" hoặc \"Đã Chặn Kênh Không Phù Hợp\".", "en": "<strong>Status:</strong> \"Blocked AI Video\" or \"Blocked Inappropriate Channel\"."},
    "guideSec5Sub1Li2": {"vi": "<strong>Độ tin cậy:</strong> Mức độ chắc chắn (%) của hệ thống và thuật toán nào đã ra quyết định chặn.", "en": "<strong>Confidence:</strong> The level of certainty (%) of the system and which algorithm made the blocking decision."},
    "guideSec5Sub1Li3": {"vi": "<strong>Lý do cụ thể:</strong> Chẳng hạn \"Phát hiện có chứa từ ngữ phản cảm\" hoặc \"Video do AI tạo ra hàng loạt\".", "en": "<strong>Specific reason:</strong> E.g., \"Detected offensive language\" or \"Mass-produced AI video\"."},
    "guideSec5Sub1Note": {"vi": "Nhấn vào khu vực video đã bị chặn sẽ <strong>không có tác dụng</strong> — điều này bảo vệ trẻ em không thể \"cố ý\" bấm vào xem.", "en": "Clicking on the blocked video area will <strong>have no effect</strong> — this protects children from \"intentionally\" clicking to watch."},
    "guideSec5Sub2": {"vi": "2. Khi trẻ bấm trực tiếp vào trang xem video", "en": "2. When a child clicks directly to the video watch page"},
    "guideSec5Sub2Desc": {"vi": "Nếu bằng một cách nào đó (như qua link chia sẻ) trẻ vẫn truy cập thẳng vào trang chiếu video bị chặn, hệ thống sẽ:", "en": "If somehow (like via a shared link) a child navigates directly to the watch page of a blocked video, the system will:"},
    "guideSec5Sub2Li1": {"vi": "<strong>Chặn phát video</strong> ngay lập tức ở mức thấp nhất, không để âm thanh hay hình ảnh lọt qua.", "en": "<strong>Block video playback</strong> immediately at the lowest level, preventing any audio or video from slipping through."},
    "guideSec5Sub2Li2": {"vi": "Hiển thị tấm màn đen bao phủ toàn bộ màn hình với nút <strong>\"← Quay lại trang chủ\"</strong>.", "en": "Display a black screen covering the entire screen with a <strong>\"← Go Back\"</strong> button."},
    "guideSec5Sub2Li3": {"vi": "Nếu phụ huynh muốn kiểm tra lại nội dung, có thể chọn nút \"Tôi là phụ huynh\", nhập mật khẩu để tạm thời xem video hoặc mở khóa kênh vĩnh viễn.", "en": "If parents want to recheck the content, they can click the \"I am a parent\" button, enter the password to temporarily view the video or permanently unlock the channel."},

    "guideSec6Title": {"vi": "6. Câu hỏi thường gặp", "en": "6. Frequently Asked Questions"},
    "guideSec6Desc": {"vi": "Giải đáp nhanh các thắc mắc trong quá trình sử dụng SafeKid.", "en": "Quick answers to questions during SafeKid usage."},
    "guideSec6Q1": {"vi": "SafeKid có lấy dữ liệu cá nhân của tôi không?", "en": "Does SafeKid take my personal data?"},
    "guideSec6A1": {"vi": "<strong>Hoàn toàn Không.</strong> SafeKid là tiện ích chạy độc lập trên trình duyệt của bạn (local). Không có dữ liệu xem video hay thông tin cá nhân nào được gửi về máy chủ của chúng tôi. Nếu bạn dùng API AI bổ sung, dữ liệu chỉ gửi trực tiếp qua API của Google/OpenRouter.", "en": "<strong>Absolutely Not.</strong> SafeKid is an extension running independently on your browser (local). No video viewing data or personal information is sent to our servers. If you use an additional AI API, data is only sent directly to Google/OpenRouter's API."},
    "guideSec6Q2": {"vi": "SafeKid có hỗ trợ YouTube Kids không?", "en": "Does SafeKid support YouTube Kids?"},
    "guideSec6A2": {"vi": "<strong>Có.</strong> Hệ thống được thiết kế tối ưu hóa để tương thích với cả <code>youtube.com</code> và trang web <code>youtubekids.com</code>.", "en": "<strong>Yes.</strong> The system is optimized to be compatible with both <code>youtube.com</code> and the <code>youtubekids.com</code> website."},
    "guideSec6Q3": {"vi": "Trẻ em có tự tắt được SafeKid không?", "en": "Can children turn off SafeKid themselves?"},
    "guideSec6A3": {"vi": "Khi <strong>mật khẩu phụ huynh</strong> đã bật, trẻ sẽ không thể mở cài đặt SafeKid. Tuy nhiên đối với các bé lớn và am hiểu máy tính, trẻ có thể vô hiệu hóa tiện ích thông qua trang Quản lý tiện ích (chrome://extensions) của Google Chrome.", "en": "When the <strong>parental password</strong> is enabled, children cannot open SafeKid's settings. However, for older, tech-savvy kids, they could disable the extension through Google Chrome's Extension Management page (chrome://extensions)."},
    "guideSec6Q4": {"vi": "Đôi khi tôi thấy video sạch vẫn bị chặn?", "en": "Sometimes I see clean videos getting blocked?"},
    "guideSec6A4": {"vi": "Đó là trường hợp \"chặn nhầm\" (false positive). Để khắc phục: Nhấn chuột phải -> \"Cho phép channel này\", video sẽ sáng lại lập tức. Hoặc bạn có thể cân nhắc chuyển Độ nhạy phát hiện về mức \"Trung bình\" trong Tab Tổng quan.", "en": "That is a \"false positive\" case. To fix: Right-click -> \"Allow this channel\", the video will light up immediately. Or you can consider switching the Detection Sensitivity to \"Medium\" in the Overview Tab."},
}

js_content = """/**
 * SafeKid Website — i18n Module
 * Supports Vietnamese (default) and English
 * Uses localStorage to persist user preference
 */

const WebI18n = (() => {
  const STORAGE_KEY = 'safekid-lang';
  const DEFAULT_LANG = 'vi';
  const SUPPORTED = ['vi', 'en'];

  const translations = {
    vi: {
"""
for k, v in i18n_keys.items():
    escaped_vi = v['vi'].replace("'", "\\'")
    js_content += f"      {k}: '{escaped_vi}',\n"

js_content += """    },
    en: {
"""
for k, v in i18n_keys.items():
    escaped_en = v['en'].replace("'", "\\'")
    js_content += f"      {k}: '{escaped_en}',\n"

js_content += """    }
  };

  function getLanguage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    const browser = (navigator.language || navigator.userLanguage || '').split('-')[0];
    return SUPPORTED.includes(browser) ? browser : DEFAULT_LANG;
  }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    applyToDOM();
    updateSwitcherUI(lang);
    document.documentElement.lang = lang;
  }

  function t(key) {
    const lang = getLanguage();
    return translations[lang]?.[key] || translations[DEFAULT_LANG]?.[key] || key;
  }

  function applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });
  }

  function updateSwitcherUI(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  function init() {
    const lang = getLanguage();
    document.documentElement.lang = lang;
    applyToDOM();
    updateSwitcherUI(lang);

    // Bind language switcher buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setLanguage(btn.dataset.lang);
      });
    });
  }

  return { init, t, setLanguage, getLanguage, applyToDOM };
})();

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', WebI18n.init);
} else {
  WebI18n.init();
}
"""

with open('docs/i18n.js', 'w') as f:
    f.write(js_content)

print("Updated docs/i18n.js")

# Now let's update index.html
with open('docs/index.html', 'r') as f:
    html = f.read()

# I will write a simple string replacement function for HTML
replacements = [
    # Hero
    ('Hỗ trợ chặn kênh/video không phù hợp với trẻ em</h1>', 'Hỗ trợ chặn kênh/video không phù hợp với trẻ em</h1>'), # Already has data-i18n
    ('<p data-i18n-html="heroSubtitle">SafeKid hỗ trợ chặn kênh hoặc video không phù hợp với trẻ em do phụ huynh tự thiết lập hoặc thông qua cơ chế tự động phát hiện. Hoạt động trên cả <strong>YouTube</strong> và <strong>YouTube Kids</strong> — miễn phí, riêng tư 100%.</p>', '<p data-i18n-html="heroSubtitle">SafeKid hỗ trợ chặn kênh hoặc video không phù hợp với trẻ em do phụ huynh tự thiết lập hoặc thông qua cơ chế tự động phát hiện. Hoạt động trên cả <strong>YouTube</strong> và <strong>YouTube Kids</strong> — miễn phí, riêng tư 100%.</p>'),
    ('Tải file ZIP miễn phí\n', 'Tải file ZIP miễn phí\n'), # It's mixed with an icon. Let's do it safely:
    ('<span class="trust-badge"><i data-lucide="lock" class="icon-small"></i> Bảo mật 100%</span>', '<span class="trust-badge"><i data-lucide="lock" class="icon-small"></i> <span data-i18n="heroTrust1">Bảo mật 100%</span></span>'),
    ('<span class="trust-badge"><i data-lucide="monitor-play" class="icon-small"></i> YouTube & YouTube Kids</span>', '<span class="trust-badge"><i data-lucide="monitor-play" class="icon-small"></i> <span data-i18n="heroTrust2">YouTube & YouTube Kids</span></span>'),
    ('<span class="trust-badge"><i data-lucide="sparkles" class="icon-small"></i> Tích hợp AI</span>', '<span class="trust-badge"><i data-lucide="sparkles" class="icon-small"></i> <span data-i18n="heroTrust3">Tích hợp AI</span></span>'),
    ('<div class="info">Kênh thiếu nhi an toàn</div>', '<div class="info" data-i18n="mockupSafe">Kênh thiếu nhi an toàn</div>'),
    ('<span>Đã chặn Video AI</span>', '<span data-i18n="mockupBlocked">Đã chặn Video AI</span>'),
    ('<div class="info text-muted">Spam content...</div>', '<div class="info text-muted" data-i18n="mockupSpam">Spam content...</div>'),
    ('<p><strong>Lưu ý:</strong> Cơ chế phát hiện video AI hiện đang trong quá trình hoàn thiện nên có thể xảy ra sai sót. SafeKid đang không ngừng nâng cấp công nghệ để liên tục cải thiện hiệu quả bảo vệ trong tương lai.</p>', '<p><strong data-i18n="noticePrefix">Lưu ý:</strong> <span data-i18n="noticeText">Cơ chế phát hiện video AI hiện đang trong quá trình hoàn thiện nên có thể xảy ra sai sót. SafeKid đang không ngừng nâng cấp công nghệ để liên tục cải thiện hiệu quả bảo vệ trong tương lai.</span></p>'),
    
    # Features
    ('<h2>Hành động ngay trước vấn nạn "Rác AI"</h2>', '<h2 data-i18n="featSectionTitle">Hành động ngay trước vấn nạn "Rác AI"</h2>'),
    ('<p>Theo thư ngỏ từ hơn 200 chuyên gia, nội dung AI độc hại đang thu lợi nhuận khổng lồ trên sự an toàn của trẻ. SafeKid là giải pháp tức thời cho cha mẹ.</p>', '<p data-i18n="featSectionDesc">Theo thư ngỏ từ hơn 200 chuyên gia, nội dung AI độc hại đang thu lợi nhuận khổng lồ trên sự an toàn của trẻ. SafeKid là giải pháp tức thời cho cha mẹ.</p>'),
    ('<h3>Phát hiện đa lớp thông minh</h3>', '<h3 data-i18n="feat1Title">Phát hiện đa lớp thông minh</h3>'),
    ('<p>Hệ thống 3 tầng: nhãn dán YouTube → phân tích ngôn ngữ NLP & keyword → AI phân tích sâu (Gemini/OpenRouter). Kết hợp tiêu đề, mô tả và phụ đề video để không bỏ sót.</p>', '<p data-i18n="feat1Desc">Hệ thống 3 tầng: nhãn dán YouTube → phân tích ngôn ngữ NLP & keyword → AI phân tích sâu (Gemini/OpenRouter). Kết hợp tiêu đề, mô tả và phụ đề video để không bỏ sót.</p>'),
    ('<div class="feature-badge">Mới</div>', '<div class="feature-badge" data-i18n="featNewBadge">Mới</div>'),
    ('<h3>Chế độ "Chỉ kênh đã duyệt"</h3>', '<h3 data-i18n="feat2Title">Chế độ "Chỉ kênh đã duyệt"</h3>'),
    ('<p>Con bạn CHỈ xem được các kênh mà bạn đã kiểm duyệt và phê duyệt. Mọi kênh lạ đều bị chặn hoàn toàn — an toàn tuyệt đối cho trẻ nhỏ.</p>', '<p data-i18n="feat2Desc">Con bạn CHỈ xem được các kênh mà bạn đã kiểm duyệt và phê duyệt. Mọi kênh lạ đều bị chặn hoàn toàn — an toàn tuyệt đối cho trẻ nhỏ.</p>'),
    ('<h3>Kiểm soát phụ huynh toàn diện</h3>', '<h3 data-i18n="feat3Title">Kiểm soát phụ huynh toàn diện</h3>'),
    ('<p>Mật khẩu bảo vệ mọi cài đặt. Danh sách chặn/cho phép kênh linh hoạt. Chuột phải vào video để chặn hoặc cho phép kênh ngay lập tức.</p>', '<p data-i18n="feat3Desc">Mật khẩu bảo vệ mọi cài đặt. Danh sách chặn/cho phép kênh linh hoạt. Chuột phải vào video để chặn hoặc cho phép kênh ngay lập tức.</p>'),
    ('<h3>Hỗ trợ YouTube Kids</h3>', '<h3 data-i18n="feat4Title">Hỗ trợ YouTube Kids</h3>'),
    ('<p>Không chỉ YouTube.com — SafeKid còn bảo vệ trẻ trên YouTube Kids với công nghệ deep traversal, đảm bảo không lọt nội dung độc hại trên mọi nền tảng.</p>', '<p data-i18n="feat4Desc">Không chỉ YouTube.com — SafeKid còn bảo vệ trẻ trên YouTube Kids với công nghệ deep traversal, đảm bảo không lọt nội dung độc hại trên mọi nền tảng.</p>'),
    ('<h3>Lọc 8 loại nội dung nguy hại</h3>', '<h3 data-i18n="feat5Title">Lọc 8 loại nội dung nguy hại</h3>'),
    ('<p>Tự động phát hiện: tình dục, bạo lực, kinh dị, tự gây hại, hành vi nguy hiểm, ma túy, ngôn ngữ tục tĩu và hoạt hình biến thái (Elsagate).</p>', '<p data-i18n="feat5Desc">Tự động phát hiện: tình dục, bạo lực, kinh dị, tự gây hại, hành vi nguy hiểm, ma túy, ngôn ngữ tục tĩu và hoạt hình biến thái (Elsagate).</p>'),
    ('<h3>Siêu mượt, siêu nhẹ</h3>', '<h3 data-i18n="feat6Title">Siêu mượt, siêu nhẹ</h3>'),
    ('<p>Hoạt động ngầm với hiệu năng tối ưu, không làm chậm trình duyệt. Cache thông minh giúp scan nhanh hơn theo thời gian sử dụng.</p>', '<p data-i18n="feat6Desc">Hoạt động ngầm với hiệu năng tối ưu, không làm chậm trình duyệt. Cache thông minh giúp scan nhanh hơn theo thời gian sử dụng.</p>'),

    # How it Works
    ('<h2>Cách thức hoạt động</h2>', '<h2 data-i18n="howTitle">Cách thức hoạt động</h2>'),
    ('<p>Bảo vệ con yêu chỉ trong 4 bước đơn giản.</p>', '<p data-i18n="howSubtitle">Bảo vệ con yêu chỉ trong 4 bước đơn giản.</p>'),
    ('<h3>Cài đặt tiện ích</h3>', '<h3 data-i18n="how1Title">Cài đặt tiện ích</h3>'),
    ('<p>Tải file ZIP và thêm SafeKid vào Chrome hoàn toàn miễn phí.</p>', '<p data-i18n="how1Desc">Tải file ZIP và thêm SafeKid vào Chrome hoàn toàn miễn phí.</p>'),
    ('<h3>Thiết lập bảo mật</h3>', '<h3 data-i18n="how2Title">Thiết lập bảo mật</h3>'),
    ('<p>Tạo mật khẩu phụ huynh và thêm các kênh an toàn vào danh sách cho phép.</p>', '<p data-i18n="how2Desc">Tạo mật khẩu phụ huynh và thêm các kênh an toàn vào danh sách cho phép.</p>'),
    ('<h3>Kích hoạt AI</h3>', '<h3 data-i18n="how3Title">Kích hoạt AI</h3>'),
    ('<p>Thêm API key Gemini hoặc OpenRouter để tăng độ chính xác. Có nhiều model <strong>miễn phí</strong>!</p>', '<p data-i18n-html="how3Desc">Thêm API key Gemini hoặc OpenRouter để tăng độ chính xác. Có nhiều model <strong>miễn phí</strong>!</p>'),
    ('<h3>Tận hưởng an toàn</h3>', '<h3 data-i18n="how4Title">Tận hưởng an toàn</h3>'),
    ('<p>SafeKid tự động chặn video AI độc hại. Bạn yên tâm, con vui chơi!</p>', '<p data-i18n="how4Desc">SafeKid tự động chặn video AI độc hại. Bạn yên tâm, con vui chơi!</p>'),

    # FAQ
    ('<h2>Câu hỏi thường gặp</h2>', '<h2 data-i18n="faqTitle">Câu hỏi thường gặp</h2>'),
    ('<p>Giải đáp mọi thắc mắc về SafeKid.</p>', '<p data-i18n="faqSubtitle">Giải đáp mọi thắc mắc về SafeKid.</p>'),
    ('<span>SafeKid có miễn phí không?</span>', '<span data-i18n="faq1Q">SafeKid có miễn phí không?</span>'),
    ('<p>Hoàn toàn miễn phí. Bạn chỉ cần tải file ZIP và cài đặt thủ công vào Chrome. Không có phí ẩn, không quảng cáo, không thu thập dữ liệu.</p>', '<p data-i18n="faq1A">Hoàn toàn miễn phí. Bạn chỉ cần tải file ZIP và cài đặt thủ công vào Chrome. Không có phí ẩn, không quảng cáo, không thu thập dữ liệu.</p>'),
    ('<span>Tại sao chưa có trên Chrome Web Store?</span>', '<span data-i18n="faq2Q">Tại sao chưa có trên Chrome Web Store?</span>'),
    ('<p>SafeKid đang chờ duyệt trên Chrome Web Store. Hiện tại bạn cài đặt bằng cách load unpacked — hướng dẫn chi tiết sẽ hiện khi bạn nhấn nút <strong>"Tải file ZIP"</strong>.</p>', '<p data-i18n-html="faq2A">SafeKid đang chờ duyệt trên Chrome Web Store. Hiện tại bạn cài đặt bằng cách load unpacked — hướng dẫn chi tiết sẽ hiện khi bạn nhấn nút <strong>"Tải file ZIP"</strong>.</p>'),
    ('<span>AI phát hiện có chính xác 100% không?</span>', '<span data-i18n="faq3Q">AI phát hiện có chính xác 100% không?</span>'),
    ('<p>Không có hệ thống nào hoàn hảo. SafeKid sử dụng 3 tầng phát hiện (labels + NLP + AI) và liên tục cải thiện. Bạn có thể bổ sung bằng chế độ <strong>"Chỉ kênh đã duyệt"</strong> để đảm bảo an toàn tuyệt đối — chỉ cho con xem các kênh bạn đã kiểm duyệt.</p>', '<p data-i18n-html="faq3A">Không có hệ thống nào hoàn hảo. SafeKid sử dụng 3 tầng phát hiện (labels + NLP + AI) và liên tục cải thiện. Bạn có thể bổ sung bằng chế độ <strong>"Chỉ kênh đã duyệt"</strong> để đảm bảo an toàn tuyệt đối — chỉ cho con xem các kênh bạn đã kiểm duyệt.</p>'),
    ('<span>Dữ liệu của tôi có bị thu thập không?</span>', '<span data-i18n="faq4Q">Dữ liệu của tôi có bị thu thập không?</span>'),
    ('<p><strong>KHÔNG.</strong> Mọi dữ liệu xử lý tại local trên máy bạn. API key được lưu trong bộ nhớ bảo mật riêng (IndexedDB). SafeKid không gửi bất kỳ dữ liệu cá nhân nào ra bên ngoài.</p>', '<p data-i18n-html="faq4A"><strong>KHÔNG.</strong> Mọi dữ liệu xử lý tại local trên máy bạn. API key được lưu trong bộ nhớ bảo mật riêng (IndexedDB). SafeKid không gửi bất kỳ dữ liệu cá nhân nào ra bên ngoài.</p>'),
    ('<span>SafeKid có hoạt động trên YouTube Kids không?</span>', '<span data-i18n="faq5Q">SafeKid có hoạt động trên YouTube Kids không?</span>'),
    ('<p><strong>CÓ!</strong> SafeKid hỗ trợ cả <code>youtube.com</code> và <code>youtubekids.com</code> với công nghệ nhận diện platform tự động. Danh sách kênh được đồng bộ giữa 2 nền tảng.</p>', '<p data-i18n-html="faq5A"><strong>CÓ!</strong> SafeKid hỗ trợ cả <code>youtube.com</code> và <code>youtubekids.com</code> với công nghệ nhận diện platform tự động. Danh sách kênh được đồng bộ giữa 2 nền tảng.</p>'),
    ('<span>Cần API key để sử dụng không?</span>', '<span data-i18n="faq6Q">Cần API key để sử dụng không?</span>'),
    ('<p><strong>Không bắt buộc.</strong> SafeKid hoạt động tốt chỉ với bộ lọc local (labels + keywords). API key giúp tăng thêm độ chính xác với phân tích AI. OpenRouter cung cấp nhiều model hoàn toàn miễn phí như Gemma 4, Qwen3, GPT-OSS.</p>', '<p data-i18n-html="faq6A"><strong>Không bắt buộc.</strong> SafeKid hoạt động tốt chỉ với bộ lọc local (labels + keywords). API key giúp tăng thêm độ chính xác với phân tích AI. OpenRouter cung cấp nhiều model hoàn toàn miễn phí như Gemma 4, Qwen3, GPT-OSS.</p>'),

    # CTA
    ('<h2>Hãy để con có một tuổi thơ kỹ thuật số an toàn</h2>', '<h2 data-i18n="ctaTitle">Hãy để con có một tuổi thơ kỹ thuật số an toàn</h2>'),
    ('<p>Tham gia cùng hàng ngàn phụ huynh đang bảo vệ con em mình trên Internet.</p>', '<p data-i18n="ctaDesc">Tham gia cùng hàng ngàn phụ huynh đang bảo vệ con em mình trên Internet.</p>'),
    ('Tải về máy ngay (File ZIP)', '<span data-i18n="ctaBtn">Tải về máy ngay (File ZIP)</span>'),

    # Footer
    ('<p class="copyright">&copy; 2026 AutoWork Team. Đảm bảo quyền riêng tư và an toàn.</p>', '<p class="copyright" data-i18n="footerCopyright">&copy; 2026 AutoWork Team. Đảm bảo quyền riêng tư và an toàn.</p>'),
    ('<a href="guide.html">Hướng dẫn sử dụng</a>', '<a href="guide.html" data-i18n="footerGuide">Hướng dẫn sử dụng</a>'),
    ('<a href="privacy.html">Chính sách bảo mật</a>', '<a href="privacy.html" data-i18n="footerPrivacy">Chính sách bảo mật</a>'),
    ('<a href="terms.html">Điều khoản</a>', '<a href="terms.html" data-i18n="footerTerms">Điều khoản</a>'),
    ('<a href="#" onclick="openContactModal(); return false;">Liên hệ</a>', '<a href="#" onclick="openContactModal(); return false;" data-i18n="footerContact">Liên hệ</a>'),

    # Contact Modal
    ('<h2>Thông tin liên hệ</h2>', '<h2 data-i18n="contactTitle">Thông tin liên hệ</h2>'),
    ('<p>Nếu bạn cần hỗ trợ hoặc có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua:</p>', '<p data-i18n="contactDesc">Nếu bạn cần hỗ trợ hoặc có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua:</p>'),
    ('<strong>Email:</strong>', '<strong data-i18n="contactEmail">Email:</strong>'),
    ('<strong>SĐT / Zalo:</strong>', '<strong data-i18n="contactPhone">SĐT / Zalo:</strong>'),

    # Install Guide Modal
    ('<h2>Hướng dẫn cài đặt thủ công</h2>', '<h2 data-i18n="installTitle">Hướng dẫn cài đặt thủ công</h2>'),
    ('<p>Do tiện ích đang chờ duyệt trên Chrome Store, bạn vui lòng cài đặt theo 4 bước đơn giản sau:</p>', '<p data-i18n="installDesc">Do tiện ích đang chờ duyệt trên Chrome Store, bạn vui lòng cài đặt theo 4 bước đơn giản sau:</p>'),
    ('<strong>Tải và giải nén</strong>', '<strong data-i18n="installStep1">Tải và giải nén</strong>'),
    ('<p>Tải file ZIP bên dưới về máy tính và giải nén ra một thư mục.</p>', '<p data-i18n="installStep1Desc">Tải file ZIP bên dưới về máy tính và giải nén ra một thư mục.</p>'),
    ('Click để tải file ZIP', '<span data-i18n="installStep1Btn">Click để tải file ZIP</span>'),
    ('<strong>Mở trang Quản lý tiện ích</strong>', '<strong data-i18n="installStep2">Mở trang Quản lý tiện ích</strong>'),
    ('<p>Mở trình duyệt, copy và dán đường dẫn này vào thanh địa chỉ: <code class="highlight-code">chrome://extensions/</code> (sau đó nhấn Enter).</p>', '<p data-i18n-html="installStep2Desc">Mở trình duyệt, copy và dán đường dẫn này vào thanh địa chỉ: <code class="highlight-code">chrome://extensions/</code> (sau đó nhấn Enter).</p>'),
    ('<strong>Bật Chế độ nhà phát triển</strong>', '<strong data-i18n="installStep3">Bật Chế độ nhà phát triển</strong>'),
    ('<p>Nhìn lên góc <strong>phải, phía trên</strong> màn hình và bật công tắc <strong>Chế độ dành cho nhà phát triển</strong> (Developer mode).</p>', '<p data-i18n-html="installStep3Desc">Nhìn lên góc <strong>phải, phía trên</strong> màn hình và bật công tắc <strong>Chế độ dành cho nhà phát triển</strong> (Developer mode).</p>'),
    ('<strong>Tải thư mục lên</strong>', '<strong data-i18n="installStep4">Tải thư mục lên</strong>'),
    ('<p>Nhấn vào nút <strong>Tải tiện ích đã giải nén</strong> (Load unpacked) ở góc trái và chọn thư mục bạn vừa giải nén ở Bước 1. Xong!</p>', '<p data-i18n-html="installStep4Desc">Nhấn vào nút <strong>Tải tiện ích đã giải nén</strong> (Load unpacked) ở góc trái và chọn thư mục bạn vừa giải nén ở Bước 1. Xong!</p>'),

    # Video Modal
    ('<h2>Cảnh báo "Rác AI" trên YouTube</h2>', '<h2 data-i18n="videoWarnTitle">Cảnh báo "Rác AI" trên YouTube</h2>'),
    ('<p>Sự bùng nổ của AI là không thể đảo ngược, nhưng an toàn của trẻ không thể bị đánh đổi.</p>', '<p data-i18n="videoWarnDesc">Sự bùng nổ của AI là không thể đảo ngược, nhưng an toàn của trẻ không thể bị đánh đổi.</p>'),
    ('<span>Xem trên YouTube</span>', '<span data-i18n="videoWatchOnYT">Xem trên YouTube</span>'),
    ('<span class="checkbox-text">Không hiển thị lại thông báo này</span>', '<span class="checkbox-text" data-i18n="videoDontShow">Không hiển thị lại thông báo này</span>'),
    ('<button class="btn btn-primary" onclick="closeVideoModal()">Tôi đã hiểu</button>', '<button class="btn btn-primary" onclick="closeVideoModal()" data-i18n="videoGotIt">Tôi đã hiểu</button>')
]

for old, new in replacements:
    html = html.replace(old, new)

# Special fix for the Tải file ZIP miễn phí hero button since it has an icon
html = html.replace('Tải file ZIP miễn phí\n', '<span data-i18n="heroBtnDownload">Tải file ZIP miễn phí</span>\n')

with open('docs/index.html', 'w') as f:
    f.write(html)
print("Updated docs/index.html")

# Now update guide.html
with open('docs/guide.html', 'r') as f:
    guide = f.read()

guide_replacements = [
    ('<h1>Hướng dẫn sử dụng SafeKid</h1>', '<h1 data-i18n="guideHeroTitle">Hướng dẫn sử dụng SafeKid</h1>'),
    ('<p>Toàn bộ hướng dẫn cách cài đặt, cấu hình và sử dụng SafeKid. Extension hỗ trợ chặn kênh hoặc video không phù hợp với trẻ em do phụ huynh tự thiết lập hoặc cơ chế tự động phát hiện.</p>', '<p data-i18n="guideHeroSubtitle">Toàn bộ hướng dẫn cách cài đặt, cấu hình và sử dụng SafeKid. Extension hỗ trợ chặn kênh hoặc video không phù hợp với trẻ em do phụ huynh tự thiết lập hoặc cơ chế tự động phát hiện.</p>'),
    ('<h2><i data-lucide="list"></i> Mục lục</h2>', '<h2><i data-lucide="list"></i> <span data-i18n="guideTocTitle">Mục lục</span></h2>'),
    ('<li><a href="#install">Cài đặt tiện ích</a></li>', '<li><a href="#install" data-i18n="guideToc1">1. Cài đặt tiện ích</a></li>'),
    ('<li><a href="#overview">Tab Tổng quan — Cài đặt cơ bản</a></li>', '<li><a href="#overview" data-i18n="guideToc2">2. Tab Tổng quan — Cài đặt cơ bản</a></li>'),
    ('<li><a href="#advanced">Tab Quản lý nâng cao</a></li>', '<li><a href="#advanced" data-i18n="guideToc3">3. Tab Quản lý nâng cao</a></li>'),
    ('<li><a href="#contextmenu">Chuột phải — Chặn/Cho phép nhanh</a></li>', '<li><a href="#contextmenu" data-i18n="guideToc4">4. Chuột phải — Chặn/Cho phép nhanh</a></li>'),
    ('<li><a href="#overlay">Màn hình chặn video</a></li>', '<li><a href="#overlay" data-i18n="guideToc5">5. Màn hình chặn video</a></li>'),
    ('<li><a href="#faq">Câu hỏi thường gặp</a></li>', '<li><a href="#faq" data-i18n="guideToc6">6. Câu hỏi thường gặp</a></li>'),

    ('<h2><i data-lucide="download-cloud" class="text-highlight"></i> 1. Cài đặt tiện ích</h2>', '<h2><i data-lucide="download-cloud" class="text-highlight"></i> <span data-i18n="guideSec1Title">1. Cài đặt tiện ích</span></h2>'),
    ('<h4><div class="step-badge-number">1</div> Tải và giải nén</h4>', '<h4><div class="step-badge-number">1</div> <span data-i18n="guideSec1Step1">Tải và giải nén</span></h4>'),
    ('<p>Tải file <strong>safekid-extension.zip</strong> từ trang chủ và giải nén ra một thư mục.</p>', '<p data-i18n-html="guideSec1Step1Desc">Tải file <strong>safekid-extension.zip</strong> từ trang chủ và giải nén ra một thư mục.</p>'),
    ('<h4><div class="step-badge-number">2</div> Mở Quản lý tiện ích</h4>', '<h4><div class="step-badge-number">2</div> <span data-i18n="guideSec1Step2">Mở Quản lý tiện ích</span></h4>'),
    ('<p>Trên trình duyệt Chrome, gõ <code>chrome://extensions/</code> vào thanh địa chỉ rồi nhấn Enter.</p>', '<p data-i18n-html="guideSec1Step2Desc">Trên trình duyệt Chrome, gõ <code>chrome://extensions/</code> vào thanh địa chỉ rồi nhấn Enter.</p>'),
    ('<h4><div class="step-badge-number">3</div> Bật Chế độ nhà phát triển</h4>', '<h4><div class="step-badge-number">3</div> <span data-i18n="guideSec1Step3">Bật Chế độ nhà phát triển</span></h4>'),
    ('<p>Bật công tắc <strong>"Developer mode"</strong> (Chế độ nhà phát triển) ở góc trên bên phải.</p>', '<p data-i18n-html="guideSec1Step3Desc">Bật công tắc <strong>"Developer mode"</strong> (Chế độ nhà phát triển) ở góc trên bên phải.</p>'),
    ('<h4><div class="step-badge-number">4</div> Tải thư mục lên</h4>', '<h4><div class="step-badge-number">4</div> <span data-i18n="guideSec1Step4">Tải thư mục lên</span></h4>'),
    ('<p>Nhấn nút <strong>"Load unpacked"</strong> (Tải tiện ích đã giải nén) → chọn thư mục vừa giải nén.</p>', '<p data-i18n-html="guideSec1Step4Desc">Nhấn nút <strong>"Load unpacked"</strong> (Tải tiện ích đã giải nén) → chọn thư mục vừa giải nén.</p>'),
    ('<strong>Mẹo:</strong> Sau khi cài đặt, hãy nhấp vào biểu tượng mảnh ghép trên Chrome và "Ghim" biểu tượng SafeKid lên thanh công cụ để dễ dàng truy cập.', '<span data-i18n-html="guideSec1Tip"><strong>Mẹo:</strong> Sau khi cài đặt, hãy nhấp vào biểu tượng mảnh ghép trên Chrome và "Ghim" biểu tượng SafeKid lên thanh công cụ để dễ dàng truy cập.</span>'),

    ('<h2><i data-lucide="layout-dashboard" class="text-highlight"></i> 2. Tab Tổng quan</h2>', '<h2><i data-lucide="layout-dashboard" class="text-highlight"></i> <span data-i18n="guideSec2Title">2. Tab Tổng quan</span></h2>'),
    ('<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;">Đây là màn hình chính khi bạn nhấn vào biểu tượng SafeKid. Tại đây bạn có thể điều chỉnh các cài đặt phát hiện và kiểm soát quá trình hoạt động.</p>', '<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;" data-i18n="guideSec2Desc">Đây là màn hình chính khi bạn nhấn vào biểu tượng SafeKid. Tại đây bạn có thể điều chỉnh các cài đặt phát hiện và kiểm soát quá trình hoạt động.</p>'),
    ('alt="Tab Tổng quan SafeKid"', 'alt="Tab Tổng quan SafeKid" data-i18n-alt="guideSec2ImgAlt"'),
    ('<p>Màn hình Tab Tổng quan</p>', '<p data-i18n="guideSec2ImgCap">Màn hình Tab Tổng quan</p>'),
    ('<h3>Bật/Tắt SafeKid</h3>', '<h3 data-i18n="guideSec2Sub1">Bật/Tắt SafeKid</h3>'),
    ('<h4><i data-lucide="power" class="text-highlight"></i> Công tắc chính (góc trên phải)</h4>', '<h4><i data-lucide="power" class="text-highlight"></i> <span data-i18n="guideSec2Sub1Title">Công tắc chính (góc trên phải)</span></h4>'),
    ('<p>Bật để SafeKid tự động quét và chặn nội dung độc hại trên YouTube & YouTube Kids. Tắt nếu muốn tạm dừng toàn bộ tính năng bảo vệ.</p>', '<p data-i18n="guideSec2Sub1Desc">Bật để SafeKid tự động quét và chặn nội dung độc hại trên YouTube & YouTube Kids. Tắt nếu muốn tạm dừng toàn bộ tính năng bảo vệ.</p>'),
    ('<h3>Thanh thống kê</h3>', '<h3 data-i18n="guideSec2Sub2">Thanh thống kê</h3>'),
    ('<p>Hiển thị 3 con số quan trọng về hoạt động của extension:</p>', '<p data-i18n="guideSec2Sub2Desc">Hiển thị 3 con số quan trọng về hoạt động của extension:</p>'),
    ('<li><strong>Đã chặn:</strong> Tổng số video đã bị phát hiện và ngăn chặn.</li>', '<li data-i18n-html="guideSec2Sub2Li1"><strong>Đã chặn:</strong> Tổng số video đã bị phát hiện và ngăn chặn.</li>'),
    ('<li><strong>Đã quét:</strong> Tổng số video SafeKid đã kiểm tra.</li>', '<li data-i18n-html="guideSec2Sub2Li2"><strong>Đã quét:</strong> Tổng số video SafeKid đã kiểm tra.</li>'),
    ('<li><strong>Phát hiện:</strong> Tỷ lệ phần trăm video bị phát hiện là độc hại/AI so với tổng số.</li>', '<li data-i18n-html="guideSec2Sub2Li3"><strong>Phát hiện:</strong> Tỷ lệ phần trăm video bị phát hiện là độc hại/AI so với tổng số.</li>'),
    ('<h3>Độ nhạy phát hiện</h3>', '<h3 data-i18n="guideSec2Sub3">Độ nhạy phát hiện</h3>'),
    ('<h4><span class="badge" style="background:#D1FAE5; color:#059669; font-size:0.85rem; margin:0; padding:0.25rem 0.75rem;">Thấp</span></h4>', '<h4><span class="badge" style="background:#D1FAE5; color:#059669; font-size:0.85rem; margin:0; padding:0.25rem 0.75rem;" data-i18n="guideSec2Sub3Low">Thấp</span></h4>'),
    ('<p>Chỉ chặn khi rất chắc chắn video là độc hại hoặc AI. Ít gây phiền hà (chặn nhầm) nhưng có thể vô tình lọt nội dung xấu.</p>', '<p data-i18n="guideSec2Sub3LowDesc">Chỉ chặn khi rất chắc chắn video là độc hại hoặc AI. Ít gây phiền hà (chặn nhầm) nhưng có thể vô tình lọt nội dung xấu.</p>'),
    ('<h4><span class="badge" style="background:#FEF3C7; color:#D97706; font-size:0.85rem; margin:0; padding:0.25rem 0.75rem;">Trung bình</span></h4>', '<h4><span class="badge" style="background:#FEF3C7; color:#D97706; font-size:0.85rem; margin:0; padding:0.25rem 0.75rem;" data-i18n="guideSec2Sub3Med">Trung bình</span></h4>'),
    ('<p>Cân bằng giữa chặn và cho phép. Phù hợp cho đa số người dùng trưởng thành.</p>', '<p data-i18n="guideSec2Sub3MedDesc">Cân bằng giữa chặn và cho phép. Phù hợp cho đa số người dùng trưởng thành.</p>'),
    ('<h4><span class="badge" style="background:#FEE2E2; color:#DC2626; font-size:0.85rem; margin:0; padding:0.25rem 0.75rem;">Cao</span> <span style="font-size:0.85rem; color:var(--warning-red); margin-left:0.5rem; font-family: var(--font-body); font-weight: bold;">Khuyên dùng</span></h4>', '<h4><span class="badge" style="background:#FEE2E2; color:#DC2626; font-size:0.85rem; margin:0; padding:0.25rem 0.75rem;" data-i18n="guideSec2Sub3High">Cao</span> <span style="font-size:0.85rem; color:var(--warning-red); margin-left:0.5rem; font-family: var(--font-body); font-weight: bold;" data-i18n="guideSec2Sub3Rec">Khuyên dùng</span></h4>'),
    ('<p>Chặn ngay cả khi có những nghi ngờ nhỏ. An toàn nhất cho trẻ em, mặc dù có thể chặn nhầm một số video bình thường.</p>', '<p data-i18n="guideSec2Sub3HighDesc">Chặn ngay cả khi có những nghi ngờ nhỏ. An toàn nhất cho trẻ em, mặc dù có thể chặn nhầm một số video bình thường.</p>'),
    ('<h3>Hồ sơ nhận diện</h3>', '<h3 data-i18n="guideSec2Sub4">Hồ sơ nhận diện</h3>'),
    ('<h4>Cân bằng</h4>', '<h4 data-i18n="guideSec2Sub4Bal">Cân bằng</h4>'),
    ('<p>Giảm tỷ lệ chặn nhầm, chỉ lọc các nội dung rõ ràng vi phạm. Phù hợp khi bạn muốn trải nghiệm YouTube ít bị gián đoạn.</p>', '<p data-i18n="guideSec2Sub4BalDesc">Giảm tỷ lệ chặn nhầm, chỉ lọc các nội dung rõ ràng vi phạm. Phù hợp khi bạn muốn trải nghiệm YouTube ít bị gián đoạn.</p>'),
    ('<h4>Ưu tiên bắt AI <span class="badge" style="background:var(--primary-blue-light); color:var(--primary-blue); font-size:0.85rem; margin:0 0 0 0.5rem; padding:0.25rem 0.75rem;">Mặc định</span></h4>', '<h4><span data-i18n="guideSec2Sub4AI">Ưu tiên bắt AI</span> <span class="badge" style="background:var(--primary-blue-light); color:var(--primary-blue); font-size:0.85rem; margin:0 0 0 0.5rem; padding:0.25rem 0.75rem;" data-i18n="guideSec2Sub4Def">Mặc định</span></h4>'),
    ('<p>Tăng cường độ nhạy với các dấu hiệu nội dung tạo tự động (AI slop). An toàn hơn cho trẻ nhỏ khỏi rác nội dung.</p>', '<p data-i18n="guideSec2Sub4AIDesc">Tăng cường độ nhạy với các dấu hiệu nội dung tạo tự động (AI slop). An toàn hơn cho trẻ nhỏ khỏi rác nội dung.</p>'),
    ('<h3>Phân tích AI nâng cao (Tùy chọn)</h3>', '<h3 data-i18n="guideSec2Sub5">Phân tích AI nâng cao (Tùy chọn)</h3>'),
    ('<h4><i data-lucide="sparkles" class="text-highlight"></i> Kết nối AI của bên thứ 3</h4>', '<h4><i data-lucide="sparkles" class="text-highlight"></i> <span data-i18n="guideSec2Sub5Title">Kết nối AI của bên thứ 3</span></h4>'),
    ('<p>SafeKid có thể kết nối với các mô hình AI lớn (như Gemini) để phân tích ngữ cảnh video một cách vô cùng chính xác. Đây là tính năng <strong>tùy chọn</strong> — SafeKid vẫn tự động bảo vệ rất tốt bằng bộ lọc thông minh tích hợp sẵn.</p>', '<p data-i18n-html="guideSec2Sub5Desc">SafeKid có thể kết nối với các mô hình AI lớn (như Gemini) để phân tích ngữ cảnh video một cách vô cùng chính xác. Đây là tính năng <strong>tùy chọn</strong> — SafeKid vẫn tự động bảo vệ rất tốt bằng bộ lọc thông minh tích hợp sẵn.</p>'),
    ('<li><strong>OpenRouter:</strong> Hỗ trợ nhiều model miễn phí hoàn toàn, khuyên dùng để tăng hiệu quả lọc mà không tốn kém.</li>', '<li data-i18n-html="guideSec2Sub5Li1"><strong>OpenRouter:</strong> Hỗ trợ nhiều model miễn phí hoàn toàn, khuyên dùng để tăng hiệu quả lọc mà không tốn kém.</li>'),
    ('<li><strong>Gemini API:</strong> Cần tạo khóa API từ Google AI Studio. Có độ chính xác cao.</li>', '<li data-i18n-html="guideSec2Sub5Li2"><strong>Gemini API:</strong> Cần tạo khóa API từ Google AI Studio. Có độ chính xác cao.</li>'),
    ('<li><strong>Phân tích thumbnail:</strong> Bật để AI xem trực tiếp cả hình ảnh. Chính xác hơn nhưng tốn nhiều thời gian xử lý hơn.</li>', '<li data-i18n-html="guideSec2Sub5Li3"><strong>Phân tích thumbnail:</strong> Bật để AI xem trực tiếp cả hình ảnh. Chính xác hơn nhưng tốn nhiều thời gian xử lý hơn.</li>'),

    ('<h2><i data-lucide="settings" class="text-highlight"></i> 3. Tab Quản lý nâng cao</h2>', '<h2><i data-lucide="settings" class="text-highlight"></i> <span data-i18n="guideSec3Title">3. Tab Quản lý nâng cao</span></h2>'),
    ('<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;">Tab dành riêng cho phụ huynh quản lý danh sách kênh an toàn, kênh bị cấm, đặt mật khẩu bảo vệ và các cấu hình chuyên sâu.</p>', '<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;" data-i18n="guideSec3Desc">Tab dành riêng cho phụ huynh quản lý danh sách kênh an toàn, kênh bị cấm, đặt mật khẩu bảo vệ và các cấu hình chuyên sâu.</p>'),
    ('alt="Tab Quản lý nâng cao SafeKid"', 'alt="Tab Quản lý nâng cao SafeKid" data-i18n-alt="guideSec3ImgAlt"'),
    ('<p>Màn hình Tab Quản lý nâng cao</p>', '<p data-i18n="guideSec3ImgCap">Màn hình Tab Quản lý nâng cao</p>'),
    ('<h3>Mật khẩu phụ huynh</h3>', '<h3 data-i18n="guideSec3Sub1">Mật khẩu phụ huynh</h3>'),
    ('<h4><i data-lucide="lock" class="text-green"></i> Bảo vệ bằng mật khẩu</h4>', '<h4><i data-lucide="lock" class="text-green"></i> <span data-i18n="guideSec3Sub1Title">Bảo vệ bằng mật khẩu</span></h4>'),
    ('<p>Khóa các cài đặt quan trọng bằng mật khẩu (tối thiểu 4 ký tự) để ngăn trẻ em vô tình tắt lớp bảo vệ. Khi thiết lập:</p>', '<p data-i18n="guideSec3Sub1Desc">Khóa các cài đặt quan trọng bằng mật khẩu (tối thiểu 4 ký tự) để ngăn trẻ em vô tình tắt lớp bảo vệ. Khi thiết lập:</p>'),
    ('<li>Mỗi lần mở bảng điều khiển (popup), SafeKid sẽ yêu cầu nhập mật khẩu.</li>', '<li data-i18n="guideSec3Sub1Li1">Mỗi lần mở bảng điều khiển (popup), SafeKid sẽ yêu cầu nhập mật khẩu.</li>'),
    ('<li>Trẻ em không thể gỡ bỏ kênh khỏi danh sách chặn hoặc thay đổi độ nhạy.</li>', '<li data-i18n="guideSec3Sub1Li2">Trẻ em không thể gỡ bỏ kênh khỏi danh sách chặn hoặc thay đổi độ nhạy.</li>'),
    ('<li>Phụ huynh có thể xóa bỏ mật khẩu bất kỳ lúc nào để tắt tính năng khóa.</li>', '<li data-i18n="guideSec3Sub1Li3">Phụ huynh có thể xóa bỏ mật khẩu bất kỳ lúc nào để tắt tính năng khóa.</li>'),
    ('<strong>Lưu ý quan trọng:</strong> Hãy ghi nhớ mật khẩu! Nếu quên, cách duy nhất để khôi phục là bạn phải gỡ bỏ hoàn toàn tiện ích SafeKid khỏi Chrome và tiến hành cài đặt lại từ đầu.', '<span data-i18n-html="guideSec3Warn"><strong>Lưu ý quan trọng:</strong> Hãy ghi nhớ mật khẩu! Nếu quên, cách duy nhất để khôi phục là bạn phải gỡ bỏ hoàn toàn tiện ích SafeKid khỏi Chrome và tiến hành cài đặt lại từ đầu.</span>'),
    ('<h3>Kênh được phép xem (Whitelist)</h3>', '<h3 data-i18n="guideSec3Sub2">Kênh được phép xem (Whitelist)</h3>'),
    ('<h4><i data-lucide="check-circle-2" class="text-green"></i> Danh sách kênh an toàn tuyệt đối</h4>', '<h4><i data-lucide="check-circle-2" class="text-green"></i> <span data-i18n="guideSec3Sub2Title">Danh sách kênh an toàn tuyệt đối</span></h4>'),
    ('<p>Thêm tên các kênh YouTube mà bạn hoàn toàn tin tưởng (ví dụ: VTV, HTV3, kênh hoạt hình chính thức). Video từ các kênh này sẽ <strong>không bao giờ bị SafeKid chặn</strong>, bất kể chúng có đặc điểm giống AI hay không.</p>', '<p data-i18n-html="guideSec3Sub2Desc">Thêm tên các kênh YouTube mà bạn hoàn toàn tin tưởng (ví dụ: VTV, HTV3, kênh hoạt hình chính thức). Video từ các kênh này sẽ <strong>không bao giờ bị SafeKid chặn</strong>, bất kể chúng có đặc điểm giống AI hay không.</p>'),
    ('<li>Vui lòng nhập đúng Tên kênh hiển thị trên YouTube (phân biệt hoa thường không quan trọng).</li>', '<li data-i18n="guideSec3Sub2Li1">Vui lòng nhập đúng Tên kênh hiển thị trên YouTube (phân biệt hoa thường không quan trọng).</li>'),
    ('<li>Nhanh nhất là dùng tính năng "Chuột phải" để thêm kênh ngay khi đang xem.</li>', '<li data-i18n-html="guideSec3Sub2Li2">Nhanh nhất là dùng tính năng "Chuột phải" để thêm kênh ngay khi đang xem.</li>'),
    ('<li>Nhấn biểu tượng thùng rác để gỡ bỏ kênh.</li>', '<li data-i18n="guideSec3Sub2Li3">Nhấn biểu tượng thùng rác để gỡ bỏ kênh.</li>'),
    ('<h3>Chế độ "Chỉ cho phép xem kênh trong danh sách"</h3>', '<h3 data-i18n="guideSec3Sub3">Chế độ "Chỉ cho phép xem kênh trong danh sách"</h3>'),
    ('<h4><i data-lucide="shield-alert" class="text-red"></i> Chế độ an toàn tối đa (Whitelist-only)</h4>', '<h4><i data-lucide="shield-alert" class="text-red"></i> <span data-i18n="guideSec3Sub3Title">Chế độ an toàn tối đa (Whitelist-only)</span></h4>'),
    ('<p>Khi công tắc này được bật, SafeKid chuyển sang mức độ kiểm soát cao nhất:</p>', '<p data-i18n="guideSec3Sub3Desc">Khi công tắc này được bật, SafeKid chuyển sang mức độ kiểm soát cao nhất:</p>'),
    ('<li><strong>Mọi video</strong> từ bất kỳ kênh nào KHÔNG có trong danh sách Whitelist sẽ bị chặn hiển thị.</li>', '<li data-i18n-html="guideSec3Sub3Li1"><strong>Mọi video</strong> từ bất kỳ kênh nào KHÔNG có trong danh sách Whitelist sẽ bị chặn hiển thị.</li>'),
    ('<li>Thậm chí cả video người thật 100% cũng bị chặn nếu kênh đó chưa được bạn phê duyệt.</li>', '<li data-i18n="guideSec3Sub3Li2">Thậm chí cả video người thật 100% cũng bị chặn nếu kênh đó chưa được bạn phê duyệt.</li>'),
    ('<li>Con bạn chỉ có thể nhìn thấy nội dung từ những kênh nằm trong "Danh sách kênh được phép xem".</li>', '<li data-i18n-html="guideSec3Sub3Li3">Con bạn chỉ có thể nhìn thấy nội dung từ những kênh nằm trong "Danh sách kênh được phép xem".</li>'),
    ('<strong>Mẹo của chuyên gia:</strong> Chế độ này là giải pháp "vàng" cho trẻ nhỏ (dưới 6 tuổi) khi bạn chỉ muốn con xem các kênh giáo dục, ca nhạc thiếu nhi mà chính bạn đã tự tay chọn lọc kỹ càng.', '<span data-i18n-html="guideSec3Tip"><strong>Mẹo của chuyên gia:</strong> Chế độ này là giải pháp "vàng" cho trẻ nhỏ (dưới 6 tuổi) khi bạn chỉ muốn con xem các kênh giáo dục, ca nhạc thiếu nhi mà chính bạn đã tự tay chọn lọc kỹ càng.</span>'),
    ('<h3>Channel luôn chặn (Blacklist)</h3>', '<h3 data-i18n="guideSec3Sub4">Channel luôn chặn (Blacklist)</h3>'),
    ('<h4><i data-lucide="ban" class="text-red"></i> Danh sách kênh bị cấm</h4>', '<h4><i data-lucide="ban" class="text-red"></i> <span data-i18n="guideSec3Sub4Title">Danh sách kênh bị cấm</span></h4>'),
    ('<p>Ghi danh các kênh mà bạn muốn <strong>loại bỏ vĩnh viễn</strong>. Toàn bộ video từ các kênh trong danh sách này sẽ bị SafeKid che khuất lập tức, dù nội dung thực sự của video đó là gì.</p>', '<p data-i18n-html="guideSec3Sub4Desc">Ghi danh các kênh mà bạn muốn <strong>loại bỏ vĩnh viễn</strong>. Toàn bộ video từ các kênh trong danh sách này sẽ bị SafeKid che khuất lập tức, dù nội dung thực sự của video đó là gì.</p>'),

    ('<h2><i data-lucide="mouse-pointer-click" class="text-highlight"></i> 4. Menu chuột phải (Context Menu)</h2>', '<h2><i data-lucide="mouse-pointer-click" class="text-highlight"></i> <span data-i18n="guideSec4Title">4. Menu chuột phải (Context Menu)</span></h2>'),
    ('<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;">Khi đang ở trang YouTube hoặc YouTube Kids, bạn chỉ cần nhấn chuột phải vào bất kỳ đâu trên trang để truy cập nhanh các tùy chọn quản lý của SafeKid.</p>', '<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;" data-i18n="guideSec4Desc">Khi đang ở trang YouTube hoặc YouTube Kids, bạn chỉ cần nhấn chuột phải vào bất kỳ đâu trên trang để truy cập nhanh các tùy chọn quản lý của SafeKid.</p>'),
    ('alt="Menu chuột phải SafeKid trên YouTube"', 'alt="Menu chuột phải SafeKid trên YouTube" data-i18n-alt="guideSec4ImgAlt"'),
    ('<p>Menu chuột phải SafeKid hiển thị trực tiếp trên YouTube</p>', '<p data-i18n="guideSec4ImgCap">Menu chuột phải SafeKid hiển thị trực tiếp trên YouTube</p>'),
    ('<h4 class="text-green"><i data-lucide="check-square" style="width:20px;height:20px;"></i> Cho phép channel này</h4>', '<h4 class="text-green"><i data-lucide="check-square" style="width:20px;height:20px;"></i> <span data-i18n="guideSec4Allow">Cho phép channel này</span></h4>'),
    ('<p>Ngay lập tức đưa kênh của video đang xem vào danh sách an toàn (Whitelist).</p>', '<p data-i18n="guideSec4AllowDesc">Ngay lập tức đưa kênh của video đang xem vào danh sách an toàn (Whitelist).</p>'),
    ('<h4 class="text-red"><i data-lucide="x-square" style="width:20px;height:20px;"></i> Chặn channel này</h4>', '<h4 class="text-red"><i data-lucide="x-square" style="width:20px;height:20px;"></i> <span data-i18n="guideSec4Block">Chặn channel này</span></h4>'),
    ('<p>Đưa kênh của video đang xem vào danh sách luôn bị cấm (Blacklist).</p>', '<p data-i18n="guideSec4BlockDesc">Đưa kênh của video đang xem vào danh sách luôn bị cấm (Blacklist).</p>'),
    ('<h4 class="text-highlight"><i data-lucide="video-off" style="width:20px;height:20px;"></i> Chặn video này</h4>', '<h4 class="text-highlight"><i data-lucide="video-off" style="width:20px;height:20px;"></i> <span data-i18n="guideSec4BlockVid">Chặn video này</span></h4>'),
    ('<p>Chỉ chặn thủ công một video cụ thể này mà không gây ảnh hưởng tới các video khác của kênh.</p>', '<p data-i18n="guideSec4BlockVidDesc">Chỉ chặn thủ công một video cụ thể này mà không gây ảnh hưởng tới các video khác của kênh.</p>'),
    ('<strong>Thao tác nhanh:</strong> Đây là cách tiết kiệm thời gian nhất! Thay vì mở bảng điều khiển để gõ tên kênh, hãy cứ chuột phải trực tiếp khi thấy video để kiểm soát.', '<span data-i18n-html="guideSec4Tip"><strong>Thao tác nhanh:</strong> Đây là cách tiết kiệm thời gian nhất! Thay vì mở bảng điều khiển để gõ tên kênh, hãy cứ chuột phải trực tiếp khi thấy video để kiểm soát.</span>'),

    ('<h2><i data-lucide="eye-off" class="text-highlight"></i> 5. Khi video bị chặn</h2>', '<h2><i data-lucide="eye-off" class="text-highlight"></i> <span data-i18n="guideSec5Title">5. Khi video bị chặn</span></h2>'),
    ('<h3>1. Trên trang chủ và danh sách gợi ý</h3>', '<h3 data-i18n="guideSec5Sub1">1. Trên trang chủ và danh sách gợi ý</h3>'),
    ('<p>Những video độc hại/AI sẽ tự động bị phủ một lớp mờ dày đặc trên ảnh thu nhỏ (thumbnail) kèm theo các thông tin:</p>', '<p data-i18n="guideSec5Sub1Desc">Những video độc hại/AI sẽ tự động bị phủ một lớp mờ dày đặc trên ảnh thu nhỏ (thumbnail) kèm theo các thông tin:</p>'),
    ('<li><strong>Trạng thái:</strong> "Đã Chặn Video AI" hoặc "Đã Chặn Kênh Không Phù Hợp".</li>', '<li data-i18n-html="guideSec5Sub1Li1"><strong>Trạng thái:</strong> "Đã Chặn Video AI" hoặc "Đã Chặn Kênh Không Phù Hợp".</li>'),
    ('<li><strong>Độ tin cậy:</strong> Mức độ chắc chắn (%) của hệ thống và thuật toán nào đã ra quyết định chặn.</li>', '<li data-i18n-html="guideSec5Sub1Li2"><strong>Độ tin cậy:</strong> Mức độ chắc chắn (%) của hệ thống và thuật toán nào đã ra quyết định chặn.</li>'),
    ('<li><strong>Lý do cụ thể:</strong> Chẳng hạn "Phát hiện có chứa từ ngữ phản cảm" hoặc "Video do AI tạo ra hàng loạt".</li>', '<li data-i18n-html="guideSec5Sub1Li3"><strong>Lý do cụ thể:</strong> Chẳng hạn "Phát hiện có chứa từ ngữ phản cảm" hoặc "Video do AI tạo ra hàng loạt".</li>'),
    ('<p style="margin-top:0.75rem">Nhấn vào khu vực video đã bị chặn sẽ <strong>không có tác dụng</strong> — điều này bảo vệ trẻ em không thể "cố ý" bấm vào xem.</p>', '<p style="margin-top:0.75rem" data-i18n-html="guideSec5Sub1Note">Nhấn vào khu vực video đã bị chặn sẽ <strong>không có tác dụng</strong> — điều này bảo vệ trẻ em không thể "cố ý" bấm vào xem.</p>'),
    ('<h3>2. Khi trẻ bấm trực tiếp vào trang xem video</h3>', '<h3 data-i18n="guideSec5Sub2">2. Khi trẻ bấm trực tiếp vào trang xem video</h3>'),
    ('<p>Nếu bằng một cách nào đó (như qua link chia sẻ) trẻ vẫn truy cập thẳng vào trang chiếu video bị chặn, hệ thống sẽ:</p>', '<p data-i18n="guideSec5Sub2Desc">Nếu bằng một cách nào đó (như qua link chia sẻ) trẻ vẫn truy cập thẳng vào trang chiếu video bị chặn, hệ thống sẽ:</p>'),
    ('<li><strong>Chặn phát video</strong> ngay lập tức ở mức thấp nhất, không để âm thanh hay hình ảnh lọt qua.</li>', '<li data-i18n-html="guideSec5Sub2Li1"><strong>Chặn phát video</strong> ngay lập tức ở mức thấp nhất, không để âm thanh hay hình ảnh lọt qua.</li>'),
    ('<li>Hiển thị tấm màn đen bao phủ toàn bộ màn hình với nút <strong>"← Quay lại trang chủ"</strong>.</li>', '<li data-i18n-html="guideSec5Sub2Li2">Hiển thị tấm màn đen bao phủ toàn bộ màn hình với nút <strong>"← Quay lại trang chủ"</strong>.</li>'),
    ('<li>Nếu phụ huynh muốn kiểm tra lại nội dung, có thể chọn nút "Tôi là phụ huynh", nhập mật khẩu để tạm thời xem video hoặc mở khóa kênh vĩnh viễn.</li>', '<li data-i18n-html="guideSec5Sub2Li3">Nếu phụ huynh muốn kiểm tra lại nội dung, có thể chọn nút "Tôi là phụ huynh", nhập mật khẩu để tạm thời xem video hoặc mở khóa kênh vĩnh viễn.</li>'),

    ('<h2><i data-lucide="help-circle" class="text-highlight"></i> 6. Câu hỏi thường gặp</h2>', '<h2><i data-lucide="help-circle" class="text-highlight"></i> <span data-i18n="guideSec6Title">6. Câu hỏi thường gặp</span></h2>'),
    ('<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;">Giải đáp nhanh các thắc mắc trong quá trình sử dụng SafeKid.</p>', '<p class="text-muted" style="font-family: var(--font-body); font-size: 1.1rem; margin-bottom: 1.5rem;" data-i18n="guideSec6Desc">Giải đáp nhanh các thắc mắc trong quá trình sử dụng SafeKid.</p>'),
    ('<h4>SafeKid có lấy dữ liệu cá nhân của tôi không?</h4>', '<h4 data-i18n="guideSec6Q1">SafeKid có lấy dữ liệu cá nhân của tôi không?</h4>'),
    ('<p><strong>Hoàn toàn Không.</strong> SafeKid là tiện ích chạy độc lập trên trình duyệt của bạn (local). Không có dữ liệu xem video hay thông tin cá nhân nào được gửi về máy chủ của chúng tôi. Nếu bạn dùng API AI bổ sung, dữ liệu chỉ gửi trực tiếp qua API của Google/OpenRouter.</p>', '<p data-i18n-html="guideSec6A1"><strong>Hoàn toàn Không.</strong> SafeKid là tiện ích chạy độc lập trên trình duyệt của bạn (local). Không có dữ liệu xem video hay thông tin cá nhân nào được gửi về máy chủ của chúng tôi. Nếu bạn dùng API AI bổ sung, dữ liệu chỉ gửi trực tiếp qua API của Google/OpenRouter.</p>'),
    ('<h4>SafeKid có hỗ trợ YouTube Kids không?</h4>', '<h4 data-i18n="guideSec6Q2">SafeKid có hỗ trợ YouTube Kids không?</h4>'),
    ('<p><strong>Có.</strong> Hệ thống được thiết kế tối ưu hóa để tương thích với cả <code>youtube.com</code> và trang web <code>youtubekids.com</code>.</p>', '<p data-i18n-html="guideSec6A2"><strong>Có.</strong> Hệ thống được thiết kế tối ưu hóa để tương thích với cả <code>youtube.com</code> và trang web <code>youtubekids.com</code>.</p>'),
    ('<h4>Trẻ em có tự tắt được SafeKid không?</h4>', '<h4 data-i18n="guideSec6Q3">Trẻ em có tự tắt được SafeKid không?</h4>'),
    ('<p>Khi <strong>mật khẩu phụ huynh</strong> đã bật, trẻ sẽ không thể mở cài đặt SafeKid. Tuy nhiên đối với các bé lớn và am hiểu máy tính, trẻ có thể vô hiệu hóa tiện ích thông qua trang Quản lý tiện ích (chrome://extensions) của Google Chrome.</p>', '<p data-i18n-html="guideSec6A3">Khi <strong>mật khẩu phụ huynh</strong> đã bật, trẻ sẽ không thể mở cài đặt SafeKid. Tuy nhiên đối với các bé lớn và am hiểu máy tính, trẻ có thể vô hiệu hóa tiện ích thông qua trang Quản lý tiện ích (chrome://extensions) của Google Chrome.</p>'),
    ('<h4>Đôi khi tôi thấy video sạch vẫn bị chặn?</h4>', '<h4 data-i18n="guideSec6Q4">Đôi khi tôi thấy video sạch vẫn bị chặn?</h4>'),
    ('<p>Đó là trường hợp "chặn nhầm" (false positive). Để khắc phục: Nhấn chuột phải -> "Cho phép channel này", video sẽ sáng lại lập tức. Hoặc bạn có thể cân nhắc chuyển Độ nhạy phát hiện về mức "Trung bình" trong Tab Tổng quan.</p>', '<p data-i18n-html="guideSec6A4">Đó là trường hợp "chặn nhầm" (false positive). Để khắc phục: Nhấn chuột phải -> "Cho phép channel này", video sẽ sáng lại lập tức. Hoặc bạn có thể cân nhắc chuyển Độ nhạy phát hiện về mức "Trung bình" trong Tab Tổng quan.</p>'),

    # Footer and Modals are same as index.html
    ('<p class="copyright">&copy; 2026 AutoWork Team. Đảm bảo quyền riêng tư và an toàn.</p>', '<p class="copyright" data-i18n="footerCopyright">&copy; 2026 AutoWork Team. Đảm bảo quyền riêng tư và an toàn.</p>'),
    ('<a href="guide.html">Hướng dẫn sử dụng</a>', '<a href="guide.html" data-i18n="footerGuide">Hướng dẫn sử dụng</a>'),
    ('<a href="privacy.html">Chính sách bảo mật</a>', '<a href="privacy.html" data-i18n="footerPrivacy">Chính sách bảo mật</a>'),
    ('<a href="terms.html">Điều khoản</a>', '<a href="terms.html" data-i18n="footerTerms">Điều khoản</a>'),
    ('<a href="#" onclick="openContactModal(); return false;">Liên hệ</a>', '<a href="#" onclick="openContactModal(); return false;" data-i18n="footerContact">Liên hệ</a>'),

    # Contact Modal
    ('<h2>Thông tin liên hệ</h2>', '<h2 data-i18n="contactTitle">Thông tin liên hệ</h2>'),
    ('<p>Nếu bạn cần hỗ trợ hoặc có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua:</p>', '<p data-i18n="contactDesc">Nếu bạn cần hỗ trợ hoặc có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua:</p>'),
    ('<strong>Email:</strong>', '<strong data-i18n="contactEmail">Email:</strong>'),
    ('<strong>SĐT / Zalo:</strong>', '<strong data-i18n="contactPhone">SĐT / Zalo:</strong>'),
]

for old, new in guide_replacements:
    guide = guide.replace(old, new)

with open('docs/guide.html', 'w') as f:
    f.write(guide)
print("Updated docs/guide.html")
