// Application State
let promptQueue = [];
let queueStatus = "idle"; // "idle", "running", "paused"
let lastConnectionState = null; // null, 'online', 'busy', 'offline'
let renderedFilenames = new Set(); // Track images already shown in gallery
let statusInterval = null;
let pollQueueInterval = null;
let activeLightboxItem = null; // Track currently open image in lightbox
let queueTimerInterval = null;
let galleryFilter = 'all'; // 'all' | 'liked' | 'disliked' | 'hide-disliked'

// Translations Dictionary and State
const TRANSLATIONS = {
    en: {
        title: "Z-Image-Turbo Workspace",
        navTitle: "Z-Image-Turbo",
        statusConnecting: "Connecting...",
        statusReady: "Server: Connected (Ready)",
        statusGenerating: "Server: Generating...",
        statusError: "Server: Error Response",
        statusOffline: "Server: Offline",
        promptInputsTitle: "Prompt Inputs",
        bulkMode: "Bulk Mode",
        promptsLabel: "Prompts (One prompt per line)",
        promptsPlaceholder: "Beijing Temple of Heaven, cute 3D cartoon style...\nShanghai Oriental Pearl Tower, cute 3D chibi style...\nTokyo Tower, pop mart style resin refrigerator magnet...",
        genSettingsTitle: "Generation Settings",
        resolutionLabel: "Resolution",
        resolutionOptionSquare: "1024 × 1024 (Square)",
        resolutionOptionPortrait: "768 × 1024 (Portrait)",
        resolutionOptionLandscape: "1024 × 768 (Landscape)",
        resolutionOptionFast: "512 × 512 (Fast draft)",
        stepsLabel: "Inference Steps",
        guidanceLabel: "Guidance Scale",
        seedLabel: "Seed (-1 for random)",
        addToQueue: "Add to Queue",
        clearInput: "Clear Input",
        genQueueTitle: "Generation Queue",
        queueCountBadge: "{count} Active",
        queueStatusIdle: "Idle",
        queueStatusRunning: "Running",
        queueStatusPaused: "Paused",
        colNum: "#",
        colPrompt: "Prompt",
        colStatus: "Status",
        colTime: "Time",
        emptyQueue: "Queue is empty. Add prompts on the left to start generating!",
        sysLogsTitle: "System Logs",
        clearLogsTitle: "Clear Logs",
        clearGalleryBtn: "Clear Gallery",
        genGalleryTitle: "Generated Gallery",
        openFolderBtn: "Open Folder",
        downloadAllBtn: "Download All",
        lightboxTitle: "Metadata",
        metaPrompt: "Prompt:",
        metaResolution: "Resolution:",
        metaSteps: "Steps:",
        metaSeed: "Seed:",
        metaTime: "Time taken:",
        downloadOriginal: "Download Original",
        regenerateBtn: "Regenerate",
        totalProgress: "Total Progress",
        promptHistory: "Prompt History",
        historyEmpty: "No prompt history yet.",
        clearHistoryTitle: "Clear Prompt History",
        
        // Parameter descriptions
        descResolution: "Optimized for 1024x1024. Smaller sizes generate faster but might lower quality.",
        descSteps: "Turbo model only needs 9 steps. Higher values won't improve quality and waste time.",
        descGuidance: "Must be 0.0. Higher values will corrupt the image (turn it completely black).",
        descSeed: "Use -1 for new random images. Set a fixed number to keep the same composition.",
        
        // Logs and alerts
        logInitialized: "System initialized. Syncing state with backend...",
        logPromptCleared: "Prompt input cleared.",
        logGalleryCleared: "Gallery cleared.",
        logLogsCleared: "System logs cleared.",
        logServerReady: "Successfully connected to Z-Image-Turbo backend.",
        logServerIdle: "Server status: Connected (Idle)",
        logServerBusy: "Server status: Busy (GPU active)",
        logServerErr: "Server status: Error response from endpoint",
        logServerOffline: "Server status: Offline. Cannot reach backend. Please verify server.py is running.",
        logQueueResumed: "Queue processing resumed/started on backend.",
        logQueuePaused: "Queue processing paused on backend.",
        logQueueIdle: "Queue completed. Idle state.",
        logAddedToQueue: "Added {count} prompt(s) to backend queue.",
        logFailedQueue: "Failed to add prompts to backend queue.",
        logErrAddQueue: "Server returned error {status} when adding prompts.",
        logNetworkErr: "Network error adding to queue: {err}",
        logPauseReq: "Requesting queue pause...",
        logPauseErr: "Error pausing queue: {err}",
        logResumeReq: "Requesting queue resume...",
        logResumeErr: "Error resuming queue: {err}",
        logStopReq: "Requesting active generation termination & pause...",
        logStopSuccess: "Generation stopped. Active task reset to pending.",
        logStopErr: "Error stopping task: {err}",
        logWipeReq: "Requesting queue wipe...",
        logWipeSuccess: "Queue history and gallery reset successfully.",
        logWipeErr: "Error wiping queue: {err}",
        confirmClearQueue: "Are you sure you want to clear the entire queue history? This will stop active runs.",
        confirmClearGallery: "Are you sure you want to clear the gallery?",
        promptAlert: "Please enter at least one prompt!",
        noValidPrompts: "No valid prompts found!",
        toastRegenAdded: "Task successfully added to front of queue!",
        toastAddedToQueue: "Successfully added {count} task(s) to queue!",
        toastPaused: "Queue paused.",
        toastResumed: "Queue resumed.",
        toastStopped: "Active generation stopped.",
        toastQueueCleared: "Queue cleared.",
        toastError: "An error occurred: {err}",
        prefixLabel: "Prompt Prefix",
        suffixLabel: "Prompt Suffix",
        
        // Tooltips
        titlePause: "Pause Queue",
        titleResume: "Resume Queue",
        titleStop: "Abort Active Task & Pause",
        titleClearQueue: "Clear Entire Queue History",
        
        // Task row management
        btnDelete: "Remove task",
        btnSkip: "Skip task",
        btnMoveTop: "Move to front",
        toastDeleted: "Task removed from queue.",
        toastSkipped: "Task skipped.",
        toastMovedTop: "Task moved to front of queue.",
        statusSkipped: "Skipped",

        // Rating & Filter
        filterLabel: "Filter",
        filterAll: "All",
        filterLiked: "Liked",
        filterDisliked: "Disliked",
        filterHideDisliked: "Hide Disliked",

        // Restart
        restartServer: "Restart",
        titleRestartServer: "Restart Server",
        statusRestarting: "Restarting...",
        confirmRestart: "Restart the server? Ongoing generation will be interrupted.",
        toastRestarting: "Server is restarting, please wait...",
        toastRestartDone: "Server restarted successfully!",

        // Stop
        stopServer: "Stop",
        titleStopServer: "Stop Server",
        statusStopping: "Stopping...",
        confirmStop: "Stop the server? The application will close and you will need to start it manually.",
        toastStopping: "Server is shutting down...",
        toastStopped: "Server has stopped.",
    },
    zh: {
        title: "Z-Image-Turbo 工作区",
        navTitle: "Z-Image-Turbo",
        statusConnecting: "正在连接...",
        statusReady: "服务器: 已连接 (空闲)",
        statusGenerating: "服务器: 正在作图...",
        statusError: "服务器: 响应错误",
        statusOffline: "服务器: 离线",
        promptInputsTitle: "提示词输入",
        bulkMode: "批量模式",
        promptsLabel: "提示词 (每行一个)",
        promptsPlaceholder: "天坛，可爱的3D卡通风格...\n上海东方明珠，可爱的3D Q版风格...\n东京铁塔，泡泡玛特风格树脂冰箱贴...",
        genSettingsTitle: "生成参数设置",
        resolutionLabel: "分辨率",
        resolutionOptionSquare: "1024 × 1024 (正方形)",
        resolutionOptionPortrait: "768 × 1024 (竖图)",
        resolutionOptionLandscape: "1024 × 768 (横图)",
        resolutionOptionFast: "512 × 512 (快速草稿)",
        stepsLabel: "推理步数",
        guidanceLabel: "提示词相关度 (CFG)",
        seedLabel: "随机种子 (-1为随机)",
        addToQueue: "加入生成队列",
        clearInput: "清空输入",
        genQueueTitle: "生成队列",
        queueCountBadge: "{count} 个活动任务",
        queueStatusIdle: "空闲",
        queueStatusRunning: "运行中",
        queueStatusPaused: "已暂停",
        colNum: "#",
        colPrompt: "提示词",
        colStatus: "状态",
        colTime: "耗时",
        emptyQueue: "队列为空。在左侧输入提示词以开始生成！",
        sysLogsTitle: "系统日志",
        clearLogsTitle: "清空日志",
        clearGalleryBtn: "清空画廊",
        genGalleryTitle: "已生成画廊",
        openFolderBtn: "打开本地目录",
        downloadAllBtn: "下载全部图片",
        lightboxTitle: "元数据",
        metaPrompt: "提示词:",
        metaResolution: "分辨率:",
        metaSteps: "步数:",
        metaSeed: "种子:",
        metaTime: "生成耗时:",
        downloadOriginal: "下载原图",
        regenerateBtn: "重新生成",
        totalProgress: "总进度",
        promptHistory: "历史记录",
        historyEmpty: "暂无历史记录。",
        clearHistoryTitle: "清空历史记录",
        
        // Parameter descriptions
        descResolution: "模型最擅长 1024x1024。尺寸越小画图越快，但画质可能会降低。",
        descSteps: "快速蒸馏模型，推荐 9 步。步数再高也不会变好看，纯属浪费时间。",
        descGuidance: "必须设为 0.0。设大了解析会报错或直接画出一张大黑图。",
        descSeed: "设为 -1 每次都是全新画面。固定一个数字可以保持画面布局不变，方便微调词。",
        
        // Logs and alerts
        logInitialized: "系统初始化完成。正在同步后端状态...",
        logPromptCleared: "提示词输入已清空。",
        logGalleryCleared: "画廊已清空。",
        logLogsCleared: "系统日志已清空。",
        logServerReady: "成功连接到 Z-Image-Turbo 后端。",
        logServerIdle: "服务器状态：已连接 (空闲)",
        logServerBusy: "服务器状态：繁忙 (GPU 活动中)",
        logServerErr: "服务器状态：接口返回错误",
        logServerOffline: "服务器状态：离线。无法连接到后端。请检查 server.py 是否正常运行。",
        logQueueResumed: "后端队列处理已恢复/开始。",
        logQueuePaused: "后端队列处理已暂停。",
        logQueueIdle: "队列任务已全部完成，处于空闲状态。",
        logAddedToQueue: "已将 {count} 个提示词添加到后端队列。",
        logFailedQueue: "添加提示词到队列失败。",
        logErrAddQueue: "添加提示词时服务器返回错误 {status}。",
        logNetworkErr: "添加队列时发生网络错误: {err}",
        logPauseReq: "正在请求暂停队列...",
        logPauseErr: "暂停队列时出错: {err}",
        logResumeReq: "正在请求恢复队列...",
        logResumeErr: "恢复队列时出错: {err}",
        logStopReq: "正在请求终止当前生成任务并暂停队列...",
        logStopSuccess: "生成已终止。当前任务已重置为等待状态。",
        logStopErr: "终止任务时出错: {err}",
        logWipeReq: "正在请求清空队列...",
        logWipeSuccess: "队列历史和画廊已成功重置。",
        logWipeErr: "清空队列时出错: {err}",
        confirmClearQueue: "确定要清空所有队列历史吗？这会终止当前正在运行的任务。",
        confirmClearGallery: "确定要清空画廊吗？",
        promptAlert: "请输入至少一个提示词！",
        noValidPrompts: "未找到有效的提示词！",
        toastRegenAdded: "重新生成任务已成功插队到最前面！",
        toastAddedToQueue: "成功添加 {count} 个任务到队列！",
        toastPaused: "队列已暂停。",
        toastResumed: "队列已恢复。",
        toastStopped: "已停止当前生成。",
        toastQueueCleared: "队列已清空。",
        toastError: "发生错误: {err}",
        prefixLabel: "提示词前缀",
        suffixLabel: "提示词后缀",
        
        // Tooltips
        titlePause: "暂停队列",
        titleResume: "恢复队列",
        titleStop: "终止当前任务并暂停",
        titleClearQueue: "清空整个队列历史",
        
        // Task row management
        btnDelete: "删除任务",
        btnSkip: "跳过任务",
        btnMoveTop: "置顶任务",
        toastDeleted: "任务已从队列中移除。",
        toastSkipped: "任务已跳过。",
        toastMovedTop: "任务已移到队列最前面。",
        statusSkipped: "已跳过",

        // Rating & Filter
        filterLabel: "过滤",
        filterAll: "全部",
        filterLiked: "点赞的",
        filterDisliked: "点踩的",
        filterHideDisliked: "隐藏点踩",

        // Restart
        restartServer: "重启",
        titleRestartServer: "重启服务",
        statusRestarting: "重启中...",
        confirmRestart: "确定重启服务吗？正在进行的生成任务将中断。",
        toastRestarting: "服务正在重启，请稍候...",
        toastRestartDone: "服务已成功重启！",

        // Stop
        stopServer: "停止",
        titleStopServer: "停止服务",
        statusStopping: "停止中...",
        confirmStop: "确定停止服务吗？服务停止后将无法在网页上重新启动，需要手动运行脚本启动。",
        toastStopping: "服务正在关闭...",
        toastStopped: "服务已停止。",
    }
};

