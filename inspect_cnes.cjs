const AdmZip = require('adm-zip');
const path = require('path');
const zipPath = path.join(__dirname, 'projeto_base_cnes', 'BASE_DE_DADOS_CNES_202608.ZIP');
const zip = new AdmZip(zipPath);

const entries = zip.getEntries();
const targetFiles = [
    'tbProfissional202608.csv', 
    'tbCargaHorariaSus202608.csv',
    'tbDadosProfissionalSus202608.csv',
    'tbMunicipio.csv'
];

for (const e of entries) {
  if (targetFiles.includes(e.entryName) || e.entryName.toLowerCase().includes('municipio') || e.entryName.toLowerCase().includes('cbo')) {
    console.log(`\n--- ${e.entryName} ---`);
    const content = zip.readAsText(e, 'latin1');
    const lines = content.split('\n');
    console.log('Columns:', lines[0]);
    console.log('Row 1:', lines[1]);
  }
}
