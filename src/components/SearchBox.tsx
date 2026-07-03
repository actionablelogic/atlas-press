import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchGazetteer,
  type GazetteerEntry,
  type RegionKind,
} from "../geo/gazetteer";

interface Props {
  selected: GazetteerEntry | null;
  onSelect: (entry: GazetteerEntry) => void;
  onClear: () => void;
}

const KIND_LABEL: Record<RegionKind, string> = {
  country: "Country",
  continent: "Continent",
  ocean: "Ocean",
};

export function SearchBox({ selected, onSelect, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (open ? searchGazetteer(query) : []),
    [query, open],
  );

  useEffect(() => setActive(0), [query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const choose = (entry: GazetteerEntry) => {
    onSelect(entry);
    setQuery(entry.name);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (results[active]) choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="search" ref={rootRef}>
      <span className="search-icon" aria-hidden>
        ⌕
      </span>
      <input
        className="search-input"
        type="text"
        placeholder="Search a country, continent, or ocean…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls="search-listbox"
      />
      {(query || selected) && (
        <button
          type="button"
          className="search-clear"
          title="Clear selection"
          onClick={() => {
            setQuery("");
            setOpen(false);
            onClear();
          }}
        >
          ✕
        </button>
      )}

      {open && results.length > 0 && (
        <ul className="search-results" id="search-listbox" role="listbox">
          {results.map((entry, i) => (
            <li
              key={entry.id}
              role="option"
              aria-selected={i === active}
              className={`search-result${i === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(entry);
              }}
            >
              <span className="search-result-name">{entry.name}</span>
              <span className={`search-chip kind-${entry.kind}`}>
                {KIND_LABEL[entry.kind]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
