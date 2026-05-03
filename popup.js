'use strict';

// ── State ───────────────────────────────────────────────────────
let currentFormat = 'custom';
let anthropicKey  = '';
let openrouterKey = '';
let openaiKey     = '';

const genCache = new Map();
const $ = id => document.getElementById(id);

// ── Constants ───────────────────────────────────────────────────
const CLAUDE_BACKBONE  = 'claude-haiku-4-5-20251001';
const OR_FREE_BACKBONE = 'meta-llama/llama-3.3-70b-instruct:free';
const OR_FALLBACKS = [
  'google/gemma-3-27b-it:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

const SYSTEM_PROMPT =
  'You are PromptForge, a prompt engineering assistant. ' +
  'Convert a natural language task description into a structured task JSON object that works as a ready-to-use AI prompt. ' +
  'The JSON must have three parts:\n' +
  '1. "task": a concise snake_case task name\n' +
  '2. One or more descriptively-named input fields with REALISTIC example content (not placeholders).\n' +
  '3. "output_format": an object where each key is a meaningful output field name and the value is its type ' +
  '("string", "number", "boolean", ["string"], or nested objects).\n' +
  'Output ONLY the JSON object — no markdown, no code fences, no explanation.';

const TASK_INSTRUCTION =
  'Generate a structured task JSON. Include a snake_case "task" name, input fields with realistic sample data, ' +
  'and an "output_format" with task-specific field names and types. Return ONLY the JSON object.';

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get([
    'apiKey', 'orApiKey', 'openaiKey', 'lastFormat', 'contextText', 'contextTrigger'
  ]);

  if (stored.apiKey)    { anthropicKey  = stored.apiKey;    $('custom-anthropic-key').value = stored.apiKey; }
  if (stored.orApiKey)  { openrouterKey = stored.orApiKey;  $('custom-or-key').value        = stored.orApiKey; }
  if (stored.openaiKey) { openaiKey     = stored.openaiKey; $('custom-openai-key').value    = stored.openaiKey; }

  const validFormats = ['ollama', 'custom'];
  if (stored.lastFormat && validFormats.includes(stored.lastFormat)) {
    switchFormat(stored.lastFormat);
  }

  if (stored.contextText && stored.contextTrigger && (Date.now() - stored.contextTrigger < 30000)) {
    $('nlPrompt').value = stored.contextText;
    await chrome.storage.local.remove(['contextText', 'contextTrigger']);
  }

  setStatus('ready', 'Ready — enter your prompt and generate');
});

// ── Tab switching ───────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchFormat(tab.dataset.format));
});

function switchFormat(format) {
  currentFormat = format;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.format === format));
  document.querySelectorAll('.format-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${format}`));
  updateKeyHint(format);
  chrome.storage.local.set({ lastFormat: format });
  hideOutput();
  clearError();
}

function updateKeyHint(format) {
  const el = $('keyHint');
  if (format === 'ollama') {
    el.className = 'key-hint hint-ollama';
    el.textContent = '🦙 No API key needed — uses your local Ollama instance';
  } else {
    const provider = $('custom-provider')?.value || 'anthropic';
    const hints = {
      anthropic:  '🔑 Requires Anthropic API key',
      openai:     '🔑 Requires OpenAI API key',
      openrouter: '🔑 Requires OpenRouter API key — free models available',
    };
    el.className = 'key-hint hint-custom';
    el.textContent = hints[provider] || hints.anthropic;
  }
}

// ── Provider switcher (Custom tab) ─────────────────────────────
$('custom-provider').addEventListener('change', () => {
  const p = $('custom-provider').value;
  ['anthropic', 'openai', 'openrouter'].forEach(id => {
    $(`cpanel-${id}`).style.display = id === p ? '' : 'none';
  });
  updateKeyHint('custom');
});

// ── Key save buttons ────────────────────────────────────────────
$('saveAnthropicKey').addEventListener('click', async () => {
  const key = $('custom-anthropic-key').value.trim();
  if (!key) return;
  anthropicKey = key;
  await chrome.storage.local.set({ apiKey: key });
  flash($('saveAnthropicKey'), '✓ Saved', 'Save');
});

$('saveOpenaiKey').addEventListener('click', async () => {
  const key = $('custom-openai-key').value.trim();
  if (!key) return;
  openaiKey = key;
  await chrome.storage.local.set({ openaiKey: key });
  flash($('saveOpenaiKey'), '✓ Saved', 'Save');
});

$('saveOrKey').addEventListener('click', async () => {
  const key = $('custom-or-key').value.trim();
  if (!key) return;
  openrouterKey = key;
  await chrome.storage.local.set({ orApiKey: key });
  flash($('saveOrKey'), '✓ Saved', 'Save');
});

