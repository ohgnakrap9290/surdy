/**************************************************
 * GLOBAL STATE
 **************************************************/
let selectedMinutes = 30;
let mode = '';
let surgeryName = '';
let time = 0;
let timerInterval = null;
let isOperating = false;
let isOnBreak = false;
let breakCount = 0;
let breaksUsed = 0;
let successRate = 0;
let prevSuccessRate = 0;
let todayStudy = 0;
let totalStudy = 0;
// XP 시스템 — 누적형
let totalXP = 0;
let records = [];
let theme = 'dark';
let isSleepMode = false;
/**************************************************
 * INDEXED DB (iOS 안전 저장)
 **************************************************/
let surdyDB;
const dbRequest = indexedDB.open('SurdyDB', 1);
dbRequest.onupgradeneeded = () => {
    const db = dbRequest.result;
    if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
    }
};
dbRequest.onsuccess = () => {
    surdyDB = dbRequest.result;
    loadAllData(); // ★ 이제 여기에서 복원됨
};
window.addEventListener('load', () => {
    // IndexedDB가 열리면 복원됨
    // 여기서는 아무것도 복원하지 않음!
});
function restoreProgress() {
    const data = localStorage.getItem('SURDY_SAVE');
    if (!data) return;
    const save = JSON.parse(data);
    if (!save.isOperating) return;
    // 진행 중이던 수술 복원
    mode = save.mode;
    surgeryName = save.surgeryName;
    selectedMinutes = save.selectedMinutes;
    time = save.time;
    successRate = save.successRate;
    prevSuccessRate = save.prevSuccessRate;
    breakCount = save.breakCount;
    breaksUsed = save.breaksUsed;
    isOperating = true;
    // 화면 세팅
    showPage('surgery');
    document.getElementById('surgeryTitle').innerText = surgeryName;
    document.getElementById('logWindow').innerHTML = save.log;
    document.getElementById('patientInfo').innerText = save.patientInfo;
    updateTimerDisplay();
    updateTimeLeft();
    updateSuccessUI();
    drawMiniECG();
    // 타이머 다시 시작
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
}
/**************************************************
 * NAVIGATION
 **************************************************/
function showPage(id) {
    if (isOperating && id !== 'surgery') {
        alert('수술 중에는 이동할 수 없습니다.');
        return;
    }
    document
        .querySelectorAll('.page')
        .forEach((p) => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'records') updateRecordList('all');
    if (id === 'profile') updateTierUI();
}
document.querySelectorAll('#navbar span').forEach((btn) => {
    btn.onclick = () => showPage(btn.dataset.target);
});
/**************************************************
 * MODALS
 **************************************************/
function openInfo() {
    document.getElementById('infoModal').classList.remove('hidden');
}
function closeInfo() {
    document.getElementById('infoModal').classList.add('hidden');
}
function openTierInfo() {
    document.getElementById('tierModal').classList.remove('hidden');
}
function closeTierInfo() {
    document.getElementById('tierModal').classList.add('hidden');
}
/**************************************************
 * WHEEL PICKER
 **************************************************/
function updateMinutesFromWheel(v) {
    selectedMinutes = v;
    updateTraumaButton();
}
function updateTraumaButton() {
    const btn = document.getElementById('traumaBtn');
    if (selectedMinutes < 100) btn.classList.add('disabled');
    else btn.classList.remove('disabled');
}
/**************************************************
 * SURGERY NAMES
 **************************************************/
const regularNames = [
    '맹장 절제술',
    '담낭 절제술',
    '탈장 복원술',
    '대장 용종 제거',
    '반월상 연골 복원술',
    '고관절 핀 고정술',
];
const traumaNames = [
    '개흉 응급수술',
    '출혈 통제술',
    '복부 천공 봉합술',
    '대량출혈 혈관 결찰술',
    '중증 골반 골절 고정술',
];
function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
/**************************************************
 * SELECT SURGERY → BRIEFING
 **************************************************/
