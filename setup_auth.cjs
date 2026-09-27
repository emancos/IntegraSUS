const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS tb_clients (
        client_id VARCHAR(255) PRIMARY KEY,
        client_secret VARCHAR(255) NOT NULL,
        description VARCHAR(255)
      )
    `);
    
    const clientId = 'sigtap-frontend-dev';
    const plainSecret = 'segredo-sigtap-123';
    
    const check = await c.query('SELECT * FROM tb_clients WHERE client_id = $1', [clientId]);
    if (check.rows.length === 0) {
      const hashedSecret = await bcrypt.hash(plainSecret, 10);
      await c.query('INSERT INTO tb_clients (client_id, client_secret, description) VALUES ($1, $2, $3)', [clientId, hashedSecret, 'Frontend Dev Test']);
      console.log('Credenciais recriadas após limpeza.');
    }
  } catch (e) {
    console.error('Erro:', e);
  } finally {
    c.end();
  }
});
