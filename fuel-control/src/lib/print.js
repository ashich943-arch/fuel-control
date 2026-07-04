import { STATION_NAME } from './config';

export function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank', 'width=400,height=650');
  if (!w) {
    alert('Please allow popups to print.');
    return;
  }
  w.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            color: #111;
            padding: 20px;
            max-width: 340px;
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 14px; }
          .station { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
          .sub { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
          .divider { border-top: 1px dashed #999; margin: 12px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
          td { padding: 3px 0; }
          .label { color: #555; }
          .right { text-align: right; }
          .total-row td { font-weight: 700; font-size: 14px; border-top: 1px solid #333; padding-top: 6px; }
          .footer { text-align: center; font-size: 10px; color: #888; margin-top: 16px; }
          @media print {
            body { padding: 0; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="station">${STATION_NAME}</div>
          <div class="sub">${title}</div>
        </div>
        <div class="divider"></div>
        ${bodyHtml}
        <div class="divider"></div>
        <div class="footer">Printed ${new Date().toLocaleString('en-GB')}</div>
      </body>
    </html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
