// Application State
let promptQueue = [];
let queueStatus = "idle"; // "idle", "running", "paused"
let lastConnectionState = null; // null, 'online', 'busy', 'offline'
let renderedFilenames = new Set(); // Track images already shown in gallery
let statusInterval = null;
let pollQueueInterval = null;

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const promptTextArea = document.getElementById('promptTextArea');
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
    setupEventListeners();
    addLog('System initialized. Syncing state with backend...', 'system');
    
    // Initial sync
    pollServerStatus();
    syncQueueState();
    
    // Set up polling intervals
    statusInterval = setInterval(pollServerStatus, 5000);
    pollQueueInterval = setInterval(syncQueueState, 1000); // Poll queue every 1s for fast UI updates
});

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

// Event Listeners Setup
function setupEventListeners() {
    // Add prompts to queue
    addToQueueBtn.addEventListener('click', handleAddToQueue);

    // Queue Action Controls
    pauseQueueBtn.addEventListener('click', handlePauseQueue);
    resumeQueueBtn.addEventListener('click', handleResumeQueue);
    stopQueueBtn.addEventListener('click', handleStopQueue);
    clearQueueBtn.addEventListener('click', handleClearQueue);

    // Clear prompt inputs
    clearInputsBtn.addEventListener('click', () => {
        promptTextArea.value = '';
        addLog('Prompt input cleared.', 'system');
    });

    // Clear Gallery
    clearGalleryBtn.addEventListener('click', () => {
        galleryGrid.innerHTML = '';
        renderedFilenames.clear();
        addLog('Gallery cleared.', 'system');
    });

    // Clear Logs
    clearLogsBtn.addEventListener('click', () => {
        logWindow.innerHTML = '';
        addLog('System logs cleared.', 'system');
    });

    // Lightbox close handlers
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) closeLightbox();
    });

    // Handle ESC key for Lightbox
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
}

