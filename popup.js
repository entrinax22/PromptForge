'use strict';

// ── State ───────────────────────────────────────────────────────
let currentFormat = 'claude';
let anthropicKey  = '';
let openrouterKey = '';
let customSchema  = '';

// LRU cache — last 10 generations
const genCache = new Map();

const $ = id => document.getElementById(id);

// ── Constants ───────────────────────────────────────────────────
const CLAUDE_BACKBONE  = 'claude-haiku-4-5-20251001';
const OR_FREE_BACKBONE = 'meta-llama/llama-3.3-70b-instruct:free';

// Core system prompt — ALL formats output task-based JSON
const SYSTEM_PROMPT =
  'You are PromptForge, a prompt engineering assistant. ' +
  'Convert a natural language task description into a structured task JSON object that works as a ready-to-use AI prompt. ' +
  'The JSON must have three parts:\n' +
  '1. "task": a concise snake_case task name (e.g. "generate_facebook_post", "summarize_article", "extract_contact_info")\n' +
  '2. One or more descriptively-named input fields — choose the field name based on what the task needs ' +
  '   (e.g. "input_text", "article_text", "code_snippet", "topic", "query", "product_name"). ' +
  '   Fill each field with REALISTIC example content that illustrates exactly what kind of data goes there — ' +
  '   not generic placeholders like "[your text here]". Make the example feel real and on-topic.\n' +
  '3. "output_format": an object where each key is a meaningful output field name and the value is its type. ' +
  '   Use "string", "number", "boolean", ["string"], or nested objects. ' +
  '   Choose fields that make sense for the task (do not just use "result" and "summary" for everything).\n' +
  'Output ONLY the JSON object — no markdown, no code fences, no explanation, no extra text.';

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get([
    'apiKey', 'orApiKey', 'customSchema', 'lastFormat', 'contextText', 'contextTrigger'
  ]);

  if (stored.apiKey)       { anthropicKey  = stored.apiKey;       $('apiKeyInput').value   = stored.apiKey; }
  if (stored.orApiKey)     { openrouterKey = stored.orApiKey;     $('orApiKeyInput').value  = stored.orApiKey; }
  if (stored.customSchema) { customSchema  = stored.customSchema; $('customSchemaInput').value = stored.customSchema; }
  if (stored.lastFormat)   switchFormat(stored.lastFormat);

  if (stored.contextText && stored.contextTrigger && (Date.now() - stored.contextTrigger < 30000)) {
    $('nlPrompt').value = stored.contextText;
    await chrome.storage.local.remove(['contextText', 'contextTrigger']);
  }

  setStatus('ready', 'Ready — select a format and enter your prompt');
});

// ── Tab switching ───────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchFormat(tab.dataset.format));
});

function switchFormat(format) {
  currentFormat = format;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.format === format));
  document.querySelectorAll('.format-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${format}`));
  $('customSchemaField').style.display = format === 'custom' ? 'block' : 'none';
  updateKeyHint(format);
  chrome.storage.local.set({ lastFormat: format });
  hideOutput();
  clearError();
}

function updateKeyHint(format) {
  const map = {
    claude:      { icon: '🔑', text: 'Requires Anthropic API key', cls: 'hint-claude' },
    openai:      { icon: '⚡', text: 'No API key needed — builds JSON instantly, locally', cls: 'hint-openai' },
    openrouter:  { icon: '🔑', text: 'Requires OpenRouter key only — Anthropic key NOT needed', cls: 'hint-or' },
    ollama:      { icon: '🦙', text: 'No API key needed — uses local Ollama to generate task JSON', cls: 'hint-ollama' },
    custom:      { icon: '🔑', text: 'Requires Anthropic or OpenRouter key (uses best available)', cls: 'hint-custom' },
  };
  const h = map[format];
  if (!h) return;
  const el = $('keyHint');
  el.className = 'key-hint ' + h.cls;
  el.textContent = `${h.icon} ${h.text}`;
}

