# BigBearLifts — video archiving to Google Drive via a self-hosted EC2 backend.

---

## 1. Vision ++&++ Goals

**What it is:** A single-user strength training app built to replace messy notes-app logging. Mobile-first, gym-friendly, fast to log, and rich with analytics. Self-hosted on EC2, installable to iPhone home screen as a PWA, with a backend that handles auth, sync, video uploads, and automated Google Drive archival.

**Primary goals:**

- Log workouts in under 5 taps per set
- Auto-fill from last same-day workout (Push2 pulls last Push2)
- Track progress, volume, poundage, PRs, and body metrics over time
- Store progress videos permanently on Google Drive, not on phone or EC2
- Feel like a real native app — offline-first, dark, fast, polished

**Non-goals:**

- Multi-user / social features
- Nutrition logging
- Video exercise tutorials
- Native iOS/Android build

---



## 2. Tech Stack

**Frontend**

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Recharts for analytics graphs
- Zustand for local state
- Dexie (IndexedDB) for local-first storage
- Framer Motion for light animations
- next-pwa for PWA / service worker

**Backend**

- Next.js API routes (same app, deployed on EC2)
- PostgreSQL (Docker container on EC2)
- Prisma ORM
- NextAuth v5 (credentials provider, single password)
- S3-compatible signed URL generation (or direct EC2 upload endpoints)
- VAPID Web Push for notifications

**Infrastructure**

- AWS EC2 (Ubuntu 22.04)
- Docker + docker-compose
- Caddy reverse proxy (auto Let's Encrypt TLS)
- `rclone` for Google Drive sync (service account auth)
- `cron` for scheduled sync
- Backup: `pg_dump` nightly to local + optional S3

**Sync & Video Pipeline**

- Videos upload directly to EC2 disk (`/var/www/bigbearlifts/uploads/`)
- Cron runs `rclone move` every 15 min → Google Drive (service account, hidden app folder)
- Files deleted from EC2 after successful transfer
- Manual "Cleanup" dashboard in the app shows EC2 video inventory + trigger buttons

---



## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      iPhone (PWA, installed)                    │
│                                                                 │
│   Next.js Frontend  ←→  Dexie/IndexedDB  ←→  Service Worker     │
│         │                                                       │
│         └─── fetch (background sync queue when offline) ────┐   │
└─────────────────────────────────────────────────────────────┼───┘
                                                              │
                                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EC2 (Ubuntu + Docker)                      │
│                                                                 │
│   Caddy (TLS) → Next.js app (API + SSR)  →  Postgres            │
│                       │                                         │
│                       ├── /api/videos/upload  → /uploads/       │
│                       ├── /api/videos/list    → lists /uploads/ │
│                       ├── /api/videos/sync    → triggers rclone │
│                       ├── /api/videos/clean   → deletes synced  │
│                       └── /api/push/subscribe → VAPID           │
│                                                                 │
│   cron: */15 * * * *  rclone move /uploads/ gdrive:bigbearlifts │
└─────────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
                                            ┌──────────────────────┐
                                            │  Google Drive        │
                                            │  (hidden app folder) │
                                            └──────────────────────┘
```

**Data flow summary:**

- Every action logs to IndexedDB first (instant)
- Sync engine pushes to Postgres when online
- Videos upload directly to EC2 → cron archives to GDrive → cleanup

---



## 4. Data Model



### Core Entities

```prisma
model User {
  id            String   @id @default(cuid())
  username      String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())
}

model Exercise {
  id            String   @id @default(cuid())
  name          String   @unique
  primaryMuscle String   // chest, back, shoulders, biceps, triceps, quads, hams, glutes, calves, abs
  secondaryMuscles String[]
  equipment     String   // barbell, dumbbell, cable, machine, smith, bodyweight, ez-bar, other
  isFavorite    Boolean  @default(false)
  isCustom      Boolean  @default(true)
  setupFields   SetupField[]
  variants      ExerciseVariant[]
  createdAt     DateTime @default(now())
}

model SetupField {
  id          String @id @default(cuid())
  exerciseId  String
  exercise    Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  label       String   // "Hole", "Angle", "Seat", "Pad", "Grip"
  type        String   // "number" | "text" | "enum"
  order       Int
  defaultValue String?
}

model ExerciseVariant {
  id          String @id @default(cuid())
  exerciseId  String
  exercise    Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  setupValues Json     // { "Hole": 9, "Angle": "90-1" }
  label       String   // computed: "Hole 9" or "Angle 90-1, Pad 2"
  createdAt   DateTime @default(now())
}

