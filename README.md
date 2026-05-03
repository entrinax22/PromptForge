# ⚡ PromptForge v2.1 — Browser Extension

Convert natural language into structured task JSON prompts — ready to paste into any AI model. Includes meta prompting, a visual JSON builder, and right-click shortcuts.

---

## What It Does

Type a rough idea like **"Summarize a news article and extract key entities"** and PromptForge uses AI to produce a structured, ready-to-use JSON prompt:

```json
{
  "task": "summarize_news_article",
  "article_text": "Scientists at MIT have developed a new battery technology that could double the range of electric vehicles...",
  "output_format": {
    "title": "string",
    "summary": "string",
    "key_entities": ["string"],
    "sentiment": "string",
    "reading_time_minutes": "number"
  }
}
```

Paste that JSON into any AI chat or API — structured prompts produce far more consistent, predictable results than plain text.

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

The extension has two tabs: **Ollama** and **Custom**. API keys are entered directly inside each provider's panel — no separate settings screen needed.

| Tab | Provider | Key Required | Where to Get It |
|-----|----------|-------------|-----------------|
| **Ollama** | Local Ollama | None | See Ollama setup below |
| **Custom → Anthropic** | Claude (Haiku, Sonnet, Opus) | Anthropic API key | console.anthropic.com |
| **Custom → OpenAI** | GPT-4o, o3, o4-mini, etc. | OpenAI API key | platform.openai.com |
| **Custom → OpenRouter** | 7+ free models + paid | OpenRouter API key | openrouter.ai/keys |

> Keys are stored only in your browser's local storage and are never sent anywhere except their own API endpoints.

---

## Core Features

### ⚡ Generate Structured JSON

1. Click the ⚡ toolbar icon to open PromptForge.
2. Choose a tab — **Ollama** or **Custom**.
3. Type your natural language description in the prompt box.
4. Press **⚡ Generate Structured JSON** or `Ctrl+Enter` / `Cmd+Enter`.
5. The structured JSON appears in the output section below.

---

### ✨ Meta Prompting

Meta prompting lets the AI **rewrite and improve your rough prompt** before you generate JSON. It sits next to the Generate button.

**How to use:**
1. Type a rough idea in the prompt box.
2. Select a meta prompt style from the dropdown above the button.
3. Click **✨ Meta Prompt**.
4. The improved prompt appears in the **output section** with a purple "Meta Prompt Result" label.
5. Click **→ Use as Prompt** to move it into the input box, then generate.

**Available styles:**

| Style | What it does |
|-------|-------------|
| ✨ Improve & Clarify | Makes the prompt clearer, more specific, better structured |
| 🎭 Role & Persona | Rewrites as "You are a [expert]…" role-based prompt |
| 🧠 Chain of Thought | Adds step-by-step reasoning scaffolds |
| 📋 Add Constraints | Adds format rules, length limits, tone guardrails |
| ⚙ System Prompt | Converts the idea into a full AI system prompt |
| 📝 Few-Shot Template | Adds 2–3 Input/Output example pairs |

> Meta Prompt uses whichever provider is currently configured — Ollama uses your local model, Custom uses Anthropic/OpenAI/OpenRouter depending on your selection. No extra key needed.

---

### { } JSON Builder

The JSON Builder lets you **define the exact field structure** and have AI generate the JSON respecting your specification.

**How to use:**
1. (Optional) Type a task description in the prompt box.
2. Click **{ } JSON Builder** to expand the panel.
3. Under **Input Attributes** — add rows with field name, example value, and type.
4. Under **Output Format** — add rows with field name and type.
5. Click **⚡ Build with AI** — the AI generates JSON that follows your defined fields.

**Example:** Define `article_text (string, e.g. "Breaking news…")` as input and `summary (string)`, `sentiment (string)`, `word_count (number)` as output — the AI fills in realistic data and structures everything correctly.

---

### Right-click Context Menu

**On any webpage:**
1. Select text on a page.
2. Right-click → **⚡ Forge this as JSON prompt**.
3. PromptForge opens with that text pre-filled as your prompt.

**Inside the prompt box:**
1. Type or paste text in the prompt box.
2. Highlight a portion of it.
3. Right-click to see:
   - **⚡ Submit selection** — generates JSON using only the highlighted text
   - **✨ Enhance selection** — runs Meta Prompt on just the selection
   - **✕ Clear prompt** — clears the entire prompt box

---

### ⬇ Page Injection

1. Open any page with a textarea (API playground, chat interface, form, etc.).
2. Click into the target text field.
3. Generate your JSON in PromptForge, then click **⬇ Inject** — it pastes directly into the focused field.

---

## Tabs

### Ollama Tab

Runs entirely on your machine — no API key, no internet connection required.

Configure:
- **Model Name** — any model you have pulled locally (autocomplete for common models)
- **Ollama Host** — defaults to `http://localhost:11434`, change if running on a different port
- **Temperature** — controls creativity (0 = deterministic, 2 = creative)

Meta Prompt also uses Ollama when this tab is active — everything stays local.

### Custom Tab

Consolidates Anthropic, OpenAI, and OpenRouter into one panel. Select a **Provider** from the dropdown to see its specific fields.

