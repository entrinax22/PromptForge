// PromptForge — content.js
// Listens for injection messages from the popup and inserts JSON into the focused/active textarea

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'INJECT_JSON') return;

  const json = message.payload;
  const injected = tryInjectIntoFocused(json) || tryInjectIntoFirstTextarea(json);

  sendResponse({ success: injected });
});

function tryInjectIntoFocused(json) {
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  const isEditable = tag === 'textarea' || (tag === 'input' && !['checkbox','radio','button','submit','file'].includes(el.type));
  const isContentEditable = el.isContentEditable;

  if (isEditable) {
    setNativeValue(el, json);
    return true;
  }

  if (isContentEditable) {
    el.textContent = json;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}

function tryInjectIntoFirstTextarea(json) {
  // Try visible textareas on page
  const areas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
  const visible = areas.find(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (!visible) return false;

  if (visible.tagName.toLowerCase() === 'textarea') {
    setNativeValue(visible, json);
  } else {
    visible.textContent = json;
    visible.dispatchEvent(new Event('input', { bubbles: true }));
  }

  visible.focus();
  showToast('PromptForge: JSON injected ✓');
  return true;
}

// Works with React-controlled inputs too
function setNativeValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.focus();
}

// ── Toast notification ─────────────────────────────────
function showToast(msg) {
  // Remove existing toast
  const existing = document.getElementById('pf-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pf-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #7c3aed;
    color: white;
    padding: 10px 18px;
    border-radius: 8px;
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(124,58,237,0.4);
    animation: pfSlideIn 0.3s ease;
    pointer-events: none;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pfSlideIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── Context menu injection (right-click on textarea) ───
// Highlight text in a textarea, right-click → "Forge this prompt"
document.addEventListener('contextmenu', e => {
  const el = e.target;
  if (el.tagName === 'TEXTAREA' || el.isContentEditable) {
    chrome.runtime.sendMessage({
      type: 'CONTEXT_TARGET',
      hasTarget: true,
      selectedText: window.getSelection().toString() || el.value || ''
    });
  }
});