let currentLang = localStorage.getItem('preferredLang') || 'zh';

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const promptTextArea = document.getElementById('promptTextArea');
const promptPrefixInput = document.getElementById('promptPrefixInput');
const promptSuffixInput = document.getElementById('promptSuffixInput');
const resolutionSelect = document.getElementById('resolutionSelect');
const stepsInput = document.getElementById('stepsInput');
const guidanceInput = document.getElementById('guidanceInput');
const seedInput = document.getElementById('seedInput');
const addToQueueBtn = document.getElementById('addToQueueBtn');
const clearInputsBtn = document.getElementById('clearInputsBtn');
const queueCountBadge = document.getElementById('queueCountBadge');
const queueList = document.getElementById('queueList');
const galleryGrid = document.getElementById('galleryGrid');
const clearGalleryBtn = document.getElementById('clearGalleryBtn');
const logWindow = document.getElementById('logWindow');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const logsDrawer = document.getElementById('logsDrawer');
const drawerHeader = document.getElementById('drawerHeader');

// New Queue Controls
const queueStatusBadge = document.getElementById('queueStatusBadge');
const pauseQueueBtn = document.getElementById('pauseQueueBtn');
const resumeQueueBtn = document.getElementById('resumeQueueBtn');
const stopQueueBtn = document.getElementById('stopQueueBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');

