# 📚 Manual Completo da Plataforma Eloha Bots SaaS

## Índice
1. [Visão Geral](#visão-geral)
2. [Como Criar Cupons de Desconto](#como-criar-cupons-de-desconto)
3. [Simulando um Cliente Novo](#simulando-um-cliente-novo)
4. [Configurando o WhatsApp do Cliente](#configurando-o-whatsapp-do-cliente)
5. [Criando Fluxos de Automação](#criando-fluxos-de-automação)
6. [API de Eventos Externos](#api-de-eventos-externos)
7. [Gerenciamento de Planos](#gerenciamento-de-planos)

---

## Visão Geral

A plataforma Eloha Bots é um SaaS de automação de WhatsApp com:
- **3 Planos**: Gold (R$ 97), Medium (R$ 197), Platinum (R$ 297)
- **Multi-tenant**: Cada cliente tem seus dados isolados
- **Limites por plano**: Instâncias e fluxos limitados
- **API de eventos**: Disponível apenas no plano Platinum

---

## Como Criar Cupons de Desconto

### Tipos de Cupom Disponíveis

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `percentage` | Desconto em porcentagem | 20% de desconto |
| `fixed` | Valor fixo de desconto | R$ 50 de desconto |
| `free_period` | Período gratuito | 30 dias grátis |

### Criando Cupom via API (Postman/Insomnia)

**Endpoint:** `POST /api/coupons`

**Headers:**
```
Authorization: Bearer SEU_TOKEN_ADMIN
Content-Type: application/json
```

#### Exemplo 1: Cupom de 20% de desconto
```json
{
  "code": "DESCONTO20",
  "description": "20% de desconto para clientes especiais",
  "discount_type": "percentage",
  "discount_value": 20,
  "max_uses": 100,
  "valid_until": "2026-12-31"
}
```

#### Exemplo 2: Cupom de 1 mês grátis
```json
{
  "code": "MESGRATIS",
  "description": "Primeiro mês gratuito",
  "discount_type": "free_period",
  "discount_value": 0,
  "free_days": 30,
  "max_uses": 50
}
```

#### Exemplo 3: Cupom de R$ 50 de desconto
```json
{
  "code": "PROMO50",
  "description": "R$ 50 de desconto",
  "discount_type": "fixed",
  "discount_value": 50,
  "max_uses": 20,
  "valid_until": "2026-06-30"
}
```

#### Exemplo 4: Cupom exclusivo para plano Platinum
```json
{
  "code": "PLATINUM30",
  "description": "30% desconto no Platinum",
  "discount_type": "percentage",
  "discount_value": 30,
  "plan_id": 3,
  "max_uses": 10
}
```

### Criando Cupom via Banco de Dados (MySQL)

```sql
-- Cupom de 1 mês grátis
INSERT INTO coupons (code, description, discount_type, discount_value, free_days, max_uses) 
VALUES ('CLIENTEVIP', 'Cliente VIP - 1 mês grátis', 'free_period', 0, 30, 1);

-- Cupom de 50% de desconto
INSERT INTO coupons (code, description, discount_type, discount_value, max_uses, valid_until) 
VALUES ('METADE', '50% de desconto', 'percentage', 50, 10, '2026-12-31');

-- Cupom ilimitado de 10%
INSERT INTO coupons (code, description, discount_type, discount_value) 
VALUES ('SEMPRE10', '10% de desconto permanente', 'percentage', 10);
```

### Listando Cupons Existentes

**Endpoint:** `GET /api/coupons`

```bash
curl -X GET "https://bot-eloha.discloud.app/api/coupons" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Desativando um Cupom

**Endpoint:** `PUT /api/coupons/:id/deactivate`

```bash
curl -X PUT "https://bot-eloha.discloud.app/api/coupons/1/deactivate" \
  -H "Authorization: Bearer SEU_TOKEN"
```

---

## Simulando um Cliente Novo

### Passo 1: Registrar Nova Conta

1. Acesse: `https://seupainel.com.br/` (Hostgator)
2. Clique em **"Criar conta"**
3. Preencha:
   - Email: `cliente@exemplo.com`
   - Senha: `senha123`
4. Clique em **"Registrar"**

**Via API:**
```bash
curl -X POST "https://bot-eloha.discloud.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@exemplo.com",
    "password": "senha123"
  }'
```

### Passo 2: Fazer Login

1. Use o email e senha cadastrados
2. Você será redirecionado ao Dashboard

**Via API:**
```bash
curl -X POST "https://bot-eloha.discloud.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@exemplo.com",
    "password": "senha123"
  }'
```

Resposta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "client": { "id": 5, "email": "cliente@exemplo.com" }
}
```

### Passo 3: Assinar um Plano

1. Vá em **"💎 Planos"** no menu
2. Escolha o plano desejado (Gold, Medium ou Platinum)
3. Se tiver cupom, insira o código
4. Clique em **"Assinar Agora"**

**Via API (com cupom):**
```bash
curl -X POST "https://bot-eloha.discloud.app/api/subscriptions" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": 1,
    "coupon_code": "MESGRATIS"
  }'
```

Resposta (cupom grátis):
```json
{
  "success": true,
  "message": "Assinatura gratuita ativada por 30 dias!",
  "subscription_id": 1,
  "status": "active",
  "plan": "Gold",
  "free_days": 30,
  "coupon_applied": "MESGRATIS"
}
```

---

## Configurando o WhatsApp do Cliente

### Passo 1: Criar uma Instância

1. Vá em **"Instâncias"** no menu
2. Clique em **"+ Nova Instância"**
3. Digite um nome (ex: "WhatsApp Principal")
4. Clique em **"Criar"**

**Via API:**
```bash
curl -X POST "https://bot-eloha.discloud.app/api/instances" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_name": "WhatsApp Principal"
  }'
```

### Passo 2: Conectar o WhatsApp

1. Na lista de instâncias, clique em **"Conectar"**
2. Aguarde o QR Code aparecer
3. Abra o WhatsApp no celular
4. Vá em **Configurações > Aparelhos Conectados > Conectar Aparelho**
5. Escaneie o QR Code
6. Aguarde a conexão (status muda para "connected")

**Via API:**
```bash
# Iniciar conexão
curl -X POST "https://bot-eloha.discloud.app/api/instances/1/connect" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE"

# Obter QR Code
curl -X GET "https://bot-eloha.discloud.app/api/instances/1/qrcode" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE"
```

### Passo 3: Criar um Fluxo de Automação

1. Vá em **"Fluxos"** no menu
2. Clique em **"+ Novo Fluxo"**
3. Digite um nome (ex: "Atendimento Inicial")
4. Use o editor visual para criar os blocos

**Via API:**
```bash
curl -X POST "https://bot-eloha.discloud.app/api/flows" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Atendimento Inicial",
    "structure_json": {
      "steps": {
        "start": {
          "type": "message",
          "content": "Olá! Bem-vindo ao nosso atendimento. Como posso ajudar?\n\n1️⃣ Informações\n2️⃣ Suporte\n3️⃣ Falar com atendente",
          "next": "menu_principal"
        },
        "menu_principal": {
          "type": "menu",
          "options": [
            { "trigger": "1", "label": "Informações", "next": "info" },
            { "trigger": "2", "label": "Suporte", "next": "suporte" },
            { "trigger": "3", "label": "Atendente", "next": "atendente" }
          ]
        },
        "info": {
          "type": "message",
          "content": "Aqui estão nossas informações:\n📍 Endereço: Rua X, 123\n📞 Telefone: (11) 99999-9999\n🕐 Horário: 9h às 18h",
          "next": "start"
        },
        "suporte": {
          "type": "message",
          "content": "Para suporte, descreva seu problema que iremos analisar.",
          "next": "aguardar_problema"
        },
        "atendente": {
          "type": "rule_human_takeover",
          "config": { "hours": 1, "message": "Aguarde, um atendente irá falar com você em breve." }
        }
      }
    },
    "is_active": true
  }'
```

### Passo 4: Vincular Fluxo à Instância

1. Na lista de instâncias, clique em **"Editar"**
2. Selecione o fluxo criado
3. Clique em **"Salvar"**

**Via API:**
```bash
curl -X PUT "https://bot-eloha.discloud.app/api/instances/1" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_id": 1
  }'
```

### Passo 5: Testar o Bot

1. Envie uma mensagem para o número conectado
2. O bot deve responder automaticamente com o fluxo configurado

---

## Criando Fluxos de Automação

### Tipos de Blocos Disponíveis

| Tipo | Descrição |
|------|-----------|
| `message` | Envia uma mensagem de texto |
| `menu` | Menu interativo com opções |
| `delay` | Aguarda X segundos antes de continuar |
| `image` | Envia uma imagem |
| `audio` | Envia um áudio |
| `video` | Envia um vídeo |
| `document` | Envia um documento |
| `rule_human_takeover` | Transfere para atendimento humano |
| `rule_block_user` | Bloqueia o usuário temporariamente |
| `rule_inactivity` | Configura timeout por inatividade |
| `end_flow` | Encerra o fluxo |
| `return_menu` | Retorna ao menu anterior |

### Exemplo de Fluxo Completo

```json
{
  "steps": {
    "start": {
      "type": "message",
      "content": "👋 Olá! Seja bem-vindo!",
      "next": "delay_1"
    },
    "delay_1": {
      "type": "delay",
      "seconds": 2,
      "next": "menu"
    },
    "menu": {
      "type": "message",
      "content": "O que você deseja?\n\n1️⃣ Ver produtos\n2️⃣ Fazer pedido\n3️⃣ Falar com vendedor",
      "next": "opcoes"
    },
    "opcoes": {
      "type": "menu",
      "options": [
        { "trigger": "1", "label": "Produtos", "next": "produtos" },
        { "trigger": "2", "label": "Pedido", "next": "pedido" },
        { "trigger": "3", "label": "Vendedor", "next": "vendedor" }
      ]
    },
    "produtos": {
      "type": "image",
      "url": "https://seusite.com/catalogo.jpg",
      "caption": "📦 Confira nosso catálogo!",
      "next": "menu"
    },
    "pedido": {
      "type": "message",
      "content": "Para fazer um pedido, informe:\n- Produto desejado\n- Quantidade\n- Endereço de entrega",
      "next": "aguardar_pedido"
    },
    "vendedor": {
      "type": "rule_human_takeover",
      "config": {
        "hours": 2,
        "message": "🧑‍💼 Um vendedor irá atendê-lo em breve!"
      }
    }
  }
}
```

---

## API de Eventos Externos

> ⚠️ **Disponível apenas no plano Platinum**

### Disparar Evento de Compra

Use para iniciar um fluxo quando um cliente compra algo em outra plataforma (Hotmart, Kiwify, etc).

**Endpoint:** `POST /api/events/purchase`

```bash
curl -X POST "https://bot-eloha.discloud.app/api/events/purchase" \
  -H "Authorization: Bearer TOKEN_PLATINUM" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "phone": "5511999999999",
    "product": "Curso de Marketing",
    "value": 297.00,
    "data": {
      "curso_id": 123,
      "email": "joao@email.com"
    }
  }'
```

### Disparar Evento Customizado

**Endpoint:** `POST /api/events/custom`

```bash
curl -X POST "https://bot-eloha.discloud.app/api/events/custom" \
  -H "Authorization: Bearer TOKEN_PLATINUM" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "event_type": "abandono_carrinho",
    "data": {
      "produto": "Tênis Nike",
      "valor": 399.90
    },
    "start_node": "recuperacao_carrinho"
  }'
