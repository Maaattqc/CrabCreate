import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as repo from '../db/repositories';
import { createRateLimitStore } from '../middleware/rate-limit-store';

const router = Router();

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: () => parseInt(repo.getConfig('export_requests_per_hour') || '30', 10),
  store: createRateLimitStore('export_generate'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => `${req.user?.userId ?? 'anonymous'}:${req.project?.id ?? 0}`,
  message: { error: 'Too many export requests. Try again later.' },
});

/** Escape HTML special characters to prevent XSS */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a CSV field: quote it and neutralize formula injection */
function escapeCsvField(value: string): string {
  // Prefix formula-triggering characters to prevent CSV injection in Excel
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  return `"${safe.replace(/"/g, '""')}"`;
}

// GET /api/export/csv
router.get('/csv', exportLimiter, (req: Request, res: Response) => {
  const projectId = req.project!.id;
  const tickets = repo.findAllTickets({}, undefined, projectId);

  const headers = ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Created', 'Updated'];
  const rows = tickets.map(t => [
    t.id,
    escapeCsvField(t.title || ''),
    escapeCsvField(t.status || ''),
    escapeCsvField(t.priority || ''),
    escapeCsvField(t.assignee || ''),
    escapeCsvField(t.due_date || ''),
    escapeCsvField(t.created_at || ''),
    escapeCsvField(t.updated_at || ''),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=tickets.csv');
  res.send(csv);
});

// GET /api/export/pdf
router.get('/pdf', exportLimiter, (req: Request, res: Response) => {
  const projectId = req.project!.id;
  const tickets = repo.findAllTickets({}, undefined, projectId);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tickets Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f5f9; padding: 8px; text-align: left; border: 1px solid #e2e8f0; }
    td { padding: 8px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .priority-critical { color: #dc2626; font-weight: bold; }
    .priority-high { color: #ea580c; }
    .priority-medium { color: #ca8a04; }
    .priority-low { color: #65a30d; }
    @media print {
      body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Tickets Export</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due Date</th>
      </tr>
    </thead>
    <tbody>
      ${tickets.map(t => `
        <tr>
          <td>${t.id}</td>
          <td>${escapeHtml(t.title || '')}</td>
          <td>${escapeHtml(t.status || '')}</td>
          <td class="priority-${escapeHtml(t.priority || '')}">${escapeHtml(t.priority || '')}</td>
          <td>${escapeHtml(t.assignee || '')}</td>
          <td>${escapeHtml(t.due_date || '-')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=tickets.html');
  res.send(html);
});

export default router;
