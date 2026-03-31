

# Email Gate → Feature Flag (Toggleable)

## Overview
Wrap the existing email gate in a feature flag so it can be toggled off (default: off). When off, all report content is immediately visible. Two soft, non-blocking inline email capture cards appear as optional capture points. No code is deleted — everything is wrapped in conditionals.

## Files

### 1. `src/lib/featureFlags.ts` — NEW
Feature flag constant `EMAIL_GATE_ENABLED` (reads `VITE_EMAIL_GATE_ENABLED`, defaults to `false`) and `GATE_VARIANT` string for analytics tagging.

### 2. `src/components/EmailReportPrompt.tsx` — NEW
Non-blocking inline email capture card with two placement variants (`post_evidence` and `post_letter`). Design: card with mail icon, headline, subtext, inline email input + "Send" button. After submit: green checkmark + confirmation message. Follows the exact same lead capture pipeline as existing EmailCapture/ReportGate (upsert_lead RPC, lead_events insert, rememberEmail, trackEvent, trackAdsConversion, generateSharedReport, sendConfirmationEmail, notifySubmission).

### 3. `src/components/RentResults.tsx` — MODIFY (~40 changes)
- Add `isUnlocked = !!capturedEmail || !EMAIL_GATE_ENABLED`
- Replace ~15 `!capturedEmail` gate conditionals with `!isUnlocked`
- Replace ~15 `capturedEmail &&` post-gate conditionals with `isUnlocked &&`
- Update `capturedEmail ?` ternaries in verdict subtitles to `isUnlocked ?`
- Update navSections memo: `!capturedEmail` → `!isUnlocked`, add to deps
- Update rentcast listings trigger: `!!capturedEmail` → `isUnlocked`
- Gate analytics: skip gate_viewed when flag is off; add `report_shown_ungated` event
- Add `gate_variant: GATE_VARIANT` to directly-fired trackEvent calls
- Insert two `<EmailReportPrompt>` placements (post_evidence, post_letter) — only shown when gate off and no email captured
- Wrap PostConversionFlow in `{capturedEmail && ...}` (only shows after actual email capture)

### 4. `src/components/WsipResults.tsx` — MODIFY (~15 changes)
Same pattern: `isUnlocked` variable, conditional replacements for mobile gate, desktop gate, Phase 3 wrapper, navSections. Two soft capture placements. Wrap WsipPostConversion. Add `gate_variant` to direct trackEvent calls.

### 5. `src/components/PreGateCompPreview.tsx` — MODIFY (1 line)
Add `!EMAIL_GATE_ENABLED` to the early-return condition so preview hides when gate is off (full comps already visible).

### 6. `src/pages/Index.tsx` — MODIFY (4 nav CTA conditionals)
Add `isUnlocked` variable, swap nav button conditionals from `capturedEmail`/`!capturedEmail` to `isUnlocked`/`!isUnlocked`.

### 7. `src/pages/WhatShouldIPay.tsx` — MODIFY (2 nav CTA conditionals)
Same pattern as Index.tsx.

## What stays untouched
- ReportGate.tsx, LetterGate.tsx, ExitIntentModal.tsx, MobileScrollPrompt.tsx — not modified
- No Supabase tables, RPCs, edge functions, or email infrastructure changes
- No scoring logic, affiliate config, or layout reordering
- No child component modifications (ShareHub, NegotiationLetter, IntentFork, PartnerCTA, MoveCTA)
- `capturedEmail` state variable preserved — still used for soft capture

**7 files total. 2 new, 5 modified. 0 deleted.**