// Lightbox Elements
const lightboxOverlay = document.getElementById('lightboxOverlay');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const metaPrompt = document.getElementById('metaPrompt');
const metaResolution = document.getElementById('metaResolution');
const metaSteps = document.getElementById('metaSteps');
const metaSeed = document.getElementById('metaSeed');
const metaTime = document.getElementById('metaTime');
const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
    updateHistoryUI();
    setupEventListeners();
    addLog(TRANSLATIONS[currentLang].logInitialized, 'system');
    
    // Restore timer state on load
    const savedStartTime = localStorage.getItem('queueStartTime');
    const savedAccum = localStorage.getItem('queueAccumulatedTime');
    const timerEl = document.getElementById('queueTotalTimer');
    
    if (savedStartTime || savedAccum) {
        if (timerEl) timerEl.style.display = 'inline-block';
        let elapsedMs = parseInt(savedAccum || '0');
        if (savedStartTime) {
            elapsedMs += (Date.now() - parseInt(savedStartTime));
        }
        updateTimerUI(elapsedMs);
    }
    
    // Initial sync
    pollServerStatus();
    syncQueueState();
    
    // Set up polling intervals
    statusInterval = setInterval(pollServerStatus, 5000);
    pollQueueInterval = setInterval(syncQueueState, 1000); // Poll queue every 1s for fast UI updates
});

// Set active language
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('preferredLang', lang);
    
    // Update document title
    document.title = TRANSLATIONS[lang].title;
    
    // Translate standard textContent elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (TRANSLATIONS[lang][key]) {
            el.textContent = TRANSLATIONS[lang][key];
        }
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (TRANSLATIONS[lang][key]) {
            el.placeholder = TRANSLATIONS[lang][key];
        }
    });

    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (TRANSLATIONS[lang][key]) {
            el.title = TRANSLATIONS[lang][key];
        }
    });
    
    // Toggle selector button label
    const langToggleBtn = document.getElementById('langToggleBtn');
    if (langToggleBtn) {
        langToggleBtn.textContent = lang === 'en' ? '中' : 'EN';
    }
    
    // Set prompt placeholder
    if (promptTextArea) {
        promptTextArea.placeholder = TRANSLATIONS[lang].promptsPlaceholder;
    }
    
    // Redraw queue to localize statuses
    updateQueueUI();
    updateHistoryUI();
}

// Logging Helper
function addLog(message, type = 'system') {
    if (!logWindow) return;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">[${timeStr}]</span>${escapeHtml(message)}`;
    logWindow.appendChild(entry);
    
    // Auto Scroll to bottom
    logWindow.scrollTop = logWindow.scrollHeight;
}

// Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
    } else if (type === 'error') {
        iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
        `;
    } else {
        iconSvg = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
        `;
    }
    
    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Total Queue Timer Controls
function tickTimer() {
    const startTime = parseInt(localStorage.getItem('queueStartTime') || '0');
    const accum = parseInt(localStorage.getItem('queueAccumulatedTime') || '0');
    if (startTime === 0) return;
    
    const elapsedMs = accum + (Date.now() - startTime);
    updateTimerUI(elapsedMs);
}

function updateTimerUI(elapsedMs) {
    const timerEl = document.getElementById('queueTotalTimer');
    if (!timerEl) return;
    
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (num) => String(num).padStart(2, '0');
    timerEl.textContent = `⏱️ ${pad(minutes)}:${pad(seconds)}`;
    timerEl.style.display = 'inline-block';
}

function resetTotalTimer() {
    if (queueTimerInterval) {
        clearInterval(queueTimerInterval);
        queueTimerInterval = null;
    }
    localStorage.removeItem('queueStartTime');
    localStorage.removeItem('queueAccumulatedTime');
    const timerEl = document.getElementById('queueTotalTimer');
    if (timerEl) {
        timerEl.textContent = '⏱️ 00:00';
        timerEl.style.display = 'none';
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Language Selector Toggle
    const langToggleBtn = document.getElementById('langToggleBtn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            const nextLang = currentLang === 'en' ? 'zh' : 'en';
            setLanguage(nextLang);
        });
    }

    // Restart Server Button
    const restartServerBtn = document.getElementById('restartServerBtn');
    if (restartServerBtn) {
        restartServerBtn.addEventListener('click', handleRestartServer);
    }

    // Stop Server Button
    const stopServerBtn = document.getElementById('stopServerBtn');
    if (stopServerBtn) {
        stopServerBtn.addEventListener('click', handleStopServer);
    }

    // Gallery Local Actions
    const openFolderBtn = document.getElementById('openFolderBtn');
    if (openFolderBtn) {
        openFolderBtn.addEventListener('click', handleOpenFolder);
    }

    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', handleDownloadAll);
    }

    // Add prompts to queue
    addToQueueBtn.addEventListener('click', handleAddToQueue);

    // Gallery filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            galleryFilter = btn.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyGalleryFilter();
        });
    });

    // Queue Action Controls
    pauseQueueBtn.addEventListener('click', handlePauseQueue);
    resumeQueueBtn.addEventListener('click', handleResumeQueue);
    stopQueueBtn.addEventListener('click', handleStopQueue);
    clearQueueBtn.addEventListener('click', handleClearQueue);

    // Clear prompt inputs
    clearInputsBtn.addEventListener('click', () => {
        promptTextArea.value = '';
        addLog(TRANSLATIONS[currentLang].logPromptCleared, 'system');
    });

    // Clear Gallery
    clearGalleryBtn.addEventListener('click', () => {
        if (confirm(TRANSLATIONS[currentLang].confirmClearGallery)) {
            galleryGrid.innerHTML = '';
            renderedFilenames.clear();
            addLog(TRANSLATIONS[currentLang].logGalleryCleared, 'system');
        }
    });

    // Clear Logs
    clearLogsBtn.addEventListener('click', () => {
        logWindow.innerHTML = '';
        addLog(TRANSLATIONS[currentLang].logLogsCleared, 'system');
    });

    // Clear History
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            localStorage.removeItem('promptHistory');
            updateHistoryUI();
            addLog(currentLang === 'zh' ? '提示词历史记录已清空。' : 'Prompt history cleared.', 'system');
        });
    }

    // Lightbox close handlers
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) closeLightbox();
    });

    // Lightbox Navigation click bindings
    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateLightbox(-1);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateLightbox(1);
        });
    }

    // Lightbox Regenerate
    const lightboxRegenBtn = document.getElementById('lightboxRegenBtn');
    if (lightboxRegenBtn) {
        lightboxRegenBtn.addEventListener('click', () => {
            if (activeLightboxItem) {
                closeLightbox();
                regeneratePrompt(activeLightboxItem, false); // use random seed for new variation
            }
        });
    }

    // Handle ESC and Arrow navigation keys for Lightbox
    document.addEventListener('keydown', (e) => {
        if (lightboxOverlay.style.display === 'flex') {
            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                navigateLightbox(-1);
            } else if (e.key === 'ArrowRight') {
                navigateLightbox(1);
            }
        }
    });


    // Toggle Logs Drawer
    const drawerHandle = document.getElementById('drawerHandle');
    const toggleDrawerBtn = document.getElementById('toggleDrawerBtn');
    
    const toggleLogsDrawer = () => {
        const drawer = document.getElementById('logsDrawer');
        if (drawer) {
            drawer.classList.toggle('expanded');
        }
    };

    if (drawerHeader) {
        drawerHeader.addEventListener('click', (e) => {
            // Do not toggle if clear logs button was clicked
            if (e.target.closest('#clearLogsBtn')) {
                return;
            }
            toggleLogsDrawer();
        });
    }
    if (drawerHandle) {
        drawerHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLogsDrawer();
        });
    }
    if (toggleDrawerBtn) {
        toggleDrawerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLogsDrawer();
        });
    }


    // Toggle Collapsible Settings (Collapsed by Default)
    const configPane = document.getElementById('configPane');
    const configHeader = document.getElementById('configHeader');
    if (configPane && configHeader) {
        configPane.classList.add('collapsed');
        configHeader.addEventListener('click', () => {
            configPane.classList.toggle('collapsed');
        });
    }
}

