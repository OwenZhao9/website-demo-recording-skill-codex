---
name: record-website-demo
description: Create polished demo videos for local or remote websites using Playwright and ffmpeg. Use when the user asks to record, generate, remake, or polish a website/app walkthrough, feature demo, screen recording, product demo video, graduation/demo presentation video, or when they want visible cursor, click indicators, element highlighting, realistic typing, slow navigation, MP4 output, or repeatable scripted website recording.
---

# Record Website Demo

## Overview

Use this skill to create repeatable website demo recordings. The bundled script records a browser session with:

- visible cursor
- click ripple
- yellow highlight that tracks the current DOM element every frame
- slow typing and realistic waits
- optional form/API waits
- optional data-file restore after demo submissions
- MP4 conversion through `ffmpeg`

Prefer this skill over ad hoc screen capture when the user needs a clean, reproducible walkthrough.

## Workflow

1. Confirm the target URL is reachable. If it is a local app, start the dev server first.
2. Inspect the UI enough to identify stable selectors, button labels, and form fields.
3. Create a temporary JSON config in the target project, such as `.demo-recording/demo.json`.
4. Run the bundled script:

```bash
node ~/.codex/skills/record-website-demo/scripts/record_website_demo.mjs --config .demo-recording/demo.json
```

5. Check the output MP4 with `ffprobe`.
6. Spot-check key timestamps or extract frames with `ffmpeg -ss`.
7. If the user reports timing/highlight problems, fix the config or the script behavior and regenerate.

## Config Shape

Use a JSON file. Minimal example:

```json
{
  "url": "http://127.0.0.1:5174",
  "output": "recordings/demo.mp4",
  "viewport": { "width": 1440, "height": 920 },
  "restoreFiles": ["data/submissions.json"],
  "actions": [
    { "caption": "首页：介绍项目主题", "wait": 1800 },
    {
      "caption": "点击进入物种图鉴",
      "click": { "role": "link", "name": "查看物种图鉴" },
      "waitAfter": 1500
    },
    {
      "caption": "搜索物种",
      "type": { "selector": ".search-field input", "text": "东北虎" }
    },
    {
      "caption": "切换类别筛选",
      "select": { "selector": ".filter-row select", "index": 0, "value": "鸟类" }
    }
  ]
}
```

Supported action keys:

- `caption`: show overlay text.
- `wait`: wait in milliseconds.
- `scroll`: scroll slowly to a selector. Example: `{ "scroll": "#features", "caption": "查看功能模块" }`.
- `click`: click a target with visible cursor, ripple, and element-following highlight.
- `type`: click a target and type text slowly.
- `replace`: select existing text, delete it, then type replacement text.
- `select`: choose an option in a `<select>`.
- `press`: press a key such as `Enter`, `Tab`, or `Control+A`.
- `waitForResponseIncludes`: on a click action, wait for an API response URL containing this string.
- `waitAfter`: on click actions, wait this many milliseconds after the click.

Target forms:

```json
{ "selector": ".form-panel input", "index": 1 }
{ "role": "button", "name": "提交报名" }
{ "text": "保持距离并联系救护机构" }
```

## Recording Guidelines

- Use stable selectors or accessible names. Avoid brittle absolute CSS paths.
- Show real user flows. Prefer actual navigation, filtering, typing, submission, and success messages.
- Keep a readable pace: 1-2 seconds after navigation, 500-900 ms after simple clicks, longer after form submissions.
- For forms that write demo data, add those files to `restoreFiles`.
- If the app has an existing data store, snapshot and restore it rather than leaving demo submissions.
- If Playwright browsers are not installed, the script will try common macOS Chrome/Edge paths first.
- If the target project cannot import Playwright, run `npm install -D playwright` in that project.
- If `ffmpeg` is missing, install it or keep the raw WebM from Playwright.

## Validation Checklist

After generating the video:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,codec_name \
  -show_entries format=duration,size \
  -of default=noprint_wrappers=1:nokey=0 recordings/demo.mp4
```

Spot-check early and interaction-heavy moments:

```bash
mkdir -p recordings/check-frames
ffmpeg -y -ss 6 -i recordings/demo.mp4 -frames:v 1 recordings/check-frames/frame-006.png
```

Inspect that:

- the yellow highlight follows the active element during scrolling
- the highlight disappears when the active element leaves the viewport
- click ripples occur on clicks only
- typing is visible and not instant
- success messages are readable
- output data files were restored
