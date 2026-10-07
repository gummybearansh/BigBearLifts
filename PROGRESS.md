# BigBearLifts progress

Open this file to see where the build is. The app runs locally at http://localhost:3000. The program, workouts, progress, body, and physique videos are in. Deploy files are still open.

Personal values stay in `.env` and `data/personal-seed.json`. Both are gitignored. `scripts/import-notes.ts` is gitignored too.

## M1 — Shell and auth

- [x] Next.js 14, TypeScript strict, Tailwind, shadcn primitives
- [x] Dark theme, bottom nav, empty routes
- [x] Single-password login, sign out, change-password route
- [x] User seed from `APP_USERNAME` and `APP_PASSWORD_HASH`

## M2 — Exercise library

- [x] Full Prisma schema and migration
- [x] Dexie mirror and local-first exercise writes
- [x] Seed catalog from gitignored `data/personal-seed.json`
- [x] List, search, filters
- [x] Detail, create, edit, favorite
- [x] Setup fields on exercises (hole, seat, pad, angle, grip, assist, attachment)

## M3 — Program

- [x] Program screen and day editor
- [x] Rotation helper
- [x] Create program and JSON import
- [x] Active program renamed from `5P PPL+PP` to `PPL`
- [x] Six days: Push 1, Pull 1, Legs 1, Push 2, Pull 2, Legs 2

## M4 — Active workout

- [x] Today launcher and active workout screen
- [x] Set logging, warmups, plate calculator, rest timer, quick log
- [x] Reorder, finish, and save
- [x] Each exercise lists every set. Each set is reps, then weight, then Log
- [x] Logging a set starts that exercise’s rest timer. Default is 3:00. − and + change it by 30 seconds and save it on the exercise

## M5 — Sync engine

- [x] Push and pull with `updatedAt` last-write-wins
- [x] Offline queue that survives reload
- [x] Workout push writes `programDayId` and `location`

## M6 — Analytics

- [x] PR detection
- [x] Sessions, Days, Lifts, Volume, plus a calendar card on Sessions
- [x] Session lines are the date and the workout, for example `7th October. Push 2`
- [x] Lifts tonnage is every completed set: weight × reps (`loggedTonnageKg`)
- [x] Volume stays the stacked muscle bars, recolored for the dark theme
- [x] Streak on Today

## M7 — Body metrics

- [x] Weigh-in, trend, BMI, FFMI, goals
- [x] Imported October weigh-ins

## M8 — Videos

- [x] Physique updates, not exercise clips. More link label is Physique
- [x] Record opens the camera in the app. No file-picker upload
- [x] Upload to EC2, then Sync that video, then Delete from EC2 after it is synced
- [x] Accepts mp4, mov, and webm

## M9 — PWA and notifications

- [x] Manifest, settings, export, and change-password form
- [ ] Service worker and push reminders

## M10 — Deploy

- [ ] Docker, Caddy, EC2 guide, rclone, backups

## Improvement pass 1

- [x] P0-1 More page. Sign-out is a server action in `app/(app)/more/sign-out.ts`. The More screen, Exercises, Physique, and both export links render.
- [x] P0-2 Searchable combobox for exercise muscle, equipment, setup-field type, and the day editor’s add-exercise control
- [x] P1 Progress: Sessions, Days, Lifts, Volume, plus a calendar card on Sessions
- [x] P2 Empty states, skeletons, rest timer on resume, sync dot, console cleanup

## Imported training

- [x] Personal sessions were imported locally. The notes, loads, and gym stay in gitignored files and are not part of this checklist.

## Spec deviations

1. Progress tabs: `Lifts / Volume / Sessions / Calendar` (Section 5.5) changed to `Sessions / Days / Lifts / Volume` plus a calendar heatmap card on Sessions.
2. Combobox added to the design system (Section 7).
3. Session volume still uses `setVolumeKg` in `lib/volume.ts` (bodyweight and assisted loads, warmups excluded). The Lifts chart uses `loggedTonnageKg`: every completed set, weight × reps, warmups included.
4. Videos are one whole-physique update after a workout. No exercise tag. Camera only.
5. Session lines show the date and the workout. Gym location is stored on the workout and is not shown.
6. Active program is `PPL` with Legs 2, not `5P PPL+PP`.
7. Rest defaults to 3:00 and is edited per exercise on the workout card.

## Before a public GitHub push

- [ ] Confirm `.env` is not tracked
- [ ] Confirm `data/personal-seed.json` is not tracked
- [ ] Confirm `scripts/import-notes.ts` is not tracked
- [ ] `specification.md` program and body stats stay out of the public tree. Confirm the staged diff before the first commit.