// ── Generate ────────────────────────────────────────────────────
$('generateBtn').addEventListener('click', generate);
$('nlPrompt').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
});

async function generate() {
  const prompt = $('nlPrompt').value.trim();
  if (!prompt) return showError('Please enter a prompt.');

  if (currentFormat === 'custom') {
    const provider = $('custom-provider').value;
    const aKey = $('custom-anthropic-key').value.trim() || anthropicKey;
    const oKey = $('custom-openai-key').value.trim()    || openaiKey;
    const rKey = $('custom-or-key').value.trim()        || openrouterKey;
    if (provider === 'anthropic'  && !aKey) return showError('Enter your Anthropic API key above.');
    if (provider === 'openai'     && !oKey) return showError('Enter your OpenAI API key above.');
    if (provider === 'openrouter' && !rKey) return showError('Enter your OpenRouter API key above.');
  }

  const cacheKey = `${currentFormat}::${prompt}`;
  if (genCache.has(cacheKey)) {
    showOutput(genCache.get(cacheKey));
    return setStatus('ready', '✓ Cached result');
  }

  setLoading(true);
  clearError();

  try {
    let json;
    switch (currentFormat) {
      case 'ollama': json = await generateViaOllama(prompt); break;
      case 'custom': json = await generateViaCustom(prompt); break;
    }
    cacheStore(cacheKey, json);
    showOutput(json);
    setStatus('ready', '✓ Done');
  } catch (err) {
    showError(err.message || 'Generation failed. Check your API key and try again.');
    setStatus('error', 'Generation failed');
  } finally {
    setLoading(false);
  }
}

// ── Ollama ──────────────────────────────────────────────────────
async function generateViaOllama(prompt) {
  const model = $('ollama-model').value.trim() || 'llama3.2';
  const host  = $('ollama-host').value.trim()  || 'http://localhost:11434';
  const temp  = parseFloat($('ollama-temp').value) || 0.8;

  setStatus('loading', `Generating with ${model}…`);

  try {
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: `${TASK_INSTRUCTION}\n\nTask: "${prompt}"` }
        ],
        options: { temperature: temp, top_p: 0.9, num_ctx: 4096 }
      })
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error(
        'Ollama blocked (CORS). Fix: run  setx OLLAMA_ORIGINS "*"  then restart Ollama.'
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
      `Cannot reach Ollama at ${host}. Start it with:  ollama serve`
    );
    throw err;
  }
}

// ── Custom (Anthropic / OpenAI / OpenRouter) ────────────────────
async function generateViaCustom(prompt) {
  const provider = $('custom-provider').value;
  const msg = buildCustomMsg(prompt);

  if (provider === 'anthropic') {
    const key    = $('custom-anthropic-key').value.trim() || anthropicKey;
    const model  = $('custom-claude-model').value || CLAUDE_BACKBONE;
    const tokens = parseInt($('custom-claude-tokens').value) || 1024;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: tokens, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: msg }] })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
    const d = await res.json();
    return extractJSON(d.content?.[0]?.text || '{}');
  }

  if (provider === 'openai') {
    const key    = $('custom-openai-key').value.trim() || openaiKey;
    const model  = $('custom-openai-model').value || 'gpt-4o';
    const tokens = parseInt($('custom-openai-tokens').value) || 1024;
    const temp   = parseFloat($('custom-openai-temp').value) || 0.7;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: tokens, temperature: temp, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: msg }] })
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
    const d = await res.json();
    return extractJSON(d.choices?.[0]?.message?.content || '{}');
  }

  if (provider === 'openrouter') {
    const key    = $('custom-or-key').value.trim() || openrouterKey;
    const model  = $('custom-or-model').value || OR_FREE_BACKBONE;
    const tokens = parseInt($('custom-or-tokens').value) || 1024;
    const temp   = parseFloat($('custom-or-temp').value) || 0.7;
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: msg }];
    const queue  = [model, ...OR_FALLBACKS.filter(m => m !== model)];
    let lastErr;
    for (let i = 0; i < queue.length; i++) {
      try {
        if (i > 0) setStatus('loading', `Retrying with ${queue[i].split('/')[1]}…`);
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://promptforge.ext', 'X-Title': 'PromptForge' },
          body: JSON.stringify({ model: queue[i], max_tokens: tokens, temperature: temp, messages })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          const msg2 = data.error?.message || `HTTP ${res.status}`;
          throw Object.assign(new Error(msg2), { isAuthErr: res.status === 401 || /key|auth/i.test(msg2) });
        }
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response');
        return extractJSON(content);
      } catch (err) {
        lastErr = err;
        if (err.isAuthErr) break;
      }
    }
    throw new Error(lastErr?.isAuthErr ? 'Invalid OpenRouter API key.' : 'All models failed. Try again.');
  }
}

