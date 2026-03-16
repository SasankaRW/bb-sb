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