// Restart the server and wait for it to come back online
async function handleRestartServer() {
    if (!confirm(TRANSLATIONS[currentLang].confirmRestart)) return;

    const btn = document.getElementById('restartServerBtn');
    const btnSpan = btn ? btn.querySelector('span') : null;
    const btnSvg  = btn ? btn.querySelector('svg') : null;

    // Visual: disable button + spin icon
    if (btn) {
        btn.disabled = true;
        btn.classList.add('restarting');
    }
    if (btnSpan) btnSpan.textContent = TRANSLATIONS[currentLang].statusRestarting;

    // Update status indicator
    statusIndicator.className = 'status-indicator status-offline';
    statusIndicator.textContent = TRANSLATIONS[currentLang].statusRestarting;

    showToast(TRANSLATIONS[currentLang].toastRestarting, 'info');
    addLog(TRANSLATIONS[currentLang].toastRestarting, 'system');

    // Send restart request (server will reply then exec itself)
    try {
        await fetch('/api/restart', { method: 'POST' });
    } catch (_) {
        // Connection drop during restart is expected — ignore
    }

    // Stop existing polling loops to avoid noisy errors during downtime
    if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
    if (pollQueueInterval) { clearInterval(pollQueueInterval); pollQueueInterval = null; }

    // Poll until server is back online (max ~60s)
    let attempts = 0;
    const maxAttempts = 60;
    const waitForRestart = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                // Server is back!
                clearInterval(waitForRestart);

                // Re-enable button
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove('restarting');
                }
                if (btnSpan) btnSpan.textContent = TRANSLATIONS[currentLang].restartServer;

                // Resume polling loops
                statusInterval    = setInterval(pollServerStatus, 5000);
                pollQueueInterval = setInterval(syncQueueState, 1000);

                showToast(TRANSLATIONS[currentLang].toastRestartDone, 'success');
                addLog(TRANSLATIONS[currentLang].toastRestartDone, 'system');
                pollServerStatus();
                syncQueueState();
            }
        } catch (_) {
            // Still offline — keep waiting
        }

        if (attempts >= maxAttempts) {
            clearInterval(waitForRestart);
            if (btn) { btn.disabled = false; btn.classList.remove('restarting'); }
            if (btnSpan) btnSpan.textContent = TRANSLATIONS[currentLang].restartServer;
            statusInterval    = setInterval(pollServerStatus, 5000);
            pollQueueInterval = setInterval(syncQueueState, 1000);
            addLog(currentLang === 'zh' ? '重启超时，请手动检查服务状态。' : 'Restart timeout. Please check server manually.', 'error');
        }
    }, 1000);
}

// Stop the server process
async function handleStopServer() {
    if (!confirm(TRANSLATIONS[currentLang].confirmStop)) return;

    const btn = document.getElementById('stopServerBtn');
    const btnSpan = btn ? btn.querySelector('span') : null;

    if (btn) {
        btn.disabled = true;
    }
    if (btnSpan) btnSpan.textContent = TRANSLATIONS[currentLang].statusStopping;

    // Update status indicator
    statusIndicator.className = 'status-indicator status-offline';
    statusIndicator.textContent = TRANSLATIONS[currentLang].statusStopping;

    showToast(TRANSLATIONS[currentLang].toastStopping, 'warning');
    addLog(TRANSLATIONS[currentLang].toastStopping, 'system');

    // Stop existing polling loops
    if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
    if (pollQueueInterval) { clearInterval(pollQueueInterval); pollQueueInterval = null; }

    try {
        await fetch('/api/shutdown', { method: 'POST' });
    } catch (_) {
        // Connection drop is expected
    }

    // After shutdown, set final states
    setTimeout(() => {
        showToast(TRANSLATIONS[currentLang].toastStopped, 'error');
        statusIndicator.textContent = TRANSLATIONS[currentLang].statusOffline;
        addLog(TRANSLATIONS[currentLang].toastStopped, 'system');
    }, 1000);
}

// Poll server status API
async function pollServerStatus() {
    try {
        const res = await fetch('/api/status');
        if (res.ok) {
            const data = await res.json();
            if (data.is_busy) {
                statusIndicator.className = 'status-indicator status-busy';
                statusIndicator.textContent = TRANSLATIONS[currentLang].statusGenerating;
                if (lastConnectionState !== 'busy') {
                    addLog(TRANSLATIONS[currentLang].logServerBusy, 'active');
                    lastConnectionState = 'busy';
                }
            } else {
                statusIndicator.className = 'status-indicator status-online';
                statusIndicator.textContent = TRANSLATIONS[currentLang].statusReady;
                if (lastConnectionState !== 'online') {
                    if (lastConnectionState === null) {
                        addLog(TRANSLATIONS[currentLang].logServerReady, 'system');
                    } else {
                        addLog(TRANSLATIONS[currentLang].logServerIdle, 'system');
                    }
                    lastConnectionState = 'online';
                }
            }
        } else {
            statusIndicator.className = 'status-indicator status-offline';
            statusIndicator.textContent = TRANSLATIONS[currentLang].statusError;
            if (lastConnectionState !== 'offline') {
                addLog(TRANSLATIONS[currentLang].logServerErr, 'error');
                lastConnectionState = 'offline';
            }
        }
    } catch (err) {
        statusIndicator.className = 'status-indicator status-offline';
        statusIndicator.textContent = TRANSLATIONS[currentLang].statusOffline;
        if (lastConnectionState !== 'offline') {
            addLog(TRANSLATIONS[currentLang].logServerOffline, 'error');
            lastConnectionState = 'offline';
        }
    }
}

