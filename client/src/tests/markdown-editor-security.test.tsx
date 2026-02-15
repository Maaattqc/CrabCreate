import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownEditor from '../components/modals/MarkdownEditor';

vi.mock('../hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      markdownHelp: 'Markdown',
      markdownPreview: 'Preview',
      markdownEdit: 'Edit',
      validationCharsRemaining: 'chars',
    },
  }),
}));

vi.mock('../hooks/useMarkdown', () => ({
  useMarkdown: () => ({
    isPreview: true,
    togglePreview: vi.fn(),
  }),
}));

describe('MarkdownEditor security', () => {
  it('blocks unsafe javascript links and hardens external links', () => {
    render(
      <MarkdownEditor
        value={'[safe](https://example.com) [bad](javascript:alert(1))'}
        onChange={() => {}}
      />,
    );

    const safeLink = screen.getByRole('link', { name: 'safe' });
    expect(safeLink).toHaveAttribute('href', 'https://example.com');
    expect(safeLink).toHaveAttribute('target', '_blank');
    expect(safeLink.getAttribute('rel')).toContain('noopener');

    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
    expect(screen.getByText('bad')).toBeInTheDocument();
  });
});
