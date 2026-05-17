# Replace Firebase Storage Backup With Backend Volume

## Summary
- Chosen direction: replace Firebase Storage backup/restore with backend-owned storage on Fly.io volume.
- Keep existing raw SQLite snapshot flow, encryption, checksum validation, restore ownership validation, and retention model.
- New backend endpoints handle upload/download/list/delete — mobile app calls the Fly backend instead of Firebase Storage directly.
- Storage lives at `/data/backups` on a Fly.io volume, mounted in the backend Docker container.
- Keep 5 backups per user.

## Solution Context
- Firebase Storage was the v1 replacement for Google Drive AppData. Now replaced with self-hosted backend storage.
- Backend is already deployed on Fly.io with Firebase Auth middleware. Adding backup routes reuses existing auth.
- Fly.io volumes provide persistent block storage attached to the backend VM. No third-party object storage needed.

## Key Changes
- Add `busboy` to backend for multipart upload parsing.
- Create `apps/backend/src/routes/backup.ts` with four endpoints:
  - `GET /api/backup/list` — list backups for authenticated user
  - `POST /api/backup/upload` — multipart upload (file + manifest JSON)
  - `GET /api/backup/download/:backupId` — download encrypted backup
  - `DELETE /api/backup/:backupId` — delete backup
- Create `apps/mobile/src/services/backendStorageBackupClient.ts` — same API surface as the old Firebase client, implemented with `fetch` + `RNFS` (already a dependency).
- Remove `@react-native-firebase/storage` from mobile dependencies.
- Delete `apps/mobile/src/services/firebaseStorageBackupClient.ts`.
- Add `[[mounts]]` section to `fly.toml`: source `backup_data` → destination `/data/backups`.
- Update Dockerfile to pre-create `/data/backups` directory.

## Fly.io Volume Setup
- One-time: `fly volumes create backup_data --region yyz --size 1`
- `fly.toml` mounts the volume. First deploy after adding the mount requires the volume to exist.
- Server-side retention: deletes oldest backups beyond 5 per user after each upload.

## Test Plan
- `npm run check` must pass.
- Manual tests:
  - first backup uploads successfully to backend
  - list returns uploaded backups
  - download restores database
  - delete removes backup
  - restore detection finds backups for empty local user
  - incorrect password does not replace database
  - backup from another Firebase UID is not accessible
  - offline backup shows no-internet error