function selectSurgery(type) {
    mode = type;
    surgeryName =
        type === 'regular' ? randomPick(regularNames) : randomPick(traumaNames);
    const patient = `${randomPick([
        '김민수',
        '박서준',
        '최지우',
        '정혜린',
    ])} · ${randomPick([22, 34, 47, 58])}세`;
    document.getElementById('patientInfo').innerText = patient;
    document.getElementById('surgeryMode').innerText =
        type === 'regular' ? '정규 수술' : '⚠ 중증외상 수술 (XP ×3)';
    document.getElementById('surgeryName').innerText = `수술명: ${surgeryName}`;
    document.getElementById(
        'briefingTime'
    ).innerText = `수술 시간: ${selectedMinutes}분`;
    breakCount = Math.floor(selectedMinutes / 40);
    breaksUsed = 0;
    document.getElementById(
        'breakInfoBrief'
    ).innerText = `휴식 가능 횟수: ${breakCount}회 (1회 10분)`;
    showPage('briefing');
}
/**************************************************
 * START SURGERY
 **************************************************/
function startSurgery() {
    showPage('surgery');
    time = 0;
    isOperating = true;
    isOnBreak = false;
    breaksUsed = 0;
    document.getElementById('surgeryTitle').innerText = surgeryName;
    let startRate = 25 + Math.random() * 15;
    if (mode === 'trauma') startRate -= 7;
    successRate = prevSuccessRate = startRate;
    updateSuccessUI();
    document.getElementById('logWindow').innerHTML = '';
    drawMiniECG();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    const bb = document.getElementById('breakBtn');
    bb.onclick = startBreak;
    bb.disabled = breakCount === 0;
    bb.style.opacity = breakCount === 0 ? 0.4 : 1;
}
/**************************************************
 * TICK
 **************************************************/
function tick() {
    if (isOnBreak) return;
    time++;
    todayStudy++;
    totalStudy++;
    updateTimerDisplay();
    updateTimeLeft();
    if (time >= selectedMinutes * 60) {
        finishSurgery(false);
        return;
    }
    updateSuccessRate();
    maybeBonus();
    maybeDrop();
    if (time % 60 === 0) {
        logMessage(
            randomPick([
                '보조의: 기구 이상 없음.',
                '집도의: 출혈량 안정적.',
                '순환간호: 활력징후 정상 범위 유지.',
                '마취과: 산소포화도 안정 유지.',
                '보조의: 절개 부위 시야 확보 완료.',
            ])
        );
    }
    if (isSleepMode) {
        document.getElementById('sleep-timePassed').innerText =
            '경과: ' + document.getElementById('timer').innerText;
        document.getElementById('sleep-timeLeft').innerText =
            document.getElementById('timeLeft').innerText;
        document.getElementById('sleep-rate').innerText =
            '성공률: ' + successRate.toFixed(1) + '%';
    }
    autoSave();
}
/**************************************************
 * SUCCESS RATE — slower curve
 **************************************************/
function updateSuccessRate() {
    const target = mode === 'trauma' ? 67 : 86;
    const progress = time / (selectedMinutes * 60);
    const curve = Math.sin((progress * Math.PI) / 2) * 0.5;
    let newRate = successRate + (target - successRate) * (curve * 0.12);
    newRate += (Math.random() - 0.5) * 0.4;
    if (newRate < 0) newRate = 0;
    if (newRate > 100) newRate = 100;
    successRate = newRate;
    updateSuccessUI();
}
function updateSuccessUI() {
    const r = document.getElementById('successRate');
    r.innerText = successRate.toFixed(1) + '%';
    if (successRate >= 70) r.className = 'success-green';
    else if (successRate <= 40) r.className = 'success-red';
    else r.className = 'success-white';
    showRateChange(successRate - prevSuccessRate);
    prevSuccessRate = successRate;
}
function showRateChange(diff) {
    const el = document.getElementById('rateChange');
    if (Math.abs(diff) < 0.05) {
        el.style.opacity = 0;
        return;
    }
    el.innerText = (diff > 0 ? '+' : '') + diff.toFixed(2) + '%';
    el.style.color = diff > 0 ? '#00ff99' : '#ff4444';
    el.style.opacity = 1;
    if (el._timeout) clearTimeout(el._timeout);
    el._timeout = setTimeout(() => (el.style.opacity = 0), 1500);
}
/**************************************************
 * BONUS / DROP
 **************************************************/