**Anthropic (Claude)**
- Enter your API key and click Save
- Choose model: claude-haiku-4.5 (fast/cheap), claude-sonnet-4, claude-opus-4, or 3.5 variants
- Configure max tokens and temperature

**OpenAI**
- Enter your API key and click Save
- Choose model: gpt-4o, gpt-4o-mini, gpt-4.1, o3, o3-mini, o4-mini
- Configure max tokens and temperature

**OpenRouter**
- Enter your API key and click Save
- Choose from free or paid models (see list below)
- If the selected free model fails, PromptForge automatically retries others

**Free models available on OpenRouter:**

| Model | Notes |
|-------|-------|
| ⭐ Llama 3.3 70B `:free` | Best free general-purpose |
| ⭐ Gemma 3 27B `:free` | Strong reasoning |
| ⭐ DeepSeek R1 `:free` | Excellent structured output |
| DeepSeek V3 `:free` | Fast and capable |
| Microsoft Phi-4 `:free` | Compact, smart |
| Qwen 3 8B `:free` | Efficient |
| Mistral 7B `:free` | Reliable baseline |

Paid models (Claude Sonnet/Opus, GPT-4o, Gemini 2.0/2.5) are also in the dropdown.

**Schema Template** — available for all providers:
- **Generic** — standard task JSON
- **LangChain / LangGraph** — output_format structured for a pipeline
- **AutoGen Agent** — output_format structured for a multi-agent workflow

---

## Output Section

The output area serves two purposes:

| Mode | Label | Color | Actions |
|------|-------|-------|---------|
| JSON generation | "Structured Output" | Blue/indigo | ⬇ Inject, ⎘ Copy |
| Meta Prompt | "Meta Prompt Result" | Lavender/purple | → Use as Prompt, ⎘ Copy |

Clicking **→ Use as Prompt** moves the meta-prompted text back into the prompt box so you can review it before generating JSON.

Results are cached — the same prompt returns instantly on repeat (up to 10 cached results per session).

---

## Ollama Setup

1. Download Ollama from [ollama.com](https://ollama.com) and install it.
2. Pull a model based on your available RAM:

```powershell
ollama pull llama3.2       # ~2 GB — recommended default
ollama pull phi4           # ~2.5 GB — high quality, compact
ollama pull mistral        # ~4 GB — solid all-rounder
ollama pull deepseek-r1    # strong at reasoning tasks
```

3. Verify it's running by visiting `http://localhost:11434` — it should display **Ollama is running**.

### Fix: Ollama blocks the extension (403 error)

Chrome extensions run from a `chrome-extension://` origin that Ollama blocks by default. One-time fix:

```powershell
setx OLLAMA_ORIGINS "*"
```

Then quit Ollama from the system tray and reopen it. You won't need to do this again.

---

## Output JSON Schema

All generation modes produce the same base schema:

```json
{
  "task": "snake_case_task_name",
  "<input_field>": "realistic example content",
  "output_format": {
    "field_name": "string | number | boolean | [\"string\"] | { nested object }"
  }
}
```

**Examples:**

```json
{
  "task": "extract_contact_info",
  "input_text": "You can reach Jane Smith at jane@acme.com or call +1-555-987-6543.",
  "output_format": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "company": "string"
  }
}
```

```json
{
  "task": "generate_product_description",
  "product_name": "AquaTrack Pro Smart Water Bottle",
  "key_features": "hydration tracking, LED reminders, 32oz BPA-free",
  "output_format": {
    "headline": "string",
    "description": "string",
    "bullet_points": ["string"],
    "call_to_action": "string"
  }
}
```

---

## Performance

| Format | Latency | Key Needed |
|--------|---------|------------|
| Ollama (local) | 2–10s (hardware dependent) | None |
| Anthropic Claude Haiku 4.5 | ~2–4s | Anthropic |
| OpenAI GPT-4o-mini | ~2–4s | OpenAI |
| OpenRouter free model | ~3–8s (auto-retries) | OpenRouter |

---

## Files

```
prompt-forge-extension/
├── manifest.json       # Extension manifest (MV3)
├── popup.html          # UI, styles, and layout
├── popup.js            # Core logic, API calls, meta prompting, JSON builder
├── background.js       # Service worker (context menu on pages)
├── content.js          # Page injection script
├── content.css         # Toast notification styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Privacy & Security

- **API keys** are stored only in `chrome.storage.local` — sandboxed to the extension, inaccessible to websites.
- **Anthropic key** is sent only to `api.anthropic.com`.
- **OpenAI key** is sent only to `api.openai.com`.
- **OpenRouter key** is sent only to `openrouter.ai`.
- **Ollama** runs entirely on your machine — no data leaves your device.
- No analytics, no telemetry, no third-party tracking.

---

## Requirements

- Chrome 88+, Edge 88+, Brave, or any Chromium browser with Manifest V3 support.
- For Anthropic: an Anthropic API key.
- For OpenAI: an OpenAI API key.
- For OpenRouter: an OpenRouter API key (free tier available, no credit card required).
- For Ollama: Ollama installed and running locally.
