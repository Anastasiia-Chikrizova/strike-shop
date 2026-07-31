# strike-shop

Монорепозиторій магазину: бекенд на Medusa (`apps/backend`) і сторфронт на
Next.js (`apps/storefront`). Пакетний менеджер — npm, скрипти проганяються
через turbo.

## Локальний запуск

Потрібні Node.js 20+, PostgreSQL 15+ і Redis (опційно — без `REDIS_URL`
Medusa працює на in-memory реалізаціях).

1. Встановити залежності:

```bash
npm install
```

2. Створити env бекенда і вписати `DATABASE_URL`:

```bash
cp apps/backend/.env.template apps/backend/.env
```

3. Прогнати міграції (з `apps/backend`):

```bash
npx medusa db:migrate
```

4. Створити адміна (з `apps/backend`):

```bash
npx medusa user -e admin@test.com -p supersecret
```

5. Запустити обидва застосунки:

```bash
npm run dev
```

Бекенд — `http://localhost:9000` (адмінка на `/app`), сторфронт —
`http://localhost:8000`.

Публішабл-ключ береться в адмінці: Settings → Publishable API key. Його треба
покласти в `apps/storefront/.env.local`.

## Змінні оточення сторфронта

| Змінна | Опис | Дефолт |
|---|---|---|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Publishable API key з бекенда | — |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Публічний URL бекенда, вшивається в бандл на збірці | `http://localhost:9000` |
| `MEDUSA_BACKEND_URL` | Приватний URL бекенда для серверних викликів | значення `NEXT_PUBLIC_MEDUSA_BACKEND_URL` |
| `NEXT_PUBLIC_DEFAULT_REGION` | Код країни регіону за замовчуванням | `ua` |
| `NEXT_PUBLIC_BASE_URL` | Базовий URL сторфронта | `https://localhost:8000` |

## Деплой

Стейдж — один інстанс Oracle Cloud A1 (arm64), образи збирає GitHub Actions і
кладе в GHCR. Порядок дій, налаштування сервера і секрети описані в
[deploy/README.md](deploy/README.md).

## Оплата

Інтеграція з Monobank описана окремо:
[apps/backend/src/lib/monobank/README.md](apps/backend/src/lib/monobank/README.md).
