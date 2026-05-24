const MATCH_IDS = ['match1', 'match2'];
const DEFAULT_MATCH_ID = 'match1';

const LOCAL_STORAGE_KEYS = {
    cachedProfile: 'scoreboardCachedProfile',
    matchStatePrefix: 'scoreboardMatchState:',
    pendingSyncPrefix: 'scoreboardPendingSync:'
};

function coerceNumber(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeMatchId(matchId) {
    return MATCH_IDS.includes(matchId) ? matchId : DEFAULT_MATCH_ID;
}

function createMeta(matchId) {
    return {
        matchId: normalizeMatchId(matchId),
        updatedAt: 0,
        updatedBy: 'system',
        version: 2
    };
}

function createDefaultScoreboardState(matchId = DEFAULT_MATCH_ID) {
    return {
        homeScore: 0,
        awayScore: 0,
        homeFouls: 0,
        awayFouls: 0,
        homeTimeouts: 2,
        awayTimeouts: 2,
        homeTeamName: "HOME",
        awayTeamName: "AWAY",
        quarter: 1,
        gameMinutes: 10,
        gameSeconds: 0,
        gameMilliseconds: 0,
        shotClockSeconds: 12,
        isGameClockRunning: false,
        isShotClockRunning: false,
        ballPossession: 'home',
        defaultGameMinutes: 10,
        defaultShotClock: 12,
        defaultTimeouts: 2,
        defaultQuarter: 1,
        defaultHomeTeam: "HOME",
        defaultAwayTeam: "AWAY",
        meta: createMeta(matchId)
    };
}

function normalizeScoreboardState(rawState, matchId = DEFAULT_MATCH_ID) {
    const normalizedMatchId = normalizeMatchId(matchId);
    const baseState = createDefaultScoreboardState(normalizedMatchId);
    const incomingState = rawState && typeof rawState === 'object' ? rawState : {};

    const mergedState = {
        ...baseState,
        ...incomingState,
        meta: {
            ...baseState.meta,
            ...(incomingState.meta || {})
        }
    };

    mergedState.homeScore = Math.max(0, Math.min(999, coerceNumber(mergedState.homeScore, 0)));
    mergedState.awayScore = Math.max(0, Math.min(999, coerceNumber(mergedState.awayScore, 0)));
    mergedState.homeFouls = Math.max(0, Math.min(99, coerceNumber(mergedState.homeFouls, 0)));
    mergedState.awayFouls = Math.max(0, Math.min(99, coerceNumber(mergedState.awayFouls, 0)));
    mergedState.homeTimeouts = Math.max(0, Math.min(99, coerceNumber(mergedState.homeTimeouts, baseState.homeTimeouts)));
    mergedState.awayTimeouts = Math.max(0, Math.min(99, coerceNumber(mergedState.awayTimeouts, baseState.awayTimeouts)));
    mergedState.quarter = Math.max(1, Math.min(10, coerceNumber(mergedState.quarter, 1)));
    mergedState.gameMinutes = Math.max(0, Math.min(99, coerceNumber(mergedState.gameMinutes, baseState.gameMinutes)));
    mergedState.gameSeconds = Math.max(0, Math.min(59, coerceNumber(mergedState.gameSeconds, 0)));
    mergedState.gameMilliseconds = Math.max(0, Math.min(900, coerceNumber(mergedState.gameMilliseconds, 0)));
    mergedState.shotClockSeconds = Math.max(0, Math.min(99, coerceNumber(mergedState.shotClockSeconds, baseState.shotClockSeconds)));
    mergedState.defaultGameMinutes = Math.max(1, Math.min(99, coerceNumber(mergedState.defaultGameMinutes, baseState.defaultGameMinutes)));
    mergedState.defaultShotClock = Math.max(1, Math.min(99, coerceNumber(mergedState.defaultShotClock, baseState.defaultShotClock)));
    mergedState.defaultTimeouts = Math.max(0, Math.min(99, coerceNumber(mergedState.defaultTimeouts, baseState.defaultTimeouts)));
    mergedState.defaultQuarter = Math.max(1, Math.min(10, coerceNumber(mergedState.defaultQuarter, baseState.defaultQuarter)));
    mergedState.isGameClockRunning = Boolean(mergedState.isGameClockRunning);
    mergedState.isShotClockRunning = Boolean(mergedState.isShotClockRunning);
    mergedState.homeTeamName = String(mergedState.homeTeamName || baseState.homeTeamName).trim() || baseState.homeTeamName;
    mergedState.awayTeamName = String(mergedState.awayTeamName || baseState.awayTeamName).trim() || baseState.awayTeamName;
    mergedState.defaultHomeTeam = String(mergedState.defaultHomeTeam || baseState.defaultHomeTeam).trim() || baseState.defaultHomeTeam;
    mergedState.defaultAwayTeam = String(mergedState.defaultAwayTeam || baseState.defaultAwayTeam).trim() || baseState.defaultAwayTeam;

    if (mergedState.ballPossession !== 'home' && mergedState.ballPossession !== 'away') {
        mergedState.ballPossession = 'home';
    }

    mergedState.meta.matchId = normalizedMatchId;
    mergedState.meta.updatedAt = coerceNumber(mergedState.meta.updatedAt, 0);
    mergedState.meta.updatedBy = String(mergedState.meta.updatedBy || 'system');
    mergedState.meta.version = coerceNumber(mergedState.meta.version, 2);

    return mergedState;
}

function exportPublicScoreboardState(state, matchId = DEFAULT_MATCH_ID) {
    const normalizedState = normalizeScoreboardState(state, matchId);

    return {
        awayFouls: normalizedState.awayFouls,
        awayScore: normalizedState.awayScore,
        awayTeamName: normalizedState.awayTeamName,
        awayTimeouts: normalizedState.awayTimeouts,
        ballPossession: normalizedState.ballPossession,
        defaultAwayTeam: normalizedState.defaultAwayTeam,
        defaultGameMinutes: normalizedState.defaultGameMinutes,
        defaultHomeTeam: normalizedState.defaultHomeTeam,
        defaultQuarter: normalizedState.defaultQuarter,
        defaultShotClock: normalizedState.defaultShotClock,
        defaultTimeouts: normalizedState.defaultTimeouts,
        gameMilliseconds: normalizedState.gameMilliseconds,
        gameMinutes: normalizedState.gameMinutes,
        gameSeconds: normalizedState.gameSeconds,
        homeFouls: normalizedState.homeFouls,
        homeScore: normalizedState.homeScore,
        homeTeamName: normalizedState.homeTeamName,
        homeTimeouts: normalizedState.homeTimeouts,
        isGameClockRunning: normalizedState.isGameClockRunning,
        isShotClockRunning: normalizedState.isShotClockRunning,
        quarter: normalizedState.quarter,
        shotClockSeconds: normalizedState.shotClockSeconds
    };
}

function stampState(state, matchId, updatedBy) {
    const normalizedState = normalizeScoreboardState(state, matchId);
    normalizedState.meta = {
        ...normalizedState.meta,
        matchId: normalizeMatchId(matchId),
        updatedAt: Date.now(),
        updatedBy: updatedBy || 'system',
        version: 2
    };
    return normalizedState;
}

function getRequestedMatchId(search = window.location.search) {
    const params = new URLSearchParams(search);
    return normalizeMatchId(params.get('match'));
}

function buildMatchStatePath(matchId) {
    return `matches/${normalizeMatchId(matchId)}/scoreboardState`;
}

function buildUserProfilePath(uid) {
    return `users/${uid}`;
}

function getMatchLabel(matchId) {
    return normalizeMatchId(matchId) === 'match2' ? 'Match 2' : 'Match 1';
}

function buildMatchScopedUrl(pathname, matchId) {
    const url = new URL(pathname, window.location.origin);
    url.searchParams.set('match', normalizeMatchId(matchId));
    return `${url.pathname}${url.search}`;
}

function getMatchStateCacheKey(matchId) {
    return `${LOCAL_STORAGE_KEYS.matchStatePrefix}${normalizeMatchId(matchId)}`;
}

function getPendingSyncKey(matchId) {
    return `${LOCAL_STORAGE_KEYS.pendingSyncPrefix}${normalizeMatchId(matchId)}`;
}

function writeJsonToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn('Unable to write local cache', error);
    }
}

