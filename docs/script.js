// Initialize Lucide Icons
lucide.createIcons();

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            // Adjust for fixed header height
            const headerHeight = document.querySelector('.header').offsetHeight;
            const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Simple intersection observer for scroll animations
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Add animation initial state to elements
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = [
        ...document.querySelectorAll('.feature-card'),
        ...document.querySelectorAll('.step'),
        ...document.querySelectorAll('.stat-item'),
        ...document.querySelectorAll('.faq-item'),
        document.querySelector('.cta-card')
    ];
    
    animateElements.forEach((el, index) => {
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = `opacity 0.6s ease-out ${index * 0.05}s, transform 0.6s ease-out ${index * 0.05}s`;
            observer.observe(el);
        }
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const isActive = item.classList.contains('active');
            // Close all others
            document.querySelectorAll('.faq-item.active').forEach(openItem => {
                if (openItem !== item) openItem.classList.remove('active');
            });
            // Toggle current
            item.classList.toggle('active', !isActive);
            btn.setAttribute('aria-expanded', !isActive);
        });
    });

    // Check localStorage for Video Modal
    const hideVideoPopup = localStorage.getItem('hideVideoPopup');
    if (!hideVideoPopup) {
        setTimeout(openVideoModal, 500);
    }
});

function openVideoModal() {
    const modal = document.getElementById('videoModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    if (modal) {
        const checkbox = document.getElementById('hideVideoCheckbox');
        if (checkbox && checkbox.checked) {
            localStorage.setItem('hideVideoPopup', 'true');
        }
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Install Tab Switcher
function switchInstallTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.install-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) activeTab.classList.add('active');

    // Update tab content
    document.querySelectorAll('.install-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const activeContent = document.getElementById(`content-${tabId}`);
    if (activeContent) activeContent.classList.add('active');

    // Re-init Lucide icons for newly visible content
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Modal Logic
function openInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
        // Re-init icons inside modal
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

function closeInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

function openContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function openDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeDonateModal() {
    const modal = document.getElementById('donateModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modal when pressing Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeInstallModal();
        closeVideoModal();
        closeContactModal();
        closeDonateModal();
    }
});

/**
 * So sánh 2 chuỗi version theo semver (1.0.8 vs 1.1.0)
 * Trả về: 1 nếu a > b, -1 nếu a < b, 0 nếu a == b
 */
function compareVersions(a, b) {
    const partsA = a.replace(/^v/i, '').split('.').map(Number);
    const partsB = b.replace(/^v/i, '').split('.').map(Number);
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

/**
 * Ẩn tất cả các nút/thành phần liên quan đến ZIP download
 * Khi CWS đã có bản mới nhất, không cần hiển thị phương thức ZIP
 */
function hideZipElements() {
    // 1. Ẩn nút "Tải file ZIP" trên hero
    const heroZipBtn = document.getElementById('hero-zip-btn');
    if (heroZipBtn) heroZipBtn.style.display = 'none';

    // 2. Ẩn nút "Hoặc tải file ZIP" trong CTA section cuối
    document.querySelectorAll('.cta-buttons .btn-outline').forEach(btn => {
        btn.style.display = 'none';
    });

    // 3. Ẩn tab ZIP trong install modal (chỉ giữ tab CWS)
    const tabZip = document.getElementById('tab-zip');
    if (tabZip) tabZip.style.display = 'none';

    // 4. Ẩn nội dung tab ZIP
    const contentZip = document.getElementById('content-zip');
    if (contentZip) contentZip.style.display = 'none';

    // 5. Ẩn badge "Khuyên dùng" vì chỉ còn 1 phương thức
    document.querySelectorAll('.tab-badge-rec').forEach(badge => {
        badge.style.display = 'none';
    });

    console.log('🟢 CWS đã cập nhật bản mới nhất — ẩn phương thức ZIP');
}

/**
 * Hiển thị nút ZIP và cập nhật text khi có bản mới hơn CWS
 */
function showZipElements(releaseVersion, cwsVersion) {
    // Đảm bảo các phần tử ZIP hiển thị (mặc định đã hiển thị)
    const heroZipBtn = document.getElementById('hero-zip-btn');
    if (heroZipBtn) heroZipBtn.style.display = '';

    const tabZip = document.getElementById('tab-zip');
    if (tabZip) tabZip.style.display = '';

    const contentZip = document.getElementById('content-zip');
    if (contentZip) contentZip.style.display = '';

    console.log(`🟡 Có bản mới v${releaseVersion} (CWS đang ở v${cwsVersion}) — hiện phương thức ZIP`);
}

/**
 * Tự động cập nhật link download từ GitHub Releases API
 * + So sánh version với CWS để quyết định ẩn/hiện nút ZIP
 */
async function updateDownloadLink() {
    const repo = 'PiPyL/safekid-extension';
    const downloadBtn = document.getElementById('latest-download-link');

    // Đọc CWS version từ biến global (version-config.js)
    const cwsVersion = (typeof SAFEKID_VERSION_CONFIG !== 'undefined')
        ? SAFEKID_VERSION_CONFIG.cwsVersion
        : null;

    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
        if (!response.ok) throw new Error('GitHub API error');

        const releaseData = await response.json();
        const releaseVersion = releaseData.tag_name || null;

        // --- Cập nhật link download nếu có ---
        if (downloadBtn) {
            const zipAsset = releaseData.assets && releaseData.assets.find(a => a.name.endsWith('.zip'));
            if (zipAsset) {
                downloadBtn.href = zipAsset.browser_download_url;
            } else if (releaseData.body) {
                const bodyMatch = releaseData.body.match(/https?:\/\/[^\s)]+\.zip/i);
                if (bodyMatch) downloadBtn.href = bodyMatch[0];
            } else if (releaseData.zipball_url) {
                downloadBtn.href = releaseData.zipball_url;
            }
        }

        // --- So sánh version để ẩn/hiện ZIP ---
        if (cwsVersion && releaseVersion) {
            const cmp = compareVersions(releaseVersion, cwsVersion);
            if (cmp <= 0) {
                hideZipElements();
            } else {
                showZipElements(releaseVersion.replace(/^v/i, ''), cwsVersion);
            }
        }

    } catch (error) {
        // Nếu GitHub API fail nhưng có cwsVersion → vẫn ẩn ZIP (giả định CWS up-to-date)
        // Vì không lấy được release version để biết có bản mới hơn không
        if (cwsVersion) {
            hideZipElements();
        }
        console.warn('⚠️ Không thể kiểm tra GitHub release:', error.message);
    }
}

// Chạy khi trang đã sẵn sàng
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateDownloadLink);
} else {
    updateDownloadLink();
}
