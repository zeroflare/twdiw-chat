// Daily Match Chat MVP - Client-side Logic
// Following constitution: tlk.io mandatory, 30-char channel limit, public algorithm

let currentStep = 1;
let selectedLevel = null;
let preferences = {};
let matchTicketId = null;
let verificationData = null;
let pollingInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeDisclosureLevels();
    initializeNavigationButtons();
    updateProgress();
});

// Disclosure Level Selection
function initializeDisclosureLevels() {
    const levels = document.querySelectorAll('.disclosure-level');
    levels.forEach(level => {
        level.addEventListener('click', function() {
            levels.forEach(l => l.classList.remove('selected'));
            this.classList.add('selected');
            selectedLevel = this.getAttribute('data-level');
            console.log('[LEVEL] Disclosure level selected:', selectedLevel);

            // Clear previous verification
            clearVerification();

            // If not minimal, require VC verification
            if (selectedLevel !== 'minimal') {
                console.log('[LEVEL] Non-minimal level selected, initiating VC verification');
                initiateVCVerification();
            } else {
                // Minimal level: no VC required, enable next button
                console.log('[LEVEL] Minimal level selected, no VC verification required');
                verificationData = null; // Explicitly set to null for minimal
                document.getElementById('btn-next-1').disabled = false;
                document.getElementById('vc-verification').classList.remove('active');
                console.log('[LEVEL] Next button enabled for minimal level');
            }
        });
    });
}

// Clear previous verification state
function clearVerification() {
    console.log('[VERIFY] Clearing verification state');
    verificationData = null;
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    document.getElementById('btn-next-1').disabled = true;
    document.getElementById('qr-container').innerHTML = '';
    const statusEl = document.getElementById('verification-status');
    statusEl.className = 'verification-status pending';
    statusEl.innerHTML = '<div class="spinner"></div>等待驗證中...';
    console.log('[VERIFY] State cleared, next button disabled, verificationData:', verificationData);
}

