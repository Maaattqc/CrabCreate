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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickets.html';
  a.click();
  URL.revokeObjectURL(url);
}
