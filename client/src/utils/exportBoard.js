import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' };

function flattenCards(columns) {
  const rows = [];
  for (const col of columns) {
    for (const card of col.cards || []) {
      rows.push({
        Title: card.title,
        Status: col.title,
        Priority: PRIORITY_LABEL[card.priority] || card.priority || 'None',
        Assignees: (card.assignees || []).map(a => a.name).join(', '),
        Labels: (card.labels || []).map(l => l.name).join(', '),
        'Due Date': card.due_date ? new Date(card.due_date).toLocaleDateString() : '',
        Description: card.description || '',
        'Created At': card.created_at ? new Date(card.created_at).toLocaleDateString() : '',
      });
    }
  }
  return rows;
}

export function exportCSV(boardTitle, columns) {
  const rows = flattenCards(columns);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  download(`${boardTitle}.csv`, 'text/csv', csv);
}

export function exportExcel(boardTitle, columns) {
  const rows = flattenCards(columns);
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cards');

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0]).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length), 10),
  }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `${boardTitle}.xlsx`);
}

export function exportPDF(boardTitle, columns) {
  const rows = flattenCards(columns);
  if (!rows.length) return;

  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(boardTitle, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported ${new Date().toLocaleDateString()}`, 14, 21);

  const headers = ['Title', 'Status', 'Priority', 'Assignees', 'Labels', 'Due Date', 'Created At'];
  const body = rows.map(r => headers.map(h => r[h] || ''));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 35 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 },
    },
  });

  doc.save(`${boardTitle}.pdf`);
}

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
