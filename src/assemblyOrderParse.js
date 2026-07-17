// Pure text parser for Flexachem "Assembly Order" PDFs (Business Central printouts).
// Kept free of pdf.js imports so it can be unit-tested in Node.

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// DD/MM/YY or DD/MM/YYYY → ISO (YYYY-MM-DD). Assembly orders print Irish-format dates.
export function ukDateToISO(value) {
  const m = String(value || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return "";
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Parse the text layer of an Assembly Order PDF into job fields.
 * Layout reference (all sample orders share it):
 *   Order No. A008271        Asm. to Order No. 298390
 *   Item No.  P007ACTUATION  Due Date 16/07/26
 *   Description 3" ANE-...   Starting Date 16/07/26
 *   Quantity 4               Ending Date 16/07/26
 *   ... BoM lines, ending with comment rows like "Paciv/ Eli Lilly 298390"
 *   Printed-by name (e.g. SHAUNA) appears in the header block.
 */
export function parseAssemblyOrderText(rawText, { staffNames = [], jobTypes = [] } = {}) {
  const text = String(rawText || "").replace(/\s+/g, " ").trim();
  const fields = {};
  const found = [];

  const asm = text.match(/Order No\.?\s*:?\s*(A\d{5,})/i);
  if (asm) {
    fields.asm = asm[1].toUpperCase();
    found.push("Assembly");
  }

  const so = text.match(/Asm\.?\s*to\s*Order No\.?\s*:?\s*(\d{5,})/i);
  if (so) {
    fields.so = so[1];
    found.push("Sales order");
  }

  const due = text.match(/Due Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (due) {
    const iso = ukDateToISO(due[1]);
    if (iso) {
      fields.due = iso;
      found.push("Due date");
    }
  }

  const start = text.match(/Starting Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (start) {
    const iso = ukDateToISO(start[1]);
    if (iso) {
      fields.start = iso;
      found.push("Start date");
    }
  }

  const qty = text.match(/Quantity\s+(\d+(?:\.\d+)?)(?:\s|$)/i);
  const desc = text.match(/Description\s+(.{3,140}?)\s+(?:Starting Date|Quantity|Ending Date|Bill of Material)/i);
  if (desc) {
    const description = desc[1].trim();
    fields.details = `${qty ? `${qty[1]} × ` : ""}${description}`;
    found.push("Details");
  }

  // Printed-by name in the header (e.g. "SHAUNA") — match against known staff.
  const owner = staffNames.find((name) => name && new RegExp(`(?:^|[^A-Za-z])${escapeRegExp(name)}(?:[^A-Za-z]|$)`, "i").test(text));
  if (owner) {
    fields.owner = owner;
    found.push("Owner");
  }

  // Customer heuristic: a BoM comment line repeats the sales order number next to the
  // customer name, e.g. "Paciv/ Eli Lilly 298390" or "For Regeneron B18 order 298309".
  if (so) {
    const re = new RegExp(`([A-Za-z][A-Za-z0-9&.'/\\- ]{2,60}?)\\s*(?:order\\s+)?${escapeRegExp(so[1])}(?:\\D|$)`, "gi");
    const JUNK_TOKENS = new Set(["each", "bin", "po", "item", "type", "no", "no.", "code", "quantity", "consumed", "picked", "variant"]);
    let match;
    let best = "";
    while ((match = re.exec(text))) {
      // Walk the candidate's words from the end, keeping name-like tokens and
      // stopping at table junk (pure numbers, unit/bin tokens) from BoM rows.
      const words = match[1].trim().split(/\s+/);
      const kept = [];
      for (let i = words.length - 1; i >= 0; i -= 1) {
        const word = words[i];
        if (/^\d+(?:\.\d+)?$/.test(word)) break;
        if (JUNK_TOKENS.has(word.toLowerCase())) break;
        if (/^[A-Z]$/.test(word)) break; // stray single capitals from wrapped table cells
        kept.unshift(word);
      }
      while (kept.length && /^(for|order|to)$/i.test(kept[0])) kept.shift();
      const candidate = kept.join(" ").replace(/[/,;:\-]+$/, "").trim();
      if (!candidate || candidate.length < 3) continue;
      if (/order|asm|\bno\b|number|page/i.test(candidate)) continue;
      best = candidate; // comment rows come after the header — last acceptable match wins
    }
    if (best) {
      fields.cust = best;
      found.push("Customer");
    }
  }

  // Job type guess from the description / item block — only when the guess exists in the catalogue.
  const typeSource = `${fields.details || ""} ${text.slice(0, 800)}`;
  let guess = "";
  if (/pump/i.test(typeSource)) guess = "Pump Assembly";
  else if (/\bseal/i.test(typeSource)) guess = "Mechanical Seal Refurb";
  else if (/valve|actuat|\bpbm\b|\bane-/i.test(typeSource)) guess = "Valve Assembly";
  if (guess && jobTypes.includes(guess)) {
    fields.type = guess;
    found.push("Job type");
  }

  return { fields, found };
}
