# Learning Sync E2E Checklist

Use this checklist before changing sync architecture. It verifies the existing `/api/learning/*` contract plus the frontend background sync effects.

## Setup

- Start the API and app: `npm run dev:server` and `npm run dev`.
- Use two browser profiles or two browsers for the same test account.
- Keep DevTools Network open on both devices/profiles.

## Scenarios

1. **A imports, B restores**
   - On A, log in and claim or import one learning package.
   - Wait until the sync chip shows `已同步`.
   - On B, log in with the same account.
   - Expected: `/api/learning/bootstrap` returns the imported subject, chapters, knowledge points, questions, and import history; B shows the package and can start the first card.

2. **A deletes, B disappears**
   - On A, delete an imported batch.
   - Wait until the sync chip shows `已同步`.
   - Reload B or log in again.
   - Expected: bootstrap returns `deletedAt` for the deleted records, and the frontend active learning state no longer displays those cards.

3. **Progress survives login restore**
   - On A, complete at least one flashcard rating.
   - Wait for `已同步`.
   - On B, reload.
   - Expected: FSRS fields, `reviewCount`, `lastReviewedAt`, `nextReviewAt`, and study records match the latest A state.

4. **Offline retry**
   - On A, turn the browser offline.
   - Complete one card or delete an imported batch.
   - Expected: sync chip shows `离线，待同步`.
   - Restore network and click retry if needed.
   - Expected: chip changes through `同步中` to `已同步`, and B receives the update after reload.

5. **Conflict sanity**
   - Send an older progress update after a newer one.
   - Expected: server keeps the newer `updatedAt` record.
