# GP Panel Backend API

Node.js + Express + PostgreSQL backend for the bot-building panel.

## Quick start

```bash
cd backend/api
npm install
npm run migrate:latest
npm run seed
npm run dev
```

Default admin credentials: `admin@example.com / admingp25`.

## Environment variables

Copy `.env.example` to `.env` and set:

- `DB_*` – PostgreSQL connection
- `JWT_SECRET` – secret for cookies/JWT
- `WFP_*` – WayForPay merchant credentials (login `genieprompts_net`, secret `9c8f0e...`, password `7c1185...`)
- `FRONTEND_RETURN_URL` – URL where WayForPay should return user

## API Overview

| Route | Method | Description |
|-------|--------|-------------|
| `/auth/register` | POST | Register user and issue JWT cookie |
| `/auth/login` | POST | Login user |
| `/auth/me` | GET | Current user info |
| `/auth/logout` | POST | Clear cookie |
| `/bots` | GET | List active bots |
| `/bots/:botId/access` | GET | Check if current user has access |
| `/bots/:botId/progress` | POST | Update progress |
| `/bots/:botId/reset` | POST | Reset progress (requires paid purchase) |
| `/payments/create` | POST | Create purchase / WayForPay invoice |
| `/payments/wayforpay-callback` | POST | WayForPay webhook |
| `/payments/my` | GET | User purchases |
| `/admin/...` | * | Admin-only CRUD & settings |

## Sample requests

```bash
# Register
curl -X POST http://localhost:4000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"John Doe","phone":"+380991112233","email":"john@example.com","password":"secret123"}' \
  -c cookies.txt

# Login
curl -X POST http://localhost:4000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"john@example.com","password":"secret123"}' \
  -c cookies.txt -b cookies.txt

# List bots
curl http://localhost:4000/bots -b cookies.txt -c cookies.txt

# Create payment
curl -X POST http://localhost:4000/payments/create \
  -H 'Content-Type: application/json' \
  -d '{"botId":2}' -b cookies.txt -c cookies.txt

# Admin list bots
curl http://localhost:4000/admin/bots -b cookies.txt -c cookies.txt
```
