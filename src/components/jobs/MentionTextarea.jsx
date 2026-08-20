import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Textarea, cx } from "../ui/primitives";

// A textarea with @-mention support: typing "@" opens a suggestion list and picking one
// inserts "@Full Name". The authoritative mention list is derived from the final text at
// submit time (see extractMentions), so this component only handles insertion + display.
//
// ---------------------------------------------------------------------------------------
// WHY THE LIST IS PORTALLED AND PICKS ON pointerdown (20 Aug 2026 — "@ doesn't work on some
// phones"):
//
// The only caller is the JobDrawer composer, and that drawer is a Framer Motion bottom sheet
// with `drag="y"`. Framer sets `touch-action: pan-x` on the sheet, which means the browser
// hands EVERY vertical touch inside it to Framer's drag gesture. Two things followed:
//
//   1. The list rendered inside that subtree, so a tap on a suggestion that drifted a few
//      pixels vertically — completely normal for a thumb on a 40px row — was claimed as a
//      sheet drag. Framer calls preventDefault on it, and a preventDefaulted touch emits NO
//      compatibility mouse events, so the `onMouseDown` picker never ran. Whether it fired
//      depended on the device's touch slop: it worked on some phones and not others, which
//      is exactly how it was reported.
//   2. `max-h` + `overflow-y-auto` on the list was dead on touch for the same reason — a
//      `touch-action` ancestor constrains its descendants, so the list could not be scrolled
//      to reach candidates 4–6. With 24 accounts in production that is most of them.
//
// The fix is to render the list in a portal on <body>, outside the draggable subtree, and to
// pick on `pointerdown` (fires on finger-down for touch/pen/mouse alike, before any drag
// threshold) rather than on a synthesised `mousedown`. Do not move it back inside the
// composer for tidiness — the position is deliberate.
// ---------------------------------------------------------------------------------------

const LIST_MAX_H = 208; // 13rem, the old max-h-52
const LIST_MAX_W = 320; // 20rem, the old max-w-xs
const GAP = 6;

export function MentionTextarea({ value, onChange, candidates = [], ...props }) {
  const ref = useRef(null);
  const [query, setQuery] = useState(null); // active @token text, or null
  const [tokenStart, setTokenStart] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [anchor, setAnchor] = useState(null); // fixed-position box for the portalled list

  const suggestions = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, candidates]);

  const open = query != null && suggestions.length > 0;

  // Measure the textarea and decide whether the list sits above it (preferred — it keeps the
  // list away from the on-screen keyboard) or below (when there is no room above).
  // getBoundingClientRect and position:fixed share the layout viewport, so the two agree even
  // while a mobile keyboard has the visual viewport offset.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const above = r.top - GAP;
    const below = window.innerHeight - r.bottom - GAP;
    const placeAbove = above >= Math.min(LIST_MAX_H, below) || above >= 140;
    setAnchor({
      left: Math.max(8, r.left),
      width: Math.min(r.width, LIST_MAX_W),
      placeAbove,
      // Anchoring by `bottom` when placing above means the list never has to be measured
      // first — it grows upward from the composer whatever its height turns out to be.
      bottom: placeAbove ? window.innerHeight - r.top + GAP : undefined,
      top: placeAbove ? undefined : r.bottom + GAP,
      maxHeight: Math.max(96, Math.min(LIST_MAX_H, (placeAbove ? above : below) - 8)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) { setAnchor(null); return undefined; }
    measure();
    // `true` for capture: the composer sits inside scrollable ancestors that do not bubble
    // their scroll events. visualViewport covers the mobile keyboard opening and closing.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [open, measure]);

  // Close on an outside press. The list is on <body> now, so it is no longer dismissed as a
  // side effect of the composer losing focus.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (e.target.closest?.("[data-mention-list]")) return;
      setQuery(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const detectToken = (text, caret) => {
    const before = text.slice(0, caret);
    const match = before.match(/(^|\s)@([\w' .-]*)$/);
    if (match) {
      setQuery(match[2]);
      setTokenStart(caret - match[2].length - 1); // position of the '@'
      setHighlight(0);
    } else {
      setQuery(null);
    }
  };

  const handleChange = (e) => {
    const text = e.target.value;
    onChange?.(text);
    detectToken(text, e.target.selectionStart ?? text.length);
  };

  const pick = (candidate) => {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = `${value.slice(0, tokenStart)}@${candidate.name} ${value.slice(caret)}`;
    onChange?.(next);
    setQuery(null);
    // Restore focus and place the caret after the inserted mention.
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = tokenStart + candidate.name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e) => {
    if (open) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(suggestions[highlight]); return; }
      if (e.key === "Escape") { e.preventDefault(); setQuery(null); return; }
    }
    props.onKeyDown?.(e);
  };

  const { onKeyDown, ...rest } = props;

  return (
    <div className="relative">
      <Textarea ref={ref} value={value} onChange={handleChange} onKeyDown={handleKeyDown} {...rest} />
      {open && anchor && createPortal(
        <ul
          role="listbox"
          data-mention-list
          style={{
            position: "fixed",
            left: anchor.left,
            top: anchor.top,
            bottom: anchor.bottom,
            width: anchor.width,
            maxHeight: anchor.maxHeight,
            // The list is out of the sheet's drag subtree now, so the browser will scroll it
            // natively again; `contain` stops that scroll chaining to the page behind it.
            touchAction: "pan-y",
            overscrollBehavior: "contain",
            // Above the drawer (z-90) and the modal (z-95/96) it may be opened over.
            zIndex: 100,
          }}
          className="overflow-y-auto rounded-xl border border-[var(--line-strong)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-float)]"
        >
          {suggestions.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                // pointerdown, not mousedown: it is the one event that fires identically for
                // touch, pen and mouse, and it lands on finger-down rather than after a
                // synthesised tap. preventDefault keeps the composer focused and its caret
                // where it was; stopPropagation keeps any future draggable ancestor out of it.
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); pick(c); }}
                onMouseEnter={() => setHighlight(i)}
                className={cx(
                  // py-3 on a coarse pointer, not py-2.5: a candidate with no email renders a
                  // single 20px line, and 2.5 left it at 40px — under the 44px touch floor the
                  // rest of the app holds to. Two-line candidates clear it either way.
                  "flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors pointer-coarse:py-3",
                  i === highlight ? "bg-[var(--color-brand-500)]/12" : "hover:bg-[var(--surface-sunken)]",
                )}
              >
                <span className="text-[0.82rem] font-semibold text-[var(--ink)]">{c.name}</span>
                {c.email && <span className="text-[0.68rem] text-[var(--ink-muted)]">{c.email}</span>}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}

// Render note text with @Name spans highlighted, given the set of known candidate names.
export function renderNoteWithMentions(text, candidateNames) {
  const names = (candidateNames || []).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length || !text) return text;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})`, "gi");
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<strong key={m.index} className="text-[var(--color-brand-500)]">{m[0]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
