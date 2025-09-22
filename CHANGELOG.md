# 📄 Changelog – SkySweep CLI

All notable changes to this project will be documented in this file.

---

## [0.7.0] - 2025-09-22

### ✨ Added

- **Video Downloads:** The media backup feature now correctly detects and downloads video files in addition to images.
- **Media Type Filtering:** Added a `--media-type` flag and an interactive menu option to allow users to download `all`, `photos`, or `videos` only.

### ♻️ Changed

- **Improved UX:** Replaced the simple yes/no prompt for content tag filtering with a more user-friendly interactive menu that includes presets for common NSFW tags (`suggestive`, `nudity`, `graphic-media`).

### 🐛 Fixed

- **Exclude Reposts:** The media backup feature now correctly ignores reposts, only downloading media from the user's original posts.


## [0.6.0] - 2025-09-20

### ✨ Added

- **Advanced Media Filtering:** Added functionality to filter media for backup or nuke operations based on content tags. New flags `--filter-tags` and `--untagged-only` are available.
- **Interactive Filtering:** The interactive menus for Media Backup and a new Nuke Content option now guide users through setting up content tag filters.
- **Unit Tests:** Introduced a Jest testing suite to validate core logic and prevent regressions.

### ♻️ Changed

- **Download Performance:** Significantly improved media backup speed by downloading images in parallel.
- **Improved UX:** The media backup feature now suggests a user-friendly default download location.
- **Heuristic Tuning:** Adjusted bot detection heuristics to be more sensitive to moderately suspicious accounts.

### 🐛 Fixed

- **Label Detection:** Fixed a critical bug where moderation-applied content labels were not being detected. The tool now correctly finds both self-applied and moderation tags.
- **Heuristic Accuracy:** Fixed a bug in the marketer detection logic where unicode emojis were being counted incorrectly.
- **Test Environment:** Corrected the Jest configuration to properly handle ES Modules.

---

## [0.5.0] - 2025-09-17

### ✨ Added

- **Content Nuke:** Added a `--nuke` feature to bulk-delete content. It supports deleting all posts, media-only posts, text-only posts, or all likes, with a strong confirmation prompt to prevent accidental use.

### ♻️ Changed

- **Improved Heuristics:** Refactored the bot and marketer detection logic to use a more accurate weighted scoring system. This provides a `confidence score` and detailed `reasons` for each flagged account, improving transparency and reducing false positives.
- **Expanded Heuristics:** Added new detection signals, such as checking for default profile pictures, missing bios, and generic handles with numbers.

---

## [0.4.0] - 2025-09-17

### ✨ Added

- **Goal-Oriented Main Menu:** The CLI now starts with a clear, interactive menu to guide users to primary actions (Scan, Backup, Configure).
- **Media Backup:** Added a `--download-media <path>` feature to download all of a user's posted images.
- **Configuration Flag:** Added a `--configure` flag to explicitly enter the advanced setup questionnaire.
- **Follower Count Note:** The scan results now include a note explaining potential discrepancies between the API follower count and the UI count.

### ♻️ Changed

- **Major UX Overhaul:** Refactored the entire application flow to be more intuitive and user-friendly.
- **Smarter Login:** Users can now enter just their username; the `.bsky.social` suffix is appended automatically. The prompt has been updated to reflect this.
- **Simplified Configuration:** Removed technical questions about API delays and replaced the confusing "pages" prompt with human-friendly options (Recent, Extended, All).
- **Default Scan:** The default interactive scan now processes all followers to be more intuitive.
- **Project Structure:** Renamed `index.js` to `skysweep.js` for better clarity.

### 🐛 Fixed

- **Input Validation:** Menus now validate user input and will re-prompt if an invalid choice is entered.
- **CSV Export:** Corrected a syntax error in a regular expression that was causing the script to crash.

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