// Synchronize queue state from backend
async function syncQueueState() {
    try {
        const res = await fetch('/api/queue');
        if (!res.ok) return;
        
        const data = await res.json();
        const prevStatus = queueStatus;
        queueStatus = data.status;
        promptQueue = data.queue;
        
        // Log status changes
        if (prevStatus !== queueStatus) {
            if (queueStatus === "running") {
                addLog(TRANSLATIONS[currentLang].logQueueResumed, 'system');
            } else if (queueStatus === "paused") {
                addLog(TRANSLATIONS[currentLang].logQueuePaused, 'system');
            } else if (queueStatus === "idle") {
                addLog(TRANSLATIONS[currentLang].logQueueIdle, 'system');
            }
        }
        
        // Manage total timer based on queueStatus
        if (queueStatus === 'running') {
            if (!queueTimerInterval) {
                let startTime = localStorage.getItem('queueStartTime');
                if (!startTime) {
                    localStorage.setItem('queueStartTime', Date.now());
                }
                tickTimer();
                queueTimerInterval = setInterval(tickTimer, 1000);
            }
        } else if (queueStatus === 'paused') {
            if (queueTimerInterval) {
                let startTime = parseInt(localStorage.getItem('queueStartTime') || '0');
                let accum = parseInt(localStorage.getItem('queueAccumulatedTime') || '0');
                if (startTime > 0) {
                    accum += Date.now() - startTime;
                }
                localStorage.setItem('queueAccumulatedTime', accum);
                localStorage.removeItem('queueStartTime');
                
                clearInterval(queueTimerInterval);
                queueTimerInterval = null;
            }
        } else if (queueStatus === 'idle') {
            if (queueTimerInterval) {
                let startTime = parseInt(localStorage.getItem('queueStartTime') || '0');
                let accum = parseInt(localStorage.getItem('queueAccumulatedTime') || '0');
                if (startTime > 0) {
                    accum += Date.now() - startTime;
                }
                localStorage.setItem('queueAccumulatedTime', accum);
                localStorage.removeItem('queueStartTime');
                
                clearInterval(queueTimerInterval);
                queueTimerInterval = null;
            }
            if (promptQueue.length === 0) {
                resetTotalTimer();
            }
        }
        
        updateQueueUI();
        syncGalleryUI();
    } catch (err) {
        console.error("Failed to sync queue state:", err);
    }
}

// Update the Queue Table, badging, and button visibility based on backend state
function updateQueueUI() {
    if (!queueCountBadge) return;
    
    // Total progress calculations
    const totalCount = promptQueue.length;
    const finishedCount = promptQueue.filter(item => item.status === 'completed' || item.status === 'failed').length;
    
    const queueProgressContainer = document.getElementById('queueProgressContainer');
    const queueProgressValue = document.getElementById('queueProgressValue');
    const queueProgressBarFill = document.getElementById('queueProgressBarFill');
    
    if (totalCount > 0) {
        if (queueProgressContainer) queueProgressContainer.style.display = 'flex';
        const percentage = Math.round((finishedCount / totalCount) * 100);
        if (queueProgressValue) {
            queueProgressValue.textContent = `${finishedCount} / ${totalCount} (${percentage}%)`;
        }
        if (queueProgressBarFill) {
            queueProgressBarFill.style.width = `${percentage}%`;
        }
    } else {
        if (queueProgressContainer) queueProgressContainer.style.display = 'none';
    }

    // 1. Update queue count badge
    const activeCount = promptQueue.filter(item => item.status === 'pending' || item.status === 'generating').length;
    queueCountBadge.textContent = TRANSLATIONS[currentLang].queueCountBadge.replace('{count}', activeCount);

    // 2. Update status badge
    if (queueStatusBadge) {
        const statusKey = 'queueStatus' + queueStatus.charAt(0).toUpperCase() + queueStatus.slice(1);
        queueStatusBadge.textContent = TRANSLATIONS[currentLang][statusKey] || queueStatus;
        queueStatusBadge.className = 'badge-status';
        if (queueStatus === 'idle') queueStatusBadge.classList.add('badge-idle');
        else if (queueStatus === 'running') queueStatusBadge.classList.add('badge-running');
        else if (queueStatus === 'paused') queueStatusBadge.classList.add('badge-paused');
    }

    // 3. Toggle Control Buttons visibility
    if (queueStatus === 'running') {
        pauseQueueBtn.style.display = 'inline-flex';
        stopQueueBtn.style.display = 'inline-flex';
        resumeQueueBtn.style.display = 'none';
    } else if (queueStatus === 'paused') {
        pauseQueueBtn.style.display = 'none';
        stopQueueBtn.style.display = 'inline-flex';
        resumeQueueBtn.style.display = 'inline-flex';
    } else { // idle
        pauseQueueBtn.style.display = 'none';
        stopQueueBtn.style.display = 'none';
        resumeQueueBtn.style.display = 'none';
    }

    // 4. Render Queue rows
    if (promptQueue.length === 0) {
        queueList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🏖️</span>
                <p>${TRANSLATIONS[currentLang].emptyQueue}</p>
            </div>
        `;
        return;
    }

    queueList.innerHTML = '';
    promptQueue.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = `queue-row ${item.status === 'generating' ? 'generating' : ''}`;
        row.id = `row_${item.id}`;

        let statusText = '';
        let badgeClass = '';

        if (item.status === 'pending') {
            statusText = '🕒 ' + (currentLang === 'zh' ? '等待中' : 'Pending');
            badgeClass = 'badge-pending';
        } else if (item.status === 'generating') {
            statusText = '⚙️ ' + (currentLang === 'zh' ? '生成中' : 'Generating');
            badgeClass = 'badge-generating';
        } else if (item.status === 'completed') {
            statusText = '✅ ' + (currentLang === 'zh' ? '已完成' : 'Completed');
            badgeClass = 'badge-completed';
        } else if (item.status === 'failed') {
            statusText = '❌ ' + (currentLang === 'zh' ? '失败' : 'Failed');
            badgeClass = 'badge-failed';
        } else if (item.status === 'skipped') {
            statusText = '⏭️ ' + TRANSLATIONS[currentLang].statusSkipped;
            badgeClass = 'badge-skipped';
        }

        // Display timing
        let timeDisplay = '-';
        if (item.status === 'completed') {
            timeDisplay = `${item.elapsed.toFixed(1)}s`;
        } else if (item.status === 'generating') {
            timeDisplay = `${item.elapsed.toFixed(1)}s`;
        } else if (item.status === 'failed') {
            timeDisplay = 'Err';
        } else if (item.status === 'skipped') {
            timeDisplay = '-';
        }

        // Per-row action buttons — vary by status
        // pending:  ⬆️ move-top  ⏭️ skip  🗑️ delete
        // failed:              ⏭️ skip  🗑️ delete
        // skipped:                      🗑️ delete
        // generating / completed: (none)
        const canDelete  = ['pending', 'failed', 'skipped'].includes(item.status);
        const canSkip    = ['pending', 'failed'].includes(item.status);
        const canMoveTop = item.status === 'pending';

        let rowActionsHtml = `<span class="col-actions">`;
        if (canDelete || canSkip || canMoveTop) {
            if (canMoveTop) {
                rowActionsHtml += `
                <button class="row-action-btn btn-move-top" title="${TRANSLATIONS[currentLang].btnMoveTop}" data-id="${item.id}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"></polyline><polyline points="17 18 12 13 7 18"></polyline></svg>
                </button>`;
            }
            if (canSkip) {
                rowActionsHtml += `
                <button class="row-action-btn btn-skip-task" title="${TRANSLATIONS[currentLang].btnSkip}" data-id="${item.id}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                </button>`;
            }
            if (canDelete) {
                rowActionsHtml += `
                <button class="row-action-btn btn-delete-task danger" title="${TRANSLATIONS[currentLang].btnDelete}" data-id="${item.id}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>`;
            }
        }
        rowActionsHtml += `</span>`;

        row.innerHTML = `
            <span class="col-num">${index + 1}</span>
            <span class="col-prompt" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</span>
            <span class="col-status">
                <span class="q-badge ${badgeClass}">${statusText}</span>
            </span>
            <span class="col-time" id="time_${item.id}">
                ${timeDisplay}
            </span>
            ${rowActionsHtml}
        `;

        // Attach row action button listeners
        if (canMoveTop) {
            row.querySelector('.btn-move-top').addEventListener('click', (e) => {
                e.stopPropagation();
                handleMoveToFront(item.id);
            });
        }
        if (canSkip) {
            row.querySelector('.btn-skip-task').addEventListener('click', (e) => {
                e.stopPropagation();
                handleSkipTask(item.id);
            });
        }
        if (canDelete) {
            row.querySelector('.btn-delete-task').addEventListener('click', (e) => {
                e.stopPropagation();
                handleDeleteTask(item.id);
            });
        }

        queueList.appendChild(row);
    });
}

