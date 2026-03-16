import { db, onValue, ref } from "./firebase-service.js";
import {
    buildMatchStatePath,
    cacheMatchState,
    getMatchLabel,
    getRequestedMatchId,
    normalizeScoreboardState,
    readCachedMatchState
} from "./scoreboard-shared.js";

document.addEventListener('DOMContentLoaded', () => {
    const matchId = getRequestedMatchId();
    document.title = `Scoreboard Display - ${getMatchLabel(matchId)}`;

    // Display-only DOM elements
    const homeScoreEl = document.getElementById('home-score');
    const awayScoreEl = document.getElementById('away-score');
    const gameClockEl = document.getElementById('game-clock');
    const shotClockEl = document.getElementById('shot-clock');
    const homeFoulsEl = document.getElementById('home-fouls');
    const awayFoulsEl = document.getElementById('away-fouls');
    const quarterEl = document.getElementById('quarter-display');
    const homeTimeoutsEl = document.getElementById('home-timeouts');
    const awayTimeoutsEl = document.getElementById('away-timeouts');

    let scoreboardState = normalizeScoreboardState({}, matchId);
    const stateRef = ref(db, buildMatchStatePath(matchId));

    const wrapClockChars = (timeString) => {
        return timeString.split('').map(char => {
            const className = (char === ':' || char === '.') ? 'clock-char colon' : 'clock-char';
            return `<span class="${className}">${char}</span>`;
        }).join('');
    };

    function updateTeamName(elementId, newName, arrowId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const existingArrow = el.querySelector('.possession-arrow');
        if (existingArrow) {
            existingArrow.remove();
        }

        el.textContent = newName;

        const arrowDiv = document.createElement('div');
        arrowDiv.className = 'possession-arrow';
        arrowDiv.id = arrowId;
        el.appendChild(arrowDiv);
    }

    function updateBallPossessionIndicator() {
        const homeArrow = document.getElementById('home-possession-arrow');
        const awayArrow = document.getElementById('away-possession-arrow');

        if (!homeArrow || !awayArrow) return;

        homeArrow.classList.remove('active');
        awayArrow.classList.remove('active');

        if (scoreboardState.ballPossession === 'home') {
            homeArrow.classList.add('active');
        } else if (scoreboardState.ballPossession === 'away') {
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
        if (homeScoreEl) homeScoreEl.textContent = String(scoreboardState.homeScore).padStart(2, '0');
        if (awayScoreEl) awayScoreEl.textContent = String(scoreboardState.awayScore).padStart(2, '0');

        if (gameClockEl) {
            let timeString;
            if (scoreboardState.gameMinutes === 0 && scoreboardState.gameSeconds < 60) {
                const milliseconds = Math.floor(scoreboardState.gameMilliseconds / 100);
                timeString = `${String(scoreboardState.gameSeconds).padStart(2, '0')}.${String(milliseconds)}`;
            } else {
                timeString = `${String(scoreboardState.gameMinutes).padStart(2, '0')}:${String(scoreboardState.gameSeconds).padStart(2, '0')}`;
            }
            gameClockEl.innerHTML = wrapClockChars(timeString);
        }

        if (shotClockEl) shotClockEl.textContent = String(scoreboardState.shotClockSeconds).padStart(2, '0');
        if (quarterEl) {
            if (scoreboardState.quarter <= 4) {
                quarterEl.textContent = `Q${scoreboardState.quarter}`;
            } else {
                quarterEl.textContent = `OT${scoreboardState.quarter - 4}`;
            }
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

    function mergeState(newState) {
        scoreboardState = normalizeScoreboardState({
            ...scoreboardState,
            ...newState
        }, matchId);
    }

    const cachedState = readCachedMatchState(matchId);
    if (cachedState?.state) {
        mergeState(cachedState.state);
        updateDisplay();
    }

    onValue(stateRef, (snapshot) => {
        const newState = snapshot.val();
        if (!newState) return;

        mergeState(newState);
        cacheMatchState(matchId, scoreboardState);
        updateDisplay();
    });

    // Initial render
    updateDisplay();
});



