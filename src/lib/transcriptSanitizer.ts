/**
 * Client-side transcript sanitizer for live interview speech recognition.
 * - Strips accidental duplicate sentences/phrases ("What is React? What is React?" -> "What is React?")
 * - Collapses consecutive repeated words/phrases ("Difference difference..." -> "Difference...")
 * - Silently fixes Indian-English / regional phonetic slips ("next knee" -> "Next.js", "jawascript" -> "JavaScript")
 * - Rejects 1-word noise fragments (< 2 words or < 8 chars) so accidental background clicks never create cards
 */
const CLIENT_PHONETIC_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:jawascript|java\s+script|jawa\s+script)\b/gi, "JavaScript"],
  [/\b(?:type\s+script|typscript)\b/gi, "TypeScript"],
  [/\b(?:react\s+js|re\s+act(?:\s+js)?)\b/gi, "React.js"],
  [/\b(?:next\s+knee|next\s+ne|next\s+js|next\s+j\s+s|next\s+chase|next\s+yes)\b/gi, "Next.js"],
  [/\b(?:node\s+js|node\s+j\s+s|know\s+js)\b/gi, "Node.js"],
  [/\b(?:virtual\s+dome|virtual\s+doom|virtual\s+damn|virtual\s+dawn)\b/gi, "Virtual DOM"],
  [/\b(?:lingual\s+dome|real\s+dome|real\s+doom|reel\s+dom|reel\s+dome|real\s+damn)\b/gi, "Real DOM"],
  [/\b(?:multi\s+conscious|multiple\s+conscious|multi\s+context|multi\s+contexts)\b/gi, "multiple contexts"],
  [/\b(?:use\s+context|used\s+context)\b/gi, "useContext"],
  [/\b(?:use\s+affect|use\s+effect|used\s+effect)\b/gi, "useEffect"],
  [/\b(?:use\s+estate|use\s+state|used\s+state)\b/gi, "useState"],
  [/\b(?:use\s+memo|used\s+memo)\b/gi, "useMemo"],
  [/\b(?:use\s+call\s*back|used\s+callback)\b/gi, "useCallback"],
  [/\b(?:use\s+ref|use\s+rough)\b/gi, "useRef"],
  [/\b(?:red\s+ducks|reedux|red\s+uks)\b/gi, "Redux"],
  [/\b(?:hoist\s+thing|hoist\s+ing)\b/gi, "Hoisting"],
  [/\b(?:micro\s+services|micro\s+service)\b/gi, "Microservices"],
  [/\b(?:a\s+p\s+i)\b/gi, "API"],
  [/\b(?:h\s+t\s+m\s+l)\b/gi, "HTML"],
  [/\b(?:c\s+s\s+s)\b/gi, "CSS"],
];

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function deduplicateSpokenText(input: string): string {
  let text = (input || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  // Deduplicate repeated sentences (e.g. "What is React? What is React?")
  const sentenceParts = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceParts.length > 1) {
    const kept: string[] = [];
    const seen = new Set<string>();
    for (const part of sentenceParts) {
      const key = normalizeKey(part);
      if (!key || seen.has(key)) continue;
      const prevKey = kept.length > 0 ? normalizeKey(kept[kept.length - 1]) : "";
      if (prevKey && (prevKey === key || prevKey.endsWith(key))) continue;
      seen.add(key);
      kept.push(part);
    }
    text = kept.join(" ");
  }

  // Collapse repeated adjacent n-grams (6 words down to 1 word)
  const normWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  let current = text.split(/\s+/).filter(Boolean);

  for (let n = 6; n >= 1; n--) {
    const next: string[] = [];
    let i = 0;
    while (i < current.length) {
      if (i + n * 2 <= current.length) {
        let same = true;
        for (let k = 0; k < n; k++) {
          const a = normWord(current[i + k]);
          const b = normWord(current[i + n + k]);
          if (!a || a !== b) {
            same = false;
            break;
          }
        }
        if (same) {
          for (let k = 0; k < n; k++) {
            next.push(current[i + k]);
          }
          i += n * 2;
          continue;
        }
      }
      next.push(current[i]);
      i += 1;
    }
    current = next;
  }

  return current.join(" ").replace(/\s+/g, " ").trim();
}

export function sanitizeSpokenTranscript(raw: string): string {
  let cleaned = deduplicateSpokenText(raw || "");
  if (!cleaned) return "";
  for (const [pattern, replacement] of CLIENT_PHONETIC_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return deduplicateSpokenText(cleaned);
}

/**
 * Rejects 1-word noise fragments (< 2 words or < 8 chars) so accidental noise never creates blank cards.
 */
export function isMeaningfulSpokenQuestion(raw: string): boolean {
  const cleaned = sanitizeSpokenTranscript(raw);
  if (cleaned.length < 8) return false;
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9.#+]/g, ""))
    .filter((w) => w.length > 0);
  return words.length >= 2;
}