// Poll server status API
async function pollServerStatus() {
    try {
        const res = await fetch('/api/status');
        if (res.ok) {
            const data = await res.json();
            if (data.is_busy) {
                statusIndicator.className = 'status-indicator status-busy';
                statusIndicator.textContent = 'Server: Generating...';
                if (lastConnectionState !== 'busy') {
                    addLog('Server status: Busy (GPU active)', 'active');
                    lastConnectionState = 'busy';
                }
            } else {
                statusIndicator.className = 'status-indicator status-online';
                statusIndicator.textContent = 'Server: Connected (Ready)';
                if (lastConnectionState !== 'online') {
                    if (lastConnectionState === null) {
                        addLog('Successfully connected to Z-Image-Turbo backend.', 'system');
                    } else {
                        addLog('Server status: Connected (Idle)', 'system');
                    }
                    lastConnectionState = 'online';
                }
            }
        } else {
            statusIndicator.className = 'status-indicator status-offline';
            statusIndicator.textContent = 'Server: Error Response';
            if (lastConnectionState !== 'offline') {
                addLog('Server status: Error response from endpoint', 'error');
                lastConnectionState = 'offline';
            }
        }
    } catch (err) {
        statusIndicator.className = 'status-indicator status-offline';
        statusIndicator.textContent = 'Server: Offline';
        if (lastConnectionState !== 'offline') {
            addLog('Server status: Offline. Cannot reach backend. Please verify server.py is running.', 'error');
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
                addLog('Queue processing resumed/started on backend.', 'system');
            } else if (queueStatus === "paused") {
                addLog('Queue processing paused on backend.', 'system');
            } else if (queueStatus === "idle") {
                addLog('Queue completed. Idle state.', 'system');
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
    // 1. Update queue count badge
    const activeCount = promptQueue.filter(item => item.status === 'pending' || item.status === 'generating').length;
    queueCountBadge.textContent = `${activeCount} Active`;

    // 2. Update status badge
    queueStatusBadge.textContent = queueStatus;
    queueStatusBadge.className = 'badge-status';
    if (queueStatus === 'idle') queueStatusBadge.classList.add('badge-idle');
    else if (queueStatus === 'running') queueStatusBadge.classList.add('badge-running');
    else if (queueStatus === 'paused') queueStatusBadge.classList.add('badge-paused');

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
                <p>Queue is empty. Add prompts on the left to start generating!</p>
            </div>
        `;
        return;
    }

    // Capture current active timing to prevent flickering
    queueList.innerHTML = '';
    promptQueue.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = `queue-row ${item.status === 'generating' ? 'generating' : ''}`;
        row.id = `row_${item.id}`;

        let statusText = '';
        let badgeClass = '';

        if (item.status === 'pending') {
            statusText = '🕒 Pending';
            badgeClass = 'badge-pending';
        } else if (item.status === 'generating') {
            statusText = '⚙️ Generating';
            badgeClass = 'badge-generating';
        } else if (item.status === 'completed') {
            statusText = '✅ Completed';
            badgeClass = 'badge-completed';
        } else if (item.status === 'failed') {
            statusText = '❌ Failed';
            badgeClass = 'badge-failed';
        }

        // Display timing: if generating, we compute local active elapsed time
        let timeDisplay = '-';
        if (item.status === 'completed') {
            timeDisplay = `${item.elapsed.toFixed(1)}s`;
        } else if (item.status === 'generating') {
            // If the backend has elapsed recorded (it updates on backend), use it, otherwise show a spinner
            timeDisplay = item.elapsed > 0 ? `${item.elapsed.toFixed(1)}s` : '⏳';
        } else if (item.status === 'failed') {
            timeDisplay = 'Err';
        }

        row.innerHTML = `
            <span class="col-num">${index + 1}</span>
            <span class="col-prompt" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</span>
            <span class="col-status">
                <span class="q-badge ${badgeClass}">${statusText}</span>
            </span>
            <span class="col-time" id="time_${item.id}">
                ${timeDisplay}
            </span>
        `;
        queueList.appendChild(row);
    });
}

// Sync completed images to Gallery
function syncGalleryUI() {
    promptQueue.forEach(item => {
        if (item.status === 'completed' && item.filename && !renderedFilenames.has(item.filename)) {
            renderedFilenames.add(item.filename);
            addToGallery(item);
        }
    });
}

// Add prompts to backend queue
async function handleAddToQueue() {
    const text = promptTextArea.value.trim();
    if (!text) {
        alert('Please enter at least one prompt!');
        return;
    }

    // Split by lines and filter empty lines
    const rawPrompts = text.split('\n');
    const prompts = rawPrompts
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (prompts.length === 0) {
        alert('No valid prompts found!');
        return;
    }

    // Settings
    const resolution = resolutionSelect.value;
    const [width, height] = resolution.split('x').map(Number);
    const steps = parseInt(stepsInput.value, 10) || 9;
    const guidanceScale = parseFloat(guidanceInput.value) || 0.0;
    const seed = parseInt(seedInput.value, 10) || -1;

    try {
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
                addLog(`Added ${prompts.length} prompt(s) to backend queue.`, 'queue');
                promptTextArea.value = '';
                syncQueueState();
            } else {
                addLog('Failed to add prompts to backend queue.', 'error');
            }
        } else {
            addLog(`Server returned error ${response.status} when adding prompts.`, 'error');
        }
    } catch (err) {
        addLog(`Network error adding to queue: ${err.message}`, 'error');
    }
}

// Queue Action Operations
async function handlePauseQueue() {
    try {
        addLog('Requesting queue pause...', 'system');
        const res = await fetch('/api/queue/pause', { method: 'POST' });
        if (res.ok) {
            syncQueueState();
        }
    } catch (err) {
        addLog(`Error pausing queue: ${err.message}`, 'error');
    }
}

async function handleResumeQueue() {
    try {
        addLog('Requesting queue resume...', 'system');
        const res = await fetch('/api/queue/resume', { method: 'POST' });
        if (res.ok) {
            syncQueueState();
        }
    } catch (err) {
        addLog(`Error resuming queue: ${err.message}`, 'error');
    }
}

async function handleStopQueue() {
    try {
        addLog('Requesting active generation termination & pause...', 'active');
        const res = await fetch('/api/queue/stop', { method: 'POST' });
        if (res.ok) {
            addLog('Generation stopped. Active task reset to pending.', 'system');
            syncQueueState();
        }
    } catch (err) {
        addLog(`Error stopping task: ${err.message}`, 'error');
    }
}

async function handleClearQueue() {
    if (!confirm('Are you sure you want to clear the entire queue history? This will stop active runs.')) {
        return;
    }
    try {
        addLog('Requesting queue wipe...', 'system');
        const res = await fetch('/api/queue/clear', { method: 'POST' });
        if (res.ok) {
            galleryGrid.innerHTML = '';
            renderedFilenames.clear();
            addLog('Queue history and gallery reset successfully.', 'system');
            syncQueueState();
        }
    } catch (err) {
        addLog(`Error wiping queue: ${err.message}`, 'error');
    }
}

// Add completed image element to Gallery DOM
function addToGallery(item) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    
    // Server endpoint serves files under /outputs/{filename}
    const imageUrl = `/outputs/${item.filename}`;

    card.innerHTML = `
        <div class="img-wrapper">
            <img src="${imageUrl}" alt="${escapeHtml(item.prompt)}" loading="lazy">
        </div>
        <div class="card-meta">
            <p class="card-prompt" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</p>
            <div class="card-info">
                <span>⏱️ ${item.elapsed.toFixed(1)}s</span>
                <span>🌱 ${item.seed_used}</span>
            </div>
        </div>
    `;

    // Click handler to open lightbox
    card.addEventListener('click', () => {
        openLightbox(item);
    });

    // Insert new card at the top of the gallery grid
    if (galleryGrid.firstChild) {
        galleryGrid.insertBefore(card, galleryGrid.firstChild);
    } else {
        galleryGrid.appendChild(card);
    }
}

// Open Lightbox view
function openLightbox(item) {
    lightboxImg.src = `/outputs/${item.filename}`;
    metaPrompt.textContent = item.prompt;
    metaResolution.textContent = `${item.width} x ${item.height}`;
    metaSteps.textContent = item.steps;
    metaSeed.textContent = item.seed_used;
    metaTime.textContent = `${item.elapsed.toFixed(2)} seconds`;
    lightboxDownloadBtn.href = `/outputs/${item.filename}`;
    lightboxDownloadBtn.setAttribute('download', `gen_seed_${item.seed_used}.png`);
    
    lightboxOverlay.style.display = 'flex';
}

// Close Lightbox view
function closeLightbox() {
    lightboxOverlay.style.display = 'none';
    lightboxImg.src = ''; // Clear source to free memory
}

// Helper to escape HTML tags to avoid XSS in user prompt prints
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
