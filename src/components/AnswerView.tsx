import { useState } from "react";
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
          className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[0.88em] text-sky-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-slate-700/70 bg-[#070b14]">
      <div className="flex items-center justify-between border-b border-slate-800/90 px-3 py-1.5 text-xs text-slate-400">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-white cursor-pointer"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-slate-200">
        <code>{code}</code>
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
            <ul key={index} className="space-y-1.5 pl-4 list-disc marker:text-slate-500">
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
