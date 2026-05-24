import { db, onValue, ref } from "./firebase-service.js";
import {
    buildMatchStatePath,
    exportPublicScoreboardState,
    getMatchLabel,
    getRequestedMatchId,
    normalizeScoreboardState,
    readCachedMatchState
} from "./scoreboard-shared.js";

const matchId = getRequestedMatchId();
const stateRef = ref(db, buildMatchStatePath(matchId));

function renderPublicState(state) {
    const payload = exportPublicScoreboardState(state, matchId);
    document.body.textContent = JSON.stringify(payload);
    document.title = `scoreboardState.json - ${getMatchLabel(matchId)}`;
}

onValue(stateRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
        return;
    }

    renderPublicState(normalizeScoreboardState(data, matchId));
});

const cachedState = readCachedMatchState(matchId);
if (cachedState?.state) {
    renderPublicState(cachedState.state);
} else {
    renderPublicState(normalizeScoreboardState({}, matchId));
}
