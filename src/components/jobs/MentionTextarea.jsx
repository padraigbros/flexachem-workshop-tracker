import { useMemo, useRef, useState } from "react";
import { Textarea, cx } from "../ui/primitives";

// A textarea with @-mention support: typing "@" opens a suggestion list and picking one
// inserts "@Full Name". The authoritative mention list is derived from the final text at
// submit time (see extractMentions), so this component only handles insertion + display.
export function MentionTextarea({ value, onChange, candidates = [], ...props }) {
  const ref = useRef(null);
  const [query, setQuery] = useState(null); // active @token text, or null
  const [tokenStart, setTokenStart] = useState(0);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    if (query == null) return [];
    const q = query.toLowerCase();
    return candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, candidates]);

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
    if (query != null && suggestions.length) {
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
      {query != null && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 z-10 mb-1 max-h-52 w-full max-w-xs overflow-y-auto rounded-xl border border-[var(--line-strong)] bg-[var(--surface-card)] p-1 shadow-[var(--shadow-float)]"
        >
          {suggestions.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                onMouseEnter={() => setHighlight(i)}
                className={cx("flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors", i === highlight ? "bg-[var(--color-brand-500)]/12" : "hover:bg-[var(--surface-sunken)]")}
              >
                <span className="text-[0.82rem] font-semibold text-[var(--ink)]">{c.name}</span>
                {c.email && <span className="text-[0.68rem] text-[var(--ink-muted)]">{c.email}</span>}
              </button>
            </li>
          ))}
        </ul>
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