function buildCustomMsg(prompt) {
  const template = $('custom-template').value;
  const extras = {
    langchain: ' Structure output_format for a LangChain/LangGraph pipeline.',
    autogen:   ' Structure output_format for an AutoGen multi-agent workflow.',
    generic:   '',
  };
  return `${TASK_INSTRUCTION}${extras[template] || ''}\n\nTask: "${prompt}"`;
}

// ── JSON extraction ─────────────────────────────────────────────
function extractJSON(text) {
  let clean = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.stringify(JSON.parse(clean), null, 2); } catch {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.stringify(JSON.parse(m[0]), null, 2); } catch {} }
  return clean || '{}';
}

// ── Cache ───────────────────────────────────────────────────────
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
  $('outputBox').classList.remove('meta-mode');
  $('outputLabel').textContent = 'Structured Output';
  $('outputDot').classList.remove('meta');
  $('useAsPromptBtn').style.display = 'none';
  $('injectBtn').style.display = '';
  $('outputSection').classList.add('visible');
}

function showMetaOutput(text) {
  $('outputBox').textContent = text;
  $('outputBox').classList.add('meta-mode');
  $('outputLabel').textContent = 'Meta Prompt Result';
  $('outputDot').classList.add('meta');
  $('useAsPromptBtn').style.display = '';
  $('injectBtn').style.display = 'none';
  $('outputSection').classList.add('visible');
}

function hideOutput()      { $('outputSection').classList.remove('visible'); }
function showError(msg)    { $('errorMsg').textContent = msg; $('errorMsg').classList.add('visible'); }
function clearError()      { $('errorMsg').classList.remove('visible'); }
function setStatus(type, msg) {
  $('statusDot').className = 'status-dot' + (type ? ' ' + type : '');
  $('statusText').textContent = msg;
}
function flash(btn, ok, def) { btn.textContent = ok; setTimeout(() => { btn.textContent = def; }, 1500); }

$('useAsPromptBtn').addEventListener('click', () => {
  const text = $('outputBox').textContent;
  if (text) {
    $('nlPrompt').value = text;
    hideOutput();
    $('nlPrompt').focus();
    setStatus('ready', '✓ Moved to prompt — edit then Generate');
  }
});

// ── Copy & Inject ───────────────────────────────────────────────
$('copyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText($('outputBox').textContent).then(() => {
    $('copyBtn').textContent = '✓ Copied!';
    $('copyBtn').classList.add('copied');
    setTimeout(() => { $('copyBtn').textContent = '⎘ Copy'; $('copyBtn').classList.remove('copied'); }, 1800);
  });
});

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

// ── Meta Prompting ──────────────────────────────────────────────
const META_PROMPTS = {
  improve:
    'You are an expert prompt engineer. Rewrite the user\'s rough prompt to be clearer, ' +
    'more specific, and better structured for an AI model. ' +
    'Add missing context, sharpen the intent, and improve phrasing. ' +
    'Return ONLY the improved prompt text — no labels, no explanation, no markdown.',
  role:
    'You are an expert prompt engineer specializing in role-based prompting. ' +
    'Rewrite the user\'s prompt by giving the AI a vivid expert role and persona that fits the task. ' +
    'Start with "You are a [specific expert]..." and build out a rich, effective prompt. ' +
    'Return ONLY the rewritten prompt — no explanation.',
  cot:
    'You are an expert prompt engineer specializing in chain-of-thought prompting. ' +
    'Rewrite the user\'s prompt so it instructs the AI to reason step by step before answering. ' +
    'Add explicit reasoning scaffolds like "Think step by step:", numbered steps, or "First... Then... Finally...". ' +
    'Return ONLY the enhanced prompt — no explanation.',
  constraints:
    'You are an expert prompt engineer. Rewrite the user\'s prompt to include specific constraints, ' +
    'rules, boundaries, and requirements that tightly shape the output. ' +
    'Add format constraints, tone requirements, length limits, and content guardrails as appropriate. ' +
    'Return ONLY the constrained prompt — no explanation.',
  system:
    'You are an expert prompt engineer. Convert the user\'s idea into a complete, ' +
    'well-structured system prompt for an AI assistant, covering role, capabilities, behavior guidelines, and constraints. ' +
    'Return ONLY the system prompt text — no explanation.',
  fewshot:
    'You are an expert prompt engineer specializing in few-shot prompting. ' +
    'Rewrite the user\'s prompt to include 2-3 concrete input/output examples that demonstrate the expected behavior. ' +
    'Format examples as "Input: ... Output: ..." pairs, then end with the actual task instruction. ' +
    'Return ONLY the few-shot prompt — no explanation.',
};