// Check Backend Connectivity
async function checkBackendConnectivity() {
    try {
        const response = await fetch(`/api/verify-vc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref: 'test', transactionId: 'test' }),
            signal: AbortSignal.timeout(3000)
        });
        return response.status !== 404;
    } catch (error) {
        return false;
    }
}

// Initiate VC Verification
async function initiateVCVerification() {
    const vcContainer = document.getElementById('vc-verification');
    const qrContainer = document.getElementById('qr-container');
    const statusEl = document.getElementById('verification-status');

    console.log('[VERIFY] Initiating VC verification for level:', selectedLevel);
    vcContainer.classList.add('active');

    try {
        // Check backend connectivity first
        console.log('[VERIFY] Checking backend connectivity...');
        const backendAvailable = await checkBackendConnectivity();

        if (!backendAvailable) {
            console.error('[VERIFY] Backend API not available');
            statusEl.className = 'verification-status error';
            statusEl.innerHTML = '❌ 後端 API 服務不可用<br>請檢查 Cloudflare Workers 部署狀態';
            return;
        }

        // Generate unique transaction ID
        const transactionId = generateTransactionId();
        console.log('[VERIFY] Generated transaction ID:', transactionId);

        // Get appropriate VC ref based on disclosure level
        const vcRef = getVCRefForLevel(selectedLevel);
        console.log('[VERIFY] Using VC reference:', vcRef);

        // Call backend to initiate verification
        const response = await API.verifyVC(vcRef, transactionId);
        console.log('[VERIFY] Backend response received:', response);

        // Display QR code
        qrContainer.innerHTML = `<img src="${response.qrcodeImage}" alt="VC Verification QR Code">`;

        // Start polling for verification result
        startVerificationPolling(transactionId);

    } catch (error) {
        console.error('[VERIFY] Failed to initiate VC verification:', error);
        statusEl.className = 'verification-status error';

        // Specific error messages
        if (error.message.includes('fetch')) {
            statusEl.innerHTML = '❌ 無法連接到後端服務<br>請先啟動後端：<code>cd backend && npm start</code>';
        } else if (error.message.includes('timeout')) {
            statusEl.textContent = '❌ 後端連接超時，請檢查服務是否正常運行';
        } else {
            statusEl.textContent = `❌ 驗證初始化失敗：${error.message}`;
        }
    }
}

// Get VC reference based on disclosure level
function getVCRefForLevel(level) {
    const vcRefs = {
        'basic': '0052696330_vc_asset_player_rank_certificate',          // 階級卡 VC
        'standard': '0052696330_vp_credit_liability_certificate',       // Basic + 信用負債 VC
        'premium': '0052696330_vp_liquid_finance_certificate',          // Standard + 流動資產 VC
        'premium-plus': '0052696330_vp_personal_property_certificate',  // Premium + 動產 VC
        'ultimate': '0052696330_vp_real_estate_asset_certificate'       // Premium Plus + 不動產 VC
    };
    return vcRefs[level] || vcRefs.basic;
}

// Generate unique transaction ID
function generateTransactionId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Start polling for verification result
function startVerificationPolling(transactionId) {
    const statusEl = document.getElementById('verification-status');
    console.log('[VERIFY] Starting polling for transaction:', transactionId);

    pollingInterval = setInterval(async () => {
        try {
            const result = await API.getVerifyResult(transactionId);
            console.log('[VERIFY] Polling result:', result);

            if (result.status === 'pending') {
                // Still waiting for user to scan and verify
                console.log('[VERIFY] Status still pending, continuing to poll...');
                return;
            }

            // Stop polling
            console.log('[VERIFY] Verification completed, stopping polling');
            clearInterval(pollingInterval);
            pollingInterval = null;

            if (result.verifyResult === true) {
                // Verification successful
                verificationData = result;
                statusEl.className = 'verification-status success';
                statusEl.textContent = '✅ 驗證成功！';
                document.getElementById('btn-next-1').disabled = false;
                console.log('[VERIFY] ✅ Verification SUCCESS! Data stored:', verificationData);
                console.log('[VERIFY] Next button enabled');
            } else {
                // Verification failed
                verificationData = null;
                statusEl.className = 'verification-status error';
                statusEl.textContent = '❌ 驗證失敗，請重新選擇揭露等級';
                console.log('[VERIFY] ❌ Verification FAILED');
                console.log('[VERIFY] Next button remains disabled');
            }

        } catch (error) {
            console.error('[VERIFY] Error polling verification result:', error);
            // Continue polling on error (unless it's a critical error)
        }
    }, 3000); // Poll every 3 seconds
}

// Navigation
function initializeNavigationButtons() {
    // Step 1 -> 2
    document.getElementById('btn-next-1').addEventListener('click', () => {
        console.log('[NAV] Next button clicked on step 1');
        console.log('[NAV] Current state - selectedLevel:', selectedLevel, 'verificationData:', verificationData);

        if (!selectedLevel) {
            console.log('[NAV] ❌ No disclosure level selected');
            alert('請選擇揭露等級');
            return;
        }

        // Verify VC verification is complete for non-minimal levels
        if (selectedLevel !== 'minimal' && !verificationData) {
            console.log('[NAV] ❌ VC verification required but not completed');
            console.log('[NAV] selectedLevel:', selectedLevel, 'verificationData:', verificationData);
            alert('請完成 VC 驗證後再繼續');
            return;
        }

        // Stop polling if still active
        if (pollingInterval) {
            console.log('[NAV] Stopping active polling interval');
            clearInterval(pollingInterval);
            pollingInterval = null;
        }

        console.log('[NAV] ✅ All checks passed, proceeding to step 2');
        goToStep(2);
    });

    // Step 2 -> 3
    document.getElementById('btn-next-2').addEventListener('click', () => {
        capturePreferences();
        generateMatch();
        goToStep(3);
    });

    // Step 3 -> 4
    document.getElementById('btn-next-3').addEventListener('click', () => {
        confirmChatConsent();
    });

    // Back buttons
    document.getElementById('btn-back-2').addEventListener('click', () => goToStep(1));
    document.getElementById('btn-back-3').addEventListener('click', () => goToStep(2));
    document.getElementById('btn-back-4').addEventListener('click', () => {
        if (confirm('確定要結束聊天嗎？')) {
            goToStep(1);
            document.getElementById('chat-container').innerHTML = '';
        }
    });
}

function goToStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    currentStep = step;
    updateProgress();
}

function updateProgress() {
    for (let i = 1; i <= 4; i++) {
        const progressStep = document.getElementById(`progress-${i}`);
        if (i < currentStep) {
            progressStep.className = 'progress-step completed';
        } else if (i === currentStep) {
            progressStep.className = 'progress-step active';
        } else {
            progressStep.className = 'progress-step';
        }
    }
}

// Preferences
function capturePreferences() {
    preferences = {
        ageMin: parseInt(document.getElementById('age-min').value),
        ageMax: parseInt(document.getElementById('age-max').value),
        interests: document.getElementById('interests').value.split(',').map(i => i.trim()),
        disclosureLevel: selectedLevel
    };
    console.log('Preferences captured:', preferences);
}

// Matching (Mock)
function generateMatch() {
    // In production: POST /matches/daily with preferences + VC proof
    // For MVP: Generate mock match based on disclosure level

    matchTicketId = `match-${Date.now()}`;

    const ranksByLevel = {
        'minimal': 'Bronze',
        'basic': 'Silver',
        'standard': 'Gold',
        'premium': 'Sapphire Elite'
    };

    const rank = ranksByLevel[selectedLevel] || 'Silver';
    document.getElementById('match-rank').textContent = rank;

    console.log('Match generated:', {
        matchTicketId,
        selectedLevel,
        preferences,
        verificationData: verificationData ? {
            verified: true,
            credentialCount: verificationData.data?.length || 0
        } : { verified: false }
    });
}

// Chat
function confirmChatConsent() {
    const confirmed = confirm(
        '您即將進入聊天室，這將：\n' +
        '1. 分享您的暱稱給配對對象\n' +
        '2. 使用第三方服務 tlk.io\n' +
        '3. 聊天紀錄僅保留 10 分鐘\n\n' +
        '確認要繼續嗎？'
    );

    if (confirmed) {
        initializeChat();
        goToStep(4);
    }
}

function initializeChat() {
    // Generate channel ID (max 30 chars per constitution)
    const channelId = generateChannelId();
    document.getElementById('channel-id').textContent = channelId;

    // Load tlk.io iframe
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = `
        <iframe src="https://tlk.io/${channelId}"
                frameborder="0"
                allowfullscreen>
        </iframe>
    `;

    console.log('Chat session started:', {
        matchTicketId,
        channelId,
        timestamp: new Date().toISOString()
    });
}

function generateChannelId() {
    // Constitution requirement: max 30 chars
    // Format: dm-[timestamp-hash]
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const channelId = `dm-${timestamp}-${random}`;

    // Ensure max 30 chars
    return channelId.substring(0, 30);
}

// Backend API Configuration
const BACKEND_URL = ''; // Use relative URLs for Cloudflare Workers

// Mock API Integration Points (for future implementation)
const API = {
    // POST /matches/daily
    requestDailyMatch: async function(preferences, vcProof) {
        console.log('API: Request daily match', { preferences, vcProof });

        // In production: send to backend with VC proof
        // Backend validates VC using sandbox verifier, then calculates match

        return { matchTicketId: 'mock-123', match: {} };
    },

    // POST /matches/{matchTicketId}/chat
    startChatSession: async function(matchTicketId, consentToken) {
        console.log('API: Start chat session', { matchTicketId, consentToken });
        return { chatSessionId: 'session-123', tlkChannelId: 'mock-channel' };
    },

    // Real VC Verification via Backend
    verifyVC: async function(ref, transactionId) {
        /**
         * Initiates VC verification with sandbox via backend
         *
         * Flow:
         * 1. Call backend POST /api/verify-vc with ref and transactionId
         * 2. Backend calls sandbox to generate QR code
         * 3. Display QR code to user for wallet app scanning
         * 4. Poll backend GET /api/verify-result/:transactionId for result
         */

        console.log('API: Initiate VC verification', { ref, transactionId });

        try {
            const response = await fetch(`${BACKEND_URL}/api/verify-vc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ref, transactionId })
            });

            if (!response.ok) {
                throw new Error(`Verification failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('VC verification error:', error);
            throw error;
        }
    },

    // Query Verification Result
    getVerifyResult: async function(transactionId) {
        /**
         * Queries verification result from backend
         * Backend calls sandbox POST /api/oidvp/result
         *
         * Returns verification result with credential data
         */

        console.log('API: Query verification result', { transactionId });

        try {
            const response = await fetch(`${BACKEND_URL}/api/verify-result/${transactionId}`);

            if (response.status === 400) {
                // User hasn't uploaded data yet
                return { status: 'pending' };
            }

            if (!response.ok) {
                throw new Error(`Query failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Query result error:', error);
            throw error;
        }
    },

};
