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

export interface PdfSection {
  title: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  emptyMessage?: string;
}

export interface PdfSectionedOptions {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

export function downloadSectionedPdf({
  title,
  subtitle,
  sections,
  filename,
  orientation = 'portrait',
}: PdfSectionedOptions) {
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  let y = 32;

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30);
    doc.text('G.D. Sawant College of Technology — leaveSYNC', pageWidth / 2, 32, { align: 'center' });
    doc.setFontSize(12);
    doc.text(title, pageWidth / 2, 50, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitle ? `${subtitle} | Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}` : `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, 66, { align: 'center' });
    y = 92;
  };

  drawHeader();

  sections.forEach((section, index) => {
    if (index > 0 && y > pageHeight - 180) {
      doc.addPage();
      drawHeader();
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(44, 31, 8);
    doc.text(section.title, margin, y);
    y += 10;

    const body = section.rows.length > 0 ? section.rows : [[section.emptyMessage || 'No records found.']];
    const head = section.rows.length > 0 ? [section.headers] : [[section.emptyMessage || 'No records found.']];

    autoTable(doc, {
      startY: y,
      head,
      body: section.rows.length > 0 ? body : [],
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 4,
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
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
      },
    });

    y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 26 : y + 80;
  });

  doc.save(filename);
}
