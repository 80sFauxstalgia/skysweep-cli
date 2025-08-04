# 🌌 SkySweep Project Roadmap

**SkySweep** is an open-source, privacy-first tool for detecting and blocking bot accounts on Bluesky. It includes both a command-line tool for developers and a user-friendly web dashboard for creators and casual users.

---

## 🎯 Vision

Empower Bluesky users to reclaim their timelines by identifying and blocking mass-follow bots using smart heuristics and community-shared lists—without compromising privacy.

---

## 🚧 Phase 1: MVP (Minimum Viable Product)

### 🛠 SkySweep CLI (Developer Tool)

- ✅ Authenticate with Bluesky App Password
- ✅ Fetch recent followers (up to 100)
- ✅ Run basic suspicion heuristics:
  - Follows > 100
  - Followers < 25
  - Posts < 5
  - Follower/Following Ratio < 0.05
- ✅ Print suspect bots to terminal
- [ ] Add `--export` and `--simulate` flags
- [ ] Add optional `--auto-block` feature

### 🌐 SkySweep Cloud (Web App)

- [ ] Simple login form (handle + app password)
- [ ] Fetch and scan followers via backend
- [ ] Display suspected bot accounts
- [ ] "Block All" and "Export List" buttons (UI only for now)

---

## 🔁 Phase 2: Core Feature Enhancements

### CLI

- [ ] Export results to `.json` or `.csv`
- [ ] Configurable scan mode: `--mode safe | moderate | aggressive`
- [ ] Read credentials from `config.json` or `.env`
- [ ] Display summary statistics

### Cloud

- [ ] Working "Block All" backend endpoint
- [ ] Export suspected bot list to download
- [ ] Individual review toggle (checkboxes per bot)
- [ ] Mobile-friendly responsive layout
- [ ] Help/FAQ panel and donation link

---

## 💸 Phase 3: Donationware & Community Layer

- [ ] Ko-fi or GitHub Sponsors support
- [ ] "Support Development" button on dashboard
- [ ] Public transparency dashboard: Total bots blocked, users helped
- [ ] Community testimonials

---

## 🌈 Stretch Goals (v1.0+)

- [ ] Schedule recurring scans via web
- [ ] Email or DMs when new bots are detected
- [ ] Public blocklist API
- [ ] Federated server support
- [ ] Custom detection filters (e.g. keyword blocks)
- [ ] Shared reputation weight system (trustworthy user reports)

---

## 🧭 Development Timeline (Proposed)

| Week | Focus                           | Milestone                    |
| ---- | ------------------------------- | ---------------------------- |
| 1    | CLI MVP                         | Public GitHub release        |
| 2    | Cloud MVP scaffold              | Deploy to Vercel, test login |
| 3    | Add CLI blocking + export       | Community testing            |
| 4    | Cloud "Block All" + Export      | Accept donations             |
| 5+   | UI polish + Feedback-driven dev | Iterate + community support  |

---

## 💬 Want to Contribute?

1. Star and fork the repo
2. Open a PR or issue for improvements or feature requests
3. Join the project via [GitHub Discussions](https://github.com/YOUR_USERNAME/skysweep-cli/discussions) _(if enabled)_

---

## 🧡 Maintainer

Built with love and frustration by [@griffin.bsky.social](https://bsky.app/profile/griffin.bsky.social). Say hi or report bugs there.
