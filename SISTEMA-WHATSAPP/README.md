# Sistema SaaS Bot WhatsApp Multi-Instância

Sistema completo para gerenciamento de múltiplas instâncias WhatsApp com fluxos automatizados.

## Stack

- **Backend:** Node.js (CommonJS), Express
- **Banco:** MySQL (mysql2/promise)
- **WhatsApp:** whatsapp-web.js + puppeteer
- **Auth:** JWT + bcrypt

## Instalação

```bash
cd bot
npm install
```

## Configuração

O arquivo `.env` já está configurado:

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hg9a3205_sistema_bots
DB_USER=hg9a3205_sistemas
DB_PASSWORD=jjds06091985
JWT_SECRET=eloha_super_secreta_2026
FRONTEND_URL=https://escolateologicaeloha.com.br
```

## Executar

```bash
cd bot
node index.js
```

## Endpoints da API

### Autenticacao

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login |

**Register:**
```json
{
  "name": "Nome",
  "email": "email@exemplo.com",
  "password": "senha123"
}
```

**Login:**
```json
{
  "email": "email@exemplo.com",
  "password": "senha123"
}
```

### Instancias (requer token)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/instances` | Listar instancias |
| POST | `/api/instances` | Criar instancia |
| POST | `/api/instances/:id/connect` | Conectar (gera QR) |
| GET | `/api/instances/:id/qrcode` | Obter QR Code |
| POST | `/api/instances/:id/disconnect` | Desconectar |
| DELETE | `/api/instances/:id` | Remover |

**Criar instancia:**
```json
{
  "instance_name": "meu-whatsapp"
}
```

### Fluxos (requer token)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/flows` | Listar fluxos |
| GET | `/api/flows/:id` | Obter fluxo |
| POST | `/api/flows` | Criar fluxo |
| PUT | `/api/flows/:id` | Atualizar fluxo |
| DELETE | `/api/flows/:id` | Remover fluxo |

**Criar fluxo:**
```json
{
  "name": "Atendimento",
  "is_active": true,
  "flow_data": {
    "steps": {
      "start": {
        "message": "Ola! Digite 1 para vendas ou 2 para suporte",
        "options": [
          { "trigger": "1", "next": "vendas", "response": "Conectando com vendas..." },
          { "trigger": "2", "next": "suporte", "response": "Conectando com suporte..." }
        ]
      },
      "vendas": {
        "message": "Nosso time de vendas entrara em contato!",
        "next": "end"
      },
      "suporte": {
        "message": "Descreva seu problema que iremos ajudar.",
        "next": "end"
      }
    }
  }
}
```

### Mensagens (requer token)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/messages/send` | Enviar mensagem |
| GET | `/api/messages` | Listar mensagens |
| GET | `/api/contacts` | Listar contatos |

**Enviar mensagem:**
```json
{
  "instance_id": 1,
  "to": "5511999999999",
  "message": "Ola!"
}
```

### Health Check

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/` | Status do servidor |
| GET | `/health` | Health check completo |

## Autenticacao

Todas as rotas protegidas requerem header:
```
Authorization: Bearer <token>
```

## Estrutura

```
bot/
├── config/
│   └── database.js
├── controllers/
│   ├── authController.js
│   ├── flowController.js
│   ├── instanceController.js
│   └── messageController.js
├── middlewares/
│   └── auth.js
├── routes/
│   └── api.js
├── services/
│   ├── flowEngine.js
│   └── sessionManager.js
├── sessions/
├── .env
├── index.js
└── package.json
```

## Tabelas MySQL

- `clients` - Usuarios do sistema
- `instances` - Instancias WhatsApp
- `flows` - Fluxos de conversa
- `contacts` - Contatos
- `messages` - Historico de mensagens

## Producao

O puppeteer esta configurado para servidor:
- headless: true
- --no-sandbox
- --disable-setuid-sandbox