model Program {
  id        String   @id @default(cuid())
  name      String   // "PPL"
  isActive  Boolean  @default(true)
  days      ProgramDay[]
}

model ProgramDay {
  id          String   @id @default(cuid())
  programId   String
  program     Program  @relation(fields: [programId], references: [id], onDelete: Cascade)
  label       String   // "Push 1", "Pull 2", "Legs 1"
  order       Int      // rotation order
  exercises   ProgramExercise[]
}

model ProgramExercise {
  id           String   @id @default(cuid())
  programDayId String
  programDay   ProgramDay @relation(fields: [programDayId], references: [id], onDelete: Cascade)
  exerciseId   String
  exercise     Exercise   @relation(fields: [exerciseId], references: [id])
  order        Int
  targetSets   Int
  targetRepsMin Int
  targetRepsMax Int
  notes        String?
}

model Workout {
  id           String   @id @default(cuid())
  programDayId String?
  label        String   // "Push 2"
  startedAt    DateTime @default(now())
  finishedAt   DateTime?
  notes        String?
  exercises    WorkoutExercise[]
  totalVolume  Float    @default(0) // kg
  totalSets    Int      @default(0)
}

model WorkoutExercise {
  id          String @id @default(cuid())
  workoutId   String
  workout     Workout @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  exerciseId  String
  exercise    Exercise @relation(fields: [exerciseId], references: [id])
  variantId   String?
  variant     ExerciseVariant? @relation(fields: [variantId], references: [id])
  order       Int
  notes       String?
  sets        WorkoutSet[]
}

model WorkoutSet {
  id                String @id @default(cuid())
  workoutExerciseId String
  workoutExercise   WorkoutExercise @relation(fields: [workoutExerciseId], references: [id], onDelete: Cascade)
  order             Int
  type              String // "warmup" | "working" | "amrap" | "drop" | "failure"
  weight            Float
  reps              Int
  parentSetId       String?  // for drops chained to a working set
  dropLevel         Int?     // 1, 2, 3 for double/triple drop
  isCompleted       Boolean  @default(true)
  createdAt         DateTime @default(now())
}

model BodyMetric {
  id        String   @id @default(cuid())
  date      DateTime @unique @db.Date
  weightKg  Float?
  bodyFatPct Float?
  smmKg     Float?
  notes     String?
}

model ProgressVideo {
  id           String   @id @default(cuid())
  filename     String
  sizeBytes    Int
  durationSec  Int?
  exerciseId   String?
  notes        String?
  status       String   // "on-ec2" | "synced" | "deleted"
  uploadedAt   DateTime @default(now())
  syncedAt     DateTime?
}

model Goal {
  id          String @id @default(cuid())
  type        String // "weight" | "bodyFat" | "lift"
  targetValue Float
  exerciseId  String?
  deadline    DateTime?
  createdAt   DateTime @default(now())
}

model PR {
  id            String   @id @default(cuid())
  exerciseId    String
  variantId     String?
  type          String   // "1RM" | "weight" | "reps" | "volume"
  value         Float
  achievedAt    DateTime
  workoutSetId  String?
}
```

**Local IndexedDB mirrors** all of these with a `_dirty` flag and `_syncedAt` timestamp for offline queue.

---



## 5. Screen Specs

Mobile-first. Bottom nav with 5 tabs: **Today**, **Program**, **Progress**, **Body**, **More**.

### 5.1 Today (Home)

- Big "Start Today's Workout" card → detects next in rotation
  - e.g. last was Pull1 → shows "Push2" as next
  - Tapping opens Active Workout with all exercises pre-filled from last Push2 (greyed)
- Streak counter top-right
- Last 3 sessions mini cards
- Quick weigh-in button
- Next reminder time



### 5.2 Active Workout

Header: workout label · elapsed · Finish button

Per exercise card (draggable to reorder):

```
▸ Incline Bench Press           [Angle: 90-1]   ⓘ
   Warmups (auto)
    40%  30kg × 8   [plate calc]
    60%  45kg × 5   [plate calc]
    80%  60kg × 3   [plate calc]
   Working
    Set 1   75kg × 5   [✓]
    Set 2   75kg × 5   [✓]
    Set 3   75kg × 5   [ ]
    AMRAP  75kg × __  [ ]
   [＋ Add set] [Quick log]
