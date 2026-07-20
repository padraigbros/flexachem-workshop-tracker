// Notification domain helpers.

export function normalizeNotification(row) {
  return {
    id: row?.id || crypto.randomUUID?.() || `ntf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId: row?.userId || row?.user_id || "",
    actor: row?.actor || "",
    jobId: row?.jobId ?? row?.job_id ?? null,
    jobLabel: row?.jobLabel || row?.job_label || "",
    excerpt: row?.excerpt || "",
    read: row?.read ?? false,
    createdAt: row?.createdAt || row?.created_at || new Date().toISOString(),
  };
}

export function excerptOf(text, len = 160) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > len ? `${clean.slice(0, len - 1)}…` : clean;
}

// Find which candidates are @-mentioned in the final note text. Matching the literal
// "@Full Name" handles names with spaces; longest-first avoids a short name shadowing a
// longer one. Deterministic and state-free, so it's reliable at submit time.
export function extractMentions(text, candidates) {
  const lower = String(text || "").toLowerCase();
  const seen = new Set();
  return [...(candidates || [])]
    .sort((a, b) => b.name.length - a.name.length)
    .filter((c) => c.name && lower.includes(`@${c.name.toLowerCase()}`))
    .filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
}

// People who can be @-mentioned. In cloud mode these are login accounts (profiles),
// since only they can receive a notification. In demo mode we fall back to staff
// names purely so the composer is exercisable — demo notifications are self-stored.
export function mentionCandidates(profiles, staffNames, cloud) {
  if (cloud) {
    return (profiles || [])
      .filter((p) => p.active !== false && (p.name || p.email))
      .map((p) => ({ id: p.id, name: p.name || p.email, email: p.email }));
  }
  return (staffNames || []).filter(Boolean).map((name) => ({ id: `staff:${name}`, name }));
}
