# Attendance Risk Predictor — Project Log

> A running record of all decisions, actions, and progress for the AttendanceRiskPredictor project.
> Maintained by Antigravity AI. All times are in IST (UTC+5:30).

---

## Session 1 — 2026-05-08 (Thu)

### 17:52 IST — Spec Shared
- User shared the planning document: `AttendanceRiskPredictor_Spec.docx`
- Document was read and parsed via a custom Python script (`read_docx.py`)

### 18:05 IST — Spec Review Complete
- Full spec reviewed. Summary:
  - **App:** Next.js web app for Indian college students to track attendance risk
  - **Core flow:** User uploads timetable photo → Claude parses it → user corrects → app handles all deterministic calculations
  - **AI role:** Timetable extraction ONLY. Never in calculation loop.
  - **Backend:** Supabase (Auth + Postgres)
  - **Build Parts:** P1–P7 (MVP = P1–P5; P6 = Bunk Planner; P7 = Share Cards)

### 18:15 IST — Thoughts Shared on Spec
- Highlighted strengths: mental model flip, AI-off calculation loop, mandatory correction screen, clean Supabase schema
- Flagged risks: Indian calendar edge cases, photo quality variance, mobile auth (magic link issues)

---

## Session 2 — 2026-05-09 (Fri)

### 15:27 IST — Conversation Resumed
- User asked for thoughts on the plan (recap of Session 1 thoughts provided)

### 15:53 IST — Mobile-First Constraint Confirmed
- **Decision:** App will be optimized primarily for mobile (Android + iOS)
- Implications discussed and agreed:
  - Single-column layouts, large tap targets, bottom navigation
  - Camera capture via `<input capture="environment">` for timetable upload
  - **Auth:** Use Supabase OTP (6-digit code) instead of magic links (magic links break on mobile browsers)
  - PWA considered as a distribution strategy
  - Keep bundle size lean for slower mobile networks
- **Open question posed:** PWA only / React Native / Next.js PWA now + native later?
  - *(Awaiting user decision)*

### 15:55 IST — Project Log Initiated
- User requested a running record of all project activity
- This file created at: `C:\Users\Pranit\.gemini\antigravity\scratch\AttendanceRiskPredictor\project_log.md`

### 16:15 IST — Development Strategy Decision
- **Decision:** **Next.js PWA (Mobile-First)**
- **Rationale:** 
  - Minimize friction for student adoption (no App Store download required).
  - Faster iteration cycle (instant updates).
  - Web-to-Native path: Build as a PWA first, with the option to wrap in Capacitor for App Stores later.
- **Next Steps:** 
  - Scaffold Next.js project.
  - Setup Supabase project and Auth (OTP).
  - Implement PWA manifest and service worker.

### 16:22 IST — Project Scaffolding & PWA Init
- **Action:** Scaffolded Next.js project using `create-next-app` in `attendance-risk-predictor`.
  - Tech Stack: TypeScript, Tailwind CSS, App Router.
- **Action:** Configured PWA infrastructure:
  - Created `public/manifest.json`.
  - Generated and added `public/icon.svg`.
  - Updated `src/app/layout.tsx` with mobile-first metadata (theme colors, apple web app support, viewport constraints).
- **Action:** Moved project log to new project root.
- **Next Steps:**
  - Initialize Supabase client.
  - Build P1: Auth flow (OTP).
  - Design the mobile shell (Bottom Nav).

### 16:30 IST — Supabase Integration Init
- **Action:** Created `.env.local` for project credentials.
- **Action:** Initialized Supabase client in `src/lib/supabase.ts`.
- **Action:** Defined database schema types in `src/types/database.ts`.
  - Tables defined: `profiles`, `timetables`, `attendance_logs`.
- **Note:** Encountered permission issues with `npm install @supabase/supabase-js`. User needs to run this manually if I can't resolve it.
- **Open Action for User:** 
  1. Create Supabase project (Mumbai region).
  2. Copy URL and Anon Key into `.env.local`.
  3. Run `npm install @supabase/supabase-js` in the project root.

### 16:52 IST — P1: Auth Flow Implementation
- **Action:** Created `src/app/auth/page.tsx` with mobile-first Email OTP flow.
  - Features: Automatic 6-digit formatting, numeric input mode for thumb-typing, glassmorphism UI.
- **Action:** Refactored `src/app/page.tsx` to act as a secure Dashboard.
  - Added `getSession` check for client-side redirection to `/auth`.
  - Implemented `handleSignOut`.
  - Designed premium mobile shell with sticky header and bottom nav placeholder.
- **Next Steps:**
  - Build P2: Timetable Upload UI.
  - Integrate vision model (Claude) for extraction.
  - Create the mandatory correction screen.

---

## Session 3 — 2026-05-10 & 2026-05-11

### 12:30 IST — AI Timetable Extraction (P2)
- **Action:** Implemented `src/app/actions/parse-timetable.ts` using Google Generative AI (Gemini 1.5 Pro).
- **Logic:** Custom prompt instructions to prioritize "PM" as the default time assumption for Indian college schedules.
- **Action:** Created `src/components/TimetableReview.tsx` — a mandatory correction screen.
  - Features: Custom 12-hour Time Picker (5-min snapping), overlap detection (Red cards), and automatic chronological sorting.

### 13:45 IST — The "Autopilot" Attendance Engine
- **Decision:** Shifted to **Negative Marking Mode** to minimize user effort.
- **Logic:** App now automatically marks classes as "Present" once their end time passes. Users only log "Absent" or "Cancelled" logs as exceptions.
- **Update:** Refactored `calculateStats` in `src/app/page.tsx` to iterate through every day from timetable creation to today to provide instant, real-time stats without manual logging.

### 15:10 IST — Risk Calculator & 3-Tier System
- **Action:** Added a dedicated **Risk Calc** tab for manual simulation.
- **Feature:** Subject dropdown automatically calculates "Total Occurred" classes from the timetable history.
- **Risk Levels Implemented:**
  - **Safe (80%+)**: Green zone.
  - **Be Careful (70-80%)**: Orange zone.
  - **Detained (Below 70%)**: Red zone.
- **Logic:** Instant calculation of "Safe Bunks" left or "Classes needed to attend" to reach 80%.

### 16:30 IST — Semester Timeline Flexibility
- **Feature:** Added a "Semester Start Date" picker to the timetable setup.
- **Impact:** Users starting mid-semester can back-date the app, allowing the Bunk-O-Meter to account for weeks of classes that happened before the app was installed.

### 18:00 IST — Runtime Stability & UI Polish
- **Bug Fix:** Resolved "undefined" crashes in the stats engine by implementing dynamic subject initialization.
- **Bug Fix:** Fixed visibility issues for dropdowns and inputs (ensuring high-contrast text colors for mobile/dark mode).
- **PWA Status:** Manifest and basic mobile meta-tags confirmed working.

---

## Session 4 — 2026-05-11 (Mon)

### 12:38 IST — Mandatory Timeline-First Workflow
- **Update:** Moved the **Semester Start Date** picker to the absolute first step of the timetable verification process.
- **Logic:** The setup is now a mandatory 3-step flow: **Timeline → Subjects → Schedule**.
- **Impact:** This guarantees that even if a student joins mid-semester, the app immediately has the correct historical context to calculate "Classes Occurred" accurately on the first load.

### 12:40 IST — Server Recovery
- **Issue:** Localhost refused to connect (Server crash).
- **Action:** Restarted the Next.js development server via `npm run dev`.

---

*— End of log. Updated entries will be appended below this line as work progresses. —*