```

Tap a set row → inline edit weight/reps → ✓ complete → rest timer starts
Tap last set → auto-copies for quick log
Long press → set type menu (warmup/working/amrap/drop/failure)
Drop set: chains to parent, tracks each level's weight+reps

Warmup generator: on exercise open, if no warmups logged, auto-generate 3 sets at 40/60/80% of first working weight. Tap any → opens plate calculator prefilled.

Plate calculator: input weight → shows plates per side (default bar 20kg, configurable).

Rest timer: floating pill at bottom, counts down from preset (default 90s, per-exercise override). Vibration + optional sound.

Finish → confirm → saves, syncs, updates PRs.

### 5.3 Program

- Shows active program (PPL) with day cards
- Tap day → exercise list with setup fields, targets
- Edit day: add/remove/reorder exercises, edit targets
- Program templates: import from JSON
- Create new program



### 5.4 Exercise Library

- Search bar
- Filter chips: muscle group, equipment, favorite
- List view with primary muscle + equipment
- Tap → detail: PRs, history chart, variants, setup fields
- "New Exercise" button: name, muscle groups, equipment, custom setup fields



### 5.5 Progress

Tabs: **Lifts** · **Volume** · **Sessions** · **Calendar**

- Lifts: pick exercise → line chart of est. 1RM, top set, total volume over time
- Volume: weekly volume per muscle group (stacked bar)
- Sessions: list of all workouts with volume, duration, sets
- Calendar: heatmap of training days
- Poundage per session + per lift displayed prominently
- PR badges: gold star on PR sets in history



### 5.6 Body

- Weigh-in input card (kg + optional BF% + optional SMM)
- Weight graph with 7-day smoothed trendline + raw scatter
- BMI / FFMI calculation
- Goals: target weight, target BF%, deadline → progress ring
- Body fat % chart
- SMM chart



### 5.7 Videos

- Grid of progress videos (thumbnails)
- Record button → in-app camera → upload directly to EC2
- Or upload from gallery
- Each video: exercise tag, notes, status badge (on-ec2 / synced / deleted)
- Sync All button → triggers `rclone move` on server
- Cleanup button → shows EC2 storage used, list of "synced" videos, delete-from-EC2 action
- Storage dashboard: EC2 total, GDrive total synced



### 5.8 More

- Settings: accent color, default rest time, units (kg/lb), plate inventory
- Notifications: workout reminder time, weigh-in reminder time
- Data: Export JSON, Export CSV, Import
- Account: change password
- About



### 5.9 Auth

- Single password login screen
- Session cookie via NextAuth
- No signup — user created via seed script

---



## 6. Feature Specs (Behavioral Detail)



### 6.1 Warmup Auto-Generator

- Triggered when first working set of an exercise is logged
- Uses first working set weight
- Default: 3 warmups at 40%, 60%, 80% of working weight
- Rep scheme: 8 / 5 / 3
- Rounded to nearest 2.5kg
- Each warmup tap → plate calculator prefilled
- Warmups don't count toward volume or PRs
- Editable per-exercise (change percentages or count)



### 6.2 Quick Log

- Small button on each exercise card
- Copies last completed set's weight + reps into a new set
- One tap → set added, marked complete, rest timer starts



### 6.3 Today's Workout

- Reads ProgramDay rotation order
- Finds last workout with same programDayId
- Pre-loads all exercises, variants, setup values
- Renders last session's sets greyed as reference (not editable, just shown)
- User logs fresh sets below each greyed set



### 6.4 Setup Fields (Structured)

- Defined per exercise in library
- Types: number, text, enum
- Displayed as chips on active workout screen
- Auto-filled from last same-exercise session
- Editable inline (tap chip → input)
- Variants tracked separately for PRs/graphs



### 6.5 Rest Timer

- Auto-starts on set complete
- Default 90s, per-exercise override in library
- Floating pill: countdown + skip + +30s
- Sound + vibration on finish (navigator.vibrate)
- Survives tab background (uses timestamp diff, not setInterval)



### 6.6 Plate Calculator

- Input: total weight
- Config: bar weight (default 20kg), available plates (default 25/20/15/10/5/2.5/1.25 kg)
- Output: plates per side + remainder warning
- Reachable from any warmup/working set row



### 6.7 Notifications

- Daily workout reminder at user-set time (default 18:00)
- Daily weigh-in reminder at user-set time (default 07:00)
- VAPID Web Push via service worker
- iOS 16.4+ requires PWA install for push
- Toggle per notification type



### 6.8 Video Upload & Archival

- In-app camera (getUserMedia) or file picker
  - Uploads directly to EC2 via `/api/videos/upload` (multipart)
  - On success: record in DB with status `on-ec2`
- Cron on EC2 every 15 min: `rclone move /uploads/ gdrive:bigbearlifts-progress/`
- After move, cron marks videos as `synced` in DB
- Videos screen shows storage dashboard
- "Cleanup" button: deletes all `synced` files from EC2, marks `deleted` in DB
- Google Drive uses service account with `drive.appfolder` scope (hidden folder)
- Files named: `YYYY-MM-DD_HHMM_<exercise>_<id>.mp4`



### 6.9 Sync Engine (Local-First)

- All writes hit Dexie first
- Background sync worker pushes dirty records to `/api/sync` every 5s when online
- Pulls server changes (updatedAt > lastSync) on app open
- Conflict: last-write-wins by updatedAt
- Offline queue persists across app restarts



### 6.10 PR Detection

- On workout finish, scan new sets:
  - 1RM PR: Epley `w * (1 + r/30)`
  - Weight PR: heaviest weight for ≥1 rep
  - Rep PR: most reps at a given weight
  - Volume PR: highest session volume for exercise
- Store in PR table, badge on session history



### 6.11 Analytics

- Est. 1RM graph: Epley, per exercise, over time
- Volume graph: sum(weight × reps) per week per muscle group
- Poundage: session total + exercise total
- Session comparison: current vs last same-day
- Streak: consecutive days with a logged workout (allow 1 rest day gap)

---



## 7. Design System

**Theme:** Dark mode default, high contrast, athletic.

- Background: `#0A0A0B`
- Surface: `#141416`
- Surface elevated: `#1C1C1F`
- Border: `#26262A`
- Text primary: `#F5F5F7`
- Text secondary: `#9A9AA2`
- Accent: user-selectable, default `#FF5A1F` (ember orange)
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`
- PR gold: `#FACC15`

