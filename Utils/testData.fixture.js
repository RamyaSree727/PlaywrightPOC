
// fixtures/testData.fixture.js
const base = require('@playwright/test').test;
const { readExcelAsObjects } = require('../Utils/readExcel');

exports.test = base.extend({
  testData: async ({}, use) => {
    // Pick your file/sheet
    const file = process.env.DATA_FILE || '../TestData/TestData.xlsx';
    const sheet = process.env.DATA_SHEET || 'Users';

    let rows = [];
    try {
      rows = readExcelAsObjects(file, sheet);
    } catch (err) {
      throw new Error(
        `Failed to load Excel data from ${file} (sheet "${sheet}"): ${err.message}`
      );
    }

    // Optional validation (ensure required fields exist)
    const required = ['Username', 'Password', 'Expected'];
    const missingColumns = required.filter(
      col => rows.length > 0 && !(col in rows[0])
    );
    if (missingColumns.length) {
      throw new Error(
        `Excel headers missing: ${missingColumns.join(', ')} in sheet "${sheet}"`
      );
    }

    await use(rows);
  },
});
