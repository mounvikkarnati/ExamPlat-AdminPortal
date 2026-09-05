// ---------------------------------------------------------------------------
// Browser detection for candidate examinations.
//
// A student can open an examination from:
//   • the ExamPlat Browser  — a custom PyQt5 (QtWebEngine/Chromium) desktop app
//     shipped for macOS and Windows, which wraps the exam UI.
//   • a regular web browser — Chrome, Edge, Safari, Firefox, Opera, Brave, …
//
// Because the ExamPlat Browser is Chromium-based it sends a Chromium-style
// User-Agent by default, so it can NOT be told apart from Chrome just from
// that string. To be identifiable, the ExamPlat app must inject its own marker
// into the User-Agent it sends (e.g. for PyQt5:
//   web_profile.setHttpUserAgent("Mozilla/5.0 (…) AppleWebKit/537.36 "
//     "(KHTML, like Gecko) ExamPlat-Secure/1.0 Chrome/126 Safari/537.36"))
// and the attempt record stored by the student portal should keep either a
// friendly name (attempt.browser) or the raw string (attempt.userAgent).
//
// This utility turns whatever was captured on the attempt into a label the
// admin can understand. The ExamPlat markers are checked first, otherwise the
// Chromium base of the ExamPlat Browser would be mistaken for plain Chrome.
// ---------------------------------------------------------------------------

// Everything is compared lower-cased, so keep these markers lower-case.
const EXAMPLAT_MARKERS = [
  "examplat",
  "examplat-browser",
  "examplatbrowser",
  "examplat secure",
];

// Friendly names that the student portal might already store verbatim.
const FRIENDLY_NAMES = {
  "examplat browser": "ExamPlat Browser",
  examplatbrowser: "ExamPlat Browser",
  examplat: "ExamPlat Browser",
  "google chrome": "Google Chrome",
  chrome: "Chrome",
  "microsoft edge": "Microsoft Edge",
  edge: "Microsoft Edge",
  safari: "Safari",
  firefox: "Firefox",
  opera: "Opera",
  brave: "Brave",
  webkit: "WebKit",
};

/**
 * Turn a raw stored value (friendly name or User-Agent string) into a
 * human-friendly browser label. Returns null for empty/unknown input.
 */
function detectBrowser(raw) {
  if (!raw) return null;

  const s = String(raw).trim();
  if (!s) return null;

  const lower = s.toLowerCase();

  // 1) Already a clean friendly name we recognise (e.g. "Chrome").
  if (FRIENDLY_NAMES[lower]) return FRIENDLY_NAMES[lower];

  // 2) User-Agent string — check the custom ExamPlat marker before the
  //    generic Chromium tokens, otherwise it would be reported as Chrome.
  if (EXAMPLAT_MARKERS.some((m) => lower.includes(m))) return "ExamPlat Browser";
  if (lower.includes("edg/") || lower.includes("edge/") || lower.includes("edgios")) return "Microsoft Edge";
  if (lower.includes("brave")) return "Brave";
  if (lower.includes("opr/") || lower.includes("opera")) return "Opera";
  if (lower.includes("firefox")) return "Firefox";
  if (lower.includes("chrome") || lower.includes("chromium")) return "Google Chrome";
  if (lower.includes("safari") || lower.includes("webkit")) return "Safari";

  return null;
}

/**
 * Reads the browser from an attempt document. The student portal may store it
 * as a friendly `browser` field or as a raw `userAgent`/`navigatorUserAgent`
 * string — handle both. Returns null when nothing is recorded.
 */
function attemptBrowser(attempt) {
  if (!attempt) return null;
  // Prefer the recorded field but fall back to common raw User-Agent / name
  // variants so we tolerate whatever field the Student Portal stores.
  const raw =
    attempt.browser ??
    attempt.browserName ??
    attempt.browserType ??
    attempt.browserInfo ??
    attempt.userAgent ??
    attempt.userAgentString ??
    attempt.navigatorUserAgent ??
    attempt.deviceUserAgent ??
    attempt.ua ??
    attempt.user_agent ??
    null;
  return detectBrowser(raw);
}

module.exports = { detectBrowser, attemptBrowser };