**Typography:** Inter (or Geist). Sizes: 12 / 14 / 16 / 20 / 24 / 32 / 40.

**Spacing:** 4px grid. Cards radius 16px. Buttons radius 12px.

**Components:** Card, Sheet (bottom sheet for modals), Chip, Button (primary/secondary/ghost/danger), Input, NumberStepper, Tab bar, FloatingPill, Toast, Chart wrappers, EmptyState, Skeleton.

**Motion:** Framer Motion — 150-200ms transitions. Set complete → subtle scale + checkmark. Screen transitions → slide from right.

**Mobile-first rules:**

- Min tap target 44px
- Bottom nav always visible except during Active Workout
- No hover states as primary interactions
- One-handed reach: primary actions in bottom 60% of screen

---



## 8. PWA Configuration

- `manifest.json`: name "BigBearLifts", short_name "BBL", display `standalone`, theme_color `#0A0A0B`, background `#0A0A0B`, orientation `portrait`
- Icons: 192, 512, 1024 (maskable + apple-touch)
- Splash screen via `apple-touch-startup-image`
- Service worker:
  - Precaches app shell
  - Runtime caches API GETs (stale-while-revalidate)
  - Background sync queue for mutations
  - Push handler for notifications
- iOS meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (black-translucent), `apple-mobile-web-app-title`

---



## 9. Backend Specs



### API Routes

```
POST   /api/auth/login               → NextAuth credentials
POST   /api/auth/logout

GET    /api/exercises                → list all + variants + setup fields
POST   /api/exercises                → create custom
PATCH  /api/exercises/:id            → edit
DELETE /api/exercises/:id

GET    /api/programs                 → list
POST   /api/programs
PATCH  /api/programs/:id

GET    /api/workouts                 → paginated history
POST   /api/workouts                 → create/save
PATCH  /api/workouts/:id
GET    /api/workouts/last?dayId=...  → last same-day workout

POST   /api/sync                     → bulk push dirty records
GET    /api/sync?since=<ts>          → pull changes

GET    /api/metrics/body             → paginated
POST   /api/metrics/body

GET    /api/prs                      → all PRs
GET    /api/prs/:exerciseId

POST   /api/videos/upload            → multipart to EC2 disk
GET    /api/videos                   → list from DB + EC2 status
POST   /api/videos/sync              → triggers rclone move
POST   /api/videos/clean             → deletes synced files from EC2
GET    /api/videos/storage           → EC2 disk usage

POST   /api/push/subscribe           → save subscription
DELETE /api/push/unsubscribe
POST   /api/push/test
```



