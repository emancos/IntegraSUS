# IntegraSUS API (SIGTAP, CNES, SIA) 🚀

API construída com **NestJS** e **PostgreSQL**, voltada para a extração, transformação e carregamento (ETL) automatizado de bases massivas de dados em saúde pública fornecidas pelo Governo Federal brasileiro através do **DATASUS**.

## 📌 Funcionalidades

- **Sincronização Automatizada e Dinâmica:** Varre automaticamente os servidores FTP do DATASUS em busca das últimas competências (arquivos mais recentes) do CNES (Cadastros) e SIA (Produção Ambulatorial).
- **Download Resiliente e Multi-Thread:** Bypassa instabilidades e limitações (WAF) do DATASUS fazendo o download com múltiplas *threads* simultâneas para arquivos gigantescos (como os ZIPs do CNES e EXEs do SIA).
- **Gerenciamento Inteligente de Bulk-Insert:** Trata tabelas de quase 10 milhões de registros otimizando o banco relacional de forma profunda (removendo índices temporariamente para inserção, aumentando o batch size de query).
- **Busca Textual em Milissegundos:** Criação nativa e automatizada de índices inversos generalizados (`GIN`) baseados em Trigramas (`pg_trgm`), fazendo buscas por aproximação (`LIKE`) voarem.
- **Tratamento Seguro de Dados Sensíveis:** O sistema automaticamente mascara CPFs e mapeia dados críticos obedecendo os atuais despachos de segurança e adequação à LGPD aplicados nas bases públicas do governo.
- **Agendamento Dinâmico (Cron API):** O comportamento de sincronização (de hora em hora, semanalmente, etc.) é totalmente gerenciado em tempo de execução pelos endpoints da própria API, sem necessidade de recompilar.

---

## 🛠️ Tecnologias

- **Framework:** NestJS, TypeScript
- **Banco de Dados:** PostgreSQL 15, TypeORM
- **Pacotes Essenciais:** `basic-ftp`, `7zip-bin`, `cron`, `@nestjs/schedule`
- **Ambiente & Deploy:** Docker, Docker Compose

---

## 🐳 Como rodar a aplicação (Docker)

A forma mais simples de subir toda a infraestrutura (Aplicação + Banco de Dados) é utilizando o Docker Compose.

### 1. Pré-requisitos
- Docker instalado na máquina.
- Docker Compose v2+.

### 2. Configurar o Ambiente
Copie o arquivo `.env.example` fornecido e renomeie-o para `.env`.
```bash
cp .env.example .env
```
*(O arquivo já vem preenchido de forma amigável com as variáveis corretas para rodar pelo Compose).*

### 3. Subir os Containers
Basta executar o comando abaixo. Ele construirá a imagem da API baseada no nosso `Dockerfile` multi-stage e iniciará um container PostgreSQL em anexo.
```bash
docker-compose up --build -d
```
*(O parâmetro `-d` roda de forma desacoplada/em background. Para ver os logs: `docker-compose logs -f api`).*

---

## 🖥️ Como rodar a aplicação (Localmente sem Docker)

Se preferir rodar no ambiente nativo (desenvolvimento):

1. Modifique no seu `.env` a variável `DATABASE_URL` para apontar para o seu banco `localhost` (ou suba apenas o postgres pelo compose: `docker-compose up -d postgres`).
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Rode o servidor de desenvolvimento:
   ```bash
   npm run start:dev
   ```

---

## 🔑 Criando Credenciais de Acesso (Client API)

A API possui um sistema de autenticação via JWT protegido por `client_id` e `client_secret`. Para interagir com endpoints seguros, você precisa cadastrar um cliente no banco de dados.

Foi disponibilizado um script utilitário interno para gerar e encriptar essas credenciais:

### Ambiente Docker
Se a sua API estiver rodando via `docker-compose up`, execute o script acessando o container da aplicação (`api`):
```bash
docker-compose exec api npm run add-client <meu_client_id> <minha_senha_forte> "Descrição do Sistema"
```

### Ambiente Nativo (Local)
Se estiver rodando nativamente na sua máquina (`npm run start:dev`):
```bash
npm run add-client <meu_client_id> <minha_senha_forte> "Descrição do Sistema"
```

*O script criptografará sua senha usando Bcrypt e gravará diretamente no banco de dados PostgreSQL.*

---

## 📖 Documentação da API (Swagger)

A API possui documentação auto-gerada que pode ser acessada visualmente através da interface do Swagger.
Com a API rodando, acesse em seu navegador:
**http://localhost:4000/api** *(Ou a porta equivalente caso tenha modificado o `.env`).*

Principais Endpoints:
- `POST /sync/trigger`: Dispara forçadamente o processamento de busca e sincronização.
- `GET /sync/config`: Retorna a versão (competência) de qual foi a última base salva no sistema, além da expressão cron em vigência.
- `POST /sync/config`: Configura, em tempo real, novos intervalos de verificação (Ex: `"cron_expression": "0 2 * * 0"`).

---

## ⚖️ Licença (MIT License)

Este projeto está licenciado sob a **MIT License**. É gratuito e de código aberto.

Copyright (c) 2026

É concedida permissão, gratuitamente, a qualquer pessoa que obtenha uma cópia deste software e dos arquivos de documentação associados (o "Software"), para lidar no Software sem restrição, incluindo, sem limitação, os direitos de usar, copiar, modificar, mesclar, publicar, distribuir, sublicenciar e/ou vender cópias do Software, e permitir que as pessoas a quem o Software é fornecido o façam, sujeitas às seguintes condições:

O aviso de copyright acima e este aviso de permissão devem ser incluídos em todas as cópias ou partes substanciais do Software.

O SOFTWARE É FORNECIDO "COMO ESTÁ", SEM GARANTIA DE QUALQUER TIPO, EXPRESSA OU IMPLÍCITA, INCLUINDO MAS NÃO SE LIMITANDO ÀS GARANTIAS DE COMERCIALIZAÇÃO, ADEQUAÇÃO A UM DETERMINADO FIM E NÃO INFRAÇÃO. EM NENHUM CASO OS AUTORES OU DETENTORES DE DIREITOS AUTORAIS SERÃO RESPONSÁVEIS POR QUALQUER RECLAMAÇÃO, DANOS OU OUTRA RESPONSABILIDADE, SEJA EM UMA AÇÃO DE CONTRATO, DELITO OU DE OUTRA FORMA, DECORRENTE DE, OU EM CONEXÃO COM O SOFTWARE OU O USO OU OUTRAS NEGOCIAÇÕES NO SOFTWARE.
