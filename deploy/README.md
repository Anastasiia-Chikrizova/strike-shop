# Деплой стейджа

Стейдж живе на одному інстансі **Oracle Cloud Always Free Ampere A1** (arm64,
Frankfurt). Postgres, Redis, бекенд, сторфронт і Caddy крутяться там же в
одному compose-стеку. Образи збирає GitHub Actions і кладе в GHCR — на сервері
нічого не збирається.

| Файл | Що це |
| --- | --- |
| [`.github/workflows/build-push.yml`](../.github/workflows/build-push.yml) | збірка обох образів під `linux/arm64` → GHCR |
| [`docker-compose.staging.yml`](../docker-compose.staging.yml) | деплойний стек: тільки `image:`, ніяких `build:` |
| [`Caddyfile`](Caddyfile) | реверс-проксі + автоматичний Let's Encrypt |
| [`deploy.sh`](deploy.sh) | pull → міграції → up → чекання healthy |
| `*.env.example` | шаблони; справжні файли лежать у `/etc/strike-shop/` і в гіт не потрапляють |

`docker-compose.yml` у корені — це збірка з вихідників (локально/вручну),
`docker-compose.dev.yml` — розробка. Для сервера потрібен тільки
`docker-compose.staging.yml`.

---

## 1. Що треба до початку

- інстанс A1 з публічним IP і доступом по SSH;
- два домени (або піддомени): `staging.…` для сторфронта, `api.staging.…` для
  бекенда, обидва A-записами на цей IP;
- тестовий токен монобанку з https://api.monobank.ua/.

## 2. Сервер

