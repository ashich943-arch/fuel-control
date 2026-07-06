// Builds a real, properly formatted .xlsx workbook (bold headers,
// currency number formatting, sensible column widths) instead of a
// plain CSV — CSVs look "raw" when opened in Excel since they carry
// no formatting at all.
//
// exceljs is loaded on demand (dynamic import) rather than at app
// startup, since it's a large library only needed when someone
// actually exports a report — this keeps the app's normal load time
// fast for everyone who never touches this feature.
//
// sheets: array of {
//   name: string,
//   columns: [{ header, key, width?, numFmt? }],
//   rows: [{ [key]: value }],
// }
export async function downloadXlsx(filename, sheets) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nexivo Fuel Control';
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    ws.columns = sheet.columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16 }));

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5484D' } };
    headerRow.alignment = { vertical: 'middle' };

    for (const row of sheet.rows) {
      ws.addRow(row);
    }

    sheet.columns.forEach((c, i) => {
      if (c.numFmt) {
        ws.getColumn(i + 1).numFmt = c.numFmt;
      }
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