// Sync completed images to Gallery by grouping prompts dynamically (delta updates)
function syncGalleryUI() {
    // Filter completed items
    const completedItems = promptQueue.filter(item => item.status === 'completed' && item.filename);
    
    completedItems.forEach(item => {
        // Find if a group card for this prompt already exists in galleryGrid
        let groupCard = findGroupCardByPrompt(item.prompt);
        
        if (!groupCard) {
            // Group card doesn't exist, create it!
            groupCard = createGroupCard(item);
            // Insert at the top of the gallery grid
            if (galleryGrid.firstChild) {
                galleryGrid.insertBefore(groupCard, galleryGrid.firstChild);
            } else {
                galleryGrid.appendChild(groupCard);
            }
        }
        
        // Find if the image element already exists inside this group's grid
        const imagesGrid = groupCard.querySelector('.group-images-grid');
        let imgItem = imagesGrid.querySelector(`[data-filename="${item.filename}"]`);
        
        if (!imgItem) {
            // Image doesn't exist in the group, create and append it!
            imgItem = createImageItem(item);
            imagesGrid.appendChild(imgItem);
            
            // Check if group card now has more than 1 image, if so add multi-versions class
            const totalImages = imagesGrid.querySelectorAll('.group-image-item').length;
            if (totalImages > 1) {
                groupCard.classList.add('multi-versions');
            }
        }
    });

    // Re-apply current filter after gallery update
    applyGalleryFilter();
}

