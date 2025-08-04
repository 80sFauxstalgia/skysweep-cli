# 📄 Changelog – SkySweep CLI

All notable changes to this project will be documented in this file.

---

## [0.2.0] – 2025-08-04

### ✨ Features

- Added `--simulate` mode for previewing blocks without taking action
- Added `--auto-block` mode to block suspected bots directly
- Heuristic engine now returns reason strings (e.g. "mass-follow botnet")
- Printed actions include rationale per account
- Full profile data pulled using `getProfile` for accurate detection

### 🔧 Internal

- Block actions now use `com.atproto.repo.createRecord`
- Improved CLI clarity with chalk color output
- Error handling for missing or shallow follower data

---

## [0.1.0] – 2025-08-03

- Initial CLI tool released
- Fetches last 100 followers from any account
- Flags likely bots using basic follower/following ratio + post count
