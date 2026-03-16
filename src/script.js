import {
    auth,
    db,
    get,
    onAuthStateChanged,
    onValue,
    ref,
    set,
    signInWithEmailAndPassword,
    signOut
} from "./firebase-service.js";
import {
    MATCH_IDS,
    buildMatchScopedUrl,
    buildMatchStatePath,
    buildUserProfilePath,
    cacheAssignedProfile,
    cacheMatchState,
    clearCachedAssignedProfile,
    clearPendingSync,
    createDefaultScoreboardState,
    getMatchLabel,
    getRequestedMatchId,
    markPendingSync,
    normalizeScoreboardState,
    readCachedAssignedProfile,
    readCachedMatchState,
    readPendingSync,
    stampState
} from "./scoreboard-shared.js";

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', (event) => event.preventDefault());

    const homeScoreEl = document.getElementById('home-score');
    const awayScoreEl = document.getElementById('away-score');
    const gameClockEl = document.getElementById('game-clock');
    const shotClockEl = document.getElementById('shot-clock');
    const quarterEl = document.getElementById('quarter-display');
    const homeFoulsEl = document.getElementById('home-fouls');
    const awayFoulsEl = document.getElementById('away-fouls');
    const homeTimeoutsEl = document.getElementById('home-timeouts');
    const awayTimeoutsEl = document.getElementById('away-timeouts');
    const helpModal = document.getElementById('help-modal');
    const helpCloseBtn = helpModal ? helpModal.querySelector('.close-button') : null;
    const controlsInfoEl = document.getElementById('controls-info');
    const sessionMatchLabelEl = document.getElementById('active-match-label');
    const sessionUserLabelEl = document.getElementById('active-user-label');
    const sessionSyncStatusEl = document.getElementById('sync-status-label');
    const scoreboardEl = document.querySelector('.scoreboard');

    const controlPanelModal = document.getElementById('control-panel-modal');
    const controlCloseBtn = document.getElementById('control-close-button');
    const homeTeamInput = document.getElementById('home-team-input');
    const awayTeamInput = document.getElementById('away-team-input');
    const homeScoreInput = document.getElementById('home-score-input');
    const awayScoreInput = document.getElementById('away-score-input');
    const homeFoulsInput = document.getElementById('home-fouls-input');
    const awayFoulsInput = document.getElementById('away-fouls-input');
    const homeTimeoutsInput = document.getElementById('home-timeouts-input');
    const awayTimeoutsInput = document.getElementById('away-timeouts-input');
    const gameMinutesInput = document.getElementById('game-minutes-input');
    const gameSecondsInput = document.getElementById('game-seconds-input');
    const shotClockInput = document.getElementById('shot-clock-input');
    const quarterInput = document.getElementById('quarter-input');
    const ballPossessionInput = document.getElementById('ball-possession-input');
    const applyChangesBtn = document.getElementById('apply-changes');
    const resetAllBtn = document.getElementById('reset-all');
    const startGameClockBtn = document.getElementById('start-game-clock');
    const stopGameClockBtn = document.getElementById('stop-game-clock');
    const startShotClockBtn = document.getElementById('start-shot-clock');
    const stopShotClockBtn = document.getElementById('stop-shot-clock');
    const defaultGameMinutesInput = document.getElementById('default-game-minutes');
    const defaultShotClockInput = document.getElementById('default-shot-clock');
    const defaultTimeoutsInput = document.getElementById('default-timeouts');
    const defaultQuarterInput = document.getElementById('default-quarter');
    const defaultHomeTeamInput = document.getElementById('default-home-team');
    const defaultAwayTeamInput = document.getElementById('default-away-team');
    const applyDefaultsBtn = document.getElementById('apply-defaults');

    const loginModal = document.getElementById('login-modal');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginStatus = document.getElementById('login-status');
    const controlUsernameInput = document.getElementById('control-username-input');
    const controlPasswordInput = document.getElementById('control-password-input');
    const controlLoginBtn = document.getElementById('control-login-btn');
    const controlLogoutBtn = document.getElementById('control-logout-btn');
    const controlLoginStatus = document.getElementById('control-login-status');

    let requestedMatchId = getRequestedMatchId();
    let activeMatchId = requestedMatchId;
    let scoreboardState = createDefaultScoreboardState(activeMatchId);
    let currentUser = null;
    let currentProfile = null;
    let isAuthenticated = false;
    let stateRef = ref(db, buildMatchStatePath(activeMatchId));
    let unsubscribeFromState = null;
    let isSeedingMatchState = false;
    let gameTimerInterval = null;
    let shotClockTimerInterval = null;

    function updateDocumentTitle() {
        document.title = `Basketball Scoreboard - ${getMatchLabel(activeMatchId)}`;
    }

    function setControlInfo(message) {
        if (controlsInfoEl) {
            controlsInfoEl.textContent = message;
        }
    }

    function wrapClockChars(timeString) {
        return timeString.split('').map((char) => {
            const className = (char === ':' || char === '.') ? 'clock-char colon' : 'clock-char';
            return `<span class="${className}">${char}</span>`;
        }).join('');
    }

    function updateTeamName(elementId, newName, arrowId) {
        const element = document.getElementById(elementId);
        if (!element) {
            return;
        }

        const existingArrow = element.querySelector('.possession-arrow');
        if (existingArrow) {
            existingArrow.remove();
        }

        element.textContent = newName;
        const arrowDiv = document.createElement('div');
        arrowDiv.className = 'possession-arrow';
        arrowDiv.id = arrowId;
        element.appendChild(arrowDiv);
    }

    function updateBallPossessionIndicator() {
        const homeArrow = document.getElementById('home-possession-arrow');
        const awayArrow = document.getElementById('away-possession-arrow');

        if (!homeArrow || !awayArrow) {
            return;
        }

        homeArrow.classList.remove('active');
        awayArrow.classList.remove('active');

        if (scoreboardState.ballPossession === 'home') {
            homeArrow.classList.add('active');
        } else {
            awayArrow.classList.add('active');
        }
    }

    function updateFoulBonusStyling() {
        const homeFoulBox = document.querySelector('.foul-box.home');
        const awayFoulBox = document.querySelector('.foul-box.away');

        if (homeFoulBox) {
            homeFoulBox.classList.toggle('penalty', scoreboardState.homeFouls >= 5);
        }
        if (awayFoulBox) {
            awayFoulBox.classList.toggle('penalty', scoreboardState.awayFouls >= 5);
        }
    }

    function updateDisplay() {
        if (scoreboardEl) {
            scoreboardEl.classList.remove('locked');
        }

        if (homeScoreEl) homeScoreEl.textContent = String(scoreboardState.homeScore).padStart(2, '0');
        if (awayScoreEl) awayScoreEl.textContent = String(scoreboardState.awayScore).padStart(2, '0');

        if (gameClockEl) {
            const timeString = scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds < 60
                ? `${String(scoreboardState.gameSeconds).padStart(2, '0')}.${Math.floor(scoreboardState.gameMilliseconds / 100)}`
                : `${String(scoreboardState.gameMinutes).padStart(2, '0')}:${String(scoreboardState.gameSeconds).padStart(2, '0')}`;
            gameClockEl.innerHTML = wrapClockChars(timeString);
        }

        if (shotClockEl) shotClockEl.textContent = String(scoreboardState.shotClockSeconds).padStart(2, '0');
        if (quarterEl) {
            quarterEl.textContent = scoreboardState.quarter <= 4
                ? `Q${scoreboardState.quarter}`
                : `OT${scoreboardState.quarter - 4}`;
        }
        if (homeFoulsEl) homeFoulsEl.textContent = scoreboardState.homeFouls;
        if (awayFoulsEl) awayFoulsEl.textContent = scoreboardState.awayFouls;
        if (homeTimeoutsEl) homeTimeoutsEl.textContent = scoreboardState.homeTimeouts;
        if (awayTimeoutsEl) awayTimeoutsEl.textContent = scoreboardState.awayTimeouts;

        updateTeamName('home-team-name', scoreboardState.homeTeamName, 'home-possession-arrow');
        updateTeamName('away-team-name', scoreboardState.awayTeamName, 'away-possession-arrow');
        updateBallPossessionIndicator();
        updateFoulBonusStyling();
    }

    function showLoginStatus(message, type = 'info') {
        [loginStatus, controlLoginStatus].forEach((element) => {
            if (!element) {
                return;
            }

            element.textContent = message;
            element.className = `login-status ${type}`;
        });
    }

    function getSyncStatusText() {
        const hasPendingSync = Boolean(readPendingSync(activeMatchId));
        if (!navigator.onLine && hasPendingSync) {
            return 'Offline - changes cached';
        }
        if (!navigator.onLine) {
            return 'Offline';
        }
        if (hasPendingSync) {
            return 'Sync pending';
        }
        return 'Online';
    }

    function updateSessionBanner() {
        if (sessionMatchLabelEl) {
            sessionMatchLabelEl.textContent = getMatchLabel(activeMatchId);
        }

        if (sessionUserLabelEl) {
            if (currentProfile) {
                const displayName = currentProfile.displayName || currentUser?.email || 'Authenticated user';
                sessionUserLabelEl.textContent = `${displayName} | ${currentProfile.role}`;
            } else {
                sessionUserLabelEl.textContent = 'View only';
            }
        }

        if (sessionSyncStatusEl) {
            sessionSyncStatusEl.textContent = getSyncStatusText();
        }
    }

    function updateScoreboardAccess() {
        if (logoutBtn) logoutBtn.style.display = isAuthenticated ? 'inline-block' : 'none';
        if (loginBtn) loginBtn.style.display = isAuthenticated ? 'none' : 'inline-block';
        if (controlLogoutBtn) controlLogoutBtn.style.display = isAuthenticated ? 'inline-block' : 'none';
        if (controlLoginBtn) controlLoginBtn.style.display = isAuthenticated ? 'none' : 'inline-block';
        updateSessionBanner();
    }

    function canEditActiveMatch() {
        return Boolean(isAuthenticated && currentProfile && currentProfile.assignedMatchId === activeMatchId);
    }

    function setLocalScoreboardState(nextState) {
        scoreboardState = normalizeScoreboardState(nextState, activeMatchId);
        cacheMatchState(activeMatchId, scoreboardState);
        updateDisplay();
        updateSessionBanner();
    }

    function buildStampedState(nextState) {
        return stampState(nextState, activeMatchId, currentUser?.uid || 'offline-cached-user');
    }

    async function persistScoreboardState(nextState) {
        const stampedState = buildStampedState(nextState);
        setLocalScoreboardState(stampedState);

        if (!canEditActiveMatch()) {
            return;
        }

        if (!navigator.onLine) {
            markPendingSync(activeMatchId, stampedState);
            return;
        }

        try {
            await set(stateRef, stampedState);
            clearPendingSync(activeMatchId);
        } catch (error) {
            console.error('Realtime sync failed, caching changes locally.', error);
            markPendingSync(activeMatchId, stampedState);
            showLoginStatus('Connection issue detected. Changes were saved locally.', 'info');
        }

        updateSessionBanner();
    }

    async function flushPendingSync() {
        if (!canEditActiveMatch() || !navigator.onLine) {
            return;
        }

        const pendingSync = readPendingSync(activeMatchId);
        if (!pendingSync?.state) {
            return;
        }

        try {
            const stampedState = buildStampedState(pendingSync.state);
            await set(stateRef, stampedState);
            clearPendingSync(activeMatchId);
            setLocalScoreboardState(stampedState);
            showLoginStatus(`Synced ${getMatchLabel(activeMatchId)} successfully.`, 'success');
        } catch (error) {
            console.error('Unable to flush pending sync.', error);
            markPendingSync(activeMatchId, pendingSync.state);
        }
    }

    function applyUpdates(updates) {
        void persistScoreboardState({
            ...scoreboardState,
            ...updates
        });
    }

    async function seedMatchStateIfNeeded() {
        if (isSeedingMatchState || !canEditActiveMatch() || !navigator.onLine) {
            return;
        }

        isSeedingMatchState = true;
        try {
            await persistScoreboardState(scoreboardState);
        } finally {
            isSeedingMatchState = false;
        }
    }

    function clearTimerIntervals() {
        clearInterval(gameTimerInterval);
        clearInterval(shotClockTimerInterval);
        gameTimerInterval = null;
        shotClockTimerInterval = null;
    }

    function stopTimersLocally() {
        clearTimerIntervals();
        scoreboardState = normalizeScoreboardState({
            ...scoreboardState,
            isGameClockRunning: false,
            isShotClockRunning: false
        }, activeMatchId);
        cacheMatchState(activeMatchId, scoreboardState);
        updateDisplay();
        updateSessionBanner();
    }

    function showLoginPrompt() {
        if (!loginModal) {
            return;
        }

        loginModal.style.display = 'block';
        if (usernameInput) {
            usernameInput.focus();
        }
    }

    function hideLoginModal() {
        if (loginModal) {
            loginModal.style.display = 'none';
        }
    }

    function hideControlPanel() {
        if (controlPanelModal) {
            controlPanelModal.style.display = 'none';
        }
    }

    function showHelp() {
        if (helpModal) helpModal.style.display = 'block';
    }

    function hideHelp() {
        if (helpModal) helpModal.style.display = 'none';
    }

    function getCredentials(source) {
        const emailElement = source === 'control' ? controlUsernameInput : usernameInput;
        const passwordElement = source === 'control' ? controlPasswordInput : passwordInput;
        return {
            email: emailElement?.value.trim() || '',
            password: passwordElement?.value || ''
        };
    }

    function clearCredentialInputs() {
        [usernameInput, passwordInput, controlUsernameInput, controlPasswordInput].forEach((element) => {
            if (element) {
                element.value = '';
            }
        });
    }

    function sanitizeProfile(rawProfile, user) {
        if (!rawProfile || rawProfile.isActive === false || !MATCH_IDS.includes(rawProfile.assignedMatchId)) {
            return null;
        }

        return {
            uid: user.uid,
            email: user.email || '',
            displayName: String(rawProfile.displayName || user.email || 'Operator'),
            role: String(rawProfile.role || 'operator'),
            assignedMatchId: rawProfile.assignedMatchId,
            isActive: rawProfile.isActive !== false
        };
    }

    async function loadUserProfile(user) {
        try {
            const profileSnapshot = await get(ref(db, buildUserProfilePath(user.uid)));
            if (profileSnapshot.exists()) {
                const profile = sanitizeProfile(profileSnapshot.val(), user);
                if (profile) {
                    cacheAssignedProfile(profile);
                    return profile;
                }
            }
        } catch (error) {
            console.warn('Unable to load profile from Firebase, attempting cached profile.', error);
        }

        const cachedProfile = readCachedAssignedProfile();
        if (cachedProfile && cachedProfile.uid === user.uid && cachedProfile.assignedMatchId) {
            return sanitizeProfile(cachedProfile, user);
        }

        return null;
    }

    function bindMatchState(matchId) {
        activeMatchId = getRequestedMatchId(`?match=${matchId}`);
        stateRef = ref(db, buildMatchStatePath(activeMatchId));
        updateDocumentTitle();

        if (unsubscribeFromState) {
            unsubscribeFromState();
            unsubscribeFromState = null;
        }

        const cachedMatchState = readCachedMatchState(activeMatchId);
        if (cachedMatchState?.state) {
            setLocalScoreboardState(cachedMatchState.state);
        } else {
            setLocalScoreboardState(createDefaultScoreboardState(activeMatchId));
        }
        syncTimersFromState();

        unsubscribeFromState = onValue(stateRef, (snapshot) => {
            const remoteState = snapshot.val();
            if (!remoteState) {
                void seedMatchStateIfNeeded();
                return;
            }

            setLocalScoreboardState(remoteState);
            syncTimersFromState();
        });

        updateSessionBanner();
    }

    function applyResolvedProfile(profile) {
        currentProfile = profile;
        isAuthenticated = Boolean(profile);
        updateScoreboardAccess();

        if (!profile) {
            return;
        }

        const assignedMatchId = profile.assignedMatchId;
        if (requestedMatchId !== assignedMatchId || activeMatchId !== assignedMatchId) {
            requestedMatchId = assignedMatchId;
            history.replaceState({}, '', buildMatchScopedUrl(window.location.pathname, assignedMatchId));
            bindMatchState(assignedMatchId);
        }

        showLoginStatus(`Signed in to ${getMatchLabel(assignedMatchId)} as ${profile.displayName}.`, 'success');
        hideLoginModal();
        syncTimersFromState();
        void flushPendingSync();
        void seedMatchStateIfNeeded();
    }

    async function handleLogin(source = 'main') {
        const { email, password } = getCredentials(source);
        if (!email || !password) {
            showLoginStatus('Enter both email and password.', 'error');
            return;
        }

        if (!navigator.onLine) {
            showLoginStatus('Offline login requires a previous authenticated session on this device.', 'error');
            return;
        }

        try {
            showLoginStatus('Signing in...', 'info');
            await signInWithEmailAndPassword(auth, email, password);
            clearCredentialInputs();
        } catch (error) {
            console.error('Unable to sign in.', error);
            showLoginStatus('Invalid credentials or profile is unavailable.', 'error');
        }
    }

    async function logout() {
        try {
            const shouldPersistStop = canEditActiveMatch() && navigator.onLine;
            stopTimersLocally();
            if (shouldPersistStop) {
                await persistScoreboardState(scoreboardState);
            } else if (!navigator.onLine) {
                clearPendingSync(activeMatchId);
            }
            clearCachedAssignedProfile();
            await signOut(auth);
            currentUser = null;
            currentProfile = null;
            isAuthenticated = false;
            updateScoreboardAccess();
            showLoginStatus('Logged out successfully.', 'info');
            hideLoginModal();
        } catch (error) {
            console.error('Unable to log out.', error);
            showLoginStatus('Logout failed. Please try again.', 'error');
        }
    }

    function requireAuth(callback) {
        if (canEditActiveMatch()) {
            return callback();
        }

        showLoginStatus('Sign in to control your assigned scoreboard.', 'info');
        showLoginPrompt();
        return false;
    }

    function syncRunningClockInterval() {
        clearInterval(gameTimerInterval);
        if (!scoreboardState.isGameClockRunning) {
            return;
        }

        const intervalMs = (scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds < 60) ? 100 : 1000;
        gameTimerInterval = setInterval(tickGameClock, intervalMs);
    }

    function syncTimersFromState() {
        clearTimerIntervals();
        if (!canEditActiveMatch()) {
            return;
        }

        if (scoreboardState.isGameClockRunning) {
            syncRunningClockInterval();
        }

        if (scoreboardState.isShotClockRunning) {
            shotClockTimerInterval = setInterval(tickShotClock, 1000);
        }
    }

    function tickGameClock() {
        scoreboardState.gameMilliseconds = Number(scoreboardState.gameMilliseconds) || 0;

        if (scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds < 60) {
            if (scoreboardState.gameMilliseconds >= 100) {
                scoreboardState.gameMilliseconds -= 100;
            } else if (scoreboardState.gameSeconds > 0) {
                scoreboardState.gameSeconds--;
                scoreboardState.gameMilliseconds = 900;
            } else {
                scoreboardState.gameMilliseconds = 0;
                void stopGameClock();
                const gameOverSound = document.getElementById('game-over-sound');
                if (gameOverSound) {
                    gameOverSound.currentTime = 0;
                    gameOverSound.play().catch(() => {});
                }
                return;
            }
        } else {
            if (scoreboardState.gameSeconds > 0) {
                scoreboardState.gameSeconds--;
            } else if (scoreboardState.gameMinutes > 0) {
                scoreboardState.gameMinutes--;
                scoreboardState.gameSeconds = 59;
            }

            if (scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds === 59) {
                scoreboardState.gameMilliseconds = 900;
                syncRunningClockInterval();
            }
        }

        applyUpdates({
            gameMinutes: scoreboardState.gameMinutes,
            gameSeconds: scoreboardState.gameSeconds,
            gameMilliseconds: scoreboardState.gameMilliseconds
        });
    }

    function tickShotClock() {
        if (scoreboardState.shotClockSeconds > 0) {
            scoreboardState.shotClockSeconds--;
        } else {
            void stopShotClock();
            return;
        }

        applyUpdates({
            shotClockSeconds: scoreboardState.shotClockSeconds
        });
    }

    async function startGameClock() {
        return requireAuth(() => {
            if (scoreboardState.isGameClockRunning || (scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds === 0)) {
                return;
            }

            if (scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds < 60 && scoreboardState.gameMilliseconds === 0) {
                scoreboardState.gameMilliseconds = 900;
            }

            scoreboardState.isGameClockRunning = true;
            syncRunningClockInterval();
            setControlInfo('Game Clock RUNNING');
            void persistScoreboardState(scoreboardState);
        });
    }

    async function stopGameClock() {
        return requireAuth(() => {
            clearInterval(gameTimerInterval);
            gameTimerInterval = null;
            scoreboardState.isGameClockRunning = false;
            setControlInfo('Game Clock STOPPED');
            void persistScoreboardState(scoreboardState);
        });
    }

    async function startShotClock() {
        return requireAuth(() => {
            if (scoreboardState.isShotClockRunning || scoreboardState.shotClockSeconds <= 0) {
                return;
            }

            clearInterval(shotClockTimerInterval);
            shotClockTimerInterval = setInterval(tickShotClock, 1000);
            scoreboardState.isShotClockRunning = true;
            if (shotClockEl) {
                shotClockEl.style.backgroundColor = '';
                shotClockEl.style.color = '';
            }
            void persistScoreboardState(scoreboardState);
        });
    }

    async function stopShotClock() {
        return requireAuth(() => {
            clearInterval(shotClockTimerInterval);
            shotClockTimerInterval = null;
            scoreboardState.isShotClockRunning = false;
            void persistScoreboardState(scoreboardState);
        });
    }

    function resetGameClock() {
        return requireAuth(() => {
            if (!confirm("Are you sure you want to reset the game clock?")) {
                return;
            }

            clearInterval(gameTimerInterval);
            gameTimerInterval = null;
            const gameOverSound = document.getElementById('game-over-sound');
            if (gameOverSound) {
                gameOverSound.pause();
                gameOverSound.currentTime = 0;
            }

            scoreboardState.isGameClockRunning = false;
            scoreboardState.gameMinutes = scoreboardState.defaultGameMinutes;
            scoreboardState.gameSeconds = 0;
            scoreboardState.gameMilliseconds = 0;
            setControlInfo('Game Clock Reset');
            void persistScoreboardState(scoreboardState);
        });
    }

    function resetShotClock(time = 24) {
        return requireAuth(() => {
            scoreboardState.shotClockSeconds = time;
            if (shotClockEl) {
                shotClockEl.style.backgroundColor = '';
                shotClockEl.style.color = '';
            }

            if (scoreboardState.isGameClockRunning && !scoreboardState.isShotClockRunning) {
                clearInterval(shotClockTimerInterval);
                shotClockTimerInterval = setInterval(tickShotClock, 1000);
                scoreboardState.isShotClockRunning = true;
            }

            void persistScoreboardState(scoreboardState);
        });
    }

    function adjustScore(team, delta) {
        return requireAuth(() => {
            if (team === 'home') {
                scoreboardState.homeScore = Math.max(0, Math.min(999, scoreboardState.homeScore + delta));
            } else {
                scoreboardState.awayScore = Math.max(0, Math.min(999, scoreboardState.awayScore + delta));
            }

            applyUpdates({
                homeScore: scoreboardState.homeScore,
                awayScore: scoreboardState.awayScore
            });
        });
    }

    function adjustFouls(team, delta) {
        return requireAuth(() => {
            if (team === 'home') {
                scoreboardState.homeFouls = Math.max(0, Math.min(99, scoreboardState.homeFouls + delta));
            } else {
                scoreboardState.awayFouls = Math.max(0, Math.min(99, scoreboardState.awayFouls + delta));
            }

            applyUpdates({
                homeFouls: scoreboardState.homeFouls,
                awayFouls: scoreboardState.awayFouls
            });
        });
    }

    function adjustTimeouts(team, delta) {
        return requireAuth(() => {
            if (team === 'home') {
                scoreboardState.homeTimeouts = Math.max(0, Math.min(99, scoreboardState.homeTimeouts + delta));
            } else {
                scoreboardState.awayTimeouts = Math.max(0, Math.min(99, scoreboardState.awayTimeouts + delta));
            }

            applyUpdates({
                homeTimeouts: scoreboardState.homeTimeouts,
                awayTimeouts: scoreboardState.awayTimeouts
            });
        });
    }

    function adjustQuarter(delta) {
        return requireAuth(() => {
            scoreboardState.quarter = Math.max(1, Math.min(10, scoreboardState.quarter + delta));
            applyUpdates({ quarter: scoreboardState.quarter });
        });
    }

    function toggleBallPossession() {
        return requireAuth(() => {
            scoreboardState.ballPossession = scoreboardState.ballPossession === 'home' ? 'away' : 'home';
            applyUpdates({ ballPossession: scoreboardState.ballPossession });
        });
    }

    function setCustomTime() {
        return requireAuth(() => {
            clearInterval(gameTimerInterval);
            gameTimerInterval = null;
            scoreboardState.isGameClockRunning = false;

            const defaultTime = scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds < 60
                ? `${String(scoreboardState.gameSeconds).padStart(2, '0')}.${Math.floor(scoreboardState.gameMilliseconds / 100)}`
                : `${String(scoreboardState.gameMinutes).padStart(2, '0')}:${String(scoreboardState.gameSeconds).padStart(2, '0')}`;
            const timeInput = prompt("Enter game time (MM:SS or SS.M):", defaultTime);
            if (!timeInput) {
                return;
            }

            let minutes = 0;
            let seconds = 0;
            let milliseconds = 0;
            let isValid = false;

            if (timeInput.includes('.')) {
                const parts = timeInput.split('.');
                if (parts.length === 2) {
                    const parsedSeconds = parseInt(parts[0], 10);
                    const parsedTenths = parseInt(parts[1], 10);
                    if (!Number.isNaN(parsedSeconds) && !Number.isNaN(parsedTenths) && parsedSeconds >= 0 && parsedTenths >= 0 && parsedTenths <= 9) {
                        seconds = parsedSeconds;
                        milliseconds = parsedTenths * 100;
                        isValid = true;
                    }
                }
            } else if (timeInput.includes(':')) {
                const parts = timeInput.split(':');
                if (parts.length === 2) {
                    minutes = parseInt(parts[0], 10);
                    seconds = parseInt(parts[1], 10);
                    if (!Number.isNaN(minutes) && !Number.isNaN(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
                        milliseconds = (minutes === 0 && seconds < 60) ? 900 : 0;
                        isValid = true;
                    }
                }
            }

            if (!isValid) {
                alert("Invalid time format. Use MM:SS or SS.M.");
                return;
            }

            scoreboardState.gameMinutes = minutes;
            scoreboardState.gameSeconds = seconds;
            scoreboardState.gameMilliseconds = milliseconds;
            setControlInfo('Game Clock STOPPED');
            void persistScoreboardState(scoreboardState);
        });
    }

    function setTeamNames() {
        return requireAuth(() => {
            const homeName = prompt("Enter Home Team Name:", scoreboardState.homeTeamName);
            if (homeName !== null) {
                scoreboardState.homeTeamName = homeName.trim() || "HOME";
            }

            const awayName = prompt("Enter Away Team Name:", scoreboardState.awayTeamName);
            if (awayName !== null) {
                scoreboardState.awayTeamName = awayName.trim() || "AWAY";
            }

            applyUpdates({
                homeTeamName: scoreboardState.homeTeamName,
                awayTeamName: scoreboardState.awayTeamName
            });
        });
    }

    function populateControlPanel() {
        if (homeTeamInput) homeTeamInput.value = scoreboardState.homeTeamName;
        if (awayTeamInput) awayTeamInput.value = scoreboardState.awayTeamName;
        if (homeScoreInput) homeScoreInput.value = scoreboardState.homeScore;
        if (awayScoreInput) awayScoreInput.value = scoreboardState.awayScore;
        if (homeFoulsInput) homeFoulsInput.value = scoreboardState.homeFouls;
        if (awayFoulsInput) awayFoulsInput.value = scoreboardState.awayFouls;
        if (homeTimeoutsInput) homeTimeoutsInput.value = scoreboardState.homeTimeouts;
        if (awayTimeoutsInput) awayTimeoutsInput.value = scoreboardState.awayTimeouts;
        if (quarterInput) quarterInput.value = scoreboardState.quarter;
        if (ballPossessionInput) ballPossessionInput.value = scoreboardState.ballPossession;
        if (gameMinutesInput) gameMinutesInput.value = scoreboardState.gameMinutes;
        if (gameSecondsInput) gameSecondsInput.value = scoreboardState.gameSeconds;
        if (shotClockInput) shotClockInput.value = scoreboardState.shotClockSeconds;
        if (defaultGameMinutesInput) defaultGameMinutesInput.value = scoreboardState.defaultGameMinutes;
        if (defaultShotClockInput) defaultShotClockInput.value = scoreboardState.defaultShotClock;
        if (defaultTimeoutsInput) defaultTimeoutsInput.value = scoreboardState.defaultTimeouts;
        if (defaultQuarterInput) defaultQuarterInput.value = scoreboardState.defaultQuarter;
        if (defaultHomeTeamInput) defaultHomeTeamInput.value = scoreboardState.defaultHomeTeam;
        if (defaultAwayTeamInput) defaultAwayTeamInput.value = scoreboardState.defaultAwayTeam;
    }

    function showControlPanel() {
        return requireAuth(() => {
            if (!controlPanelModal) {
                return;
            }

            populateControlPanel();
            controlPanelModal.style.display = 'block';
        });
    }

    function applyControlPanelChanges() {
        return requireAuth(() => {
            clearTimerIntervals();
            scoreboardState.isGameClockRunning = false;
            scoreboardState.isShotClockRunning = false;
            if (homeTeamInput) scoreboardState.homeTeamName = homeTeamInput.value.trim() || "HOME";
            if (awayTeamInput) scoreboardState.awayTeamName = awayTeamInput.value.trim() || "AWAY";
            if (homeScoreInput) scoreboardState.homeScore = Math.max(0, Math.min(999, parseInt(homeScoreInput.value, 10) || 0));
            if (awayScoreInput) scoreboardState.awayScore = Math.max(0, Math.min(999, parseInt(awayScoreInput.value, 10) || 0));
            if (homeFoulsInput) scoreboardState.homeFouls = Math.max(0, Math.min(99, parseInt(homeFoulsInput.value, 10) || 0));
            if (awayFoulsInput) scoreboardState.awayFouls = Math.max(0, Math.min(99, parseInt(awayFoulsInput.value, 10) || 0));
            if (homeTimeoutsInput) scoreboardState.homeTimeouts = Math.max(0, Math.min(99, parseInt(homeTimeoutsInput.value, 10) || 0));
            if (awayTimeoutsInput) scoreboardState.awayTimeouts = Math.max(0, Math.min(99, parseInt(awayTimeoutsInput.value, 10) || 0));
            if (gameMinutesInput) scoreboardState.gameMinutes = Math.max(0, Math.min(99, parseInt(gameMinutesInput.value, 10) || 0));
            if (gameSecondsInput) scoreboardState.gameSeconds = Math.max(0, Math.min(59, parseInt(gameSecondsInput.value, 10) || 0));
            scoreboardState.gameMilliseconds = (scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds < 60) ? 900 : 0;
            if (shotClockInput) scoreboardState.shotClockSeconds = Math.max(0, Math.min(99, parseInt(shotClockInput.value, 10) || 0));
            if (quarterInput) scoreboardState.quarter = Math.max(1, Math.min(10, parseInt(quarterInput.value, 10) || 1));
            if (ballPossessionInput) scoreboardState.ballPossession = ballPossessionInput.value;
            if (defaultGameMinutesInput) scoreboardState.defaultGameMinutes = Math.max(1, Math.min(99, parseInt(defaultGameMinutesInput.value, 10) || 10));
            if (defaultShotClockInput) scoreboardState.defaultShotClock = Math.max(1, Math.min(99, parseInt(defaultShotClockInput.value, 10) || 24));
            if (defaultTimeoutsInput) scoreboardState.defaultTimeouts = Math.max(0, Math.min(99, parseInt(defaultTimeoutsInput.value, 10) || 2));
            if (defaultQuarterInput) scoreboardState.defaultQuarter = Math.max(1, Math.min(10, parseInt(defaultQuarterInput.value, 10) || 1));
            if (defaultHomeTeamInput) scoreboardState.defaultHomeTeam = defaultHomeTeamInput.value.trim() || "HOME";
            if (defaultAwayTeamInput) scoreboardState.defaultAwayTeam = defaultAwayTeamInput.value.trim() || "AWAY";

            void persistScoreboardState(scoreboardState);
            hideControlPanel();
        });
    }

    function applyDefaults() {
        return requireAuth(() => {
            if (!confirm("Apply default settings to current game? This will reset the current game data.")) {
                return;
            }

            clearTimerIntervals();
            scoreboardState = normalizeScoreboardState({
                ...scoreboardState,
                homeScore: 0,
                awayScore: 0,
                homeFouls: 0,
                awayFouls: 0,
                homeTimeouts: scoreboardState.defaultTimeouts,
                awayTimeouts: scoreboardState.defaultTimeouts,
                homeTeamName: scoreboardState.defaultHomeTeam,
                awayTeamName: scoreboardState.defaultAwayTeam,
                quarter: scoreboardState.defaultQuarter,
                ballPossession: 'home',
                gameMinutes: scoreboardState.defaultGameMinutes,
                gameSeconds: 0,
                gameMilliseconds: 0,
                shotClockSeconds: scoreboardState.defaultShotClock,
                isGameClockRunning: false,
                isShotClockRunning: false
            }, activeMatchId);

            void persistScoreboardState(scoreboardState);
            hideControlPanel();
        });
    }

    function resetAllData() {
        return requireAuth(() => {
            if (!confirm("Are you sure you want to reset all data? This will set everything back to default values.")) {
                return;
            }

            clearTimerIntervals();
            scoreboardState = normalizeScoreboardState({
                ...createDefaultScoreboardState(activeMatchId),
                defaultGameMinutes: scoreboardState.defaultGameMinutes,
                defaultShotClock: scoreboardState.defaultShotClock,
                defaultTimeouts: scoreboardState.defaultTimeouts,
                defaultQuarter: scoreboardState.defaultQuarter,
                defaultHomeTeam: scoreboardState.defaultHomeTeam,
                defaultAwayTeam: scoreboardState.defaultAwayTeam,
                homeTimeouts: scoreboardState.defaultTimeouts,
                awayTimeouts: scoreboardState.defaultTimeouts,
                homeTeamName: scoreboardState.defaultHomeTeam,
                awayTeamName: scoreboardState.defaultAwayTeam,
                quarter: scoreboardState.defaultQuarter,
                gameMinutes: scoreboardState.defaultGameMinutes,
                shotClockSeconds: scoreboardState.defaultShotClock
            }, activeMatchId);

            void persistScoreboardState(scoreboardState);
            hideControlPanel();
        });
    }

    function shouldIgnorePointerShortcut(target) {
        return Boolean(target.closest('button, input, select, .modal-content'));
    }

    function isTypingInFormControl(target) {
        const tagName = target.tagName;
        return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    document.addEventListener('mousedown', (event) => {
        if (shouldIgnorePointerShortcut(event.target)) {
            return;
        }

        if (event.button === 2) {
            event.preventDefault();
            if (scoreboardState.isShotClockRunning) {
                void stopShotClock();
            } else {
                void startShotClock();
            }
        } else if (event.button === 0) {
            resetShotClock(24);
        } else if (event.button === 1) {
            event.preventDefault();
            resetShotClock(14);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideHelp();
            hideControlPanel();
            hideLoginModal();
            return;
        }

        if (isTypingInFormControl(event.target)) {
            return;
        }

        const hotkeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyC', 'KeyR', 'KeyF', 'KeyJ', 'KeyT', 'KeyH', 'KeyZ', 'KeyX', 'KeyQ', 'KeyB', 'Enter', 'KeyN', 'KeyP', 'KeyO', 'KeyA', 'KeyD', 'KeyL', 'KeyG'];
        if (hotkeys.includes(event.code)) {
            event.preventDefault();
        }

        if (event.code === 'KeyT') {
            if (scoreboardState.isGameClockRunning) {
                void stopGameClock();
            } else {
                void startGameClock();
            }
        } else if (event.code === 'Space' && !event.shiftKey) {
            if (scoreboardState.isShotClockRunning) {
                void stopShotClock();
            } else {
                void startShotClock();
            }
        } else if (event.code === 'KeyR' && !event.shiftKey) {
            resetShotClock(24);
        } else if (event.code === 'KeyR' && event.shiftKey) {
            resetShotClock(14);
        } else if (event.code === 'ArrowUp') {
            adjustScore('home', 1);
        } else if (event.code === 'ArrowDown') {
            adjustScore('home', -1);
        } else if (event.code === 'ArrowRight') {
            adjustScore('away', 1);
        } else if (event.code === 'ArrowLeft') {
            adjustScore('away', -1);
        } else if (event.code === 'KeyF' && !event.shiftKey) {
            adjustFouls('home', 1);
        } else if (event.code === 'KeyF' && event.shiftKey) {
            adjustFouls('home', -1);
        } else if (event.code === 'KeyJ' && !event.shiftKey) {
            adjustFouls('away', 1);
        } else if (event.code === 'KeyJ' && event.shiftKey) {
            adjustFouls('away', -1);
        } else if (event.code === 'KeyZ' && !event.shiftKey) {
            adjustTimeouts('home', -1);
        } else if (event.code === 'KeyZ' && event.shiftKey) {
            adjustTimeouts('home', 1);
        } else if (event.code === 'KeyX' && !event.shiftKey) {
            adjustTimeouts('away', -1);
        } else if (event.code === 'KeyX' && event.shiftKey) {
            adjustTimeouts('away', 1);
        } else if (event.code === 'KeyQ' && !event.shiftKey) {
            adjustQuarter(1);
        } else if (event.code === 'KeyQ' && event.shiftKey) {
            adjustQuarter(-1);
        } else if (event.code === 'KeyB') {
            toggleBallPossession();
        } else if (event.code === 'KeyC' && event.shiftKey) {
            const customValue = prompt('Enter custom shot clock (seconds):', scoreboardState.shotClockSeconds);
            if (customValue !== null) {
                const parsedValue = parseInt(customValue, 10);
                if (!Number.isNaN(parsedValue) && parsedValue > 0 && parsedValue <= 99) {
                    resetShotClock(parsedValue);
                } else {
                    alert('Invalid shot clock value. Enter a number between 1 and 99.');
                }
            }
        } else if (event.code === 'Enter') {
            setCustomTime();
        } else if (event.code === 'KeyG') {
            resetGameClock();
        } else if (event.code === 'KeyH') {
            if (helpModal && helpModal.style.display === 'block') {
                hideHelp();
            } else {
                showHelp();
            }
        } else if (event.code === 'KeyC' || event.code === 'KeyP') {
            showControlPanel();
        } else if (event.code === 'KeyO') {
            hideControlPanel();
        } else if (event.code === 'KeyN') {
            setTeamNames();
        } else if (event.code === 'KeyA') {
            resetAllData();
        } else if (event.code === 'KeyD') {
            applyDefaults();
        } else if (event.code === 'KeyL') {
            showLoginPrompt();
        }
    });

    if (helpCloseBtn) helpCloseBtn.addEventListener('click', hideHelp);
    if (controlCloseBtn) controlCloseBtn.addEventListener('click', hideControlPanel);
    if (applyChangesBtn) applyChangesBtn.addEventListener('click', applyControlPanelChanges);
    if (resetAllBtn) resetAllBtn.addEventListener('click', resetAllData);
    if (startGameClockBtn) startGameClockBtn.addEventListener('click', () => void startGameClock());
    if (stopGameClockBtn) stopGameClockBtn.addEventListener('click', () => void stopGameClock());
    if (startShotClockBtn) startShotClockBtn.addEventListener('click', () => void startShotClock());
    if (stopShotClockBtn) stopShotClockBtn.addEventListener('click', () => void stopShotClock());
    if (applyDefaultsBtn) applyDefaultsBtn.addEventListener('click', applyDefaults);
    if (loginBtn) loginBtn.addEventListener('click', () => void handleLogin('main'));
    if (logoutBtn) logoutBtn.addEventListener('click', () => void logout());
    if (controlLoginBtn) controlLoginBtn.addEventListener('click', () => void handleLogin('control'));
    if (controlLogoutBtn) controlLogoutBtn.addEventListener('click', () => void logout());

    [passwordInput, controlPasswordInput].forEach((element, index) => {
        if (!element) {
            return;
        }

        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void handleLogin(index === 0 ? 'main' : 'control');
            }
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === helpModal) hideHelp();
        if (event.target === controlPanelModal) hideControlPanel();
        if (event.target === loginModal) hideLoginModal();
    });

    window.addEventListener('online', async () => {
        updateSessionBanner();
        showLoginStatus('Connection restored. Syncing cached changes...', 'info');

        if (currentUser) {
            const refreshedProfile = await loadUserProfile(currentUser);
            if (refreshedProfile) {
                applyResolvedProfile(refreshedProfile);
            }
        }

        await flushPendingSync();
    });

    window.addEventListener('offline', () => {
        updateSessionBanner();
        showLoginStatus('Offline mode active. Your assigned match stays editable on this device.', 'info');
    });

    function initializeSounds() {
        const gameOverSound = document.getElementById('game-over-sound');
        const shotClockSound = document.getElementById('shotclock-sound');

        if (gameOverSound) {
            gameOverSound.volume = 0.7;
            gameOverSound.load();
        }

        if (shotClockSound) {
            shotClockSound.volume = 0.8;
            shotClockSound.load();
        }
    }

    bindMatchState(activeMatchId);
    updateDocumentTitle();
    updateScoreboardAccess();
    updateDisplay();

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;

        if (!user) {
            isAuthenticated = false;
            currentProfile = null;
            updateScoreboardAccess();
            stopTimersLocally();
            showLoginStatus('Viewing scoreboard only. Sign in to control your assigned match.', 'info');
            return;
        }

        const profile = await loadUserProfile(user);
        if (!profile) {
            isAuthenticated = false;
            currentProfile = null;
            clearCachedAssignedProfile();
            showLoginStatus('No active match assignment found for this account.', 'error');
            updateScoreboardAccess();
            return;
        }

        applyResolvedProfile(profile);
    });

    document.addEventListener('click', function initSounds() {
        initializeSounds();
        document.removeEventListener('click', initSounds);
    }, { once: true });

    document.addEventListener('keydown', function initSounds() {
        initializeSounds();
        document.removeEventListener('keydown', initSounds);
    }, { once: true });
});