// Add prompts to backend queue
async function handleAddToQueue() {
    const text = promptTextArea.value.trim();
    if (!text) {
        alert(TRANSLATIONS[currentLang].promptAlert);
        return;
    }

    const rawPrompts = text.split('\n');
    const prefix = promptPrefixInput ? promptPrefixInput.value.trim() : '';
    const suffix = promptSuffixInput ? promptSuffixInput.value.trim() : '';

    const prompts = rawPrompts
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => {
            let fp = p;
            if (prefix) fp = prefix + " " + fp;
            if (suffix) fp = fp + " " + suffix;
            return fp;
        });

    if (prompts.length === 0) {
        alert(TRANSLATIONS[currentLang].noValidPrompts);
        return;
    }

    const resolution = resolutionSelect.value;
    const [width, height] = resolution.split('x').map(Number);
    const steps = parseInt(stepsInput.value, 10) || 9;
    const guidanceScale = parseFloat(guidanceInput.value) || 0.0;
    const seed = parseInt(seedInput.value, 10) || -1;

    try {
        // Smart clear: if the previous batch is fully done, clean up queue records
        // (gallery images are preserved, only task list entries are removed)
        const isAllDone = promptQueue.length > 0 &&
            promptQueue.every(item => ['completed', 'failed', 'skipped'].includes(item.status));
        if (isAllDone) {
            await fetch('/api/queue/clear-completed', { method: 'POST' });
            resetTotalTimer();
            addLog(currentLang === 'zh' ? '上一批任务已完成，队列记录已自动清理。' : 'Previous batch done — queue records cleared.', 'system');
        }

        if (queueStatus === 'idle') {
            resetTotalTimer();
        }
        const response = await fetch('/api/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompts: prompts,
                seed: seed,
                height: height,
                width: width,
                steps: steps,
                guidance_scale: guidanceScale
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                addLog(TRANSLATIONS[currentLang].logAddedToQueue.replace('{count}', prompts.length), 'queue');
                showToast(TRANSLATIONS[currentLang].toastAddedToQueue.replace('{count}', prompts.length), 'success');
                // Save the entire batch text to history
                savePromptToHistory(text);
                promptTextArea.value = '';
                syncQueueState();
            } else {
                addLog(TRANSLATIONS[currentLang].logFailedQueue, 'error');
                showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', TRANSLATIONS[currentLang].logFailedQueue), 'error');
            }
        } else {
            addLog(TRANSLATIONS[currentLang].logErrAddQueue.replace('{status}', response.status), 'error');
            showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', `HTTP ${response.status}`), 'error');
        }
    } catch (err) {
        addLog(TRANSLATIONS[currentLang].logNetworkErr.replace('{err}', err.message), 'error');
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

// Queue Action Operations
async function handlePauseQueue() {
    try {
        addLog(TRANSLATIONS[currentLang].logPauseReq, 'system');
        const res = await fetch('/api/queue/pause', { method: 'POST' });
        if (res.ok) {
            showToast(TRANSLATIONS[currentLang].toastPaused, 'info');
            syncQueueState();
        }
    } catch (err) {
        addLog(TRANSLATIONS[currentLang].logPauseErr.replace('{err}', err.message), 'error');
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

async function handleResumeQueue() {
    try {
        addLog(TRANSLATIONS[currentLang].logResumeReq, 'system');
        const res = await fetch('/api/queue/resume', { method: 'POST' });
        if (res.ok) {
            showToast(TRANSLATIONS[currentLang].toastResumed, 'success');
            syncQueueState();
        }
    } catch (err) {
        addLog(TRANSLATIONS[currentLang].logResumeErr.replace('{err}', err.message), 'error');
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

async function handleStopQueue() {
    try {
        addLog(TRANSLATIONS[currentLang].logStopReq, 'active');
        const res = await fetch('/api/queue/stop', { method: 'POST' });
        if (res.ok) {
            addLog(TRANSLATIONS[currentLang].logStopSuccess, 'system');
            showToast(TRANSLATIONS[currentLang].toastStopped, 'info');
            syncQueueState();
        }
    } catch (err) {
        addLog(TRANSLATIONS[currentLang].logStopErr.replace('{err}', err.message), 'error');
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

async function handleClearQueue() {
    if (!confirm(TRANSLATIONS[currentLang].confirmClearQueue)) {
        return;
    }
    try {
        addLog(TRANSLATIONS[currentLang].logWipeReq, 'system');
        const res = await fetch('/api/queue/clear', { method: 'POST' });
        if (res.ok) {
            galleryGrid.innerHTML = '';
            renderedFilenames.clear();
            addLog(TRANSLATIONS[currentLang].logWipeSuccess, 'system');
            resetTotalTimer();
            showToast(TRANSLATIONS[currentLang].toastQueueCleared, 'success');
            syncQueueState();
        }
    } catch (err) {
        addLog(TRANSLATIONS[currentLang].logWipeErr.replace('{err}', err.message), 'error');
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

// Open output directory locally on Windows PC
async function handleOpenFolder() {
    try {
        addLog(currentLang === 'zh' ? '正在请求打开本地输出目录...' : 'Requesting to open local output folder...', 'system');
        const response = await fetch('/api/open-folder', { method: 'POST' });
        if (response.ok) {
            addLog(currentLang === 'zh' ? '成功在 Windows 资源管理器中打开输出目录。' : 'Opened output folder in Windows Explorer.', 'system');
        } else {
            const errData = await response.json();
            addLog((currentLang === 'zh' ? '打开目录失败: ' : 'Failed to open folder: ') + errData.detail, 'error');
        }
    } catch (err) {
        addLog((currentLang === 'zh' ? '打开目录时出错: ' : 'Error opening folder: ') + err.message, 'error');
    }
}

// Download all images compiled in ZIP file
function handleDownloadAll() {
    addLog(currentLang === 'zh' ? '正在请求打包下载全部图片...' : 'Requesting download of all images as ZIP...', 'system');
    window.location.href = '/api/outputs/zip';
}

// Open Lightbox view
function openLightbox(item) {
    activeLightboxItem = item;
    lightboxImg.src = `/outputs/${item.filename}`;
    metaPrompt.textContent = item.prompt;
    metaResolution.textContent = `${item.width} x ${item.height}`;
    metaSteps.textContent = item.steps;
    metaSeed.textContent = item.seed_used;
    metaTime.textContent = `${item.elapsed.toFixed(2)} seconds`;
    lightboxDownloadBtn.href = `/outputs/${item.filename}`;
    lightboxDownloadBtn.setAttribute('download', `gen_seed_${item.seed_used}.png`);
    
    // Update navigation buttons based on current thumbnail index
    const allThumbnails = Array.from(document.querySelectorAll('.group-image-item'));
    const currentIndex = allThumbnails.findIndex(thumb => thumb.itemData && thumb.itemData.filename === item.filename);
    
    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');
    
    if (prevBtn && nextBtn) {
        if (currentIndex === -1) {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        } else {
            prevBtn.disabled = (currentIndex === 0);
            nextBtn.disabled = (currentIndex === allThumbnails.length - 1);
        }
    }
    
    lightboxOverlay.style.display = 'flex';
}

// Navigate lightbox index in visual order
function navigateLightbox(direction) {
    if (!activeLightboxItem) return;
    
    const allThumbnails = Array.from(document.querySelectorAll('.group-image-item'));
    if (allThumbnails.length === 0) return;
    
    const currentIndex = allThumbnails.findIndex(thumb => thumb.itemData && thumb.itemData.filename === activeLightboxItem.filename);
    if (currentIndex === -1) return;
    
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < allThumbnails.length) {
        openLightbox(allThumbnails[nextIndex].itemData);
    }
}

// Close Lightbox view
function closeLightbox() {
    activeLightboxItem = null;
    lightboxOverlay.style.display = 'none';
    lightboxImg.src = ''; // Clear source to free memory
}


// Helper to escape HTML tags to avoid XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Find a prompt group card in the gallery grid
function findGroupCardByPrompt(prompt) {
    const cards = galleryGrid.querySelectorAll('.gallery-group-card');
    for (let card of cards) {
        if (card.dataset.prompt === prompt) {
            return card;
        }
    }
    return null;
}

// Create a prompt group card DOM element
function createGroupCard(item) {
    const card = document.createElement('div');
    card.className = 'gallery-group-card';
    card.dataset.prompt = item.prompt;
    
    // Set localized regenerate group tooltip text
    const titleText = currentLang === 'zh' ? '重新生成提示词' : 'Regenerate Prompt';
    
    card.innerHTML = `
        <div class="group-header">
            <p class="group-prompt" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</p>
            <button class="btn-regenerate-group" title="${titleText}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        </div>
        <div class="group-images-grid"></div>
    `;
    
    const regenBtn = card.querySelector('.btn-regenerate-group');
    regenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        regeneratePrompt(item, false); // use random seed
    });
    
    return card;
}

// Create single version image element inside group
function createImageItem(item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'group-image-item';
    wrapper.dataset.filename = item.filename;
    wrapper.itemData = item; // Store item data directly on the DOM element

    const imageUrl = `/outputs/${item.filename}`;
    const titleText = currentLang === 'zh' ? '用此种子重新生成' : 'Regenerate with Seed';

    // Restore persisted rating
    const rating = getImageRating(item.filename);
    if (rating === 'like') wrapper.classList.add('rated-like');
    else if (rating === 'dislike') wrapper.classList.add('rated-dislike');

    wrapper.innerHTML = `
        <img src="${imageUrl}" alt="${escapeHtml(item.prompt)}" loading="lazy">
        <div class="image-rating-bar">
            <button class="btn-rate btn-like${rating === 'like' ? ' active' : ''}" title="\uD83D\uDC4D" data-filename="${item.filename}">👍</button>
            <button class="btn-rate btn-dislike${rating === 'dislike' ? ' active' : ''}" title="\uD83D\uDC4E" data-filename="${item.filename}">👎</button>
        </div>
        <div class="image-meta-overlay">
            <span class="image-seed-badge">🌱 ${item.seed_used}</span>
            <button class="btn-regenerate-single" title="${titleText}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
            </button>
        </div>
    `;

    // Click thumbnail opens Lightbox
    wrapper.addEventListener('click', (e) => {
        if (e.target.closest('.btn-regenerate-single') || e.target.closest('.btn-rate')) {
            return;
        }
        openLightbox(item);
    });

    const regenSingleBtn = wrapper.querySelector('.btn-regenerate-single');
    regenSingleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        regeneratePrompt(item, false); // always use random seed for new variation
    });

    // Like button
    wrapper.querySelector('.btn-like').addEventListener('click', (e) => {
        e.stopPropagation();
        const current = getImageRating(item.filename);
        const next = current === 'like' ? null : 'like';
        setImageRating(item.filename, next, wrapper);
        applyGalleryFilter();
    });

    // Dislike button
    wrapper.querySelector('.btn-dislike').addEventListener('click', (e) => {
        e.stopPropagation();
        const current = getImageRating(item.filename);
        const next = current === 'dislike' ? null : 'dislike';
        setImageRating(item.filename, next, wrapper);
        applyGalleryFilter();
    });

    return wrapper;
}

// Per-task queue action handlers
async function handleDeleteTask(taskId) {
    try {
        const res = await fetch(`/api/queue/${taskId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(TRANSLATIONS[currentLang].toastDeleted, 'info');
            syncQueueState();
        } else {
            const body = await res.json().catch(() => ({}));
            const detail = body.detail || `HTTP ${res.status}`;
            showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', detail), 'error');
            syncQueueState(); // refresh to show current real state
        }
    } catch (err) {
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

async function handleSkipTask(taskId) {
    try {
        const res = await fetch(`/api/queue/${taskId}/skip`, { method: 'POST' });
        if (res.ok) {
            showToast(TRANSLATIONS[currentLang].toastSkipped, 'info');
            syncQueueState();
        } else {
            const body = await res.json().catch(() => ({}));
            const detail = body.detail || `HTTP ${res.status}`;
            showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', detail), 'error');
            syncQueueState();
        }
    } catch (err) {
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

async function handleMoveToFront(taskId) {
    try {
        const res = await fetch(`/api/queue/${taskId}/move-front`, { method: 'POST' });
        if (res.ok) {
            showToast(TRANSLATIONS[currentLang].toastMovedTop, 'success');
            syncQueueState();
        } else {
            const body = await res.json().catch(() => ({}));
            const detail = body.detail || `HTTP ${res.status}`;
            showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', detail), 'error');
            syncQueueState();
        }
    } catch (err) {
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

// ============================================================
// Rating Persistence (localStorage keyed by filename)
// ============================================================
function getImageRating(filename) {
    const ratings = JSON.parse(localStorage.getItem('imageRatings') || '{}');
    return ratings[filename] || null; // 'like' | 'dislike' | null
}

function setImageRating(filename, rating, wrapperEl) {
    const ratings = JSON.parse(localStorage.getItem('imageRatings') || '{}');
    if (rating === null) {
        delete ratings[filename];
    } else {
        ratings[filename] = rating;
    }
    localStorage.setItem('imageRatings', JSON.stringify(ratings));

    // Update DOM classes and button active states
    wrapperEl.classList.remove('rated-like', 'rated-dislike');
    const likeBtn = wrapperEl.querySelector('.btn-like');
    const dislikeBtn = wrapperEl.querySelector('.btn-dislike');
    if (likeBtn) likeBtn.classList.remove('active');
    if (dislikeBtn) dislikeBtn.classList.remove('active');

    if (rating === 'like') {
        wrapperEl.classList.add('rated-like');
        if (likeBtn) likeBtn.classList.add('active');
    } else if (rating === 'dislike') {
        wrapperEl.classList.add('rated-dislike');
        if (dislikeBtn) dislikeBtn.classList.add('active');
    }
}

// ============================================================
// Gallery Filter Logic
// ============================================================
function applyGalleryFilter() {
    const allItems = document.querySelectorAll('.group-image-item');
    allItems.forEach(item => {
        const filename = item.dataset.filename;
        const rating = getImageRating(filename);

        let visible = true;
        if (galleryFilter === 'liked') {
            visible = rating === 'like';
        } else if (galleryFilter === 'disliked') {
            visible = rating === 'dislike';
        } else if (galleryFilter === 'hide-disliked') {
            visible = rating !== 'dislike';
        }
        item.style.display = visible ? '' : 'none';
    });

    // Hide group cards that have no visible images
    document.querySelectorAll('.gallery-group-card').forEach(card => {
        const visibleItems = card.querySelectorAll('.group-image-item:not([style*="display: none"])');
        card.style.display = visibleItems.length === 0 ? 'none' : '';
    });
}

// Queue prompt for regeneration
async function regeneratePrompt(item, useFixedSeed = false) {
    try {
        if (queueStatus === 'idle') {
            resetTotalTimer();
        }
        addLog(currentLang === 'zh' ? `正在请求重新生成提示词...` : `Requesting regeneration for prompt...`, 'system');
        const response = await fetch('/api/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompts: [item.prompt],
                seed: useFixedSeed ? item.seed_used : -1,
                height: item.height,
                width: item.width,
                steps: item.steps,
                guidance_scale: item.guidance_scale,
                front: true
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                addLog(currentLang === 'zh' ? `已添加重新生成任务到队列。` : `Regeneration task added to queue.`, 'queue');
                showToast(TRANSLATIONS[currentLang].toastRegenAdded, 'success');
                syncQueueState();
            } else {
                showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', currentLang === 'zh' ? '添加失败' : 'Failed to add'), 'error');
            }
        } else {
            showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', `HTTP ${response.status}`), 'error');
        }
    } catch (err) {
        addLog(`Regeneration error: ${err.message}`, 'error');
        showToast(TRANSLATIONS[currentLang].toastError.replace('{err}', err.message), 'error');
    }
}

// Save prompt to local storage history
function savePromptToHistory(prompt) {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('promptHistory')) || [];
    } catch (e) {
        history = [];
    }
    history = history.filter(p => p !== prompt);
    history.unshift(prompt);
    if (history.length > 20) {
        history = history.slice(0, 20);
    }
    localStorage.setItem('promptHistory', JSON.stringify(history));
    updateHistoryUI();
}

// Load prompt history list
function loadHistory() {
    let history = [];
    try {
        history = JSON.parse(localStorage.getItem('promptHistory')) || [];
    } catch (e) {
        history = [];
    }
    return history;
}

// Render prompt history in UI
function updateHistoryUI() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    const history = loadHistory();
    if (history.length === 0) {
        historyList.innerHTML = `<div class="history-empty" data-i18n="historyEmpty">${TRANSLATIONS[currentLang].historyEmpty}</div>`;
        return;
    }
    historyList.innerHTML = '';
    history.forEach(prompt => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.title = prompt;
        item.textContent = prompt.replace(/\n/g, ' ｜ ');
        item.addEventListener('click', () => {
            loadHistoryPrompt(prompt);
        });
        historyList.appendChild(item);
    });
}

// Load selected prompt into textarea
function loadHistoryPrompt(prompt) {
    const currentVal = promptTextArea.value.trim();
    if (currentVal === '') {
        promptTextArea.value = prompt;
    } else {
        promptTextArea.value = currentVal + '\n' + prompt;
    }
    addLog(currentLang === 'zh' ? `已载入历史批次` : `Loaded batch from history`, 'system');
}
