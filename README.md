# Basketball_ScoreBoard

## Multi-match setup

This app now supports two isolated matches: `match1` and `match2`.

### Operator URLs

- `src/index.html?match=match1`
- `src/index.html?match=match2`
- `src/scoreboard-display.html?match=match1`
- `src/scoreboard-display.html?match=match2`
- `src/stream-overlay.html?match=match1`
- `src/stream-overlay.html?match=match2`
- `/scoreboardState.json` (match 1 live JSON, no `meta`)
- `/scoreboardState-match2.json` (match 2 live JSON, no `meta`)

### Live JSON export

The control panel mirrors public scoreboard data to `matches/{matchId}/liveScoreboard` in Realtime Database on every update. That node is real JSON (no HTML, no JavaScript).

**Match 1**

- Hosted shortcut: `/scoreboardState.json`
- Direct: `https://bb-scoreboardnew-default-rtdb.asia-southeast1.firebasedatabase.app/matches/match1/liveScoreboard.json`

**Match 2**

- Hosted shortcut: `/scoreboardState-match2.json`
- Direct: `https://bb-scoreboardnew-default-rtdb.asia-southeast1.firebasedatabase.app/matches/match2/liveScoreboard.json`

Poll either URL; each request returns the latest JSON body. Example:

```json
{"awayFouls":5,"awayScore":70,"awayTeamName":"APEX","awayTimeouts":2,"ballPossession":"home","defaultAwayTeam":"AWAY","defaultGameMinutes":10,"defaultHomeTeam":"HOME","defaultQuarter":1,"defaultShotClock":24,"defaultTimeouts":2,"gameMilliseconds":0,"gameMinutes":10,"gameSeconds":0,"homeFouls":2,"homeScore":66,"homeTeamName":"CON","homeTimeouts":2,"isGameClockRunning":false,"isShotClockRunning":false,"quarter":3,"shotClockSeconds":24}
```

Deploy database rules and hosting after pulling these changes. Make at least one score change while signed in so `liveScoreboard` is populated.

### Firebase Authentication

Create Firebase Authentication email/password users for each operator.

### Required Realtime Database profile

For every authenticated user, create a profile at `users/{uid}`:

```json
{
  "displayName": "Operator A",
  "role": "operator",
  "assignedMatchId": "match1",
  "isActive": true
}
```

Only `match1` and `match2` are valid assigned match IDs.

### Security rules

Deploy the included Realtime Database rules:

```bash
firebase deploy --only database
```

They allow public read access for scoreboard displays and restrict scoreboard writes to authenticated users whose `users/{uid}.assignedMatchId` matches the target match.