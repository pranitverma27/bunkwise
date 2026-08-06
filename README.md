# BunkWise 🚀

BunkWise is a mobile-first, AI-powered Progressive Web App (PWA) built specifically for college students to effortlessly track and optimize their attendance. Never guess your attendance percentage or calculate "safe bunks" manually ever again.

## Features

*   **📸 AI Timetable Extraction:** Just upload a photo of your class schedule. BunkWise uses Gemini 1.5 Pro to automatically parse your subjects and timings.
*   **✈️ Autopilot Tracking:** We flip the traditional attendance model on its head. Instead of manually logging every class, BunkWise assumes you attend all scheduled classes. You only interact with the app when you *miss* a class or a class is *cancelled*.
*   **🔮 The AI Bunk Planner:** Planning a trip or a long weekend? Simulate your absence before committing. BunkWise will calculate exactly which classes you'll miss and project your new attendance percentage, warning you if you're about to enter the "Danger Zone".
*   **📊 Full History & One-Tap Fixes:** A reverse-chronological timeline of your entire semester. Instantly fix any logging mistakes with a single tap.
*   **💯 Risk Calculator:** Instantly answers the burning questions: *"How many more classes can I bunk safely?"* and *"How many classes do I need to attend to reach 75%?"*
*   **✨ Share Cards (Spotify Wrapped-style):** Generate vibrant, highly-shareable stat cards summarizing your attendance "vibe" to post on Instagram Stories or WhatsApp.

## Tech Stack

*   **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
*   **Backend & Database:** Supabase (PostgreSQL)
*   **Authentication:** Supabase Auth (Email OTP)
*   **AI Vision:** Google Generative AI (Gemini 1.5 Pro)
*   **Image Generation:** `html2canvas`

## Getting Started

### Prerequisites

*   Node.js 18+
*   A Supabase Project
*   A Google Gemini API Key

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/bunkwise.git
    cd bunkwise
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env.local` file in the root directory and add the following:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Database Setup:**
    You'll need three tables in your Supabase database: `profiles`, `timetables`, and `attendance_logs`. 
    (Check the `src/types/database.ts` file for the schema structure).

5.  **Run the development server:**
    ```bash
    npm run dev
    ```

6.  **Open the app:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser. For the best experience, use Chrome DevTools and simulate a mobile device (iPhone 14 Pro).

## Design Philosophy

BunkWise is built with a strictly **mobile-first** approach. 
*   **No App Store Required:** Built as a PWA, students can install it directly to their home screen from the browser.
*   **Premium UI:** Glassmorphism, neon glows, large tap targets, and smooth bottom navigation make it feel like a native iOS/Android app.
*   **Low Friction:** The "Negative Marking" (Autopilot) approach means users spend less than 5 seconds in the app per week, only opening it when they actually bunk.

## License

This project is licensed under the MIT License.