function maybeBonus() {
    let chance = mode === 'trauma' ? 0.12 : selectedMinutes >= 90 ? 0.07 : 0.04;
    if (Math.random() < chance) {
        let amt = 3 + Math.random() * 3;
        successRate = Math.min(100, successRate + amt);
        logMessage(`상태 안정화 감지 (+${amt.toFixed(1)}%)`);
        showRateChange(amt);
    }
}
function maybeDrop() {
    if (Math.random() < 0.015) {
        let drop = 1 + Math.random() * 2;
        successRate = Math.max(0, successRate - drop);
        logMessage(`조직 반응 저하 (-${drop.toFixed(1)}%)`);
        updateSuccessUI();
    }
}
/**************************************************
 * DISTRACTION
 **************************************************/
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isOperating && !isOnBreak) {
        successRate = Math.max(0, successRate - 10);
        logMessage('모니터링 이탈 → 성공률 -10%');
        updateSuccessUI();
    }
});
/**************************************************
 * LOG
 **************************************************/
function logMessage(msg) {
    const log = document.getElementById('logWindow');
    log.innerHTML += msg + '<br>';
    log.scrollTop = log.scrollHeight;
}
/**************************************************
 * BREAK
 **************************************************/
function startBreak() {
    if (breaksUsed >= breakCount) return;
    breaksUsed++;
    isOnBreak = true;
    document.getElementById('breakInfo').innerText = `남은 휴식: ${
        breakCount - breaksUsed
    }회`;
    document.getElementById('breakScreen').classList.remove('hidden');
}
function endBreak() {
    isOnBreak = false;
    document.getElementById('breakScreen').classList.add('hidden');
}
/**************************************************
 * QUIT
 **************************************************/
function confirmQuit() {
    if (confirm('수술을 중단하시겠습니까?')) {
        finishSurgery(true);
    }
}
/**************************************************
 * TIMER UI
 **************************************************/
function updateTimerDisplay() {
    const m = String(Math.floor(time / 60)).padStart(2, '0');
    const s = String(time % 60).padStart(2, '0');
    document.getElementById('timer').innerText = `${m}:${s}`;
}
function updateTimeLeft() {
    const left = selectedMinutes * 60 - time;
    const m = String(Math.floor(left / 60)).padStart(2, '0');
    const s = String(left % 60).padStart(2, '0');
    document.getElementById('timeLeft').innerText = `남은 시간: ${m}:${s}`;
}
/**************************************************
 * XP / TIER / RANK SYSTEM
 **************************************************/
const tierTable = [
    { name: 'INTERN', min: 0, max: 1499, color: 'white' },
    { name: 'RESIDENT', min: 1500, max: 9999, color: '#4fb3ff' },
    { name: 'SPECIALIST', min: 10000, max: 29999, color: '#ffd86b' },
    { name: 'MASTER', min: 30000, max: 99999, color: '#c58bff' },
    { name: 'CHIEF SURGEON', min: 100000, max: Infinity, color: '#ff4c4c' },
];
function getTierRank(xp) {
    let tier = tierTable.find((t) => xp >= t.min && xp <= t.max);
    if (tier.name === 'CHIEF SURGEON') {
        return {
            tier: 'CHIEF SURGEON',
            rank: '',
            color: tier.color,
            progress: 1,
            nextXP: 1000,
        };
    }
    const span = tier.max - tier.min + 1;
    const unit = Math.floor(span / 3);
    const local = xp - tier.min;
    let rank = '';
    let progress = 0;
    if (local < unit) {
        rank = 'I';
        progress = local / unit;
    } else if (local < unit * 2) {
        rank = 'II';
        progress = (local - unit) / unit;
    } else {
        rank = 'III';
        progress = (local - unit * 2) / unit;
    }
    return {
        tier: tier.name,
        rank,
        color: tier.color,
        progress,
        nextXP: unit,
    };
}
let lastTier = '';
let lastRank = '';
/**************************************************
 * UPDATE PROFILE UI
 **************************************************/
function updateTierUI() {
    const info = getTierRank(totalXP);
    const tierEl = document.getElementById('profileTier');
    const xpEl = document.getElementById('xpText');
    tierEl.innerText = info.tier + (info.rank ? ` ${info.rank}` : '');
    tierEl.style.color = info.color;
    xpEl.innerText = `${Math.floor(info.progress * info.nextXP)} / ${
        info.nextXP
    }`;
    if (lastTier && lastRank) {
        if (info.tier !== lastTier)
            showTierPopup(lastTier, info.tier, info.color);
        else if (info.rank !== lastRank)
            showRankPopup(info.tier, lastRank, info.rank, info.color);
    }
    lastTier = info.tier;
    lastRank = info.rank;
}
/**************************************************
 * POPUP — RANK
 **************************************************/