// ── Settings ────────────────────────────────────────────────────
$('settingsToggle').addEventListener('click', () => $('settingsPanel').classList.toggle('open'));

$('saveApiKey').addEventListener('click', async () => {
  const key = $('apiKeyInput').value.trim();
  if (!key) return;
  anthropicKey = key;
  await chrome.storage.local.set({ apiKey: key });
  flash($('saveApiKey'), '✓ Saved', 'Save');
  setStatus('ready', 'Anthropic API key saved');
});

$('saveOrApiKey').addEventListener('click', async () => {
  const key    = $('orApiKeyInput').value.trim();
  const schema = $('customSchemaInput').value.trim();
  if (key) {
    openrouterKey = key;
    customSchema  = schema;
    await chrome.storage.local.set({ orApiKey: key, customSchema: schema });
    flash($('saveOrApiKey'), '✓ Saved', 'Save');
    setStatus('ready', 'OpenRouter API key saved');
  } else if (schema) {
    customSchema = schema;
    await chrome.storage.local.set({ customSchema: schema });
    flash($('saveOrApiKey'), '✓ Saved', 'Save');
  }
});

// ── Generate ────────────────────────────────────────────────────
$('generateBtn').addEventListener('click', generate);
$('nlPrompt').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
});

async function generate() {
  const prompt = $('nlPrompt').value.trim();
  if (!prompt) return showError('Please enter a prompt.');

  // Per-format key validation — the bug was: openrouter was requiring anthropicKey!
  if (currentFormat === 'claude' && !anthropicKey)
    return showError('Anthropic API key required. Click ⚙ to add it.');
  if (currentFormat === 'openrouter' && !openrouterKey)
    return showError('OpenRouter API key required. Click ⚙ to add it.');
  if (currentFormat === 'custom' && !anthropicKey && !openrouterKey)
    return showError('Add an Anthropic or OpenRouter key in ⚙ Settings.');
  // openai needs no key — builds JSON locally. ollama calls your local Ollama instance.

  const cacheKey = `${currentFormat}::${prompt}`;
  if (genCache.has(cacheKey)) {
    showOutput(genCache.get(cacheKey));
    return setStatus('ready', `✓ Cached — ${currentFormat.toUpperCase()} format`);
  }

  setLoading(true);
  clearError();

  try {
    let json;
    switch (currentFormat) {
      case 'claude':     json = await generateViaClaude(prompt);     break;
      case 'openrouter': json = await generateViaOpenRouter(prompt);  break;
      case 'openai':     json = buildOpenAIJSON(prompt);              break; // local, instant
      case 'ollama':     json = await generateViaOllama(prompt);      break;
      case 'custom':     json = await generateViaCustom(prompt);      break;
    }
    cacheStore(cacheKey, json);
    showOutput(json);
    setStatus('ready', `✓ Done — ${currentFormat.toUpperCase()} format`);
  } catch (err) {
    showError(err.message || 'Generation failed. Check your API key and try again.');
    setStatus('error', 'Generation failed');
  } finally {
    setLoading(false);
  }
}

// ── API: Anthropic backbone (Haiku — fast & cheap) ─────────────
async function generateViaClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_BACKBONE,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildClaudeMsg(prompt) }]
    })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `Anthropic error ${res.status}`);
  }
  const data = await res.json();
  return extractJSON(data.content?.[0]?.text || '{}');
}