function readJsonFromLocalStorage(key) {
    try {
        const rawValue = localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : null;
    } catch (error) {
        console.warn('Unable to read local cache', error);
        return null;
    }
}

function cacheMatchState(matchId, state) {
    writeJsonToLocalStorage(getMatchStateCacheKey(matchId), {
        cachedAt: Date.now(),
        state: normalizeScoreboardState(state, matchId)
    });
}

function readCachedMatchState(matchId) {
    const cachedEntry = readJsonFromLocalStorage(getMatchStateCacheKey(matchId));
    if (!cachedEntry || !cachedEntry.state) {
        return null;
    }

    return {
        cachedAt: coerceNumber(cachedEntry.cachedAt, 0),
        state: normalizeScoreboardState(cachedEntry.state, matchId)
    };
}

function cacheAssignedProfile(profile) {
    if (!profile) {
        return;
    }

    writeJsonToLocalStorage(LOCAL_STORAGE_KEYS.cachedProfile, {
        ...profile,
        cachedAt: Date.now()
    });
}

function readCachedAssignedProfile() {
    return readJsonFromLocalStorage(LOCAL_STORAGE_KEYS.cachedProfile);
}

function clearCachedAssignedProfile() {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.cachedProfile);
}

function markPendingSync(matchId, state) {
    writeJsonToLocalStorage(getPendingSyncKey(matchId), {
        queuedAt: Date.now(),
        state: normalizeScoreboardState(state, matchId)
    });
}

function readPendingSync(matchId) {
    const pendingEntry = readJsonFromLocalStorage(getPendingSyncKey(matchId));
    if (!pendingEntry || !pendingEntry.state) {
        return null;
    }

    return {
        queuedAt: coerceNumber(pendingEntry.queuedAt, 0),
        state: normalizeScoreboardState(pendingEntry.state, matchId)
    };
}

function clearPendingSync(matchId) {
    localStorage.removeItem(getPendingSyncKey(matchId));
}

export {
    DEFAULT_MATCH_ID,
    MATCH_IDS,
    buildMatchScopedUrl,
    buildMatchStatePath,
    buildUserProfilePath,
    cacheAssignedProfile,
    cacheMatchState,
    clearCachedAssignedProfile,
    clearPendingSync,
    createDefaultScoreboardState,
    exportPublicScoreboardState,
    getMatchLabel,
    getRequestedMatchId,
    markPendingSync,
    normalizeScoreboardState,
    readCachedAssignedProfile,
    readCachedMatchState,
    readPendingSync,
    stampState
};
