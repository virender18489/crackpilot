import { Fragment, useState } from "react";
import { Check, Copy } from "lucide-react";

interface AnswerViewProps {
  markdown: string;
  isStreaming: boolean;
  fontSizePx?: number;
}

interface ParsedBlock {
  type: "heading" | "paragraph" | "list" | "code";
  content: string;
  items?: string[];
  language?: string;
}

function parseSimpleMarkdown(input: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n"),
      });
      i++;
      continue;
    }

    if (line.trim().startsWith("### ") || line.trim().startsWith("## ")) {
      blocks.push({
        type: "heading",
        content: line.trim().replace(/^#{2,3}\s+/, ""),
      });
      i++;
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (/^\s*[-*•]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))
      ) {
        items.push(
          lines[i].replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+\.\s+/, "")
        );
        i++;
      }
      blocks.push({ type: "list", content: "", items });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("### ") &&
      !lines[i].trim().startsWith("## ") &&
      !/^\s*[-*•]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", content: paraLines.join(" ") });
  }

  return blocks;
}

function renderInlineFormatting(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={idx}
          className="rounded border border-cyan-500/25 bg-[#11192b] px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}

function normalizeLanguageBadge(lang: string): string {
  const cleaned = (lang || "code").trim().toLowerCase();
  const map: Record<string, string> = {
    js: "JAVASCRIPT",
    javascript: "JAVASCRIPT",
    jsx: "JSX",
    ts: "TYPESCRIPT",
    typescript: "TYPESCRIPT",
    tsx: "TSX",
    py: "PYTHON",
    python: "PYTHON",
    sql: "SQL",
    pgsql: "SQL",
    postgres: "SQL",
    mysql: "SQL",
    node: "NODE",
    nodejs: "NODE",
    java: "JAVA",
    cpp: "C++",
    "c++": "C++",
    cs: "C#",
    csharp: "C#",
    go: "GO",
    golang: "GO",
    rs: "RUST",
    rust: "RUST",
    html: "HTML",
    css: "CSS",
    sh: "BASH",
    bash: "BASH",
    shell: "BASH",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    abap: "ABAP",
  };
  return map[cleaned] || cleaned.toUpperCase() || "CODE";
}

const CODE_KEYWORDS = new Set([
  // JS / TS / React
  "import", "export", "default", "from", "const", "let", "var", "function",
  "return", "if", "else", "switch", "case", "break", "continue", "for",
  "while", "do", "try", "catch", "finally", "throw", "new", "async", "await",
  "class", "extends", "implements", "interface", "type", "enum", "typeof",
  "instanceof", "in", "of", "void", "yield", "public", "private", "protected",
  "readonly", "static",
  // Python
  "def", "elif", "except", "with", "as", "pass", "lambda", "raise", "and",
  "or", "not", "is", "global", "nonlocal", "assert", "del",
  // Java / C++ / Go / Rust / C#
  "int", "float", "double", "char", "bool", "boolean", "string", "struct",
  "package", "func", "defer", "go", "chan", "select", "fn", "mut", "pub",
  "match", "impl", "trait", "use", "namespace", "using", "template", "auto",
  "final", "abstract", "override", "virtual", "nullptr",
  // SQL (checked uppercased too)
  "SELECT", "FROM", "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "FULL",
  "OUTER", "CROSS", "ON", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC",
  "LIMIT", "OFFSET", "AS", "DISTINCT", "UNION", "ALL", "INSERT", "INTO",
  "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "ALTER", "DROP", "TABLE",
  "INDEX", "VIEW", "WITH", "OVER", "PARTITION", "CASE", "WHEN", "THEN",
  "ELSE", "END", "AND", "OR", "NOT", "IN", "IS", "NULL", "EXISTS", "BETWEEN",
  "LIKE", "ILIKE", "COALESCE", "COUNT", "SUM", "AVG", "MIN", "MAX",
  // ABAP
  "DATA", "TYPES", "LOOP", "AT", "ENDLOOP", "IF", "ENDIF", "METHOD",
  "ENDMETHOD", "CLASS", "ENDCLASS", "REPORT", "START-OF-SELECTION",
]);

const CODE_LITERALS = new Set([
  "true", "false", "null", "undefined", "NaN", "Infinity",
  "True", "False", "None", "self", "this", "super",
]);

interface TokenSpan {
  kind: "comment" | "string" | "keyword" | "literal" | "number" | "function" | "tag" | "plain";
  text: string;
}

const TOKEN_CLASS: Record<TokenSpan["kind"], string> = {
  comment: "text-slate-500 italic",
  string: "text-emerald-300",
  keyword: "text-fuchsia-400 font-medium",
  literal: "text-amber-300",
  number: "text-amber-300",
  function: "text-sky-300",
  tag: "text-cyan-300",
  plain: "text-slate-200",
};

function tokenizeCodeLine(line: string, language: string): TokenSpan[] {
  const lang = language.toLowerCase();
  const isSql = lang === "sql" || lang === "postgres" || lang === "pgsql" || lang === "mysql";
  const isPythonOrShell = lang === "python" || lang === "py" || lang === "bash" || lang === "sh" || lang === "shell" || lang === "yaml" || lang === "yml";

  // Unified safe regex scanner: comments | strings | JSX/HTML tags | identifiers | numbers | punctuation
  const pattern =
    /(\/\/.*$|\/\*[\s\S]*?\*\/|--.*$|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][A-Za-z0-9._-]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_-]*\b)/gm;

  const spans: TokenSpan[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ kind: "plain", text: line.slice(lastIndex, match.index) });
    }

    const token = match[0];
    let kind: TokenSpan["kind"] = "plain";

    if (
      token.startsWith("//") ||
      token.startsWith("/*") ||
      (token.startsWith("--") && isSql) ||
      (token.startsWith("#") && isPythonOrShell)
    ) {
      kind = "comment";
    } else if (
      token.startsWith('"') ||
      token.startsWith("'") ||
      token.startsWith("`")
    ) {
      kind = "string";
    } else if (token.startsWith("<")) {
      kind = "tag";
    } else if (/^\d/.test(token)) {
      kind = "number";
    } else if (CODE_LITERALS.has(token)) {
      kind = "literal";
    } else if (
      CODE_KEYWORDS.has(token) ||
      (isSql && CODE_KEYWORDS.has(token.toUpperCase()))
    ) {
      kind = "keyword";
    } else {
      const nextChar = line[match.index + token.length];
      if (nextChar === "(") {
        kind = "function";
      }
    }

    spans.push({ kind, text: token });
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    spans.push({ kind: "plain", text: line.slice(lastIndex) });
  }

  return spans;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const badge = normalizeLanguageBadge(language);
  const codeLines = code.split("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback textarea copy if clipboard API is restricted
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        // Ignore clipboard failure
      }
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-slate-700/70 bg-[#0d1117] shadow-lg shadow-black/30">
      <div className="flex items-center justify-between border-b border-slate-800/90 bg-[#111622] px-3.5 py-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-400">
          {badge}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
            copied
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
              : "border-slate-700/80 bg-[#182032] text-slate-200 hover:border-cyan-400/50 hover:text-white"
          }`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-slate-300" />
          )}
          <span>{copied ? "Copied!" : "Copy Code"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-slate-200">
        <code>
          {codeLines.map((lineText, lineIdx) => (
            <Fragment key={lineIdx}>
              {tokenizeCodeLine(lineText, language).map((span, spanIdx) => (
                <span key={spanIdx} className={TOKEN_CLASS[span.kind]}>
                  {span.text}
                </span>
              ))}
              {lineIdx < codeLines.length - 1 ? "\n" : ""}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function AnswerView({
  markdown,
  isStreaming,
  fontSizePx = 15,
}: AnswerViewProps) {
  const blocks = parseSimpleMarkdown(markdown);

  return (
    <div
      className="space-y-3 leading-relaxed text-slate-200 tracking-[0.01em]"
      style={{ fontSize: `${fontSizePx}px` }}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h4
              key={index}
              className="pt-1 text-[0.95em] font-semibold tracking-tight text-sky-300 first:pt-0"
            >
              {block.content}
            </h4>
          );
        }

        if (block.type === "code") {
          return (
            <CodeBlock
              key={index}
              code={block.content}
              language={block.language || "text"}
            />
          );
        }

        if (block.type === "list" && block.items) {
          return (
            <ul
              key={index}
              className="space-y-1.5 pl-4 list-disc marker:text-slate-500"
            >
              {block.items.map((item, idx) => (
                <li key={idx} className="pl-0.5 text-slate-200">
                  {renderInlineFormatting(item)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="text-slate-200">
            {renderInlineFormatting(block.content)}
          </p>
        );
      })}

      {isStreaming && (
        <span
          className="inline-block h-4 w-1.5 animate-pulse bg-sky-400 align-middle"
          aria-label="Generating answer"
        />
      )}
    </div>
  );
}
