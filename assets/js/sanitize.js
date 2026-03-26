// assets/js/sanitize.js
// Shared sanitizing and DOM helpers for TrainerTrials

export function escapeHtml(input) {
  const s = String(input ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeText(el, text) {
  el.textContent = String(text ?? "");
  return el;
}