### Auth

- NextAuth v5 credentials provider
- Single user seeded via `prisma/seed.ts` (username + bcrypt hash from env)
- Session cookie, 30-day expiry, httpOnly, secure, sameSite lax



### Video Upload

- Max size 500MB
- Accepted: mp4, mov
- Stored at `/var/www/bigbearlifts/uploads/<uuid>.mp4`
- Metadata in Postgres
- Served for playback via signed short-lived URL (Next.js route handler streams file)



### Cron Jobs (EC2)

```cron
# Sync videos to GDrive every 15 min
*/15 * * * * rclone move /var/www/bigbearlifts/uploads/ gdrive:bigbearlifts-progress/ --min-age 2m --log-file /var/log/rclone.log

# Nightly DB backup
0 3 * * * pg_dump -U bbl bigbearlifts | gzip > /backups/bbl-$(date +\%F).sql.gz
```



### rclone Setup (Service Account)

1. Google Cloud Console → create project → enable Drive API
2. Create service account → download JSON key
3. In Google Drive, create folder "BigBearLifts Progress"
4. Share folder with service account email
5. On EC2: `rclone config` → new remote `gdrive` → type `drive` → service account → path to JSON → root_folder_id = folder ID
6. Test: `rclone lsd gdrive:`

---



## 10. Folder Structure

```
bigbearlifts/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                 # bottom nav shell
│   │   ├── page.tsx                   # Today
│   │   ├── workout/[id]/page.tsx      # Active workout
│   │   ├── program/page.tsx
│   │   ├── program/[dayId]/page.tsx
│   │   ├── exercises/page.tsx
│   │   ├── exercises/[id]/page.tsx
│   │   ├── progress/page.tsx
│   │   ├── body/page.tsx
│   │   ├── videos/page.tsx
│   │   └── more/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── exercises/route.ts
│   │   ├── programs/route.ts
│   │   ├── workouts/route.ts
│   │   ├── sync/route.ts
│   │   ├── metrics/body/route.ts
│   │   ├── prs/route.ts
│   │   ├── videos/upload/route.ts
│   │   ├── videos/sync/route.ts
│   │   ├── videos/clean/route.ts
│   │   └── push/subscribe/route.ts
│   ├── manifest.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                            # shadcn primitives
│   ├── workout/
│   │   ├── ExerciseCard.tsx
│   │   ├── SetRow.tsx
│   │   ├── WarmupList.tsx
│   │   ├── PlateCalculator.tsx
│   │   ├── RestTimer.tsx
│   │   └── SetupChips.tsx
│   ├── charts/
│   │   ├── LiftChart.tsx
│   │   ├── VolumeChart.tsx
│   │   ├── WeightChart.tsx
│   │   └── CalendarHeatmap.tsx
│   └── layout/
│       ├── BottomNav.tsx
│       └── PageHeader.tsx
├── lib/
│   ├── db/
│   │   ├── dexie.ts                   # local schema
│   │   ├── sync.ts                    # sync engine
│   │   └── prisma.ts
│   ├── auth.ts
│   ├── plate-calc.ts
│   ├── warmup-gen.ts
│   ├── one-rm.ts
│   ├── pr-detect.ts
│   ├── units.ts
│   └── utils.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
│   ├── icons/
│   └── sw.js
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── Caddyfile
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---



## 11. Environment Variables

```env
# Database
DATABASE_URL=postgresql://bbl:password@postgres:5432/bigbearlifts

# Auth
NEXTAUTH_URL=https://bigbearlifts.yourdomain.com
NEXTAUTH_SECRET=<random-32-bytes>
APP_USERNAME=you
APP_PASSWORD_HASH=<bcrypt hash>

# Push
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
VAPID_SUBJECT=mailto:you@example.com

# Video
UPLOAD_DIR=/var/www/bigbearlifts/uploads
MAX_UPLOAD_MB=500

