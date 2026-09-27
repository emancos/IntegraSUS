# IntegraSUS API

API Unificada para agregação, busca e disponibilização de dados das principais bases de dados do Sistema Único de Saúde (SUS):
- **SIGTAP:** Tabela Unificada de Procedimentos, Medicamentos e OPM.
- **CNES:** Cadastro Nacional de Estabelecimentos de Saúde e Profissionais.
- **SIA/BDSIA:** Sistema de Informações Ambulatoriais.

## Inicialização

```bash
# Instalar as dependências
$ npm install

# Executar migrações / criar cliente padrão de autenticação
$ node setup_auth.cjs

# Iniciar o servidor em desenvolvimento
$ npm run start:dev
```

## Sincronização de Dados
Esta API possui rotas protegidas (JWT) que disparam *Background Jobs* para download, descompactação e persistência dos repositórios governamentais em PostgreSQL.

## Documentação Interativa
Acesse a documentação no padrão OpenAPI (Swagger) localmente:
- **URL:** [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
