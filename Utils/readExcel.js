
// utils/readExcel.js
const XLSX = require('xlsx');
const path = require('path');

function readExcelAsObjects(filePath, sheetName) {
  const absolute = path.resolve(filePath);
  const workbook = XLSX.readFile(absolute);
  const ws = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];
  if (!ws) {
    throw new Error(
      `Sheet not found: ${sheetName || '(first sheet)'} in ${absolute}`
    );
  }
  // First row = headers; keep empty cells as ''.
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows;
}

module.exports = { readExcelAsObjects };
