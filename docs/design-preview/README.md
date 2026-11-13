# Streaxie visual design preview

Open `index.html` directly in a browser. No installation, server, or external asset request is required.

This is a standalone design artifact for the grilling/design interview. It is **not the production frontend**, does not call the backend, does not create accounts, and does not send email. All habit values and history are explicitly illustrative. The production framework and implementation plan remain separate from this prototype.

Preview controls above the product frame:

- Landing, Today, Onboarding: switch between initial screen designs.
- Mobile: constrain the product frame to a phone-width layout. The page also responds to the actual viewport width.
- Offline: simulate pending check-ins. Returning online simulates acknowledgment after a short delay.
- Read-only: show the expired email-verification state and disable writes.
- Empty and Loading: inspect first-use and loading layouts.
- Reset: restore the original sample habits, replacing only this preview's local sample state.

Click a habit card: binary habits toggle immediately; water/time cards expand an inline editor with Save and Cancel. There are no separate History or Update buttons. Cards also support native keyboard activation with Enter/Space. In read-only mode, clicking a card shows its details instead of changing data. Walk through the first-habit flow with the Onboarding control.

Each collapsed card shows its current streak in days so habits can be compared directly. Counts in this preview use illustrative history, include provisional passing check-ins for the example day, and revert when a check-in is undone. Pending changes have a dashed badge and pending status. The selected habit's side panel uses the same counts. New sample habits start at zero; production counts will come from the backend's current_streak field.

Sample habit changes use the browser key `streaxie.design-preview.v1`, where browser storage is available. They are separate from real account data. Reset clears the sample state back to its initial values.

Useful review URLs when opening the file:

```text
index.html?view=landing
index.html?view=today
index.html?view=onboarding
index.html?view=today&mobile=1
index.html?view=today&readonly=1
```

Not yet represented in full: production login/register/password-reset forms, complete Insights and Settings pages, real sync conflicts, and email delivery. Those are marked as preliminary panels when opened. The source of approved product decisions is `../WEB-DESIGN.md`; a visual suggestion in this preview is not a new approved requirement.
