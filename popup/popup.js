/**
 * AI Video Blocker — Popup Script
 * Quản lý settings UI, parental lock, channel lists
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Elements
  const lockScreen = $('#lock-screen');
  const mainScreen = $('#main-screen');
  const passwordInput = $('#password-input');
  const btnUnlock = $('#btn-unlock');
  const lockError = $('#lock-error');

  const checkboxEnabled = $('#checkbox-enabled');
  const statBlocked = $('#stat-blocked');
  const statScanned = $('#stat-scanned');
  const statAccuracy = $('#stat-accuracy');
  const breakStrong = $('#break-strong');
  const breakMedium = $('#break-medium');
  const breakWeak = $('#break-weak');
  const breakMethod = $('#break-method');

  const newPassword = $('#new-password');
  const btnSetPassword = $('#btn-set-password');
  const passwordStatus = $('#password-status');

  const whitelistInput = $('#whitelist-input');
  const btnAddWhitelist = $('#btn-add-whitelist');
  const whitelistContainer = $('#whitelist-container');
  const whitelistCount = $('#whitelist-count');

  const blacklistInput = $('#blacklist-input');
  const btnAddBlacklist = $('#btn-add-blacklist');
  const blacklistContainer = $('#blacklist-container');
  const blacklistCount = $('#blacklist-count');

  const btnRescan = $('#btn-rescan');

  // ==================== INITIALIZATION ====================

  let settings = await getSettings();

  // Check parental lock
  if (settings.parentalPassword && settings.isLocked) {
    lockScreen.style.display = 'flex';
    mainScreen.style.display = 'none';
    passwordInput.focus();
  } else {
    lockScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    await loadUI(settings);
  }

  // ==================== LOCK SCREEN ====================

  btnUnlock.addEventListener('click', async () => {
    const result = await sendMessage({ type: 'VERIFY_PASSWORD', password: passwordInput.value });
    if (result.valid) {
      lockScreen.style.display = 'none';
      mainScreen.style.display = 'block';
      settings = await getSettings();
      await loadUI(settings);
    } else {
      lockError.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
      setTimeout(() => { lockError.style.display = 'none'; }, 2000);
    }
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnUnlock.click();
  });

  // ==================== LOAD UI ====================

  async function loadUI(s) {
    // Toggle
    checkboxEnabled.checked = s.enabled;

    // Sensitivity
    const sensRadio = document.querySelector(`input[name="sensitivity"][value="${s.sensitivity}"]`);
    if (sensRadio) sensRadio.checked = true;

    // Detection profile
    const profileRadio = document.querySelector(`input[name="detectionProfile"][value="${s.detectionProfile || 'recall-first'}"]`);
    if (profileRadio) profileRadio.checked = true;

    // Channel lists
    renderChannelList(whitelistContainer, s.whitelistedChannels, 'whitelist');
    whitelistCount.textContent = s.whitelistedChannels.length;

    renderChannelList(blacklistContainer, s.blacklistedChannels, 'blacklist');
    blacklistCount.textContent = s.blacklistedChannels.length;

    // Stats
    await loadStats();
  }

  async function loadStats() {
    try {
      const stats = await sendMessage({ type: 'GET_FULL_STATS' });
      if (stats) {
        statBlocked.textContent = formatNumber(stats.totalBlocked);
        statScanned.textContent = formatNumber(stats.totalScanned);
        
        if (stats.totalScanned > 0) {
          const rate = Math.round((stats.totalBlocked / stats.totalScanned) * 100);
          statAccuracy.textContent = `${rate}%`;
        }

        breakStrong.textContent = formatNumber(stats.statsBySignal?.strong || 0);
        breakMedium.textContent = formatNumber(stats.statsBySignal?.medium || 0);
        breakWeak.textContent = formatNumber(stats.statsBySignal?.weak || 0);
        breakMethod.textContent = topMethod(stats.methodBreakdown || {});
      }
    } catch (e) {
      // Extension might not be active on current tab
    }
  }

  // ==================== EVENT HANDLERS ====================

  // Toggle enabled
  checkboxEnabled.addEventListener('change', async () => {
    await updateSetting({ enabled: checkboxEnabled.checked });
  });

  // Sensitivity
  $$('input[name="sensitivity"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      await updateSetting({ sensitivity: radio.value });
    });
  });

  // Detection profile
  $$('input[name="detectionProfile"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      await updateSetting({ detectionProfile: radio.value });
    });
  });

  // Set password
  btnSetPassword.addEventListener('click', async () => {
    const pwd = newPassword.value.trim();
    if (pwd.length < 4) {
      passwordStatus.textContent = 'Mật khẩu ít nhất 4 ký tự!';
      passwordStatus.style.color = '#ef4444';
      return;
    }
    await updateSetting({ parentalPassword: pwd, isLocked: true });
    newPassword.value = '';
    passwordStatus.textContent = '✅ Đã lưu mật khẩu!';
    passwordStatus.style.color = '#22c55e';
    setTimeout(() => { passwordStatus.textContent = ''; }, 2000);
  });

  // Whitelist
  btnAddWhitelist.addEventListener('click', () => addChannel('whitelist'));
  whitelistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel('whitelist');
  });

  // Blacklist
  btnAddBlacklist.addEventListener('click', () => addChannel('blacklist'));
  blacklistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel('blacklist');
  });

  // Rescan
  btnRescan.addEventListener('click', async () => {
    btnRescan.textContent = '⏳ Đang quét...';
    btnRescan.disabled = true;
    await sendMessage({ type: 'RESCAN_ALL' });
    setTimeout(async () => {
      await loadStats();
      btnRescan.textContent = '🔄 Quét lại';
      btnRescan.disabled = false;
    }, 1500);
  });

  // ==================== CHANNEL MANAGEMENT ====================

  async function addChannel(listType) {
    const input = listType === 'whitelist' ? whitelistInput : blacklistInput;
    const name = input.value.trim();
    if (!name) return;

    settings = await getSettings();
    const key = listType === 'whitelist' ? 'whitelistedChannels' : 'blacklistedChannels';
    
    if (!settings[key].includes(name)) {
      settings[key].push(name);
      await updateSetting({ [key]: settings[key] });
    }

    input.value = '';
    
    const container = listType === 'whitelist' ? whitelistContainer : blacklistContainer;
    const countEl = listType === 'whitelist' ? whitelistCount : blacklistCount;
    renderChannelList(container, settings[key], listType);
    countEl.textContent = settings[key].length;
  }

  async function removeChannel(name, listType) {
    settings = await getSettings();
    const key = listType === 'whitelist' ? 'whitelistedChannels' : 'blacklistedChannels';
    settings[key] = settings[key].filter(c => c !== name);
    await updateSetting({ [key]: settings[key] });

    const container = listType === 'whitelist' ? whitelistContainer : blacklistContainer;
    const countEl = listType === 'whitelist' ? whitelistCount : blacklistCount;
    renderChannelList(container, settings[key], listType);
    countEl.textContent = settings[key].length;
  }

  function renderChannelList(container, channels, listType) {
    container.innerHTML = '';
    channels.forEach(name => {
      const tag = document.createElement('div');
      tag.className = 'channel-tag';
      tag.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <span class="channel-tag-remove">×</span>
      `;
      tag.querySelector('.channel-tag-remove').addEventListener('click', () => {
        removeChannel(name, listType);
      });
      container.appendChild(tag);
    });
  }

  // ==================== HELPERS ====================

  async function getSettings() {
    return await sendMessage({ type: 'GET_SETTINGS' });
  }

  async function updateSetting(partial) {
    const result = await sendMessage({ type: 'UPDATE_SETTINGS', settings: partial });
    settings = result || settings;
    // Trigger rescan after settings change
    await sendMessage({ type: 'RESCAN_ALL' });
    return settings;
  }

  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (response) => {
        resolve(response || {});
      });
    });
  }

  function formatNumber(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function topMethod(methodBreakdown) {
    let key = '—';
    let max = 0;
    for (const [method, count] of Object.entries(methodBreakdown)) {
      if (Number(count) > max) {
        key = method;
        max = Number(count);
      }
    }
    const labels = {
      label: 'YouTube label',
      keyword: 'Từ khóa AI',
      pattern: 'Pattern',
      channel: 'Channel',
      disclosure: 'Disclosure',
      childRisk: 'Rủi ro trẻ em',
      combination: 'Kết hợp'
    };
    return labels[key] || key;
  }
});
