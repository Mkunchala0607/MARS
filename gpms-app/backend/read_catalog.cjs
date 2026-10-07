const ExcelJS = require('exceljs');

async function processExcel() {
  const filePath = 'C:\\Users\\KarthikDoguparthi\\OneDrive - IntraEdge Inc\\MARS\\app\\MARS_GPMS_API_Link_Interfaces.xlsx';
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
    
    const catalogSheet = workbook.getWorksheet('API Master Catalog');
    console.log(`\nContents of API Master Catalog:`);
    
    catalogSheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 15) {
        console.log(`Row ${rowNumber}: ${JSON.stringify(row.values)}`);
      }
    });
  } catch (error) {
    console.error("Error reading excel file:", error);
  }
}

processExcel();
