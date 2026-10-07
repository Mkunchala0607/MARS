const ExcelJS = require('exceljs');
const path = require('path');

async function processExcel() {
  const filePath = 'C:\\Users\\KarthikDoguparthi\\OneDrive - IntraEdge Inc\\MARS\\app\\MARS_GPMS_API_Link_Interfaces.xlsx';
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
    console.log("Sheets in workbook:");
    workbook.worksheets.forEach(sheet => console.log(sheet.name));
    
    const firstSheet = workbook.worksheets[0];
    console.log(`\nContents of first sheet (${firstSheet.name}):`);
    
    // Read the first few rows
    firstSheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 20) {
        console.log(`Row ${rowNumber}: ${JSON.stringify(row.values)}`);
      }
    });
  } catch (error) {
    console.error("Error reading excel file:", error);
  }
}

processExcel();
