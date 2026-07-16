import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface PdfTableOptions {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  filename: string;
  orientation?: 'portrait' | 'landscape';
  emptyMessage?: string;
}

export function downloadTablePdf({
  title,
  subtitle,
  headers,
  rows,
  filename,
  orientation = 'landscape',
  emptyMessage = 'No records found.',
}: PdfTableOptions) {
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('G.D. Sawant College of Technology — leaveSYNC', pageWidth / 2, 32, { align: 'center' });
  doc.setFontSize(12);
  doc.text(title, pageWidth / 2, 50, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitle ? `${subtitle} | Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}` : `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, 66, { align: 'center' });

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.text(emptyMessage, margin, 104);
  } else {
    autoTable(doc, {
      startY: 84,
      head: [headers],
      body: rows,
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: [210, 210, 210],
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: [44, 31, 8],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        lineColor: [212, 175, 55],
        lineWidth: 0.6,
      },
      alternateRowStyles: { fillColor: [250, 248, 240] },
      bodyStyles: { textColor: [30, 30, 30] },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
      },
    });
  }

  doc.save(filename);
}

export const downloadSectionedPdf = (
  title: string,
  sections: Array<{
    title: string;
    columns: string[];
    rows: Array<Array<string | number | null | undefined>>;
  }>,
  filename = 'report.pdf'
) => {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, y, { align: 'center' });

  y += 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, y);

  y += 10;

  sections.forEach((section, index) => {
    if (y > 260) {
      doc.addPage();
      y = 18;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin, y);

    y += 6;

    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body: section.rows.map((row) =>
        row.map((cell) => (cell === null || cell === undefined ? '-' : String(cell)))
      ),
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
      },
      headStyles: {
        fontStyle: 'bold',
      },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
      theme: 'grid',
    });

    y = (doc as any).lastAutoTable.finalY + 12;

    if (index < sections.length - 1 && y > 250) {
      doc.addPage();
      y = 18;
    }
  });

  doc.save(filename);
};
