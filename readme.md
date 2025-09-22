# 🌌 SkySweep CLI

A privacy-focused CLI tool to scan your Bluesky followers and identify likely bot accounts based on follower/following ratios and activity.

---

## 🔧 Features

- **Follower Scanning:** Scan your followers to identify likely bot or marketer accounts based on a configurable heuristic engine.
- **Content Deletion (`--nuke`):** Bulk-delete content from your account, with options to nuke all posts, media-only posts, text-only posts, or all your likes.
- **Media Backup:** Download all media (both images and videos) from your account to a local directory. The tool automatically filters out reposts to back up only your original content.
- **Advanced Filtering:** Filter backup and deletion operations by content moderation tags (e.g., only act on posts tagged `nudity` or only on posts with no tags). Also, filter media backups by type (photos only, videos only, or all).
- **Multiple Modes:** Run in a safe simulation mode, an interactive review mode, or a fully automatic `--auto-block` mode.
- **Ease of Use:** A simple, interactive main menu guides non-technical users through the primary features, with clear menus for filtering options.
- **Privacy-Focused:** Authenticates via a **Bluesky App Password** and performs all actions locally without storing credentials.

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/skysweep-cli.git
cd skysweep-cli
```
