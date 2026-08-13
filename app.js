/* ==========================================================================
   BADMINTON PENALTY & VIETQR PAYMENT TRACKER - JAVASCRIPT ENGINE (MBBANK)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        lucide.createIcons();
    }

    // --- Bank Mapping ---
    const BANK_MAPPING = {
        'MB': { bin: '970422', name: 'MBBank (Ngân hàng Quân Đội)' },
        'TCB': { bin: '970407', name: 'Techcombank' },
        'VCB': { bin: '970436', name: 'Vietcombank' },
        'VPB': { bin: '970432', name: 'VPBank' },
        'ACB': { bin: '970416', name: 'ACB' },
        'BIDV': { bin: '970418', name: 'BIDV' },
        'VTB': { bin: '970415', name: 'VietinBank' },
        'TPB': { bin: '970423', name: 'TPBank' },
        'STB': { bin: '970403', name: 'Sacombank' },
        'VIB': { bin: '970441', name: 'VIB' },
        'MSB': { bin: '970426', name: 'MSB' },
        'SHB': { bin: '970443', name: 'SHB' }
    };

    // --- Audio Sound Engine ---
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.enabled = true;
        }

        init() {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) this.ctx = new AudioContext();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        playPenaltySound() {
            if (!this.enabled) return;
            this.init();
            if (!this.ctx) return;

            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.3);

                gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.3);
            } catch (e) {
                console.error("Audio error:", e);
            }
        }

        playSuccessSound() {
            if (!this.enabled) return;
            this.init();
            if (!this.ctx) return;

            try {
                this.playTone(523.25, 'triangle', 0.15, 0);   // C5
                this.playTone(659.25, 'triangle', 0.15, 120); // E5
                this.playTone(783.99, 'triangle', 0.35, 240); // G5
            } catch (e) {}
        }

        playTone(freq, type, duration, delay = 0) {
            setTimeout(() => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            }, delay);
        }
    }

    const soundEngine = new SoundEngine();

    // --- State ---
    let currentMode = '2v2'; // '2v2' or '1v1'
    let shuttlePrice = parseInt(localStorage.getItem('badminton_shuttle_price') || '26000');
    let bankConfig = JSON.parse(localStorage.getItem('badminton_bank_config') || '{"bankId":"MB","accountNo":"","accountName":"","sepayToken":""}');
    let registeredPlayers = JSON.parse(localStorage.getItem('badminton_players') || '["Toàn", "Tú", "Phượng", "Tiến", "Hùng", "Nam"]');
    let playerPenalties = JSON.parse(localStorage.getItem('badminton_penalties') || '{}');
    let historyLog = JSON.parse(localStorage.getItem('badminton_penalty_history') || '[]');

    // Selection step state
    let selectedWinners = [];
    let selectedLosers = [];
    let currentPayPlayer = null;
    let currentQrUrl = '';
    let autoCheckInterval = null;

    // --- DOM Elements ---
    const elements = {
        inputShuttlePrice: document.getElementById('inputShuttlePrice'),
        btnBankSettings: document.getElementById('btnBankSettings'),
        btnMode1v1: document.getElementById('btnMode1v1'),
        btnMode2v2: document.getElementById('btnMode2v2'),

        stepGuideBox: document.getElementById('stepGuideBox'),
        stepBadge: document.getElementById('stepBadge'),
        stepTitle: document.getElementById('stepTitle'),
        stepSub: document.getElementById('stepSub'),

        winnerPreviewNames: document.getElementById('winnerPreviewNames'),
        loserPreviewNames: document.getElementById('loserPreviewNames'),
        btnClearSelection: document.getElementById('btnClearSelection'),

        playerTilesGrid: document.getElementById('playerTilesGrid'),
        btnAddPlayerBtn: document.getElementById('btnAddPlayerBtn'),

        penaltyList: document.getElementById('penaltyList'),
        totalShuttlesBadge: document.getElementById('totalShuttlesBadge'),
        totalMoneyBadge: document.getElementById('totalMoneyBadge'),

        btnAudioToggle: document.getElementById('btnAudioToggle'),
        audioIcon: document.getElementById('audioIcon'),
        btnShowHistory: document.getElementById('btnShowHistory'),
        btnResetAll: document.getElementById('btnResetAll'),

        // Bank Settings Modal
        bankModal: document.getElementById('bankModal'),
        bankForm: document.getElementById('bankForm'),
        bankSelect: document.getElementById('bankSelect'),
        bankAccNo: document.getElementById('bankAccNo'),
        bankAccName: document.getElementById('bankAccName'),
        sepayToken: document.getElementById('sepayToken'),
        btnCloseBank: document.getElementById('btnCloseBank'),

        // Payment Modal
        paymentModal: document.getElementById('paymentModal'),
        btnClosePayment: document.getElementById('btnClosePayment'),
        autoCheckBanner: document.getElementById('autoCheckBanner'),
        autoCheckText: document.getElementById('autoCheckText'),
        qrCodeImg: document.getElementById('qrCodeImg'),
        payPlayerName: document.getElementById('payPlayerName'),
        payAmount: document.getElementById('payAmount'),
        payBankInfo: document.getElementById('payBankInfo'),
        payMemo: document.getElementById('payMemo'),
        btnCopyAccNo: document.getElementById('btnCopyAccNo'),
        btnCopyMemo: document.getElementById('btnCopyMemo'),
        btnDownloadQr: document.getElementById('btnDownloadQr'),
        btnMarkPaid: document.getElementById('btnMarkPaid'),

        // Add Player Modal
        addPlayerModal: document.getElementById('addPlayerModal'),
        addPlayerForm: document.getElementById('addPlayerForm'),
        newPlayerName: document.getElementById('newPlayerName'),
        btnCloseAddPlayer: document.getElementById('btnCloseAddPlayer'),

        // History Modal
        historyModal: document.getElementById('historyModal'),
        btnCloseHistory: document.getElementById('btnCloseHistory'),
        historyLogList: document.getElementById('historyLogList'),

        toastContainer: document.getElementById('toastContainer')
    };

    // Initialize Bank Inputs
    elements.inputShuttlePrice.value = shuttlePrice;
    elements.bankSelect.value = bankConfig.bankId || 'MB';
    elements.bankAccNo.value = bankConfig.accountNo || '';
    elements.bankAccName.value = bankConfig.accountName || '';
    elements.sepayToken.value = bankConfig.sepayToken || '';

    // --- Helpers ---
    function formatMoney(amount) {
        return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function saveState() {
        localStorage.setItem('badminton_shuttle_price', shuttlePrice.toString());
        localStorage.setItem('badminton_bank_config', JSON.stringify(bankConfig));
        localStorage.setItem('badminton_players', JSON.stringify(registeredPlayers));
        localStorage.setItem('badminton_penalties', JSON.stringify(playerPenalties));
        localStorage.setItem('badminton_penalty_history', JSON.stringify(historyLog));
    }

    function getNeededCount() {
        return currentMode === '2v2' ? 2 : 1;
    }

    // --- Server-Sent Events (Real-time SePay Webhook Listener) ---
    function initRealtimeSePayListener() {
        if (!!window.EventSource) {
            const source = new EventSource('/api/events');

            source.addEventListener('message', (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.type === 'SEPAY_TRANSACTION') {
                        console.log("⚡ Instant SePay Webhook Event Received:", data);
                        handleIncomingTransaction(data.amount, data.content);
                    }
                } catch (err) {
                    console.error("SSE parse error:", err);
                }
            });
        }
    }

    function handleIncomingTransaction(amount, content) {
        if (!content) return;
        const normalizedContent = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        registeredPlayers.forEach(playerName => {
            const normalizedPlayer = playerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            if (normalizedContent.includes(normalizedPlayer)) {
                markPlayerAsPaid(playerName, true, amount);
            }
        });
    }

    // --- Selection UI ---
    function updateSelectionUI() {
        const needed = getNeededCount();
        const deltaQuả = currentMode === '2v2' ? 0.5 : 1.0;
        const deltaTiền = deltaQuả * shuttlePrice;

        if (selectedWinners.length < needed) {
            elements.stepGuideBox.className = 'step-guide-box step-winner';
            elements.stepBadge.textContent = 'LẦN BẤM 1';
            elements.stepTitle.textContent = `🏆 CHỌN NGƯỜI THẮNG (${selectedWinners.length}/${needed})`;
            elements.stepSub.textContent = `Bấm chọn ${needed} người chiến thắng trận này`;
        } else if (selectedLosers.length < needed) {
            elements.stepGuideBox.className = 'step-guide-box step-loser';
            elements.stepBadge.textContent = 'LẦN BẤM 2';
            elements.stepTitle.textContent = `❌ CHỌN NGƯỜI THUA (${selectedLosers.length}/${needed})`;
            elements.stepSub.textContent = `Bấm chọn ${needed} người thua trận này (+${deltaQuả} quả / ${formatMoney(deltaTiền)})`;
        }

        elements.winnerPreviewNames.textContent = selectedWinners.length > 0 ? selectedWinners.join(' & ') : 'Chưa chọn';
        elements.loserPreviewNames.textContent = selectedLosers.length > 0 ? selectedLosers.join(' & ') : 'Chưa chọn';

        // Render Player Tiles
        elements.playerTilesGrid.innerHTML = '';
        registeredPlayers.forEach(name => {
            const tile = document.createElement('div');
            let isWinner = selectedWinners.includes(name);
            let isLoser = selectedLosers.includes(name);

            let tileClass = 'player-tile';
            let badgeHtml = '';

            if (isWinner) {
                tileClass += ' selected-winner';
                badgeHtml = '<span class="status-icon-badge">🏆 THẮNG</span>';
            } else if (isLoser) {
                tileClass += ' selected-loser';
                badgeHtml = '<span class="status-icon-badge">❌ THUA</span>';
            }

            tile.className = tileClass;
            tile.innerHTML = `
                <div class="tile-name">${name}</div>
                ${badgeHtml}
            `;

            tile.addEventListener('click', () => handlePlayerTileClick(name));
            elements.playerTilesGrid.appendChild(tile);
        });
    }

    function handlePlayerTileClick(name) {
        const needed = getNeededCount();

        if (selectedWinners.includes(name)) {
            selectedWinners = selectedWinners.filter(n => n !== name);
            updateSelectionUI();
            return;
        }

        if (selectedLosers.includes(name)) {
            selectedLosers = selectedLosers.filter(n => n !== name);
            updateSelectionUI();
            return;
        }

        if (selectedWinners.length < needed) {
            selectedWinners.push(name);
            updateSelectionUI();
            if (selectedWinners.length === needed) {
                showToast(`🏆 Đã chọn bên THẮNG: ${selectedWinners.join(' & ')} ➔ Bấm chọn bên THUA`);
            }
            return;
        }

        if (selectedLosers.length < needed) {
            selectedLosers.push(name);
            updateSelectionUI();

            if (selectedLosers.length === needed) {
                commitMatchResult();
            }
        }
    }

    function commitMatchResult() {
        const deltaQuả = currentMode === '2v2' ? 0.5 : 1.0;
        const deltaTiền = deltaQuả * shuttlePrice;

        const winnersStr = selectedWinners.join(' & ');
        const losersStr = selectedLosers.join(' & ');

        selectedLosers.forEach(name => {
            playerPenalties[name] = (playerPenalties[name] || 0) + deltaQuả;
        });

        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        historyLog.unshift({
            time: timeStr,
            winners: winnersStr,
            losers: losersStr,
            penalty: deltaQuả,
            money: deltaTiền,
            mode: currentMode
        });

        soundEngine.playPenaltySound();
        saveState();

        showToast(`🏆 ${winnersStr} THẮNG  ➔  ❌ ${losersStr} THUA (+${deltaQuả} quả / ${formatMoney(deltaTiền)})!`);

        clearSelections();
        renderLeaderboard();
    }

    function clearSelections() {
        selectedWinners = [];
        selectedLosers = [];
        updateSelectionUI();
    }

    // --- VietQR Payment & Auto Check Engine ---
    function openPaymentModal(playerName) {
        if (!bankConfig.accountNo) {
            showToast("⚠️ Vui lòng bấm vào 'Cài STK & Auto Check' để nhập STK MBBank!");
            elements.bankModal.classList.add('active');
            return;
        }

        const count = playerPenalties[playerName] || 0;
        const amount = count * shuttlePrice;

        if (amount <= 0) {
            showToast(`${playerName} không nợ tiền cầu nào!`);
            return;
        }

        currentPayPlayer = playerName;

        const memo = `Den cau ${playerName}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
        const bankId = bankConfig.bankId || 'MB';
        const bankInfo = BANK_MAPPING[bankId] || { name: 'MBBank', bin: '970422' };
        const accountNo = bankConfig.accountNo;
        const accountName = bankConfig.accountName || '';

        // Official VietQR API Image URL for MBBank
        currentQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}`;
        if (accountName) {
            currentQrUrl += `&accountName=${encodeURIComponent(accountName)}`;
        }

        elements.qrCodeImg.src = currentQrUrl;
        elements.payPlayerName.textContent = playerName;
        elements.payAmount.textContent = formatMoney(amount);
        elements.payBankInfo.textContent = `${bankInfo.name} - ${accountNo}`;
        elements.payMemo.textContent = memo;

        elements.paymentModal.classList.add('active');

        startAutoCheckPolling(playerName, amount, memo);
    }

    function startAutoCheckPolling(playerName, expectedAmount, memoText) {
        stopAutoCheckPolling();

        if (bankConfig.sepayToken) {
            elements.autoCheckText.textContent = `Đang tự động quét tiền về MBBank từ SePay API...`;
        } else {
            elements.autoCheckText.textContent = `Đang chờ phát tín hiệu chuyển khoản MBBank...`;
        }

        autoCheckInterval = setInterval(() => {
            if (!currentPayPlayer || currentPayPlayer !== playerName) return;

            if (bankConfig.sepayToken && bankConfig.accountNo) {
                const apiUrl = `https://my.sepay.vn/userapi/transactions/list?account_number=${bankConfig.accountNo}`;
                fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${bankConfig.sepayToken}`,
                        'Content-Type': 'application/json'
                    }
                })
                .then(res => res.json())
                .then(data => {
                    if (data && data.transactions && Array.isArray(data.transactions)) {
                        const match = data.transactions.find(t => {
                            const matchAmount = parseInt(t.amount_in) >= expectedAmount;
                            const matchMemo = t.transaction_content && t.transaction_content.toLowerCase().includes(playerName.toLowerCase());
                            return matchAmount && matchMemo;
                        });

                        if (match) {
                            markPlayerAsPaid(playerName, true, match.amount_in);
                        }
                    }
                })
                .catch(err => console.error("SePay MBBank API Error:", err));
            }
        }, 4000);
    }

    function stopAutoCheckPolling() {
        if (autoCheckInterval) {
            clearInterval(autoCheckInterval);
            autoCheckInterval = null;
        }
    }

    function markPlayerAsPaid(playerName, isAuto = false, amountReceived = 0) {
        playerPenalties[playerName] = 0;
        saveState();
        renderLeaderboard();
        stopAutoCheckPolling();
        elements.paymentModal.classList.remove('active');
        soundEngine.playSuccessSound();

        if (isAuto) {
            showToast(`🎉 SEPAY XÁC NHẬN: ${playerName} đã chuyển MBBank ${formatMoney(amountReceived || 0)} thành công!`);
        } else {
            showToast(`🎉 XÁC NHẬN: ${playerName} đã thanh toán hết nợ!`);
        }
    }

    // --- Render Leaderboard ---
    function renderLeaderboard() {
        registeredPlayers.forEach(name => {
            if (playerPenalties[name] === undefined) {
                playerPenalties[name] = 0;
            }
        });

        const sortedPlayers = [...registeredPlayers];
        sortedPlayers.sort((a, b) => (playerPenalties[b] || 0) - (playerPenalties[a] || 0));

        elements.penaltyList.innerHTML = '';
        let grandTotalShuttles = 0;

        sortedPlayers.forEach((name, index) => {
            const count = playerPenalties[name] || 0;
            grandTotalShuttles += count;

            const moneyOwed = count * shuttlePrice;
            const isLeader = index === 0 && count > 0;

            const card = document.createElement('div');
            card.className = `penalty-card-item ${isLeader ? 'leader' : ''}`;
            card.innerHTML = `
                <div class="player-info">
                    <div class="player-avatar">${name.charAt(0).toUpperCase()}</div>
                    <div class="player-name-text">${name}</div>
                </div>

                <div class="penalty-controls">
                    <div class="shuttle-count-box">
                        <div class="shuttle-count-val">
                            <span>${count}</span> <span style="font-size:1.2rem;">🏸</span>
                        </div>
                        <div class="player-money-val">${formatMoney(moneyOwed)}</div>
                    </div>

                    ${moneyOwed > 0 ? `
                        <button class="btn-pay-qr" data-pay-name="${name}">
                            💳 QR CẦU
                        </button>
                    ` : ''}

                    <div class="btn-group-counter">
                        <button class="btn-counter btn-minus" data-name="${name}">-0.5</button>
                        <button class="btn-counter btn-plus" data-name="${name}">+0.5</button>
                    </div>
                </div>
            `;
            elements.penaltyList.appendChild(card);
        });

        const grandTotalMoney = grandTotalShuttles * shuttlePrice;
        elements.totalShuttlesBadge.textContent = `${grandTotalShuttles} quả`;
        elements.totalMoneyBadge.textContent = `${formatMoney(grandTotalMoney)}`;

        // Register Pay QR button events
        document.querySelectorAll('.btn-pay-qr').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.getAttribute('data-pay-name');
                openPaymentModal(name);
            });
        });

        // Counter buttons
        document.querySelectorAll('.btn-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.getAttribute('data-name');
                if (playerPenalties[name] > 0) {
                    playerPenalties[name] = Math.max(0, playerPenalties[name] - 0.5);
                    saveState();
                    renderLeaderboard();
                }
            });
        });

        document.querySelectorAll('.btn-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.getAttribute('data-name');
                playerPenalties[name] = (playerPenalties[name] || 0) + 0.5;
                saveState();
                renderLeaderboard();
            });
        });
    }

    function renderHistoryLog() {
        elements.historyLogList.innerHTML = '';
        if (historyLog.length === 0) {
            elements.historyLogList.innerHTML = '<p class="empty-msg">Chưa có trận nào được ghi nhận.</p>';
            return;
        }

        historyLog.forEach(log => {
            const item = document.createElement('div');
            item.className = 'history-log-item';
            item.innerHTML = `
                <div>
                    🏆 <strong>${log.winners}</strong> thắng ➔ ❌ <strong>${log.losers}</strong> thua
                </div>
                <div style="font-size: 0.8rem; opacity: 0.8; text-align: right;">
                    +${log.penalty} quả / người (${formatMoney(log.money)})<br>
                    <span style="opacity: 0.6;">${log.time}</span>
                </div>
            `;
            elements.historyLogList.appendChild(item);
        });
    }

    // --- Mode Switch ---
    function setMode(mode) {
        currentMode = mode;
        clearSelections();
        if (mode === '2v2') {
            elements.btnMode2v2.classList.add('active');
            elements.btnMode1v1.classList.remove('active');
        } else {
            elements.btnMode1v1.classList.add('active');
            elements.btnMode2v2.classList.remove('active');
        }
        updateSelectionUI();
    }

    // --- Event Listeners ---
    elements.inputShuttlePrice.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val >= 0) {
            shuttlePrice = val;
            saveState();
            updateSelectionUI();
            renderLeaderboard();
            showToast(`Đã đổi giá quả cầu: ${formatMoney(shuttlePrice)}`);
        }
    });

    elements.btnMode1v1.addEventListener('click', () => setMode('1v1'));
    elements.btnMode2v2.addEventListener('click', () => setMode('2v2'));
    elements.btnClearSelection.addEventListener('click', clearSelections);

    // Bank settings modal
    elements.btnBankSettings.addEventListener('click', () => elements.bankModal.classList.add('active'));
    elements.btnCloseBank.addEventListener('click', () => elements.bankModal.classList.remove('active'));

    elements.bankForm.addEventListener('submit', (e) => {
        e.preventDefault();
        bankConfig.bankId = elements.bankSelect.value;
        bankConfig.accountNo = elements.bankAccNo.value.trim();
        bankConfig.accountName = elements.bankAccName.value.trim().toUpperCase();
        bankConfig.sepayToken = elements.sepayToken.value.trim();

        saveState();
        elements.bankModal.classList.remove('active');
        showToast("✅ Đã lưu cấu hình tài khoản MBBank & SePay Token!");
    });

    // Payment modal copy & mark paid events
    elements.btnClosePayment.addEventListener('click', () => {
        stopAutoCheckPolling();
        elements.paymentModal.classList.remove('active');
    });

    elements.btnCopyAccNo.addEventListener('click', () => {
        if (bankConfig.accountNo) {
            navigator.clipboard.writeText(bankConfig.accountNo);
            showToast("📋 Đã sao chép Số Tài Khoản MBBank!");
        }
    });

    elements.btnCopyMemo.addEventListener('click', () => {
        const memo = elements.payMemo.textContent;
        navigator.clipboard.writeText(memo);
        showToast("📋 Đã sao chép Nội dung chuyển khoản!");
    });

    // Download QR Image handler
    elements.btnDownloadQr.addEventListener('click', () => {
        if (currentQrUrl) {
            fetch(currentQrUrl)
                .then(res => res.blob())
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `VietQR_MBBank_${currentPayPlayer}_${Date.now()}.png`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    showToast("📥 Đã tải ảnh QR MBBank về máy!");
                })
                .catch(err => {
                    console.error(err);
                    window.open(currentQrUrl, '_blank');
                });
        }
    });

    elements.btnMarkPaid.addEventListener('click', () => {
        if (currentPayPlayer) {
            markPlayerAsPaid(currentPayPlayer, false);
        }
    });

    // Add Player Modal
    elements.btnAddPlayerBtn.addEventListener('click', () => elements.addPlayerModal.classList.add('active'));
    elements.btnCloseAddPlayer.addEventListener('click', () => elements.addPlayerModal.classList.remove('active'));

    elements.addPlayerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = elements.newPlayerName.value.trim();
        if (name && !registeredPlayers.includes(name)) {
            registeredPlayers.push(name);
            playerPenalties[name] = 0;
            saveState();
            updateSelectionUI();
            renderLeaderboard();
            elements.newPlayerName.value = '';
            elements.addPlayerModal.classList.remove('active');
            showToast(`Đã thêm người chơi: ${name}`);
        }
    });

    // History Modal
    elements.btnShowHistory.addEventListener('click', () => {
        renderHistoryLog();
        elements.historyModal.classList.add('active');
    });

    elements.btnCloseHistory.addEventListener('click', () => elements.historyModal.classList.remove('active'));

    // Reset All
    elements.btnResetAll.addEventListener('click', () => {
        if (confirm("Bạn có chắc chắn muốn đặt lại tất cả số quả cầu và tiền phạt về 0?")) {
            playerPenalties = {};
            historyLog = [];
            clearSelections();
            stopAutoCheckPolling();
            saveState();
            renderLeaderboard();
            showToast("Đã đặt lại toàn bộ!");
        }
    });

    elements.btnAudioToggle.addEventListener('click', () => {
        soundEngine.enabled = !soundEngine.enabled;
        elements.audioIcon.setAttribute('data-lucide', soundEngine.enabled ? 'volume-2' : 'volume-x');
        if (window.lucide) lucide.createIcons();
        showToast(soundEngine.enabled ? "Đã bật âm thanh" : "Đã tắt âm thanh");
    });

    // Init
    initRealtimeSePayListener();
    updateSelectionUI();
    renderLeaderboard();
});
