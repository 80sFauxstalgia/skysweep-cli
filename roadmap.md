# 🌌 SkySweep Project Roadmap

**SkySweep** is evolving from a bot scanner into a comprehensive, privacy-first toolkit for Bluesky power users. Our goal is to provide useful, easy-to-access tools for account management, starting with a command-line interface and paving the way for future web and mobile applications.

---

## 🎯 Vision

To empower Bluesky users with a suite of powerful, intuitive, and privacy-respecting tools to manage their content, curate their community, and understand their social graph.

---

## 🚧 Phase 1: Core CLI Refinement & Feature Expansion (In Progress)

This phase focuses on making the CLI a robust and user-friendly foundation for all future development.

- [x] **UX Overhaul:** Refactor the CLI to be goal-oriented with a simple main menu instead of a long questionnaire.
- [x] **Rename `index.js` to `skysweep.js`** for better project clarity.
- [x] **Feature: Media Backup:** Implement functionality to download all user-posted media to a local directory (`--download-media`).
- [x] **Feature: Content Nuke:** Implement functionality to bulk-delete content with fine-grained controls:
  - [x] Nuke all posts.
  - [x] Nuke only posts with media.
  - [x] Nuke only text posts.
  - [x] Nuke all likes.
- [x] **Bot/Marketer Scanning:** Retain the original scanning functionality as a core feature accessible from the main menu.

---

## 📦 Phase 2: Packaging & Distribution

This phase is about making the tool accessible to non-technical users.

- [ ] **Standalone Executables:** Integrate `pkg` to bundle the application into single executables for Windows, macOS, and Linux.
- [ ] **Address False Positives:** Develop clear documentation and release notes to guide users through potential virus scanner warnings.

---

## 🖥️ Phase 3: UI Development (Web & Mobile)

This phase will bring the power of the CLI to a graphical interface.

- [ ] **Web Dashboard:** Design and build a web application that exposes the core features (scanning, backup, content deletion) through a user-friendly interface.
- [ ] **iOS Application:** Scope and develop a companion iOS app for on-the-go account management.

---

## ✨ Future Ideas (The "Suite" Vision)

These are longer-term goals to consider after the core phases are complete.

- [ ] **Advanced Follower Curation:** A dashboard to see who doesn't follow you back, manage allow-lists, etc.
- [ ] **Post Scheduling:** A common power-user request.
- [ ] **Account Analytics:** Insights into account growth and engagement.