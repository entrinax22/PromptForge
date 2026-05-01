# ⚡ PromptForge v2.0 — Browser Extension

Convert natural language into structured task JSON prompts — ready to paste into any AI model (ChatGPT, Claude, Gemini, Ollama, OpenRouter, and more).

---

## What It Does

You type a rough idea like **"Generate fb content about a product launch"** and PromptForge uses AI to turn it into a structured, ready-to-use JSON prompt:

```json
{
  "task": "generate_facebook_post",
  "topic": "We just launched our new smart water bottle that tracks hydration!",
  "target_audience": "health-conscious adults aged 20–40",
  "output_format": {
    "post_text": "string",
    "hashtags": ["string"],
    "call_to_action": "string",
    "emoji_suggestions": ["string"]
  }
}
```

Copy that JSON and paste it directly into **any AI chat or API** — the structured format gets far better, more consistent results than a plain text prompt.

---

## Installation (Chrome / Edge / Brave)

1. Download or unzip the `prompt-forge-extension` folder to your computer.
2. Open your browser and navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer Mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `prompt-forge-extension` folder.
5. The ⚡ PromptForge icon will appear in your toolbar.

---

## Setup

Click the ⚙ button inside the popup and add your API keys. Each tab only needs its own key — they are independent.

| Tab | Key Required | Where to Get It |
|-----|-------------|-----------------|
| **Claude** | Anthropic API key | console.anthropic.com |
| **OpenAI** | None — builds locally | — |
| **OpenRouter** | OpenRouter API key | openrouter.ai/keys |
| **Ollama** | None — runs locally | See Ollama setup below |
| **Custom** | Anthropic or OpenRouter key | Either of the above |

> Keys are stored only in your browser's local storage and are never sent anywhere except their respective API endpoints.

---

## Usage

### Basic Flow

1. Click the ⚡ toolbar icon to open PromptForge.
2. Select a format tab (Claude, OpenAI, OpenRouter, Ollama, Custom).
3. Type your natural language description in the prompt box.
4. Press **⚡ Generate Structured JSON** or `Ctrl+Enter` / `Cmd+Enter`.
5. Copy the output JSON and paste it into any AI chat or API call.

### Page Injection

1. Open any page with a text input (API playground, chat interface, etc.).
2. Click into the target textarea.
3. Generate your JSON in PromptForge, then click **⬇ Inject** — it pastes directly.

### Right-click Context Menu

1. Select any text on a page.
2. Right-click → **⚡ Forge this as JSON prompt**.
3. The ⚡ popup opens with the selected text pre-filled as your prompt.

---

## Format Tabs

### Claude
Uses your **Anthropic API key** and Claude Haiku as the backbone model to generate the task JSON. Configure model, temperature, max tokens, and an optional system prompt. Supports:
- claude-sonnet-4
- claude-opus-4
- claude-haiku-4.5
- claude-3.5-sonnet / haiku

### OpenAI
Builds a task JSON **locally with no API call** — instant, no key needed. Useful for generating prompts targeting GPT-4o, o3, o4-mini, and other OpenAI models.

### OpenRouter
Uses your **OpenRouter API key only** — no Anthropic key required. Includes **12+ free models** with no usage cost:

| Model | Notes |
|-------|-------|
| Llama 3.3 70B Instruct `:free` | Best free general-purpose |
| Gemma 3 27B IT `:free` | Strong reasoning |
| DeepSeek R1 `:free` | Great for structured output |
| DeepSeek V3 Chat `:free` | Fast and capable |
| Microsoft Phi-4 `:free` | Compact, smart |
| Qwen 3 8B `:free` | Efficient |
| Mistral 7B Instruct `:free` | Reliable baseline |
| Llama 3.2 3B / 3.1 8B `:free` | Lightweight options |
| Gemma 3 12B / 1B `:free` | Smaller Gemma variants |
| Hermes 3 405B `:free` | Large open model |

Paid models (Claude, GPT-4o, Gemini, etc.) are also in the dropdown.

> **Note:** Only use chat/instruct models. Embedding models (names containing "embed") will be rejected with a clear error.

