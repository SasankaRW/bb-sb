import { db, onValue, ref } from "./firebase-service.js";
import {
    buildMatchStatePath,
    cacheMatchState,
    getMatchLabel,
    getRequestedMatchId,
    normalizeScoreboardState,
    readCachedMatchState
} from "./scoreboard-shared.js";

// DOM Elements
const streamHomeNameEl = document.getElementById('stream-home-name');
const streamAwayNameEl = document.getElementById('stream-away-name');
const streamHomeScoreEl = document.getElementById('stream-home-score');
const streamAwayScoreEl = document.getElementById('stream-away-score');
const streamGameTimeEl = document.getElementById('stream-game-time');
const streamQuarterEl = document.getElementById('stream-quarter');
const matchId = getRequestedMatchId();

document.title = `Basketball Scoreboard - Stream Overlay - ${getMatchLabel(matchId)}`;

// Listen to Firebase for real-time updates
const stateRef = ref(db, buildMatchStatePath(matchId));
let scoreboardState = normalizeScoreboardState({}, matchId);

// Helper function to format team names for two lines if two words
function formatTeamName(name) {
    if (!name) return 'TEAM';
    const words = name.trim().split(/\s+/);
    if (words.length === 2) {
        return words.join('\n'); // Add line break between two words
    }
    return name;
}

onValue(stateRef, (snapshot) => {
    const data = snapshot.val();

    if (data) {
        scoreboardState = normalizeScoreboardState(data, matchId);
        cacheMatchState(matchId, scoreboardState);

        // Update team names with two-line formatting
        if (streamHomeNameEl) streamHomeNameEl.textContent = formatTeamName(scoreboardState.homeTeamName);
        if (streamAwayNameEl) streamAwayNameEl.textContent = formatTeamName(scoreboardState.awayTeamName);

        // Update scores
        if (streamHomeScoreEl) streamHomeScoreEl.textContent = scoreboardState.homeScore;
        if (streamAwayScoreEl) streamAwayScoreEl.textContent = scoreboardState.awayScore;

        // Update game time
        if (streamGameTimeEl) {
            const minutes = String(scoreboardState.gameMinutes).padStart(2, '0');
            const seconds = String(scoreboardState.gameSeconds).padStart(2, '0');
            streamGameTimeEl.textContent = `${minutes}:${seconds}`;
        }

        // Update quarter
        if (streamQuarterEl) {
            const quarter = scoreboardState.quarter;
            if (quarter <= 4) {
                streamQuarterEl.textContent = `Q${quarter}`;
            } else {
                streamQuarterEl.textContent = `OT${quarter - 4}`;
            }
        }
    }
});

const cachedState = readCachedMatchState(matchId);
if (cachedState?.state) {
    scoreboardState = cachedState.state;
    if (streamHomeNameEl) streamHomeNameEl.textContent = formatTeamName(scoreboardState.homeTeamName);
    if (streamAwayNameEl) streamAwayNameEl.textContent = formatTeamName(scoreboardState.awayTeamName);
    if (streamHomeScoreEl) streamHomeScoreEl.textContent = scoreboardState.homeScore;
    if (streamAwayScoreEl) streamAwayScoreEl.textContent = scoreboardState.awayScore;
    if (streamGameTimeEl) {
        const minutes = String(scoreboardState.gameMinutes).padStart(2, '0');
        const seconds = String(scoreboardState.gameSeconds).padStart(2, '0');
        streamGameTimeEl.textContent = `${minutes}:${seconds}`;
    }
    if (streamQuarterEl) {
        streamQuarterEl.textContent = scoreboardState.quarter <= 4
            ? `Q${scoreboardState.quarter}`
            : `OT${scoreboardState.quarter - 4}`;
    }
}

// Initial display
console.log('Stream overlay loaded and listening to Firebase...');
