import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  onAiSuggest?: () => Promise<string[]>;
  suggestions?: string[];
  disabled?: boolean;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  onAiSuggest,
  suggestions = [],
  disabled,
  placeholder = 'Add tag…',
}) => {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = suggestions.filter(s =>
    s.toLowerCase().includes(inputValue.toLowerCase()) &&
    !tags.includes(s) &&
    inputValue.trim().length > 0
  ).slice(0, 8);

  useEffect(() => {
    setShowDropdown(filteredSuggestions.length > 0);
    setHighlightIdx(-1);
  }, [inputValue, filteredSuggestions.length]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const commit = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
    setInputValue('');
    setShowDropdown(false);
  };

  const removeTag = (index: number) => {
    const next = [...tags];
    next.splice(index, 1);
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filteredSuggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && highlightIdx >= 0)) {
        e.preventDefault();
        commit(highlightIdx >= 0 ? filteredSuggestions[highlightIdx] : inputValue);
        return;
      }
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleAiSuggest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAiSuggest) return;
    setAiLoading(true);
    try {
      const suggested = await onAiSuggest();
      const fresh = suggested.filter(t => !tags.includes(t));
      if (fresh.length > 0) onChange([...tags, ...fresh]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap gap-1.5 items-center min-h-[36px] px-2.5 py-1.5 rounded-lg border cursor-text"
        style={{ borderColor: theme.border, backgroundColor: theme.surface }}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-text"
            style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeTag(idx); }}
                className="text-text2 hover:text-text leading-none"
                aria-label={`Remove ${tag}`}
              >×</button>
            )}
          </span>
        ))}

        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (filteredSuggestions.length > 0) setShowDropdown(true); }}
            onBlur={() => {
              if (inputValue.trim()) { commit(inputValue); }
              setTimeout(() => setShowDropdown(false), 150);
            }}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[80px] bg-transparent outline-none text-xs text-text placeholder:text-text2"
          />
        )}

        {onAiSuggest && !disabled && (
          <button
            type="button"
            onClick={handleAiSuggest}
            disabled={aiLoading}
            className="ml-auto flex-shrink-0 text-xs font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full transition-opacity hover:opacity-70 disabled:opacity-50"
            style={{ background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}35` }}
            title="Suggest tags with AI"
          >
            {aiLoading ? '…' : '✦ AI'}
          </button>
        )}
      </div>

      {showDropdown && filteredSuggestions.length > 0 && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg shadow-lg border overflow-hidden"
          style={{ background: theme.surface, borderColor: theme.border }}
        >
          {filteredSuggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs transition-colors"
              style={{
                color: i === highlightIdx ? theme.accent : theme.text,
                background: i === highlightIdx ? `${theme.accent}14` : 'transparent',
              }}
              onPointerDown={e => { e.preventDefault(); commit(s); }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
