# ⚡ PromptForge — Browser Extension

Convert natural language into structured JSON prompts for Claude, OpenAI, or custom schemas — right from your browser.

---

## Installation (Chrome / Edge / Brave)

1. **Download** or unzip the `prompt-forge-extension` folder somewhere on your computer.
2. Open your browser and go to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer Mode** (toggle in top-right corner).
4. Click **"Load unpacked"** and select the `prompt-forge-extension` folder.
5. The ⚡ PromptForge icon will appear in your toolbar.

---

## Setup

1. Click the ⚡ icon to open the popup.
2. Click the **⚙** settings button (top-right of popup).
3. Paste your **Anthropic API key** (`sk-ant-api03-...`) and click **Save**.
   - Your key is stored locally in browser storage — never sent anywhere except `api.anthropic.com`.

---

## Usage

### Popup Mode
1. Click the ⚡ toolbar icon.
2. Select a format tab: **Claude**, **OpenAI**, or **Custom**.
3. Adjust parameters (model, tokens, temperature, etc.).
4. Type your natural language prompt in the text box.
5. Press **⚡ Generate** (or `Ctrl+Enter` / `Cmd+Enter`).
6. The structured JSON appears below.
7. **⎘ Copy** — copies JSON to clipboard.
8. **⬇ Inject** — pastes JSON into the focused textarea on the active page.

### Page Injection
- Navigate to any page with a text input (e.g., an API playground, chat UI, or code editor).
- Click into the target textarea.
- Open PromptForge, generate your JSON, then click **⬇ Inject**.

### Right-click Context Menu
- Select text on any page.
- Right-click → **⚡ Forge this as JSON prompt**.
- Click the ⚡ icon — the selected text is pre-filled as your prompt.

---

## Formats

| Tab | Output Schema |
|-----|--------------|
| **Claude** | Anthropic Messages API (`/v1/messages`) |
| **OpenAI** | OpenAI Chat Completions API (`/v1/chat/completions`) |
| **Custom** | Generic REST, LangChain, AutoGen, or your own schema |

---

## Files

```
prompt-forge-extension/
├── manifest.json       # Extension manifest (MV3)
├── popup.html          # Main UI
├── popup.js            # Popup logic + API calls
├── background.js       # Service worker (context menus)
├── content.js          # Page injection script
├── content.css         # Minimal page styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Notes

- The extension uses your **Anthropic API key** to call Claude Sonnet for generating structured JSON.
- No data is stored on any server — everything stays in your browser's local storage.
- Works on Chrome 88+, Edge 88+, Brave, and any Chromium-based browser supporting Manifest V3.
