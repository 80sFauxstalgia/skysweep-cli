# 🌌 SkySweep CLI

A privacy-focused CLI tool to scan your Bluesky followers and identify likely bot accounts based on follower/following ratios and activity.

---

## 🔧 Features

- Authenticates via **Bluesky App Password** (not your main login)
- Scans your latest followers
- Flags accounts with suspicious behavior:
  - High following count
  - Very low follower count
  - Very low activity
  - Low follower/following ratio
- Prints results with clear suspect indicators

> This tool never stores your credentials and performs all actions **locally**.

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/skysweep-cli.git
cd skysweep-cli
```
