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
        document.querySelector('.cta-card')
    ];
    
    animateElements.forEach((el, index) => {
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = `opacity 0.6s ease-out ${index * 0.1}s, transform 0.6s ease-out ${index * 0.1}s`;
            observer.observe(el);
        }
    });

    // Check localStorage for Video Modal
    const hideVideoPopup = localStorage.getItem('hideVideoPopup');
    if (!hideVideoPopup) {
        setTimeout(openVideoModal, 500); // Small delay for better UX
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

// Modal Logic
function openInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
}

function closeInstallModal() {
    const modal = document.getElementById('installModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Close modal when pressing Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeInstallModal();
        closeVideoModal();
    }
});

/**
 * Tự động cập nhật link download từ GitHub Releases API (frontend-specialist)
 * Đảm bảo người dùng luôn tải về bản ZIP mới nhất đã được release.
 */
async function updateDownloadLink() {
    const repo = 'PiPyL/safekid-extension';
    const downloadBtn = document.getElementById('latest-download-link');
    
    if (!downloadBtn) return;

    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
        if (!response.ok) throw new Error('Không thể kết nối GitHub API');
        
        const data = await response.json();
        
        // 1. Tìm trong Assets (Cách chuẩn nhất)
        const zipAsset = data.assets && data.assets.find(asset => asset.name.endsWith('.zip'));
        
        if (zipAsset) {
            downloadBtn.href = zipAsset.browser_download_url;
            console.log('✅ Đã cập nhật link từ Assets:', zipAsset.name);
            return;
        }

        // 2. Tìm trong nội dung Release (body) nếu file được đính kèm ở đó
        if (data.body) {
            const bodyZipMatch = data.body.match(/https?:\/\/[^\s)]+\.zip/i);
            if (bodyZipMatch) {
                downloadBtn.href = bodyZipMatch[0];
                console.log('✅ Đã cập nhật link từ nội dung Release:', bodyZipMatch[0]);
                return;
            }
        }

        // 3. Dự phòng: Nếu không có Assets, lấy link Source Code ZIP của Release đó
        if (data.zipball_url) {
            downloadBtn.href = data.zipball_url;
            console.log('⚠️ Không thấy Assets, đã dùng link Source ZIP của Release ' + data.tag_name);
            return;
        }

    } catch (error) {
        console.error('❌ Lỗi cập nhật link download:', error);
        // Giữ nguyên link mặc định trong HTML làm phương án cuối cùng
    }
}

// Chạy khi trang đã sẵn sàng
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateDownloadLink);
} else {
    updateDownloadLink();
}

