const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const clientId = process.argv[2];
const clientSecret = process.argv[3];
const desc = process.argv[4] || 'Novo Cliente API';

if (!clientId || !clientSecret) {
  console.log('Uso: npm run add-client <client_id> <client_secret> [descricao]');
  console.log('Exemplo: npm run add-client app-mobile senha-123 "App Mobile iOS"');
  process.exit(1);
}

const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  try {
    // Garante que a tabela existe
    await c.query(`
      CREATE TABLE IF NOT EXISTS tb_clients (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(50) UNIQUE NOT NULL,
        client_secret VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const hashedSecret = await bcrypt.hash(clientSecret, 10);
    await c.query('INSERT INTO tb_clients (client_id, client_secret, description) VALUES ($1, $2, $3)', [clientId, hashedSecret, desc]);
    console.log(`\n✅ Sucesso! Cliente autorizado no banco.`);
    console.log(`client_id: ${clientId}`);
    console.log(`client_secret: ${clientSecret}`);
    console.log(`Lembre-se: o secret foi criptografado com bcrypt no banco e não pode ser recuperado, apenas sobrescrito.\n`);
  } catch (e) {
    if (e.code === '23505') {
        console.error('❌ Erro: Esse client_id já existe!');
    } else {
        console.error('❌ Erro:', e.message);
    }
  } finally {
    c.end();
  }
});