// ── API: OpenRouter (uses OR key only — no Anthropic needed!) ──
const OR_FALLBACKS = [
  'google/gemma-3-27b-it:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

async function orFetch(model, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openrouterKey}`,
      'HTTP-Referer': 'https://promptforge.ext',
      'X-Title': 'PromptForge',
    },
    body: JSON.stringify({ model, max_tokens: 1024, messages })
  });
  const data = await res.json().catch(() => ({}));
  // OpenRouter can return errors inside a 200 body too
  if (!res.ok || data.error) {
    const msg = data.error?.message || `HTTP ${res.status}`;
    const isAuthErr = res.status === 401 || /key|auth|creden/i.test(msg);
    throw Object.assign(new Error(msg), { isAuthErr });
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Model returned empty response');
  return extractJSON(content);
}

// Model types that cannot do chat completions
const NON_CHAT_PATTERNS = /embed|rerank|classify|whisper|tts|vision-only|encode/i;

async function generateViaOpenRouter(prompt) {
  const customModel  = $('or-custom-model').value.trim();
  const primaryModel = customModel || $('or-model').value || OR_FREE_BACKBONE;

  // Reject embedding/non-chat models immediately — they don't generate text
  if (NON_CHAT_PATTERNS.test(primaryModel)) {
    const shortName = primaryModel.split('/').pop();
    throw new Error(
      `"${shortName}" is not a chat model (looks like an embedding/encode model). ` +
      `Clear the Custom Model ID field and pick a chat or instruct model from the dropdown.`
    );
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: buildOpenRouterMsg(prompt) }
  ];

  // Try primary model first, then fallbacks on provider errors
  const queue = [primaryModel, ...OR_FALLBACKS.filter(m => m !== primaryModel)];
  let lastErr;
  for (let i = 0; i < queue.length; i++) {
    const model = queue[i];
    try {
      if (i > 0) setStatus('loading', `Retrying with ${model.split('/')[1]}…`);
      return await orFetch(model, messages);
    } catch (err) {
      lastErr = err;
      if (err.isAuthErr) break; // wrong key — no point retrying
    }
  }
  throw new Error(
    lastErr?.isAuthErr
      ? 'Invalid OpenRouter API key. Check ⚙ Settings.'
      : `All ${queue.length} models failed. Try again later or pick a different model from the dropdown.`
  );
}

// ── Custom: use best available backbone ────────────────────────
async function generateViaCustom(prompt) {
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_BACKBONE, max_tokens: 1024, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: buildCustomMsg(prompt) }] })
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
    const d = await res.json();
    return extractJSON(d.content?.[0]?.text || '{}');
  }
  // Fallback to OpenRouter free model (with same retry logic)
  return orFetch(OR_FREE_BACKBONE, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: buildCustomMsg(prompt) }
  ]);
}

// ── Local JSON builder for OpenAI tab (no API call — template-based) ──
function buildOpenAIJSON(prompt) {
  const sysMsg = $('openai-system').value.trim();
  // Derive a snake_case task name from the prompt
  const task = prompt.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('_');

  const obj = {
    task,
    input_text: `[Provide the ${task.split('_').join(' ')} content here]`,
    output_format: {
      result: 'string',
      summary: 'string',
    }
  };

  if (sysMsg) obj.context = sysMsg;
  return JSON.stringify(obj, null, 2);
}

// ── Ollama: generate task JSON via local Ollama ─────────────────
async function generateViaOllama(prompt) {
  const model  = $('ollama-model').value.trim()     || 'llama3.2';
  const host   = $('ollama-host').value.trim()      || 'http://localhost:11434';
  const ctx    = parseInt($('ollama-ctx').value)    || 4096;
  const temp   = parseFloat($('ollama-temp').value) || 0.8;
  const system = $('ollama-system').value.trim();

  setStatus('loading', `Generating with ${model}…`);

  try {
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: `${TASK_INSTRUCTION}\n\nTask description: "${prompt}"${system ? `\nAdditional context: ${system}` : ''}` }
        ],
        options: { temperature: temp, top_p: 0.9, num_ctx: ctx }
      })
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error(
        'Ollama blocked the request (CORS). One-time fix:\n' +
        '1. Run in PowerShell:  setx OLLAMA_ORIGINS "*"\n' +
        '2. Restart Ollama (close tray icon, reopen)'
      );
      if (res.status === 404) throw new Error(
        `Model "${model}" not found. Run:  ollama pull ${model}`
      );
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || `Ollama error ${res.status}`);
    }
    const data = await res.json();
    return extractJSON(data.message?.content || '{}');
  } catch (err) {
    if (err instanceof TypeError) throw new Error(
      `Cannot reach Ollama at ${host}. Make sure it is running: ollama serve`
    );
    throw err;
  }
}

// ── Prompt builders — all ask for task-based JSON ──────────────
const TASK_INSTRUCTION =
  'Generate a structured task JSON for this request. ' +
  'Include a snake_case "task" name, one or more input fields with realistic example content ' +
  '(not placeholders — write actual sample data that shows what the input looks like), ' +
  'and an "output_format" object with field names specific to this task and their types. ' +
  'Return ONLY the JSON object.';

function buildClaudeMsg(prompt) {
  const context = $('claude-system').value.trim();
  return `${TASK_INSTRUCTION}\n\nTask description: "${prompt}"${context ? `\nAdditional context: ${context}` : ''}`;
}

function buildOpenRouterMsg(prompt) {
  const context = $('or-system').value.trim();
  return `${TASK_INSTRUCTION}\n\nTask description: "${prompt}"${context ? `\nAdditional context: ${context}` : ''}`;
}

function buildCustomMsg(prompt) {
  const template = $('custom-template').value;
  const tags     = $('custom-tags').value.trim();
  const schema   = customSchema || '';
  const extraHints = {
    langchain: ' Structure output_format for a LangChain/LangGraph pipeline.',
    autogen:   ' Structure output_format for an AutoGen multi-agent workflow.',
    schema:    schema ? ` Use this schema as reference: ${schema}` : '',
    generic:   '',
  };
  return `${TASK_INSTRUCTION}${extraHints[template] || ''}\n\nTask description: "${prompt}"${tags ? `\nTags/context: ${tags}` : ''}`;
}

// ── JSON extraction ─────────────────────────────────────────────
function extractJSON(text) {
  let clean = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.stringify(JSON.parse(clean), null, 2); } catch {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.stringify(JSON.parse(m[0]), null, 2); } catch {} }
  return clean || '{}';
}

// ── Cache helpers ───────────────────────────────────────────────
function cacheStore(key, value) {
  if (genCache.size >= 10) genCache.delete(genCache.keys().next().value);
  genCache.set(key, value);
}

// ── UI helpers ──────────────────────────────────────────────────
function setLoading(on) {
  $('generateBtn').disabled = on;
  $('generateBtn').innerHTML = on ? '⏳ Forging…' : '⚡ Generate Structured JSON';
  setStatus(on ? 'loading' : 'ready', on ? 'Calling AI…' : 'Ready');
  if (on) hideOutput();
}

function showOutput(json) {
  $('outputBox').textContent = json;
  $('outputSection').classList.add('visible');
}

function hideOutput() {
  $('outputSection').classList.remove('visible');
}

function showError(msg) { $('errorMsg').textContent = msg; $('errorMsg').classList.add('visible'); }
function clearError()   { $('errorMsg').classList.remove('visible'); }

function setStatus(type, msg) {
  const dot = $('statusDot');
  dot.className = 'status-dot' + (type ? ' ' + type : '');
  $('statusText').textContent = msg;
}

function flash(btn, successText, defaultText) {
  btn.textContent = successText;
  setTimeout(() => { btn.textContent = defaultText; }, 1500);
}

// ── Copy (standard output) ──────────────────────────────────────
$('copyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText($('outputBox').textContent).then(() => {
    $('copyBtn').textContent = '✓ Copied!';
    $('copyBtn').classList.add('copied');
    setTimeout(() => { $('copyBtn').textContent = '⎘ Copy'; $('copyBtn').classList.remove('copied'); }, 1800);
  });
});

// ── Inject into page ────────────────────────────────────────────
$('injectBtn').addEventListener('click', async () => {
  const json = $('outputBox').textContent;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'INJECT_JSON', payload: json }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      setStatus('error', 'Could not inject — no active text field found');
    } else {
      setStatus('ready', '✓ Injected into page textarea');
      flash($('injectBtn'), '✓ Injected!', '⬇ Inject');
    }
  });
});
