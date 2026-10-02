# Project guidance

Read README.md before changing this project. It is a small Express service for
GSCRL broadcast overlays and match logs; keep the runtime and UI simple.

- Event metadata and bracket IDs belong in config/events.json. Preserve old
  event entries and stable division keys/aliases when transitioning events.
- Credentials belong only in .env or host secrets. Never print or commit them.
- Preserve the existing GSCRL theme and transparent OBS backgrounds.
- Keep all TrueFinals requests behind the poller's rate limiter, including
  startup, player refreshes and retries. Never fetch authenticated data in the browser.
- Explicit division selection must never fall back to a different division.
- Scope persisted stream timing by event ID.
- Preserve pre-existing local changes. Review the complete diff before committing.
- Use a feature branch and a pull request; never push changes directly to main.
- Run npm run check and npm test before publishing. Add meaningful regression
  coverage for changes to event selection, polling, or API behavior.
- Use applicable available skills when their scope matches the task. Read the
  skill instructions first; do not invent project skills or invoke unrelated ones.
- Update README.md when configuration, operation or event-transition steps change.

claude.md is historical design context, not the current setup guide.
