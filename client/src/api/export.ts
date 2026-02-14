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

export async function exportPDF(): Promise<void> {
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