If a free model is temporarily unavailable, PromptForge automatically retries up to 4 other free models before giving up.

### Ollama
Uses **your locally running Ollama instance** — no API key, no cloud, completely private. Supports autocomplete for 30+ popular models:

```
llama3.2  llama3.1  mistral  phi4  gemma3  deepseek-r1
codellama  qwen2.5  qwen2.5-coder  llava  nomic-embed-text
deepseek-coder-v2  phi3  gemma2  llava:13b  and more…
```

Ollama sends your prompt to the local model and returns a fully structured task JSON — no data leaves your machine.

### Custom
Generates task JSON using the best available backbone (Anthropic if key exists, else OpenRouter free model). Choose from built-in schema templates:
- **Generic REST body**
- **LangChain / LangGraph pipeline**
- **AutoGen multi-agent workflow**
- **Saved schema** — paste your own JSON schema in ⚙ Settings

---

## Ollama Setup

1. Download Ollama from [ollama.com](https://ollama.com) and run the installer.
2. Pull a model (pick one based on your available RAM):
   ```powershell
   ollama pull llama3.2       # 2GB — good default
   ollama pull llama3.2:1b    # 1.3GB — very fast, lower quality
   ollama pull phi4           # 2.5GB — excellent quality
   ollama pull deepseek-r1    # strong reasoning
   ```
3. Verify Ollama is running by opening `http://localhost:11434` in your browser — it should say **Ollama is running**.

### Fix: Ollama blocks the extension (403 error)

Chrome extensions run from a `chrome-extension://` origin that Ollama blocks by default. One-time fix:

```powershell
setx OLLAMA_ORIGINS "*"
```

Then restart Ollama (quit from the system tray icon and reopen it). You will not need to do this again.

---

## Output Format

All formats produce the same structured task JSON schema:

```json
{
  "task": "snake_case_task_name",
  "<input_field>": "realistic example content for this task",
  "output_format": {
    "field_name": "string | number | boolean | [\"string\"] | { nested object }"
  }
}
```

**Examples:**

```json
{
  "task": "extract_contact_info",
  "input_text": "You can reach John Doe at john@example.com or call +1-555-123-4567.",
  "output_format": {
    "name": "string",
    "email": "string",
    "phone": "string"
  }
}
```

```json
{
  "task": "summarize_article",
  "article_text": "Artificial Intelligence is transforming industries across the globe...",
  "output_format": {
    "title": "string",
    "summary": "string",
    "keywords": ["string"],
    "sentiment": "string"
  }
}
```

Paste the output into any AI chat (ChatGPT, Claude.ai, Gemini, etc.) or send it directly to an API.

---

## Performance

| Format | API Call | Speed | Key Needed |
|--------|----------|-------|------------|
| Claude | Anthropic (Haiku) | ~2–4s | Anthropic |
| OpenAI | None (local) | Instant | None |
| OpenRouter (free model) | OpenRouter | ~3–8s | OpenRouter |
| Ollama | Local machine | ~2–10s | None |
| Custom | Anthropic or OpenRouter | ~2–8s | Either |

Results are cached — the same prompt generates instantly on repeat.

---

## Files

```
prompt-forge-extension/
├── manifest.json       # Extension manifest (MV3)
├── popup.html          # UI and styles
├── popup.js            # Core logic, API calls, JSON generation
├── background.js       # Service worker (context menus)
├── content.js          # Page injection script
├── content.css         # Toast notification styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Privacy & Security

- API keys are stored only in your browser's local storage (`chrome.storage.local`).
- Keys are sent only to their own API endpoints — Anthropic key goes only to `api.anthropic.com`, OpenRouter key only to `openrouter.ai`.
- Ollama runs entirely on your machine — nothing leaves your device.
- No analytics, no telemetry, no external servers.

---

## Requirements

- Chrome 88+, Edge 88+, Brave, or any Chromium-based browser with Manifest V3 support.
- For Claude tab: an Anthropic API key.
- For OpenRouter tab: an OpenRouter API key (free tier available).
- For Ollama tab: Ollama installed and running locally.
- For OpenAI tab: nothing — works offline.
