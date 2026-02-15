const API = '/api';
function projectHeaders(): Record<string, string> {
  const pid = localStorage.getItem('crab-current-project') || '';
  return pid ? { 'X-Project-Id': pid } : {};
}

export async function exportCSV(): Promise<void> {
  const res = await fetch(`${API}/export/csv`, { headers: projectHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickets.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportHTML(): Promise<void> {
  const res = await fetch(`${API}/export/pdf`, { headers: projectHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickets.html';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPDF(): Promise<void> {
  const res = await fetch(`${API}/export/pdf`, { headers: projectHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error('Export failed');
  const html = await res.text();

  // Open HTML in a hidden iframe and trigger the browser's print-to-PDF dialog
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); throw new Error('Export failed'); }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render then print
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
  // Fallback if onload doesn't fire (content already written)
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000);
    }
  }, 500);
}
