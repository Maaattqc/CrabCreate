import { Router, Request, Response } from 'express';
import * as repo from '../db/repositories';

const router = Router();

// GET /api/export/csv
router.get('/csv', (req: Request, res: Response) => {
  const projectId = req.project!.id;
  const tickets = repo.findAllTickets({}, undefined, projectId);

  const headers = ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Created', 'Updated'];
  const rows = tickets.map(t => [
    t.id,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    t.assignee,
    t.due_date || '',
    t.created_at,
    t.updated_at,
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=tickets.csv');
  res.send(csv);
});

// GET /api/export/pdf
router.get('/pdf', (req: Request, res: Response) => {
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
          <td>${t.title}</td>
          <td>${t.status}</td>
          <td class="priority-${t.priority}">${t.priority}</td>
          <td>${t.assignee}</td>
          <td>${t.due_date || '-'}</td>
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
