/**
 * Lightweight phonetic sanitizer for live speech-to-text interview transcripts.
 * Silently corrects common Indian-English / regional STT slips into exact software engineering terms
 * before the question is sent to the LLM.
 */
const PHONETIC_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:jawascript|java\s+script|jawa\s+script)\b/gi, "JavaScript"],
  [/\b(?:type\s+script|typscript)\b/gi, "TypeScript"],
  [/\b(?:react\s+js|re\s+act(?:\s+js)?)\b/gi, "React.js"],
  [/\b(?:next\s+js|next\s+j\s+s)\b/gi, "Next.js"],
  [/\b(?:node\s+js|node\s+j\s+s)\b/gi, "Node.js"],
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

export function sanitizePhoneticQuestion(rawQuestion: string): string {
  let cleaned = (rawQuestion || "").trim();
  if (!cleaned) return "";
  for (const [pattern, replacement] of PHONETIC_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.replace(/\s+/g, " ").trim();
}
