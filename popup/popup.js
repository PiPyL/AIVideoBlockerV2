/**
 * SafeKid — Popup Script
 * Quản lý settings UI, parental lock, channel lists
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Initialize i18n with language override support
  await I18n.init();

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
  const btnClearPassword = $('#btn-clear-password');
  const clearPasswordRow = $('#clear-password-row');
  const passwordSetBadge = $('#password-set-badge');

  const checkboxAllowOnlyWhitelisted = $('#checkbox-allow-only-whitelisted');
  const allowOnlyEmptyWarning = $('#allow-only-empty-warning');
  const whitelistInput = $('#whitelist-input');
  const btnAddWhitelist = $('#btn-add-whitelist');
  const whitelistContainer = $('#whitelist-container');
  const whitelistCount = $('#whitelist-count');

  const blacklistInput = $('#blacklist-input');
  const btnAddBlacklist = $('#btn-add-blacklist');
  const blacklistContainer = $('#blacklist-container');
  const blacklistCount = $('#blacklist-count');

  const blockedVideosHeader = $('#blocked-videos-header');
  const blockedVideosDetails = $('#blocked-videos-details');
  const blockedVideosChevron = $('#blocked-videos-chevron');
  const blockedVideosContainer = $('#blocked-videos-container');
  const blockedVideosCount = $('#blocked-videos-count');
  const btnClearBlockedVideos = $('#btn-clear-blocked-videos');
  const blockSearchInput = $('#block-search-input');

  const btnRescan = $('#btn-rescan');
  const tabMainButton = $('#tab-main-button');
  const tabParentalButton = $('#tab-parental-button');
  const tabMainPanel = $('#tab-main-panel');
  const tabParentalPanel = $('#tab-parental-panel');

  const btnLangToggle = $('#btn-lang-toggle');
  const langFlag = $('#lang-flag');
  const langCode = $('#lang-code');

  const checkboxAiEnabled = $('#checkbox-ai-enabled');
  const aiProviderHeader = $('#ai-provider-header');
  const aiProviderDetails = $('#ai-provider-details');
  const aiProviderChevron = $('#ai-provider-chevron');
  const activeProviderBadge = $('#active-provider-badge');

  const geminiForm = $('#gemini-form');
  const openrouterForm = $('#openrouter-form');

  const geminiApiKey = $('#gemini-api-key');
  const btnTestGemini = $('#btn-test-gemini');
  const geminiModel = $('#gemini-model');
  const btnClearGeminiKey = $('#btn-clear-gemini-key');
  const geminiStatusText = $('#gemini-status-text');
  const geminiStatus = $('#gemini-status');

  const openrouterApiKey = $('#openrouter-api-key');
  const btnTestOpenrouter = $('#btn-test-openrouter');
  const openrouterModel = $('#openrouter-model');
  const btnClearOpenrouterKey = $('#btn-clear-openrouter-key');
  const openrouterStatusText = $('#openrouter-status-text');
  const openrouterStatus = $('#openrouter-status');

  const checkboxAiThumbnail = $('#checkbox-ai-thumbnail');
  const aiCacheCount = $('#ai-cache-count');
  const btnClearAiCache = $('#btn-clear-ai-cache');

  // TikTok elements
  const tiktokHeader = $('#tiktok-header');
  const tiktokDetails = $('#tiktok-details');
  const tiktokChevron = $('#tiktok-chevron');
  const checkboxTiktokEnabled = $('#checkbox-tiktok-enabled');
  const checkboxTiktokAllowOnly = $('#checkbox-tiktok-allow-only');
  const tiktokWhitelistInput = $('#tiktok-whitelist-input');
  const btnAddTiktokWhitelist = $('#btn-add-tiktok-whitelist');
  const tiktokWhitelistContainer = $('#tiktok-whitelist-container');
  const tiktokWhitelistCount = $('#tiktok-whitelist-count');
  const tiktokBlacklistInput = $('#tiktok-blacklist-input');
  const btnAddTiktokBlacklist = $('#btn-add-tiktok-blacklist');
  const tiktokBlacklistContainer = $('#tiktok-blacklist-container');
  const tiktokBlacklistCount = $('#tiktok-blacklist-count');

  // ==================== INITIALIZATION ====================

  let settings = await getSettings();
  let blockSearchTerm = '';

  // Update language toggle button state (both header + lock screen)
  function updateLangButton() {
    const lang = I18n.getLanguage();
    const flag = lang === 'vi' ? '\ud83c\uddfb\ud83c\uddf3' : '\ud83c\uddfa\ud83c\uddf8';
    const code = lang === 'vi' ? 'VI' : 'EN';
    if (langFlag) langFlag.textContent = flag;
    if (langCode) langCode.textContent = code;
    const lockFlag = $('#lock-lang-flag');
    const lockCode = $('#lock-lang-code');
    if (lockFlag) lockFlag.textContent = flag;
    if (lockCode) lockCode.textContent = code;
  }
  updateLangButton();

  // Check parental lock
  if (settings.parentalPassword && settings.isLocked) {
    lockScreen.style.display = 'flex';
    mainScreen.style.display = 'none';
    I18n.applyToDOM();
    passwordInput.focus();
  } else {
    lockScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    I18n.applyToDOM();
    await loadUI(settings);
  }

  // ==================== LOCK SCREEN ====================

  btnUnlock.addEventListener('click', async () => {
    const result = await sendMessage({ type: 'VERIFY_PASSWORD', password: passwordInput.value });
    if (result.valid) {
      lockScreen.style.display = 'none';
      mainScreen.style.display = 'block';
      I18n.applyToDOM();
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

  // Lock screen language toggle
  const btnLockLang = $('#btn-lock-lang');
  if (btnLockLang) {
    btnLockLang.addEventListener('click', async () => {
      const current = I18n.getLanguage();
      const next = current === 'vi' ? 'en' : 'vi';
      await I18n.setLanguage(next);
      updateLangButton();
    });
  }

  // ==================== LOAD UI ====================

  function updateAllowOnlyEmptyWarning(s) {
    if (!allowOnlyEmptyWarning || !checkboxAllowOnlyWhitelisted) return;
    const wl = s.whitelistedChannels || [];
    if (checkboxAllowOnlyWhitelisted.checked && wl.length === 0) {
      allowOnlyEmptyWarning.style.display = 'block';
      allowOnlyEmptyWarning.textContent = I18n.t('allowOnlyEmptyWarning');
    } else {
      allowOnlyEmptyWarning.style.display = 'none';
      allowOnlyEmptyWarning.textContent = '';
    }
  }

  async function loadUI(s) {
    // Toggle
    checkboxEnabled.checked = s.enabled;

    // Sensitivity
    const sensRadio = document.querySelector(`input[name="sensitivity"][value="${s.sensitivity}"]`);
    if (sensRadio) sensRadio.checked = true;

    // Detection profile
    const profileRadio = document.querySelector(`input[name="detectionProfile"][value="${s.detectionProfile || 'recall-first'}"]`);
    if (profileRadio) profileRadio.checked = true;

    // AI Provider Setup
    const gemini = s.gemini || {};
    const openrouter = s.openrouter || {};
    const activeProvider = s.activeProvider || 'openrouter';

    // Set Provider Radio
    const providerRadio = document.querySelector(`input[name="activeProvider"][value="${activeProvider}"]`);
    if (providerRadio) providerRadio.checked = true;

    // Toggle Forms Visibility
    geminiForm.style.display = activeProvider === 'gemini' ? 'flex' : 'none';
    openrouterForm.style.display = activeProvider === 'openrouter' ? 'flex' : 'none';

    const activeSettings = activeProvider === 'gemini' ? gemini : openrouter;
    checkboxAiEnabled.checked = Boolean(activeSettings.enabled && activeSettings.hasApiKey);
    activeProviderBadge.textContent = checkboxAiEnabled.checked ? (activeProvider === 'gemini' ? 'Gemini' : 'OpenRouter') : I18n.t('aiProviderOff');
    activeProviderBadge.style.color = checkboxAiEnabled.checked ? 'white' : 'var(--text-muted)';
    activeProviderBadge.style.background = checkboxAiEnabled.checked ? 'var(--accent-indigo)' : 'rgba(99, 102, 241, 0.1)';

    // OpenRouter
    openrouterApiKey.value = '';
    openrouterApiKey.placeholder = openrouter.hasApiKey ? I18n.t('openrouterKeySaved') : I18n.t('openrouterPlaceholder');
    openrouterModel.value = openrouter.model || 'google/gemini-2.0-flash-lite-preview-02-05:free';
    openrouterStatusText.textContent = openrouter.hasApiKey ? I18n.t('statusKeySaved') : I18n.t('statusNotConfigured');
    openrouterStatusText.style.color = openrouter.hasApiKey ? 'var(--accent-green)' : 'var(--text-secondary)';

    // Gemini
    geminiApiKey.value = '';
    geminiApiKey.placeholder = gemini.hasApiKey ? I18n.t('geminiKeySaved') : I18n.t('geminiPlaceholder');
    geminiModel.value = gemini.model || 'gemini-3.1-flash-lite-preview';
    geminiStatusText.textContent = gemini.hasApiKey ? I18n.t('statusKeySaved') : I18n.t('statusNotConfigured');
    geminiStatusText.style.color = gemini.hasApiKey ? 'var(--accent-green)' : 'var(--text-secondary)';

    // Common
    checkboxAiThumbnail.checked = activeProvider === 'gemini' ? Boolean(gemini.includeThumbnail) : Boolean(openrouter.includeThumbnail);

    renderBlockListsWithFilter(s);

    // TikTok
    const tt = s.tiktok || {};
    if (checkboxTiktokEnabled) checkboxTiktokEnabled.checked = Boolean(tt.enabled !== false);
    if (checkboxTiktokAllowOnly) checkboxTiktokAllowOnly.checked = Boolean(tt.allowOnlyWhitelistedChannels);

    // Password badge & clear row
    const hasPassword = Boolean(s.parentalPassword);
    if (passwordSetBadge) passwordSetBadge.style.display = hasPassword ? 'inline-block' : 'none';
    if (clearPasswordRow) clearPasswordRow.style.display = hasPassword ? 'block' : 'none';

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
        aiCacheCount.textContent = formatNumber(stats.geminiCacheSize || 0);
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

  // AI Provider Collapsible
  aiProviderHeader.addEventListener('click', (e) => {
    if (e.target.tagName.toLowerCase() === 'input' || e.target.classList.contains('toggle-slider')) return;
    const isHidden = aiProviderDetails.style.display === 'none';
    aiProviderDetails.style.display = isHidden ? 'block' : 'none';
    aiProviderChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  // Provider Selection
  $$('input[name="activeProvider"]').forEach(radio => {
    radio.addEventListener('change', async () => {
      const activeProvider = radio.value;
      geminiForm.style.display = activeProvider === 'gemini' ? 'flex' : 'none';
      openrouterForm.style.display = activeProvider === 'openrouter' ? 'flex' : 'none';
      await updateSetting({ activeProvider });
      
      settings = await getSettings();
      await loadUI(settings);
    });
  });

  // AI Enabled Toggle
  checkboxAiEnabled.addEventListener('change', async () => {
    settings = await getSettings();
    const activeProvider = settings.activeProvider || 'openrouter';
    const providerSettings = settings[activeProvider] || {};
    const apiKeyInput = activeProvider === 'gemini' ? geminiApiKey : openrouterApiKey;
    const setStatus = activeProvider === 'gemini' ? setGeminiStatus : setOpenrouterStatus;

    if (checkboxAiEnabled.checked && !providerSettings.hasApiKey && !apiKeyInput.value.trim()) {
      checkboxAiEnabled.checked = false;
      setStatus(I18n.t('apiKeyRequired'), 'error');
      return;
    }

    if (checkboxAiEnabled.checked && apiKeyInput.value.trim()) {
      if (activeProvider === 'gemini') await testAndSaveGeminiKey(true);
      else await testAndSaveOpenrouterKey(true);
      return;
    }

    await saveProviderPartial(activeProvider, { enabled: checkboxAiEnabled.checked });
    setStatus(checkboxAiEnabled.checked ? `${activeProvider} API ✓` : `${activeProvider} API ✗`, 'success');
    await loadUI(await getSettings());
  });

  // OpenRouter Events
  btnTestOpenrouter.addEventListener('click', async () => {
    await testAndSaveOpenrouterKey(true);
  });

  openrouterModel.addEventListener('change', async () => {
    await saveProviderPartial('openrouter', { model: openrouterModel.value });
    setOpenrouterStatus('OpenRouter model ✓', 'success');
  });

  btnClearOpenrouterKey.addEventListener('click', async () => {
    btnClearOpenrouterKey.disabled = true;
    await sendMessage({ type: 'CLEAR_OPENROUTER_KEY' });
    openrouterApiKey.value = '';
    
    settings = await getSettings();
    if (settings.activeProvider === 'openrouter') checkboxAiEnabled.checked = false;
    
    await loadUI(settings);
    setOpenrouterStatus('OpenRouter API key ✓ cleared', 'success');
    btnClearOpenrouterKey.disabled = false;
  });

  // Gemini Events
  btnTestGemini.addEventListener('click', async () => {
    await testAndSaveGeminiKey(true);
  });

  geminiModel.addEventListener('change', async () => {
    await saveProviderPartial('gemini', { model: geminiModel.value });
    setGeminiStatus('Gemini model ✓', 'success');
  });

  btnClearGeminiKey.addEventListener('click', async () => {
    btnClearGeminiKey.disabled = true;
    await sendMessage({ type: 'CLEAR_GEMINI_KEY' });
    geminiApiKey.value = '';
    
    settings = await getSettings();
    if (settings.activeProvider === 'gemini') checkboxAiEnabled.checked = false;
    
    await loadUI(settings);
    setGeminiStatus('Gemini API key ✓ cleared', 'success');
    btnClearGeminiKey.disabled = false;
  });

  // Common Events
  checkboxAiThumbnail.addEventListener('change', async () => {
    settings = await getSettings();
    const activeProvider = settings.activeProvider || 'openrouter';
    await saveProviderPartial(activeProvider, {
      includeThumbnail: checkboxAiThumbnail.checked,
      timeoutMs: checkboxAiThumbnail.checked ? (activeProvider === 'gemini' ? 6000 : 8000) : (activeProvider === 'gemini' ? 3500 : 5000)
    });
    const setStatus = activeProvider === 'gemini' ? setGeminiStatus : setOpenrouterStatus;
    setStatus(checkboxAiThumbnail.checked ? I18n.t('thumbnailEnabled') : I18n.t('thumbnailDisabled'), 'success');
  });

  btnClearAiCache.addEventListener('click', async () => {
    btnClearAiCache.disabled = true;
    await sendMessage({ type: 'CLEAR_GEMINI_CACHE' }); // the backend uses this to clear the common AI cache
    await loadStats();
    
    settings = await getSettings();
    const activeProvider = settings.activeProvider || 'openrouter';
    const setStatus = activeProvider === 'gemini' ? setGeminiStatus : setOpenrouterStatus;
    setStatus(I18n.t('cacheClearedMsg'), 'success');
    
    btnClearAiCache.disabled = false;
  });

  // Set password
  btnSetPassword.addEventListener('click', async () => {
    const pwd = newPassword.value.trim();
    if (pwd.length < 4) {
      passwordStatus.textContent = I18n.t('passwordMinLength');
      passwordStatus.style.color = '#ef4444';
      return;
    }
    await updateSetting({ parentalPassword: pwd, isLocked: true });
    newPassword.value = '';
    passwordStatus.textContent = I18n.t('passwordSaved');
    passwordStatus.style.color = '#22c55e';
    if (passwordSetBadge) passwordSetBadge.style.display = 'inline-block';
    if (clearPasswordRow) clearPasswordRow.style.display = 'block';
    setTimeout(() => { passwordStatus.textContent = ''; }, 2000);
  });

  // Clear password
  btnClearPassword.addEventListener('click', async () => {
    const ok = window.confirm(I18n.t('confirmClearPassword'));
    if (!ok) return;
    await updateSetting({ parentalPassword: '', isLocked: false });
    newPassword.value = '';
    passwordStatus.textContent = I18n.t('passwordCleared');
    passwordStatus.style.color = '#94a3b8';
    if (passwordSetBadge) passwordSetBadge.style.display = 'none';
    if (clearPasswordRow) clearPasswordRow.style.display = 'none';
    setTimeout(() => { passwordStatus.textContent = ''; }, 3000);
  });

  // Chế độ chỉ xem kênh trong danh sách + whitelist trong popup
  checkboxAllowOnlyWhitelisted.addEventListener('change', async () => {
    settings = await getSettings();
    const wl = settings.whitelistedChannels || [];
    if (checkboxAllowOnlyWhitelisted.checked && wl.length === 0) {
      const ok = window.confirm(I18n.t('confirmAllowOnlyEmpty'));
      if (!ok) {
        checkboxAllowOnlyWhitelisted.checked = false;
        return;
      }
    }
    await updateSetting({ allowOnlyWhitelistedChannels: checkboxAllowOnlyWhitelisted.checked });
    settings = await getSettings();
    updateAllowOnlyEmptyWarning(settings);
  });

  btnAddWhitelist.addEventListener('click', addWhitelistChannel);
  whitelistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWhitelistChannel();
  });

  // Blacklist
  btnAddBlacklist.addEventListener('click', addBlacklistChannel);
  blacklistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBlacklistChannel();
  });

  // Rescan
  btnRescan.addEventListener('click', async () => {
    btnRescan.textContent = I18n.t('btnScanning');
    btnRescan.disabled = true;
    await sendMessage({ type: 'RESCAN_ALL' });
    setTimeout(async () => {
      await loadStats();
      btnRescan.textContent = I18n.t('btnRescan');
      btnRescan.disabled = false;
    }, 1500);
  });

  // Blocked videos collapsible
  blockedVideosHeader.addEventListener('click', () => {
    const isHidden = blockedVideosDetails.style.display === 'none';
    blockedVideosDetails.style.display = isHidden ? 'block' : 'none';
    blockedVideosChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  // Clear all blocked videos
  btnClearBlockedVideos.addEventListener('click', async () => {
    btnClearBlockedVideos.disabled = true;
    await updateSetting({ blockedVideos: [] });
    settings = await getSettings();
    renderBlockListsWithFilter(settings);
    btnClearBlockedVideos.style.display = 'none';
    btnClearBlockedVideos.disabled = false;
  });

  blockSearchInput.addEventListener('input', async () => {
    blockSearchTerm = blockSearchInput.value.trim();
    settings = await getSettings();
    renderBlockListsWithFilter(settings);
  });

  // TikTok section collapsible
  if (tiktokHeader) {
    tiktokHeader.addEventListener('click', (e) => {
      if (e.target.closest('.toggle-switch')) return;
      const isHidden = tiktokDetails.style.display === 'none';
      tiktokDetails.style.display = isHidden ? 'block' : 'none';
      tiktokChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }

  // TikTok enabled toggle
  if (checkboxTiktokEnabled) {
    checkboxTiktokEnabled.addEventListener('change', async () => {
      await updateSetting({ tiktok: { enabled: checkboxTiktokEnabled.checked } });
    });
  }

  // TikTok allow only whitelisted
  if (checkboxTiktokAllowOnly) {
    checkboxTiktokAllowOnly.addEventListener('change', async () => {
      await updateSetting({ tiktok: { allowOnlyWhitelistedChannels: checkboxTiktokAllowOnly.checked } });
    });
  }

  // TikTok whitelist add
  if (btnAddTiktokWhitelist) {
    btnAddTiktokWhitelist.addEventListener('click', addTiktokWhitelist);
    tiktokWhitelistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTiktokWhitelist();
    });
  }

  // TikTok blacklist add
  if (btnAddTiktokBlacklist) {
    btnAddTiktokBlacklist.addEventListener('click', addTiktokBlacklist);
    tiktokBlacklistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addTiktokBlacklist();
    });
  }

  // Tabs
  function activateTab(tabName) {
    const showMain = tabName === 'main';
    tabMainButton.classList.toggle('active', showMain);
    tabMainButton.setAttribute('aria-selected', showMain ? 'true' : 'false');
    tabMainPanel.classList.toggle('active', showMain);

    tabParentalButton.classList.toggle('active', !showMain);
    tabParentalButton.setAttribute('aria-selected', !showMain ? 'true' : 'false');
    tabParentalPanel.classList.toggle('active', !showMain);
  }

  tabMainButton.addEventListener('click', () => activateTab('main'));
  tabParentalButton.addEventListener('click', () => activateTab('parental'));

  // Language toggle
  if (btnLangToggle) {
    btnLangToggle.addEventListener('click', async () => {
      const current = I18n.getLanguage();
      const next = current === 'vi' ? 'en' : 'vi';
      await I18n.setLanguage(next);
      updateLangButton();
      // Re-load dynamic UI content that uses I18n.t() in JS
      settings = await getSettings();
      await loadUI(settings);
    });
  }

  // ==================== CHANNEL MANAGEMENT ====================

  async function addBlacklistChannel() {
    const name = blacklistInput.value.trim();
    if (!name) return;

    settings = await getSettings();
    const blacklistedChannels = settings.blacklistedChannels || [];

    if (!blacklistedChannels.includes(name)) {
      blacklistedChannels.push(name);
      await updateSetting({ blacklistedChannels });
    }

    blacklistInput.value = '';

    settings = await getSettings();
    renderBlockListsWithFilter(settings);
  }

  async function addWhitelistChannel() {
    const name = whitelistInput.value.trim();
    if (!name) return;

    settings = await getSettings();
    const whitelistedChannels = settings.whitelistedChannels || [];

    if (!whitelistedChannels.includes(name)) {
      whitelistedChannels.push(name);
      await updateSetting({ whitelistedChannels });
    }

    whitelistInput.value = '';

    settings = await getSettings();
    updateAllowOnlyEmptyWarning(settings);
    renderBlockListsWithFilter(settings);
  }

  async function removeChannel(name, listType) {
    settings = await getSettings();
    if (listType === 'blacklist') {
      const blacklistedChannels = (settings.blacklistedChannels || []).filter(c => c !== name);
      await updateSetting({ blacklistedChannels });
    } else if (listType === 'whitelist') {
      const whitelistedChannels = (settings.whitelistedChannels || []).filter(c => c !== name);
      await updateSetting({ whitelistedChannels });
    } else {
      return;
    }
    settings = await getSettings();
    updateAllowOnlyEmptyWarning(settings);
    renderBlockListsWithFilter(settings);
  }

  // ==================== TIKTOK CHANNEL MANAGEMENT ====================

  async function addTiktokWhitelist() {
    const raw = (tiktokWhitelistInput?.value || '').trim();
    if (!raw) return;
    await sendMessage({ type: 'TIKTOK_WHITELIST_CHANNEL', username: raw });
    tiktokWhitelistInput.value = '';
    settings = await getSettings();
    renderBlockListsWithFilter(settings);
  }

  async function addTiktokBlacklist() {
    const raw = (tiktokBlacklistInput?.value || '').trim();
    if (!raw) return;
    await sendMessage({ type: 'TIKTOK_BLOCK_CHANNEL', username: raw });
    tiktokBlacklistInput.value = '';
    settings = await getSettings();
    renderBlockListsWithFilter(settings);
  }

  async function removeTiktokChannel(username, listType) {
    const msgType = listType === 'whitelist' ? 'TIKTOK_UNWHITELIST_CHANNEL' : 'TIKTOK_UNBLOCK_CHANNEL';
    await sendMessage({ type: msgType, username });
    settings = await getSettings();
    renderBlockListsWithFilter(settings);
  }

  function renderTiktokChannelList(container, channels, listType) {
    if (!container) return;
    container.innerHTML = '';
    if (!channels.length) {
      container.innerHTML = `<p style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 6px 0;">Chưa có kênh nào</p>`;
      return;
    }
    channels.forEach(name => {
      const tag = document.createElement('div');
      tag.className = listType === 'whitelist' ? 'channel-tag channel-tag-allow' : 'channel-tag';
      tag.innerHTML = `
        <span>@${escapeHtml(name)}</span>
        <span class="channel-tag-remove">×</span>
      `;
      tag.querySelector('.channel-tag-remove').addEventListener('click', () => {
        removeTiktokChannel(name, listType);
      });
      container.appendChild(tag);
    });
  }

  function renderChannelList(container, channels, listType) {
    container.innerHTML = '';
    if (!channels.length) {
      const emptyBlacklist = blockSearchTerm ? I18n.t('noSearchMatch') : I18n.t('blacklistEmpty');
      const emptyWhitelist = blockSearchTerm ? I18n.t('noSearchMatch') : I18n.t('whitelistEmpty');
      const emptyMsg = listType === 'whitelist' ? emptyWhitelist : emptyBlacklist;
      container.innerHTML = `<p style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 8px 0;">${emptyMsg}</p>`;
      return;
    }
    channels.forEach(name => {
      const tag = document.createElement('div');
      tag.className = listType === 'whitelist' ? 'channel-tag channel-tag-allow' : 'channel-tag';
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

  function renderBlockedVideosList(blockedVideos) {
    blockedVideosContainer.innerHTML = '';
    if (!blockedVideos.length) {
      blockedVideosContainer.innerHTML = `<p style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 8px 0;">${blockSearchTerm ? I18n.t('noVideoSearchMatch') : I18n.t('blockedVideosEmpty')}</p>`;
      return;
    }
    blockedVideos.forEach(video => {
      const tag = document.createElement('div');
      tag.className = 'channel-tag blocked-video-tag';
      const title = video.title || video.videoId;
      const channel = video.channel ? ` · ${escapeHtml(video.channel)}` : '';
      const date = video.blockedAt ? new Date(video.blockedAt).toLocaleDateString('vi-VN') : '';
      tag.innerHTML = `
        <div class="blocked-video-info">
          <span class="blocked-video-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          <span class="blocked-video-meta">${escapeHtml(video.videoId)}${channel}${date ? ' · ' + date : ''}</span>
        </div>
        <span class="channel-tag-remove" title="Bỏ chặn">×</span>
      `;
      tag.querySelector('.channel-tag-remove').addEventListener('click', async () => {
        await sendMessage({ type: 'UNBLOCK_VIDEO', videoId: video.videoId });
        settings = await getSettings();
        renderBlockListsWithFilter(settings);
      });
      blockedVideosContainer.appendChild(tag);
    });
  }

  function renderBlockListsWithFilter(s) {
    const whitelistedChannels = s.whitelistedChannels || [];
    const blacklistedChannels = s.blacklistedChannels || [];
    const blockedVideos = s.blockedVideos || [];
    const normalizedSearch = normalizeForSearch(blockSearchTerm);

    const filteredWhitelistedChannels = whitelistedChannels.filter((name) =>
      matchBySearch(name, normalizedSearch)
    );

    const filteredBlacklistedChannels = blacklistedChannels.filter((name) => {
      return matchBySearch(name, normalizedSearch);
    });

    const filteredBlockedVideos = blockedVideos.filter((video) => {
      const searchableText = `${video.title || ''} ${video.channel || ''} ${video.videoId || ''}`;
      return matchBySearch(searchableText, normalizedSearch);
    });

    renderChannelList(whitelistContainer, filteredWhitelistedChannels, 'whitelist');
    renderChannelList(blacklistContainer, filteredBlacklistedChannels, 'blacklist');
    renderBlockedVideosList(filteredBlockedVideos);

    whitelistCount.textContent = getCountLabel(filteredWhitelistedChannels.length, whitelistedChannels.length, normalizedSearch);
    blacklistCount.textContent = getCountLabel(filteredBlacklistedChannels.length, blacklistedChannels.length, normalizedSearch);
    blockedVideosCount.textContent = getCountLabel(filteredBlockedVideos.length, blockedVideos.length, normalizedSearch);
    btnClearBlockedVideos.style.display = blockedVideos.length > 0 ? 'block' : 'none';
    updateAllowOnlyEmptyWarning(s);
    if (checkboxAllowOnlyWhitelisted) {
      checkboxAllowOnlyWhitelisted.checked = Boolean(s.allowOnlyWhitelistedChannels);
    }

    // TikTok lists
    const tt = s.tiktok || {};
    const ttWhitelist = tt.whitelistedChannels || [];
    const ttBlacklist = tt.blacklistedChannels || [];
    renderTiktokChannelList(tiktokWhitelistContainer, ttWhitelist, 'whitelist');
    renderTiktokChannelList(tiktokBlacklistContainer, ttBlacklist, 'blacklist');
    if (tiktokWhitelistCount) tiktokWhitelistCount.textContent = String(ttWhitelist.length);
    if (tiktokBlacklistCount) tiktokBlacklistCount.textContent = String(ttBlacklist.length);
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

  async function saveProviderPartial(provider, partial) {
    settings = await getSettings();
    const current = settings[provider] || {};
    const next = {
      ...current,
      ...partial
    };
    return await updateSetting({ [provider]: next });
  }

  async function testAndSaveGeminiKey(enableAfterSuccess = false) {
    const apiKey = geminiApiKey.value.trim();
    settings = await getSettings();
    const hasSavedKey = Boolean(settings.gemini?.hasApiKey);

    if (!apiKey && !hasSavedKey) {
      setGeminiStatus(I18n.t('apiKeyNoKey'), 'error');
      if (settings.activeProvider === 'gemini') checkboxAiEnabled.checked = false;
      return;
    }

    btnTestGemini.disabled = true;
    btnTestGemini.textContent = I18n.t('btnTesting');
    setGeminiStatus(I18n.t('apiKeyChecking'), 'neutral');

    const result = apiKey
      ? await sendMessage({
        type: 'SAVE_GEMINI_KEY',
        apiKey,
        model: geminiModel.value,
        enabled: enableAfterSuccess || (settings.activeProvider === 'gemini' ? checkboxAiEnabled.checked : settings.gemini.enabled),
        includeThumbnail: checkboxAiThumbnail.checked
      })
      : await sendMessage({
        type: 'TEST_GEMINI_KEY',
        model: geminiModel.value
      });

    btnTestGemini.disabled = false;
    btnTestGemini.textContent = I18n.t('btnTest');

    if (!result?.ok) {
      if (settings.activeProvider === 'gemini') checkboxAiEnabled.checked = false;
      setGeminiStatus(getApiErrorText(result, 'Gemini'), 'error');
      return;
    }

    if (!apiKey) {
      await saveProviderPartial('gemini', {
        enabled: enableAfterSuccess || (settings.activeProvider === 'gemini' ? checkboxAiEnabled.checked : settings.gemini.enabled),
        model: geminiModel.value,
        includeThumbnail: checkboxAiThumbnail.checked,
        timeoutMs: checkboxAiThumbnail.checked ? 6000 : 3500
      });
    } else {
      await sendMessage({ type: 'RESCAN_ALL' });
    }
    
    settings = await getSettings();
    await loadUI(settings);
    setGeminiStatus(I18n.t('apiKeyValid'), 'success');
  }

  async function testAndSaveOpenrouterKey(enableAfterSuccess = false) {
    const apiKey = openrouterApiKey.value.trim();
    settings = await getSettings();
    const hasSavedKey = Boolean(settings.openrouter?.hasApiKey);

    if (!apiKey && !hasSavedKey) {
      setOpenrouterStatus(I18n.t('apiKeyNoKey'), 'error');
      if (settings.activeProvider === 'openrouter') checkboxAiEnabled.checked = false;
      return;
    }

    btnTestOpenrouter.disabled = true;
    btnTestOpenrouter.textContent = I18n.t('btnTesting');
    setOpenrouterStatus(I18n.t('apiKeyChecking'), 'neutral');

    const result = apiKey
      ? await sendMessage({
        type: 'SAVE_OPENROUTER_KEY',
        apiKey,
        model: openrouterModel.value,
        enabled: enableAfterSuccess || (settings.activeProvider === 'openrouter' ? checkboxAiEnabled.checked : settings.openrouter.enabled)
      })
      : await sendMessage({
        type: 'TEST_OPENROUTER_KEY',
        model: openrouterModel.value
      });

    btnTestOpenrouter.disabled = false;
    btnTestOpenrouter.textContent = I18n.t('btnTest');

    if (!result?.ok) {
      if (settings.activeProvider === 'openrouter') checkboxAiEnabled.checked = false;
      setOpenrouterStatus(getApiErrorText(result, 'OpenRouter'), 'error');
      return;
    }

    if (!apiKey) {
      await saveProviderPartial('openrouter', {
        enabled: enableAfterSuccess || (settings.activeProvider === 'openrouter' ? checkboxAiEnabled.checked : settings.openrouter.enabled),
        model: openrouterModel.value
      });
    } else {
      await sendMessage({ type: 'RESCAN_ALL' });
    }
    
    settings = await getSettings();
    await loadUI(settings);
    setOpenrouterStatus(I18n.t('apiKeyValid'), 'success');
  }

  function setGeminiStatus(text, tone = 'neutral') {
    geminiStatus.textContent = text || '';
    const colors = { success: '#22c55e', error: '#ef4444', neutral: '#94a3b8' };
    geminiStatus.style.color = colors[tone] || colors.neutral;
  }
  
  function setOpenrouterStatus(text, tone = 'neutral') {
    openrouterStatus.textContent = text || '';
    const colors = { success: '#22c55e', error: '#ef4444', neutral: '#94a3b8' };
    openrouterStatus.style.color = colors[tone] || colors.neutral;
  }

  function getApiErrorText(result = {}, provider = 'API') {
    const labels = {
      missing_api_key: I18n.t('errMissingApiKey'),
      invalid_api_key: I18n.t('errInvalidApiKey'),
      model_unavailable: I18n.t('errModelUnavailable'),
      rate_limited: I18n.t('errRateLimited'),
      service_unavailable: `${provider} — service unavailable`,
      timeout: I18n.t('errTimeout'),
      request_failed: `${provider} — request failed`
    };
    return labels[result.reason] || `${I18n.t('errGeneric')}${result.status ? ` (${result.status})` : ''}`;
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

  function normalizeForSearch(text) {
    return (text || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function matchBySearch(text, normalizedSearch) {
    if (!normalizedSearch) return true;
    return normalizeForSearch(text).includes(normalizedSearch);
  }

  function getCountLabel(filteredCount, totalCount, normalizedSearch) {
    if (!normalizedSearch || filteredCount === totalCount) return String(totalCount);
    return `${filteredCount}/${totalCount}`;
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
      label: I18n.t('methodLabel'),
      keyword: I18n.t('methodKeyword'),
      pattern: 'Pattern',
      channel: 'Channel',
      manual: I18n.t('methodManual'),
      disclosure: 'Disclosure',
      childRisk: I18n.t('methodChildRisk'),
      gemini: 'Gemini API',
      openrouter: 'OpenRouter API',
      combination: I18n.t('methodCombination')
    };
    return labels[key] || key;
  }
});
