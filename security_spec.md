# Firestore Security Specification

## 1. Data Invariants
1. Every document in `/users/{userId}` must have `uid == userId == request.auth.uid` on creation, and `role` cannot be escalated to `super_admin` unless `request.auth.token.email_verified == true && request.auth.token.email == 'hsenmhmd1022@gmail.com'`.
2. PII (`email`, `displayName`, `paidUntil`) in `/users/{userId}` can only be read by the document owner or the verified super admin (`hsenmhmd1022@gmail.com`). Collection `list` on `/users` and `/codes` is strictly limited to the verified super admin.
3. Every document in `/codes/{codeId}` can only be created or deleted by the verified super admin, with `code == codeId` matching `^[A-Z0-9\-]{4,32}$`.
4. A license code can only be redeemed once: `existing().used == false` transitioning atomically via `writeBatch` to `used == true`, `usedBy == request.auth.uid`, `usedAt == request.time`, while simultaneously updating `/users/{request.auth.uid}.paidUntil` within `durationDays` of `request.time` (extending active `paidUntil` if still valid, or starting from `request.time` if expired).
5. Every newly registered user starts with `freeUsed == 0`. Owners may only increment `freeUsed` by `1` per generation up to `3` (`freeUsed` can never be decremented, skipped, or reset to `0`).

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read/write on `/users/{uid}` or `/codes/{codeId}` -> `PERMISSION_DENIED`.
2. Unverified email (`email_verified == false`) attempting to create `/users/{uid}` or redeem `/codes/{codeId}` -> `PERMISSION_DENIED`.
3. Spoofed admin email with `email_verified == false` attempting to `list /users` or `create /codes/FAKE-1234` -> `PERMISSION_DENIED`.
4. Regular user setting `role: 'super_admin'` or `freeUsed: -5` on `/users/{uid}` create -> `PERMISSION_DENIED`.
5. Regular user resetting own `freeUsed` from `3` back to `0` after exhausting free quota -> `PERMISSION_DENIED`.
6. Regular user setting `paidUntil` directly or extending it past `durationDays` -> `PERMISSION_DENIED`.
7. Regular user attempting to redeem a non-existent code (`codes/FAKE-9999`) -> `PERMISSION_DENIED`.
8. Second user attempting to redeem an already-used code (`used == true`) -> `PERMISSION_DENIED`.
9. User attempting to mark `codes/{codeId}` `used: true` with someone else's `usedBy` UID -> `PERMISSION_DENIED`.
10. User attempting to update `/users/{uid}` with a ghost field (`isAdmin: true`) -> `PERMISSION_DENIED` (`hasOnly` rejects).
11. Regular user attempting `list` query on `/codes` to scrape unused codes -> `PERMISSION_DENIED`.
12. Regular user attempting `get` on another user's `/users/{otherUid}` document -> `PERMISSION_DENIED`.
