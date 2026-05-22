# record-website-demo

Codex skill for generating polished website demo videos with Playwright and ffmpeg.

It records a real browser walkthrough with a visible cursor, click ripple, element-following highlight, slow typing, realistic waits, and MP4 output. It is useful for product demos, graduation project demos, feature walkthroughs, and QA-ready website recordings.

## Features

- Visible green cursor for every interaction.
- Yellow click ripple on actual clicks.
- Yellow highlight bound to the active DOM element, updated every frame while the page scrolls or layout changes.
- Slow, readable typing instead of instant field filling.
- Navigation, scrolling, select boxes, form submission, key presses, and API-response waits.
- Optional restore of files such as `data/submissions.json` after demo submissions.
- MP4 conversion through `ffmpeg`.

## Installation

Clone this repository into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/OwenZhao9/record-website-demo.git ~/.codex/skills/record-website-demo
```

Restart Codex or start a new conversation so the skill list refreshes.

## Requirements

The target project should have Playwright available:

```bash
npm install -D playwright
```

The script first tries to load Playwright from the target project. If that fails, it tries to load Playwright from the skill directory.

You also need `ffmpeg` for MP4 conversion:

```bash
ffmpeg -version
```

On macOS with Homebrew:

```bash
brew install ffmpeg
```

If Playwright-managed browsers are not installed, the script tries common macOS Chrome, Chromium, and Edge paths.

## Usage In Codex

In a Codex conversation, ask:

```text
Use record-website-demo to record a slow website demo video with visible cursor, click indicators, element-following highlight, realistic typing, and MP4 output.
```

For local apps, include the URL:

```text
Use record-website-demo. The website is running at http://127.0.0.1:5174.
```

Codex should inspect the UI, create a JSON config, run the bundled script, and validate the video.

## Direct Script Usage

Create a JSON config in your target project, for example `.demo-recording/demo.json`:

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

Run:

```bash
node ~/.codex/skills/record-website-demo/scripts/record_website_demo.mjs --config .demo-recording/demo.json
```

## Action Reference

Each item in `actions` can include:

- `caption`: show overlay text.
- `wait`: wait in milliseconds.
- `scroll`: slowly scroll to a CSS selector.
- `click`: click a target with cursor, ripple, and element-following highlight.
- `type`: click a target and type text slowly.
- `replace`: select existing text, delete it, then type replacement text.
- `select`: choose an option in a `<select>`.
- `press`: press a keyboard key.
- `waitAfter`: wait after a click.
- `waitForResponseIncludes`: wait for an API response URL containing a string.

Supported targets:

```json
{ "selector": ".form-panel input", "index": 1 }
{ "role": "button", "name": "提交报名" }
{ "text": "保持距离并联系救护机构" }
```

## Validation

Check output metadata:

```bash
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,codec_name \
  -show_entries format=duration,size \
  -of default=noprint_wrappers=1:nokey=0 recordings/demo.mp4
```

Extract a frame for visual review:

```bash
mkdir -p recordings/check-frames
ffmpeg -y -ss 6 -i recordings/demo.mp4 -frames:v 1 recordings/check-frames/frame-006.png
```

Review that:

- the yellow highlight follows the active element during scrolling
- the highlight disappears when the active element leaves the viewport
- click ripples only happen on real clicks
- typing is visible and readable
- success messages are readable
- files listed in `restoreFiles` are restored

## Repository Layout

```text
record-website-demo/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── scripts/
    └── record_website_demo.mjs
```

## License

No license has been specified yet.