async function metaCallRaw(text) {
  const style     = $('metaStyle')?.value || 'improve';
  const sysPrompt = META_PROMPTS[style] || META_PROMPTS.improve;
  const userMsg   = `Apply your prompt engineering expertise to this:\n\n${text}`;

  // If Ollama tab is active, use Ollama for meta prompting
  if (currentFormat === 'ollama') {
    const model = $('ollama-model').value.trim() || 'llama3.2';
    const host  = $('ollama-host').value.trim()  || 'http://localhost:11434';
    try {
      const res = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, stream: false,
          messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userMsg }],
          options: { temperature: 0.7 }
        })
      });
      if (!res.ok) throw new Error(`Ollama error ${res.status}`);
      const data = await res.json();
      return (data.message?.content || text).trim();
    } catch (err) {
      if (err instanceof TypeError) throw new Error('Cannot reach Ollama. Make sure it is running.');
      throw err;
    }
  }

  // Custom tab: use the selected provider
  if (currentFormat === 'custom') {
    const provider = $('custom-provider').value;

    if (provider === 'anthropic') {
      const key = $('custom-anthropic-key').value.trim() || anthropicKey;
      if (!key) throw new Error('Enter your Anthropic API key in the Custom tab.');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: CLAUDE_BACKBONE, max_tokens: 768, system: sysPrompt, messages: [{ role: 'user', content: userMsg }] })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const d = await res.json();
      return (d.content?.[0]?.text || text).trim();
    }

    if (provider === 'openai') {
      const key = $('custom-openai-key').value.trim() || openaiKey;
      if (!key) throw new Error('Enter your OpenAI API key in the Custom tab.');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 768, messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userMsg }] })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
      const d = await res.json();
      return (d.choices?.[0]?.message?.content || text).trim();
    }

    if (provider === 'openrouter') {
      const key   = $('custom-or-key').value.trim() || openrouterKey;
      if (!key) throw new Error('Enter your OpenRouter API key in the Custom tab.');
      const queue = [OR_FREE_BACKBONE, ...OR_FALLBACKS];
      let lastErr;
      for (let i = 0; i < queue.length; i++) {
        try {
          if (i > 0) setStatus('loading', `Retrying with ${queue[i].split('/')[1]}…`);
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://promptforge.ext', 'X-Title': 'PromptForge' },
            body: JSON.stringify({ model: queue[i], max_tokens: 768, messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userMsg }] })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.error) {
            const m = data.error?.message || `HTTP ${res.status}`;
            throw Object.assign(new Error(m), { isAuthErr: res.status === 401 || /key|auth/i.test(m) });
          }
          const content = data.choices?.[0]?.message?.content;
          if (!content) throw new Error('Empty response');
          return content.trim();
        } catch (err) {
          lastErr = err;
          if (err.isAuthErr) break;
        }
      }
      throw new Error(lastErr?.isAuthErr ? 'Invalid OpenRouter API key.' : 'All models failed. Try again.');
    }
  }

  throw new Error('Switch to the Custom or Ollama tab and configure a provider to use Meta Prompt.');
}

$('metaPromptBtn').addEventListener('click', () => enhancePrompt());

async function enhancePrompt(textOverride) {
  const prompt = textOverride ?? $('nlPrompt').value.trim();
  if (!prompt) return showError('Enter a prompt to enhance.');

  const btn = $('metaPromptBtn');
  const origLabel = btn.textContent;
  btn.textContent = '⏳ Enhancing…';
  btn.disabled = true;
  clearError();
  setStatus('loading', 'Running meta-prompt…');

  try {
    const enhanced = await metaCallRaw(prompt);
    showMetaOutput(enhanced);
    setStatus('ready', '✓ Meta prompt ready — click "→ Use as Prompt" or Generate');
  } catch (err) {
    showError(err.message || 'Meta-prompt failed.');
    setStatus('error', 'Meta-prompt failed');
  } finally {
    btn.textContent = origLabel;
    btn.disabled = false;
  }
}

// ── JSON Builder ────────────────────────────────────────────────
$('builderToggle').addEventListener('click', () => {
  const builder = $('jsonBuilder');
  const open = builder.classList.toggle('open');
  $('builderToggle').classList.toggle('active', open);
  $('builderToggle').textContent = open ? '{ } Hide Builder' : '{ } JSON Builder';
  if (open && $('inputRows').children.length === 0) {
    spawnInputRow();
    spawnOutputRow();
  }
});

