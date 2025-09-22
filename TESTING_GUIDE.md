# SkySweep CLI: Manual Testing Guide

This guide provides a set of steps to manually test the functionality of the SkySweep CLI tool in a live environment, using your own Bluesky account.

**IMPORTANT:** Some features, especially the `--nuke` command, are destructive and will permanently delete your data. Please proceed with caution and consider testing on a non-critical account if possible.

---

## 1. Prerequisites: Configuration

Before you begin, you need to provide your Bluesky credentials to the application. The recommended way to do this is via a `config.json` file in the root of the project.

1.  Create a file named `config.json` in the project directory.
2.  Add your credentials in the following format:

    ```json
    {
      "identifier": "your-handle.bsky.social",
      "password": "your-app-password"
    }
    ```

    *   **`identifier`**: Your full Bluesky handle.
    *   **`password`**: A **Bluesky App Password**, not your main account password. You can generate one in Bluesky under Settings -> App Passwords.

---

## 2. Testing Features

Run the following commands from your terminal in the project directory.

### A. Follower Scan

This feature scans your followers to identify potential bot or marketer accounts.

**Test 1: Simulation Mode (Safe)**

This command will scan your followers and show you which accounts it *would* block, without taking any action.

```bash
node skysweep.js --simulate
```

**Expected Outcome:**
*   The application logs in successfully.
*   It fetches your followers and starts scanning them.
*   It prints a list of suspected accounts with a `[GHOST] Would block:` prefix.
*   The summary at the end should report `blocked 0 (simulation)`.

**Test 2: Auto-Block Mode (Use with Caution)**

This command will automatically block a small number of suspected bot accounts.

```bash
node skysweep.js --auto-block --max-blocks 2
```

**Expected Outcome:**
*   The application will block up to 2 suspected bot accounts.
*   It will print a `[BLOCKED]` message for each account it blocks.
*   Check your Bluesky account to confirm that the users have been blocked.

**Test 3: CSV Export**

This command will scan your followers and export the list of suspected accounts to a CSV file.

```bash
node skysweep.js --simulate --export csv
```

**Expected Outcome:**
*   A new file named `skysweep-suspects-YYYYMMDD-HHMMSS.csv` is created in the project directory.
*   The CSV file should contain a header row and a list of suspected accounts with their details.

### B. Media Backup

This feature downloads all the media from your account to a local directory.

**Test 1: Basic Backup (Images and Videos)**

```bash
node skysweep.js --download-media ./my_media_backup
```

**Expected Outcome:**
*   A new directory named `my_media_backup` is created.
*   The application fetches all your posts and downloads all images and videos to the `my_media_backup` directory.
*   Verify that the media in the directory is from your original posts (no reposts).

**Test 2: Photos Only Backup**

```bash
node skysweep.js --download-media ./my_photos_only --media-type photos
```

**Expected Outcome:**
*   A new directory named `my_photos_only` is created.
*   Only images are downloaded.

**Test 3: Videos Only Backup**

```bash
node skysweep.js --download-media ./my_videos_only --media-type videos
```

**Expected Outcome:**
*   A new directory named `my_videos_only` is created.
*   Only videos are downloaded.

**Test 4: Interactive Backup with Filters**

Run the tool in interactive mode:
```bash
node skysweep.js
```
1.  Choose the "💾  Back up all my media" option.
2.  When prompted to filter by content tags, select one of the NSFW options (e.g., "Nudity").
3.  When prompted for media type, select "Photos only".
4.  Confirm the download path.

**Expected Outcome:**
*   The tool should download only photos from posts tagged with `nudity`.

### C. Content Nuke (DANGER)

This feature permanently deletes content from your account. **USE WITH EXTREME CAUTION.**

**Test 1: Nuke Likes (Safest Option)**

This command will delete all of your likes. This is the safest option for testing the nuke feature.

```bash
node skysweep.js --nuke likes
```

**Expected Outcome:**
*   You will be prompted with a strong warning and asked to type `likes` to confirm.
*   The application will then delete all of your likes.
*   Check your Bluesky account to confirm that your likes have been removed.

### D. Interactive Mode

This tests the interactive menus for non-technical users.

**Test 1: Main Menu**

Run the application without any flags:

```bash
node skysweep.js
```

**Expected Outcome:**
*   You are presented with a menu of options.
*   Test each menu option to ensure it leads to the correct feature (e.g., selecting "Back up all my media" should start the media backup process).

---

If you encounter any errors or unexpected behavior during these tests, please provide the full command you ran and the complete output from the terminal.