```

---

## Gerenciamento de Planos

### Verificar Limites do Cliente

**Endpoint:** `GET /api/plans/limits`

```bash
curl -X GET "https://bot-eloha.discloud.app/api/plans/limits" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE"
```

Resposta:
```json
{
  "instances": { "current": 1, "max": 1, "available": 0 },
  "flows": { "current": 1, "max": 1, "available": 0 },
  "apiEvents": { "enabled": false },
  "plan": "Gold"
}
```

### Verificar Assinatura Atual

**Endpoint:** `GET /api/subscriptions/my`

```bash
curl -X GET "https://bot-eloha.discloud.app/api/subscriptions/my" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE"
```

### Cancelar Assinatura

**Endpoint:** `DELETE /api/subscriptions/:id`

```bash
curl -X DELETE "https://bot-eloha.discloud.app/api/subscriptions/1" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE"
```

---

## Resumo dos Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Registrar novo cliente |
| POST | `/api/auth/login` | Login |
| GET | `/api/instances` | Listar instâncias |
| POST | `/api/instances` | Criar instância |
| POST | `/api/instances/:id/connect` | Conectar WhatsApp |
| GET | `/api/instances/:id/qrcode` | Obter QR Code |
| GET | `/api/flows` | Listar fluxos |
| POST | `/api/flows` | Criar fluxo |
| PUT | `/api/flows/:id` | Atualizar fluxo |
| GET | `/api/plans` | Listar planos |
| GET | `/api/plans/limits` | Ver limites |
| POST | `/api/subscriptions` | Criar assinatura |
| GET | `/api/subscriptions/my` | Ver assinatura |
| DELETE | `/api/subscriptions/:id` | Cancelar assinatura |
| POST | `/api/coupons` | Criar cupom |
| GET | `/api/coupons` | Listar cupons |
| POST | `/api/coupons/validate` | Validar cupom |
| POST | `/api/events/purchase` | Evento de compra (Platinum) |
| POST | `/api/events/custom` | Evento customizado (Platinum) |
| GET | `/api/analytics/summary` | Métricas do sistema |

---

## Dúvidas Frequentes

### Como dar acesso gratuito a um cliente?

1. Crie um cupom do tipo `free_period`:
```sql
INSERT INTO coupons (code, description, discount_type, free_days, max_uses) 
VALUES ('CLIENTEX', 'Acesso gratuito Cliente X', 'free_period', 30, 1);
```

2. Envie o código `CLIENTEX` para o cliente usar na assinatura.

### Como aumentar os limites de um cliente específico?

Faça upgrade do plano dele ou crie um plano personalizado:
```sql
INSERT INTO plans (name, slug, max_instances, max_flows, api_events_enabled, price_monthly) 
VALUES ('Personalizado', 'custom-cliente-x', 10, 10, 1, 500.00);
```

### Como ver as métricas de um cliente?

Use o endpoint de analytics:
```bash
curl -X GET "https://bot-eloha.discloud.app/api/analytics/summary" \
  -H "Authorization: Bearer TOKEN_DO_CLIENTE"
```

---

## Arquivos para Deploy

### Discloud (Bot)
- `bot/services/schemaManager.js`
- `bot/services/couponService.js` (novo)
- `bot/controllers/couponController.js` (novo)
- `bot/controllers/subscriptionController.js`
- `bot/routes/api.js`

### Hostgator (Painel)
- `painel/plans.html`
- `painel/js/settings.js`
- `painel/js/auth.js`

---

*Manual atualizado em Março/2026*
