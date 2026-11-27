/**
 * Shared phonetic & deduplication sanitizer for live speech-to-text transcripts.
 * - Strips accidental duplicate sentences/phrases ("What is React? What is React?" -> "What is React?")
 * - Strips stuttered/repeated consecutive words ("Difference difference..." -> "Difference...")
 * - Silently corrects Indian-English / regional STT phonetic slips into exact engineering terms
 * - Filters out 1-word noise fragments (< 2 words or < 8 chars)
 */
const PHONETIC_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
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
  [/\b(?:cube\s+netties|kuber\s+net\s+ease)\b/gi, "Kubernetes"],
  [/\b(?:pie\s+spark|pi\s+spark)\b/gi, "PySpark"],
  [/\b(?:see\s+quel|sea\s+quel)\b/gi, "SQL"],
  [/\b(?:eye\s+dock)\b/gi, "IDoc"],
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

/**
 * Removes repeated sentences ("What is React? What is React?") and
 * consecutive repeated words/phrases ("Difference difference between...").
 */
export function deduplicateTranscriptText(input: string): string {
  let text = (input || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  // 1. Deduplicate identical or near-identical sentences
  const sentenceParts = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceParts.length > 1) {
    const kept: string[] = [];
    const seen = new Set<string>();
    for (const part of sentenceParts) {
      const key = normalizeKey(part);
      if (!key) continue;
      if (seen.has(key)) continue;
      // Also skip if immediately previous sentence ends with or contains this exact fragment
      const prevKey = kept.length > 0 ? normalizeKey(kept[kept.length - 1]) : "";
      if (prevKey && (prevKey === key || prevKey.endsWith(key))) continue;
      seen.add(key);
      kept.push(part);
    }
    text = kept.join(" ");
  }

  // 2. Collapse consecutive repeated n-grams (length 6 down to 1 word)
  // e.g. "What is React what is React" or "Difference difference between"
  const words = text.split(/\s+/).filter(Boolean);
  const normWord = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  let current = words;

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
          // Keep the first occurrence (preferring capitalized / punctuated version) and skip duplicate
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

export function sanitizePhoneticQuestion(rawQuestion: string): string {
  let cleaned = deduplicateTranscriptText(rawQuestion || "");
  if (!cleaned) return "";
  for (const [pattern, replacement] of PHONETIC_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return deduplicateTranscriptText(cleaned);
}

/**
 * Ignores 1-word noise fragments (< 2 words or < 8 characters) such as "What?", "Okay", "Yeah".
 */
export function isValidSpokenQuestion(rawText: string): boolean {
  const cleaned = sanitizePhoneticQuestion(rawText);
  if (cleaned.length < 8) return false;
  const meaningfulWords = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9.#+]/g, ""))
    .filter((w) => w.length > 0);
  return meaningfulWords.length >= 2;
}