Docker з офіційного репозиторію (в дистрибутивному пакеті стара версія без
`docker compose`):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # перелогінитись
```

**Мережа відкривається у двох місцях, і про друге забувають:**

1. VCN → Security Lists → Ingress: TCP 80 і 443 з `0.0.0.0/0`;
2. локальний файрвол інстансу. В Ubuntu-образах Oracle у `iptables` стоїть
   `REJECT` на все, крім 22. Трафік до опублікованих контейнерних портів іде
   через `FORWARD`, тому часто працює і так, але якщо 80/443 мовчать при
   відкритому Security List — дивитись саме сюди:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

(в Oracle Linux замість цього `firewall-cmd --add-service=http --permanent`.)

Репозиторій потрібен на сервері тільки заради compose-файла і цього скрипта:

```bash
sudo git clone https://github.com/Anastasiia-Chikrizova/strike-shop /opt/strike-shop
sudo chown -R "$USER" /opt/strike-shop
```

## 3. Секрети на сервері

```bash
sudo mkdir -p /etc/strike-shop
sudo cp /opt/strike-shop/deploy/*.env.example /etc/strike-shop/
# перейменувати без .example, заповнити
sudo chmod 600 /etc/strike-shop/*.env
```

Генерація секретів: `openssl rand -base64 32` для `JWT_SECRET`,
`COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`, `openssl rand -base64 24` для
пароля Postgres (він же в `DATABASE_URL` — тримати синхронно).

Доступ до GHCR (образи приватні, поки пакет не зроблено публічним) — PAT з
єдиним правом `read:packages`:

```bash
echo "<PAT>" | docker login ghcr.io -u Anastasiia-Chikrizova --password-stdin
```

## 4. GitHub

Settings → Environments → **staging** (і згодом **prod**), у кожному секрет
`STOREFRONT_ENV` — вміст `storefront.env` цілком, як текст. Воркфлоу підбирає
Environment за гілкою: `dev` → staging, `master` → prod.

---

## 5. Перший деплой

Порядок не довільний: `NEXT_PUBLIC_*` вшиваються у бандл на збірці, а
publishable key з'являється тільки після першого запуску бекенда. Тому спершу
піднімається бекенд, і лише потім збирається сторфронт.

**1. Зібрати бекенд.** Пуш у `dev` або Actions → Run workflow → staging.

**2. Підняти базу і бекенд:**

```bash
cd /opt/strike-shop
set -a; . /etc/strike-shop/stack.env; set +a
compose() { docker compose --env-file /etc/strike-shop/stack.env -f docker-compose.staging.yml "$@"; }

compose pull backend
compose up -d postgres redis
compose --profile tools run --rm migrate
compose up -d backend caddy
```

Сторфронт-домен поки віддає 502 — це нормально, апстріму ще немає.

**3. Створити адміна:**

```bash
compose run --rm backend npx medusa user -e admin@strike.shop -p '<пароль>'
```

**4. Взяти publishable key** в адмінці `https://api.staging.…/app` →
Settings → Publishable API keys, і там же ввімкнути монобанк:
Settings → Regions → Ukraine → Payment providers → `monobank`.

**5. Заповнити `storefront.env`** ключем і доменами, покласти той самий вміст
у секрет `STOREFRONT_ENV`, перезапустити воркфлоу.

**6. Викотити все:**

```bash
./deploy/deploy.sh
```

## 6. Звичайний деплой

```bash
cd /opt/strike-shop && git pull && ./deploy/deploy.sh
```

Скрипт тягне образи за тегом `staging`, проганяє міграції, піднімає стек і
чекає, поки обидва застосунки стануть `healthy`. Якщо ні — друкує логи і
виходить з ненульовим кодом.

Відкат на конкретний білд (тег = sha коміту, він є в summary воркфлоу):

```bash
TAG=9f2c1ab ./deploy/deploy.sh
```

Міграції назад не відкочуються — відкат образу з несумісною схемою БД не
врятує. На стейджі це терпимо, для прода тримати `pg_dump` перед викоткою.

## 7. Монобанк на стейджі

Пісочниця відрізняється **тільки токеном** — `MONO_API_URL` той самий бойовий
`https://api.monobank.ua`. Обидва URL мають бути публічними https, інакше
вебхук не дійде і оплата зависне в `pending`:

```
MONO_WEBHOOK_URL=https://api.staging.…/webhooks/monobank
MONO_REDIRECT_URL=https://staging.…/ua/monobank/return
```

Перевірка після викотки — таблиця `monobank_webhook_log` наповнюється (туди
пишуться і ті вебхуки, що не пройшли підпис). Деталі інтеграції —
[apps/backend/src/lib/monobank/README.md](../apps/backend/src/lib/monobank/README.md).

## 8. Відома проблема: міграції в контейнері

**Перевірено локально (Docker Desktop, macOS/arm64):** `npx medusa db:migrate`
всередині контейнера зависає. Процес засинає в `epoll_wait`, міграції не
застосовуються, і Medusa обриває його власною перевіркою:

```
Could not connect to the database while running migrations.
The connection timed out after 10 seconds
```

Повідомлення оманливе — з базою все гаразд. Що виключено вимірюваннями:

| Підозра | Спростування |
| --- | --- |
| Недоступна БД | сирий `pg` з того ж контейнера — 37 мс, `knex` — 96 мс |
| SSL | у `createPgConnection` ssl за замовчуванням `false` |
| Redis | без `REDIS_URL` зависає так само |
| Стан БД | зависає і на чистій, і на вже мігрованій |
| Версія Node | 20 і 22 зависають однаково |
| Базовий образ | alpine (musl) і bookworm (glibc) — однаково |
| Артефакт збірки | той самий `.medusa/server` на хості відпрацьовує повністю (145 таблиць) |
| Батьківські `node_modules` | підмонтовані в контейнер — не допомогло |

Закономірність одна: **в Docker — завжди зависає, поза Docker — завжди
проходить.** Схоже на артефакт Docker Desktop на macOS, тому першою справою
варто просто спробувати на самому інстансі — там справжній Linux і справжній
Docker.

Якщо на сервері відтвориться, обхідний шлях: поставити Node 20 на сам інстанс,
склонувати репозиторій і прогнати міграції з хоста проти контейнерного
Postgres (тимчасово опублікувавши його порт на `127.0.0.1`). Сам застосунок у
контейнері працює нормально — перевірено, бекенд і сторфронт піднімаються
healthy на вже мігрованій базі.

Ліміт перевірки, до речі, налаштовується:
`MEDUSA_DB_MIGRATION_CONNECTION_TIMEOUT` (мілісекунди). Підняття не рятує —
процес просто висить довше.

## 9. Чого тут свідомо немає

- **бекапів** — для стейджа зайве, для прода мінімум `pg_dump` по крону в
  Object Storage (він теж у Always Free);
- **закриття стейджа від сторонніх** — basic auth у Caddy зламає вебхук
  монобанку, тому робити його треба вибірково, не на весь домен;
- **окремого воркера Medusa** — один інстанс тягне і API, і фонові джоби
  (`MEDUSA_WORKER_MODE` за замовчуванням `shared`). Розділяти є сенс, коли
  з'явиться друга машина.
