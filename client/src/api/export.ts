import { apiBlob } from './http';

const API = '/api';

export async function exportCSV(): Promise<void> {
  const blob = await apiBlob(`${API}/export/csv`, {
    includeProjectId: true,
    defaultErrorMessage: 'Export failed',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickets.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportHTML(): Promise<void> {
  const blob = await apiBlob(`${API}/export/pdf`, {
    includeProjectId: true,
    defaultErrorMessage: 'Export failed',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickets.html';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPDF(): Promise<void> {
  const blob = await apiBlob(`${API}/export/pdf`, {
    includeProjectId: true,
    defaultErrorMessage: 'Export failed',
  });
  const html = await blob.text();
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render then trigger print dialog (Save as PDF)
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}
