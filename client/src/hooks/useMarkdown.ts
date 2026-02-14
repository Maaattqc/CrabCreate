import { useState, useMemo } from 'react';

export function useMarkdown(initialContent: string = '') {
  const [content, setContent] = useState(initialContent);
  const [isPreview, setIsPreview] = useState(false);

  const togglePreview = () => setIsPreview(prev => !prev);

  // Basic markdown to HTML conversion for preview
  const html = useMemo(() => {
    let result = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');
    // Wrap consecutive <li> in <ul>
    result = result.replace(/(<li>.*?<\/li>(?:<br>)?)+/g, (match) => `<ul>${match.replace(/<br>/g, '')}</ul>`);
    return result;
  }, [content]);

  return { content, setContent, isPreview, togglePreview, html };
}
