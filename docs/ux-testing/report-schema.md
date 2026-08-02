# Rapportkontrakt för personatester

Rapporten ska vara giltig JSON och följa denna struktur. Frivillig berättande sammanfattning får läggas efter JSON-filen, aldrig i stället för den.

```json
{
  "persona": "digital-novice",
  "mission": "join-group",
  "runId": "2026-08-03-digital-novice-01",
  "environment": {
    "kind": "example | staging | preview",
    "origin": "https://…",
    "viewport": "360x800",
    "browser": "Chromium",
    "authenticatedRole": "none | owner | admin | member"
  },
  "startedAt": "2026-08-03T10:00:00+02:00",
  "completed": false,
  "stopReason": "goal-reached | persona-gave-up | blocked | test-error",
  "firstInterpretation": "…",
  "steps": [
    {
      "index": 1,
      "screen": "landing",
      "visibleUnderstanding": "…",
      "intendedAction": "…",
      "expectedResult": "…",
      "actualResult": "…",
      "backtrack": false,
      "evidence": ["screenshots/001-landing.png"]
    }
  ],
  "metrics": {
    "actions": 0,
    "wrongTurns": 0,
    "backtracks": 0,
    "helpRequests": 0,
    "taskDurationSeconds": 0
  },
  "findings": [
    {
      "id": "F-001",
      "type": "navigation | confusing-copy | hidden-action | trust | accessibility | error-recovery | visual-hierarchy | other",
      "severity": "critical | high | medium | low",
      "confidence": "high | medium | low",
      "screen": "invite-signin",
      "observation": "Endast det som faktiskt syntes eller hände.",
      "userInterpretation": "Vad personan trodde att det betydde.",
      "expected": "Vad personan rimligen förväntade sig.",
      "actual": "Vad gränssnittet gjorde.",
      "impact": "Hur detta påverkade uppdraget eller förtroendet.",
      "reproduction": ["…"],
      "evidence": ["screenshots/004-invite-signin.png"],
      "inference": "Separat analytisk hypotes, inte presenterad som observation."
    }
  ],
  "privacyCheck": {
    "understoodGroupBoundary": true,
    "understoodExternalSharing": null,
    "concerns": []
  },
  "technicalErrors": {
    "console": [],
    "network": []
  }
}
```

## Regler

- `observation` får inte innehålla antagen grundorsak.
- `inference` ska vara tom när ingen teknisk analys har gjorts.
- En åsikt om färg eller smak är inte ett fynd utan observerad påverkan på ett mål.
- `critical` används när en kärnuppgift inte går att slutföra eller privat data riskerar exponering.
- `high` används när många rimliga användare sannolikt blockeras eller gör en farlig handling.
- `medium` används för tydlig friktion, feltolkning eller extra omväg.
- `low` används för lokal förbättring utan påtaglig uppgiftspåverkan.
- Saknad visuell browseråtkomst ska ge `stopReason: test-error`; agenten får inte simulera skärmbilder i text.
