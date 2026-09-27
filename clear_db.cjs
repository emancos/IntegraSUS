const { Client } = require('pg');
require('dotenv').config();

const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  try {
    console.log('Limpando schema public...');
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Schema recriado.');
  } catch (e) {
    console.error('Erro:', e);
  } finally {
    c.end();
  }
});
