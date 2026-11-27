import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

interface SearchableSelectProps {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  id?: string;
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search specializations...",
  searchable = true,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...options];
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchable) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 15);
      return () => window.clearTimeout(timer);
    }
  }, [open, searchable]);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDownControl = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        filtered.length > 0 ? (i + 1) % filtered.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) =>
        filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightedIndex]) {
        handleSelect(filtered[highlightedIndex]);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-zinc-300"
      >
        {label}
      </label>

      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDownControl}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
          open
            ? "border-[#b4f416] bg-[#0a0a0a] text-white"
            : "border-white/10 bg-[#0a0a0a] text-white hover:border-white/25"
        }`}
      >
        <span className={`truncate ${value ? "text-white" : "text-zinc-500"}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${
            open ? "rotate-180 text-[#b4f416]" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-white/15 bg-[#111111] shadow-2xl shadow-black/80"
        >
          {searchable && (
            <div className="border-b border-white/[0.08] bg-[#0a0a0a] p-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#111111] px-2.5 py-1.5 focus-within:border-[#b4f416]/70">
                <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDownControl}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">
                No matching specialization found.
              </p>
            ) : (
              filtered.map((option, idx) => {
                const isSelected = option === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(option)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#b4f416]/15 font-semibold text-[#b4f416]"
                        : isHighlighted
                          ? "bg-white/[0.07] text-white"
                          : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <span className="leading-snug">{option}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#b4f416]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
