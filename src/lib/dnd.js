// Shared drag bookkeeping. Cards are draggable from anywhere on their surface AND
// clickable to open the drawer; after a drop, browsers can fire a stray click on the
// card, which would immediately open the drawer. The board marks the moment a drag
// ends and cards ignore clicks that arrive within the suppression window.
const memo = { endedAt: 0 };

export function markDragEnd() {
  memo.endedAt = Date.now();
}

export function wasRecentDrag(windowMs = 300) {
  return Date.now() - memo.endedAt < windowMs;
}
