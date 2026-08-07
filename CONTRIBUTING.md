# Contributing to BunkWise 🚀

First off, thank you for considering contributing to BunkWise! It's contributors like you who make BunkWise such a great tool for students.

Below you'll find guidelines and instructions to help you get started with contributing.

---

## 🤝 Code of Conduct

Please be respectful, helpful, and welcoming to all other contributors. We aim to foster a collaborative and friendly community.

---

## 🛠️ How Can I Contribute?

### 1. Reporting Bugs 🐛
If you find a bug, please open an Issue on GitHub:
*   First, search existing issues to see if it has already been reported.
*   Describe the bug clearly, including the steps to reproduce it.
*   Mention your environment (e.g., browser, device, OS).

### 2. Suggesting Enhancements 💡
Have an idea for a cool feature? Open an Issue:
*   Explain the feature idea and why it would be useful for BunkWise.
*   If possible, sketch out how it might look or work.

### 3. Submitting Code Changes (Pull Requests) 🚀
To contribute code (features, bug fixes, or documentation updates):

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** to your local machine:
    ```bash
    git clone https://github.com/YOUR_USERNAME/bunkwise.git
    cd bunkwise
    ```
3.  **Set up the upstream remote** to stay in sync with the original project:
    ```bash
    git remote add upstream https://github.com/pranitverma27/bunkwise.git
    ```
4.  **Create a new branch** for your changes. Use a descriptive name:
    ```bash
    git checkout -b feature/your-feature-name
    # or
    git checkout -b fix/bug-description
    ```
5.  **Set up your environment variables** in `.env.local` (see [README.md](README.md) for details).
6.  **Make your changes** and test them locally.
    *   Run `npm run dev` to start the Next.js development server.
7.  **Commit your changes**. We follow simple conventional commit guidelines for clarity:
    *   `feat: add Spotify-wrapped share cards`
    *   `fix: resolve timetable parsing timezone shift`
    *   `docs: update setup steps in README`
8.  **Push your branch** to your fork:
    ```bash
    git push origin feature/your-feature-name
    ```
9.  **Open a Pull Request** against the `main` branch of the original `bunkwise` repository.
10. Wait for the automatic Vercel Preview build and review!

---

## 🎨 Development Guidelines

### Next.js & React Style
*   Use functional components and React Hooks.
*   Keep components modular and reusable under `src/components`.
*   Use Tailwind CSS utility classes and ensure they match the neon/dark-mode theme.
*   Ensure the app remains strictly mobile-first and responsive.

### Python OCR scripts (Optional)
If you're contributing to the timetable OCR parsing script in the `scripts/` directory:
*   Keep the script compatible with standard Python libraries where possible.
*   Ensure it outputs structured JSON matching the format expected by the server action.

---

## 🙋 Need Help?
If you have any questions or get stuck, feel free to open a draft PR or start a discussion in the Issues/Discussions tab. We're happy to help!
