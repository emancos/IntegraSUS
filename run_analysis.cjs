const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

async function downloadFile(url, dest, headers = {}) {
  console.log(`Downloading ${url}...`);
  const response = await axios({ url, method: 'GET', responseType: 'stream', headers });
  const writer = fs.createWriteStream(dest);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function run() {
  const dir = path.join(__dirname, 'test_sia_cnes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  
  const bdsiaZip = path.join(dir, 'BDSIA202609a.zip');
  const bdsiaExtracted = path.join(dir, 'bdsia_extracted');
  const cnesZip = path.join(dir, 'BASE_DE_DADOS_CNES_202608.ZIP');
  const cnesExtracted = path.join(dir, 'cnes_extracted');

  // Install required deps
  console.log('Installing dependencies...');
  execSync('npm install 7zip-bin node-dbf adm-zip axios', { cwd: dir, stdio: 'inherit' });

  // 1. Download BDSIA
  if (!fs.existsSync(bdsiaZip)) {
    await downloadFile('https://github.com/RenatoKR/SIASUS/raw/main/bdsia/BDSIA202609a.exe', bdsiaZip);
  }

  // 2. Extract BDSIA using 7zip-bin
  if (!fs.existsSync(bdsiaExtracted)) {
    fs.mkdirSync(bdsiaExtracted);
    const { path7za } = require(path.join(dir, 'node_modules', '7zip-bin'));
    console.log(`Extracting BDSIA using 7za...`);
    execSync(`"${path7za}" x "${bdsiaZip}" -o"${bdsiaExtracted}" -y`);
  }

  // 3. Download CNES
  if (!fs.existsSync(cnesZip)) {
    await downloadFile(
      'https://cnes.datasus.gov.br/EstatisticasServlet?path=BASE_DE_DADOS_CNES_202608.ZIP',
      cnesZip,
      {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Cookie': 'TS0142589a=01e9f7e51f1373e139804b6a28b983707d40b8d4529175e70b41a5519fbc9dad7b2b95eb62161e4e2d95ba31a244ce5f08068d5043; TS42893502027=08b6e4e1d8ab2000f7a8b242aa959bff90d026b213e16c2cbc17ecead7534e10806546e29d05ab2f0849c46156113000cff2f3616851434a8e288e14b2556225052c5eb8a379f7b09faf905e67380547b7907ff241d03ef61daeea465abffcb5',
        'Referer': 'https://cnes.datasus.gov.br/pages/downloads/arquivosBaseDados.jsp',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
      }
    );
  }

  // 4. Extract CNES using adm-zip
  if (!fs.existsSync(cnesExtracted)) {
    fs.mkdirSync(cnesExtracted);
    console.log('Extracting CNES...');
    const AdmZip = require(path.join(dir, 'node_modules', 'adm-zip'));
    try {
        const zip = new AdmZip(cnesZip);
        zip.extractAllTo(cnesExtracted, true);
    } catch (e) {
        console.log('Failed to extract CNES with adm-zip. Trying 7zip-bin...');
        const { path7za } = require(path.join(dir, 'node_modules', '7zip-bin'));
        execSync(`"${path7za}" x "${cnesZip}" -o"${cnesExtracted}" -y`);
    }
  }

  // 5. Read a sample of DBF files using node-dbf
  console.log('Analyzing extracted data...');
  const Parser = require(path.join(dir, 'node_modules', 'node-dbf')).default;
  
  const filesToRead = [
    { name: 'SIA - CADMUN.DBF', path: path.join(bdsiaExtracted, 'CADMUN.DBF') },
    { name: 'CNES - tbEstabelecimento202608.csv', path: path.join(cnesExtracted, 'tbEstabelecimento202608.csv') }
  ];

  for (const f of filesToRead) {
    if (f.path.endsWith('.DBF') && fs.existsSync(f.path)) {
      console.log(`\n--- Reading first 3 rows of ${f.name} ---`);
      let count = 0;
      const parser = new Parser(f.path, { encoding: 'latin1' });
      parser.on('record', (record) => {
        if (count < 3) {
          console.log(record);
          count++;
        }
      });
      parser.on('end', () => console.log(`Finished ${f.name}.`));
      parser.parse();
    } else if (f.path.endsWith('.csv') && fs.existsSync(f.path)) {
      console.log(`\n--- Reading first 5 lines of ${f.name} ---`);
      const lines = fs.readFileSync(f.path, 'latin1').split('\n').slice(0, 5);
      console.log(lines.join('\n'));
    } else {
        console.log(`File not found: ${f.path}`);
        if (f.path.includes('cnes_extracted')) {
            console.log('CNES files extracted:', fs.readdirSync(cnesExtracted).slice(0, 10));
        }
        if (f.path.includes('bdsia_extracted')) {
            console.log('BDSIA files extracted:', fs.readdirSync(bdsiaExtracted).slice(0, 10));
        }
    }
  }
}

run().catch(console.error);