function showRankPopup(tier, oldRank, newRank, color) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="
            background: rgba(5,25,25,0.95);
            border: 2px solid ${color};
            padding: 25px;
        ">
            <h2 style="color:${color}; font-size:24px;">승급!!</h2>
            <p style="font-size:22px; margin-top:10px;">
                ${tier} ${oldRank} → <br>
                <b style="color:${color}; font-size:24px;">${tier} ${newRank}</b>
            </p>
            <button class="main-btn" onclick="this.parentElement.parentElement.remove()">
                계속
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}
/**************************************************
 * POPUP — TIER
 **************************************************/
function showTierPopup(oldTier, newTier, color) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="
            background: rgba(10,30,30,0.98);
            border: 3px solid ${color};
            box-shadow: 0 0 40px ${color};
            padding: 35px;
        ">
            <h2 style="font-size:34px; font-weight:900; color:${color};">
                티어 승급!!
            </h2>
            <p style="margin-top:15px; font-size:26px;">
                ${oldTier} →<br>
                <b style="color:${color}; font-size:30px;">${newTier}</b>
            </p>
            <button class="main-btn" onclick="this.parentElement.parentElement.remove()"
                style="margin-top:25px;">
                계속
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}
/**************************************************
 * FINISH SURGERY
 **************************************************/
function finishSurgery(forceFail = false) {
    localStorage.removeItem('SURDY_SAVE');
    clearInterval(timerInterval);
    isOperating = false;
    isOnBreak = false;
    const finalRate = forceFail ? 0 : successRate;
    document.getElementById('resultTitle').innerText =
        finalRate >= 50 ? '수술 성공' : '수술 실패';
    let xpGain = 0;
    if (!forceFail && finalRate >= 50) {
        let base = selectedMinutes * (finalRate / 100);
        let rand = base * (Math.random() * 0.1 - 0.05);
        xpGain = Math.max(5, Math.floor(base + rand));
        if (mode === 'trauma') xpGain *= 3;
    }
    totalXP += xpGain;
    document.getElementById(
        'rewardInfo'
    ).innerText = `최종 성공률: ${finalRate.toFixed(1)}% | 획득 XP: ${xpGain}`;
    drawECG(finalRate);
    saveRecord(finalRate, xpGain);

    showPage('result');
    updateTierUI();
    saveProfileDB();
}

/**************************************************
 * RECORD
 **************************************************/
function saveRecord(rate, xp) {
    records.push({
        date: new Date().toLocaleString(),
        name: surgeryName,
        minutes: selectedMinutes,
        mode,
        success: rate.toFixed(1),
        xp,
    });
}
function updateRecordList(filter = 'all') {
    const list = document.getElementById('recordList');
    if (records.length === 0) {
        list.innerHTML = '기록이 없습니다.';
        return;
    }
    let filtered = records;
    if (filter === 'success') filtered = records.filter((r) => r.success >= 50);
    if (filter === 'fail') filtered = records.filter((r) => r.success < 50);
    list.innerHTML = filtered
        .map(
            (r) => `
        <div class="card">
            <b>${r.date}</b><br>
            ${r.name} (${r.mode})<br>
            시간: ${r.minutes}분<br>
            성공률: ${r.success}%<br>
            XP: ${r.xp}
        </div>
    `
        )
        .join('');
}
function filterRecords(type) {
    updateRecordList(type);
}
/**************************************************
 * ECG
 **************************************************/
function drawECG(finalRate) {
    const canvas = document.getElementById('ecg');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = finalRate >= 50 ? '#00ff99' : '#ff4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const mid = canvas.height / 2;
    for (let x = 0; x < canvas.width; x++) {
        ctx.lineTo(x, mid + Math.sin(x * 0.05) * 25);
    }
    ctx.stroke();
}
function drawMiniECG() {
    const canvas = document.getElementById('ecgMini');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#00ff99';
    ctx.beginPath();
    const mid = canvas.height / 2;
    for (let x = 0; x < canvas.width; x++) {
        ctx.lineTo(x, mid + Math.sin(x * 0.15) * 12);
    }
    ctx.stroke();
}
/**************************************************
 * GO HOME
 **************************************************/