$('addInputRowBtn').addEventListener('click', spawnInputRow);
$('addOutputRowBtn').addEventListener('click', spawnOutputRow);
$('buildJsonBtn').addEventListener('click', buildFromFields);

function makeTypeSelect() {
  const sel = document.createElement('select');
  ['string', 'number', 'boolean', 'array', 'object'].forEach(t => {
    const o = document.createElement('option');
    o.value = o.textContent = t;
    sel.appendChild(o);
  });
  return sel;
}

function makeRemoveBtn(row) {
  const btn = document.createElement('button');
  btn.className = 'remove-row-btn';
  btn.textContent = '×';
  btn.title = 'Remove field';
  btn.addEventListener('click', () => row.remove());
  return btn;
}

function spawnInputRow() {
  const row = document.createElement('div');
  row.className = 'field-row';
  const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.placeholder = 'field_name';
  const exIn = document.createElement('input');
  exIn.type = 'text'; exIn.placeholder = 'example value';
  row.append(nameIn, exIn, makeTypeSelect(), makeRemoveBtn(row));
  $('inputRows').appendChild(row);
  nameIn.focus();
}

function spawnOutputRow() {
  const row = document.createElement('div');
  row.className = 'field-row';
  const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.placeholder = 'output_field';
  row.append(nameIn, makeTypeSelect(), makeRemoveBtn(row));
  $('outputRows').appendChild(row);
  nameIn.focus();
}

async function buildFromFields() {
  const inRows  = [...$('inputRows').querySelectorAll('.field-row')];
  const outRows = [...$('outputRows').querySelectorAll('.field-row')];

  if (!inRows.length && !outRows.length)
    return showError('Add at least one field in the JSON Builder.');

  const inputHints = [];
  inRows.forEach(row => {
    const [nameIn, exIn] = row.querySelectorAll('input');
    const name = (nameIn?.value || '').trim().replace(/\s+/g, '_');
    const ex   = exIn?.value.trim();
    const type = row.querySelector('select')?.value || 'string';
    if (name) inputHints.push(`${name} (${type}${ex ? `, e.g. "${ex}"` : ''})`);
  });

  const outputHints = [];
  outRows.forEach(row => {
    const nameIn = row.querySelector('input');
    const typeS  = row.querySelector('select');
    const name   = (nameIn?.value || '').trim().replace(/\s+/g, '_');
    if (name) outputHints.push(`${name}: ${typeS?.value || 'string'}`);
  });

  const base = $('nlPrompt').value.trim() || 'Generate a structured task';
  let augmented = base;
  if (inputHints.length)  augmented += `\n\nUse these input fields: ${inputHints.join(', ')}.`;
  if (outputHints.length) augmented += `\nUse these output_format fields: ${outputHints.join(', ')}.`;

  const original = $('nlPrompt').value;
  $('nlPrompt').value = augmented;
  await generate();
  $('nlPrompt').value = original;
}

// ── Right-click context menu on prompt textarea ─────────────────
let savedSel = { start: 0, end: 0, text: '' };

$('nlPrompt').addEventListener('contextmenu', e => {
  e.preventDefault();
  const ta = $('nlPrompt');
  savedSel = {
    start: ta.selectionStart,
    end:   ta.selectionEnd,
    text:  ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
  };
  const hasSel = savedSel.text.length > 0;
  $('ctxSubmit').style.display  = hasSel ? '' : 'none';
  $('ctxEnhance').style.display = hasSel ? '' : 'none';
  $('ctxSep').style.display     = hasSel ? '' : 'none';

  const menu = $('ctxMenu');
  const mw = 180, mh = 120;
  menu.style.left = Math.min(e.clientX, window.innerWidth  - mw) + 'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight - mh) + 'px';
  menu.classList.add('visible');
});

document.addEventListener('click',  ()  => $('ctxMenu').classList.remove('visible'));
document.addEventListener('keydown', e  => { if (e.key === 'Escape') $('ctxMenu').classList.remove('visible'); });

$('ctxSubmit').addEventListener('click', () => {
  if (savedSel.text) { $('nlPrompt').value = savedSel.text; generate(); }
});

$('ctxEnhance').addEventListener('click', async () => {
  if (savedSel.text) await enhancePrompt(savedSel.text);
});

$('ctxClear').addEventListener('click', () => {
  $('nlPrompt').value = '';
  hideOutput();
  clearError();
  $('ctxMenu').classList.remove('visible');
});
