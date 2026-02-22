import { useRef, useCallback } from 'react';
import { Bold, Italic, Code, Link, List, Eye, Pencil, HelpCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useMarkdown } from '../../hooks/useMarkdown';
import { useLanguage } from '../../hooks/useLanguage';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import MicButton from '../common/MicButton';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
}

function sanitizeMarkdownUrl(rawHref: string | undefined): string | null {
  if (!rawHref) return null;
  const href = rawHref.trim();
  if (!href) return null;

  const normalized = href.replace(/\s+/g, '').toLowerCase();
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:')
  ) {
    return null;
  }

  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) {
    return href;
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return href;
    }
  } catch {
    return null;
  }

  return null;
}

export default function MarkdownEditor({ value, onChange, placeholder, maxLength, rows = 6, disabled = false }: MarkdownEditorProps) {
  const { t } = useLanguage();
  const { isPreview, togglePreview } = useMarkdown();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) onChange(value ? `${value} ${text}` : text);
  }, [onChange, value]);
  const { isListening, isSupported, toggle: toggleMic } = useSpeechToText({ onTranscript: handleTranscript });

  const handleMicClick = useCallback(() => {
    textareaRef.current?.focus();
    toggleMic();
  }, [toggleMic]);

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const replacement = `${before}${selected || 'text'}${after}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = selected
        ? start + replacement.length
        : start + before.length;
      textarea.setSelectionRange(cursorPos, cursorPos + (selected ? 0 : 4));
    });
  }, [value, onChange]);

  const insertTemplate = useCallback((template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newValue = value.substring(0, start) + template + value.substring(start);
    onChange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + template.length, start + template.length);
    });
  }, [value, onChange]);

  const toolbarButtons = [
    { icon: Bold, action: () => wrapSelection('**', '**'), title: 'Bold' },
    { icon: Italic, action: () => wrapSelection('*', '*'), title: 'Italic' },
    { icon: Code, action: () => wrapSelection('`', '`'), title: 'Code' },
    { icon: Link, action: () => wrapSelection('[', '](url)'), title: 'Link' },
    { icon: List, action: () => insertTemplate('\n- '), title: 'List' },
  ];

  const markdownComponents: Components = {
    a: ({ href, children, ...props }) => {
      const safeHref = sanitizeMarkdownUrl(href);
      if (!safeHref) {
        return <span {...props}>{children}</span>;
      }
      const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');
      return (
        <a
          {...props}
          href={safeHref}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer nofollow ugc' : undefined}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="border border-th-border rounded-lg overflow-hidden bg-subtle">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-th-border bg-card">
        <div className="flex items-center gap-0.5">
          {toolbarButtons.map(({ icon: Icon, action, title }) => (
            <button
              key={title}
              type="button"
              onClick={action}
              disabled={disabled || isPreview}
              title={title}
              className="p-1.5 rounded text-tx-faint hover:text-tx-secondary hover:bg-subtle transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon size={14} />
            </button>
          ))}
          <MicButton isListening={isListening} isSupported={isSupported} onClick={handleMicClick} size={14} />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-tx-faint flex items-center gap-1">
            <HelpCircle size={10} />
            {t.markdownHelp}
          </span>
          <button
            type="button"
            onClick={togglePreview}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isPreview
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-tx-faint hover:text-tx-secondary hover:bg-subtle'
            }`}
          >
            {isPreview ? (
              <>
                <Eye size={12} />
                {t.markdownPreview}
              </>
            ) : (
              <>
                <Pencil size={12} />
                {t.markdownEdit}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {isPreview ? (
        <div className="p-3 min-h-[8rem] max-h-[20rem] overflow-y-auto prose prose-invert prose-sm max-w-none text-tx-secondary [&_h1]:text-tx-primary [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-tx-primary [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-tx-primary [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1 [&_strong]:text-tx-primary [&_code]:text-amber-400 [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-black/30 [&_pre]:rounded-lg [&_pre]:p-3 [&_a]:text-amber-400 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-tx-faint">
          {value ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={markdownComponents}
            >
              {value}
            </ReactMarkdown>
          ) : (
            <p className="text-tx-ghost italic">{placeholder}</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          disabled={disabled}
          className="w-full bg-transparent px-3 py-2 text-sm text-tx-primary placeholder-tx-faint focus:outline-none resize-none font-mono"
        />
      )}

      {/* Character count */}
      {maxLength && value.length > maxLength * 0.8 && (
        <div className="px-3 py-1 border-t border-th-border text-right">
          <span className={`text-[10px] ${value.length > maxLength * 0.95 ? 'text-red-400' : 'text-tx-faint'}`}>
            {maxLength - value.length} {t.validationCharsRemaining}
          </span>
        </div>
      )}
    </div>
  );
}