function goHome() {
    showPage('home');
}
/**************************************************
 * XP TEST
 **************************************************/
function setTestXP() {
    let v = Number(document.getElementById('testXP').value);
    if (isNaN(v) || v < 0) {
        alert('올바른 XP를 입력하세요.');
        return;
    }
    totalXP = v;
    alert('XP 적용 완료');
    updateTierUI();
}
if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('/surdy/service-worker.js')
        .then(() => console.log('SW registered'))
        .catch((err) => console.log('SW fail:', err));
}
function enterSleepMode() {
    if (!isOperating) return;
    isSleepMode = true;
    document.getElementById('sleepOverlay').classList.remove('hidden');
}
function exitSleepMode() {
    isSleepMode = false;
    document.getElementById('sleepOverlay').classList.add('hidden');
}
document
    .getElementById('sleepOverlay')
    .addEventListener('click', exitSleepMode);
function autoSave() {
    const saveData = {
        isOperating,
        mode,
        surgeryName,
        selectedMinutes,
        time,
        successRate,
        prevSuccessRate,
        breakCount,
        breaksUsed,
        log: document.getElementById('logWindow').innerHTML,
        patientInfo: document.getElementById('patientInfo')?.innerText,
    };
    localStorage.setItem('SURDY_SAVE', JSON.stringify(saveData));
    saveProfileDB();
}
function restoreProgressFromDB(save) {
    if (!save || !save.isOperating) return;
    mode = save.mode;
    surgeryName = save.surgeryName;
    selectedMinutes = save.selectedMinutes;
    time = save.time;
    successRate = save.successRate;
    prevSuccessRate = save.prevSuccessRate;
    breakCount = save.breakCount;
    breaksUsed = save.breaksUsed;
    isOperating = true;
    showPage('surgery');
    document.getElementById('surgeryTitle').innerText = surgeryName;
    document.getElementById('logWindow').innerHTML = save.log;
    document.getElementById('patientInfo').innerText = save.patientInfo;
    updateTimerDisplay();
    updateTimeLeft();
    updateSuccessUI();
    drawMiniECG();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
}
function saveProgressDB() {
    if (!surdyDB) return;
    const tx = surdyDB.transaction('progress', 'readwrite');
    const store = tx.objectStore('progress');
    store.put({
        id: 'current',
        isOperating,
        mode,
        surgeryName,
        selectedMinutes,
        time,
        successRate,
        prevSuccessRate,
        breakCount,
        breaksUsed,
        log: document.getElementById('logWindow').innerHTML,
        patientInfo: document.getElementById('patientInfo')?.innerText,
    });
}
function saveProfileDB() {
    if (!surdyDB) return;
    const tx = surdyDB.transaction('profile', 'readwrite');
    const store = tx.objectStore('profile');
    store.put({
        id: 'profile',
        totalXP,
        records,
    });
}
function loadAllData() {
    if (!surdyDB) return;

    // 진행 중 수술 복원
    /* ----------------------------------------------------
       1) 진행 중 수술(progress) 복원하지 않기 (삭제)
    ---------------------------------------------------- */
    const tx1 = surdyDB.transaction('progress', 'readonly');
    const store1 = tx1.objectStore('progress');
    const req1 = store1.get('current');

    req1.onsuccess = () => {
        const save = req1.result;

        if (save && save.isOperating) {
            // 진행 중 수술 삭제
            const txDel = surdyDB.transaction('progress', 'readwrite');
            txDel.objectStore('progress').delete('current');
        }
    };

    // XP / 기록 복원
    /* ----------------------------------------------------
       2) XP / 수술 기록(profile) 복원하기
    ---------------------------------------------------- */
    const tx2 = surdyDB.transaction('profile', 'readonly');
    const store2 = tx2.objectStore('profile');
    const req2 = store2.get('profile');

    req2.onsuccess = () => {
        const data = req2.result;

        if (data) {
            totalXP = data.totalXP ?? 0;
            records = data.records ?? [];
        }

        // ★★★★★ 중요: UI 업데이트 꼭 해야 함 ★★★★★
        updateTierUI(); // XP 반영
        updateRecordList('all'); // 기록 목록 반영
    };
}