# App
NEXT_PUBLIC_APP_NAME=BigBearLifts
NEXT_PUBLIC_DEFAULT_REST_SEC=90
NEXT_PUBLIC_ACCENT=#FF5A1F
```

---



## 12. Seed Data

The live catalog and program are not in git. Put them in gitignored `data/personal-seed.json`. `data/personal-seed.example.json` shows the shape with placeholder names only.

### Exercises and program

Not stored in this repository. Copy `data/personal-seed.example.json` to `data/personal-seed.json` and fill in your own catalog and days. The app reads that file at seed time. Do not commit it.

### Seed Body Metric

- Optional. Set `SEED_METRIC_DATE` and `SEED_METRIC_WEIGHT_KG` in `.env`. Do not commit the values.

---



## 13. Milestones (Build Order)

**M1 — Shell & Auth**

- Next.js + Tailwind + shadcn scaffold
- Dark theme + bottom nav
- NextAuth single password
- Empty screens routed

**M2 — Exercise Library**

- Prisma schema + migrations
- Seed data
- Library list/search/filter
- Exercise detail with custom setup fields
- Create/edit exercise

**M3 — Program**

- Program builder UI
- Program day editor
- Rotation logic

**M4 — Active Workout (Core)**

- Dexie local schema
- Today's workout launcher
- Active workout screen
- Set logging (weight/reps/type)
- Warmup auto-generator
- Plate calculator
- Rest timer
- Quick log
- Drag reorder
- Finish & save

**M5 — Sync Engine**

- Dirty queue
- Push/pull endpoints
- Conflict resolution
- Background sync

**M6 — Analytics**

- PR detection
- Lift charts (est 1RM)
- Volume per muscle chart
- Poundage totals
- Session history list
- Calendar heatmap
- Streak

**M7 — Body Metrics**

- Weigh-in input
- Weight graph + 7d smoothing
- BMI / FFMI
- Goals

**M8 — Videos**

- Upload endpoint
- Video list screen
- EC2 storage dashboard
- rclone cron setup
- Sync + cleanup buttons

**M9 — PWA & Notifications**

- Manifest + icons + splash
- Service worker
- Offline support
- Push subscription
- Daily reminders

**M10 — Deploy**

- Dockerfiles
- docker-compose
- Caddy config
- EC2 setup guide
- rclone service account setup
- Backup cron

---



## 14. EC2 Deployment Guide

```bash
# 1. Provision EC2 (Ubuntu 22.04, t3.small minimum, 30GB+ disk)
# 2. Install Docker + docker-compose
sudo apt update && sudo apt install -y docker.io docker-compose-plugin rclone
sudo usermod -aG docker $USER

# 3. Clone repo
git clone https://github.com/you/bigbearlifts.git /opt/bigbearlifts
cd /opt/bigbearlifts

# 4. Env
cp .env.example .env
# edit .env with real values

# 5. rclone config (service account)
rclone config
# → n, name=gdrive, type=drive, service_account_file=/opt/gcloud-key.json
# → root_folder_id=<BigBearLifts folder ID>

# 6. Uploads dir
sudo mkdir -p /var/www/bigbearlifts/uploads
sudo chown -R $USER:$USER /var/www/bigbearlifts

# 7. Start
docker compose up -d

# 8. Caddy auto-TLS handles HTTPS for your domain
# Point DNS A record to EC2 IP

# 9. Migrate + seed
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed

# 10. Cron
crontab -e
# add:
# */15 * * * * rclone move /var/www/bigbearlifts/uploads/ gdrive:bigbearlifts-progress/ --min-age 2m --log-file /var/log/rclone.log
# 0 3 * * * pg_dump -U bbl bigbearlifts | gzip > /backups/bbl-$(date +\%F).sql.gz
```

**Caddyfile:**

```
bigbearlifts.yourdomain.com {
    reverse_proxy app:3000
    encode gzip
    request_body {
        max_size 500MB
    }
}
```

**docker-compose.yml** (skeleton):

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - /var/www/bigbearlifts/uploads:/var/www/bigbearlifts/uploads
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: bbl
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: bigbearlifts
    volumes:
      - pgdata:/var/lib/postgresql/data

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

---



## 15. README.md (Repository)

```markdown
# BigBearLifts

A personal, mobile-first strength training PWA.

- Offline-first workout logging
- Auto-fill from last session
- Structured exercise setup tracking
- Analytics: PRs, volume, poundage, est. 1RM
- Body metrics with smoothed trends
- Progress video archival to Google Drive
- Self-hosted on EC2

## Stack
Next.js 14 · TypeScript · Tailwind · shadcn/ui · Dexie · Prisma · PostgreSQL · NextAuth · rclone · Caddy · Docker

## Setup
See `/docs/deployment.md` for full EC2 guide.

## License
Private. Personal use only.
```

---

