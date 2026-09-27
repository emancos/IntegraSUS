const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

async function run() {
  const cnesZipPath = path.join(__dirname, 'projeto_base_cnes', 'BASE_DE_DADOS_CNES_202608.ZIP');
  
  console.log('--- CNES Analysis ---');
  if (fs.existsSync(cnesZipPath)) {
    const zip = new AdmZip(cnesZipPath);
    const zipEntries = zip.getEntries();
    
    // Find some interesting tables
    const tablesOfInterest = ['tbEstabelecimento202608.csv', 'tbEquipe202608.csv', 'tbProfissional202608.csv'];
    
    for (const entry of zipEntries) {
      if (tablesOfInterest.includes(entry.entryName)) {
        console.log(`\nFound: ${entry.entryName}`);
        const content = zip.readAsText(entry, 'latin1'); // Or utf8 depending on cnes
        const lines = content.split('\n');
        console.log(`Total rows: ${lines.length}`);
        console.log(`Columns: ${lines[0]}`);
        console.log(`Sample row 1: ${lines[1]}`);
      }
    }
  } else {
    console.log(`CNES file not found at ${cnesZipPath}`);
  }

  console.log('\n--- BDSIA Analysis ---');
  const bdsiaPath = path.join(__dirname, 'test_sia_cnes', 'BDSIA202609a.zip');
  if (fs.existsSync(bdsiaPath)) {
    try {
        const { path7za } = require('7zip-bin');
        const bdsiaExtracted = path.join(__dirname, 'test_sia_cnes', 'bdsia_extracted_ok');
        if (!fs.existsSync(bdsiaExtracted)) fs.mkdirSync(bdsiaExtracted);
        execSync(`"${path7za}" x "${bdsiaPath}" -o"${bdsiaExtracted}" -y`);
        
        const Parser = require('node-dbf').default;
        const cadmun = path.join(bdsiaExtracted, 'CADMUN.DBF');
        if (fs.existsSync(cadmun)) {
            console.log(`Found CADMUN.DBF`);
            const parser = new Parser(cadmun, { encoding: 'latin1' });
            let count = 0;
            parser.on('record', (r) => {
                if (count < 2) console.log(r);
                count++;
            });
            parser.on('end', () => console.log('Finished reading CADMUN.'));
            parser.parse();
        }
    } catch (e) {
        console.error('Error analyzing BDSIA', e.message);
    }
  }
}

run().catch(console.error);
