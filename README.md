# 🏭 Интерактивный дашборд мониторинга объектов критической инфраструктуры

Защищённое веб-приложение для централизованного мониторинга состояния объектов КИИ (ТЭЦ, подстанции, водозаборы и т.д.) с интерактивной картой, тревожной кнопкой, ролевой моделью и двухфакторной аутентификацией.

**🔗 Демо:** [https://217.71.129.139:5429](https://217.71.129.139:5429)  
**👤 Тестовый доступ:**  
- Логин: `admin`  
- Пароль: `AdminPass123!`

---

## ✨ Основные возможности

- **Интерактивная карта** (Leaflet + OpenStreetMap) с цветовыми маркерами объектов в зависимости от статуса (норма / тревога)
- **Тревожная кнопка** — оператор отправляет сигнал инженеру одним нажатием
- **Ролевая модель** — администратор, оператор, инженер, гость
- **Двухфакторная аутентификация (2FA)** — подтверждение по email (6-значный код)
- **Google reCAPTCHA v2** — защита формы регистрации от ботов
- **JWT-аутентификация** — токен с временем жизни 30 минут
- **Логирование действий** — полный журнал с IP-адресом и деталями, экспорт в PDF
- **Административная панель** — управление пользователями, заявками, объектами, логами
- **Графики и статистика** — инциденты по дням, распределение объектов по статусам, пользователи по ролям
- **HTTPS** — самоподписанный сертификат для шифрования канала
- **Резервное копирование** — автоматический `pg_dump` базы данных

---

## 🧱 Технологический стек

- **Бэкенд** — Python 3.11, FastAPI, SQLAlchemy 2.0 (ORM), PostgreSQL
- **Фронтенд** — HTML, TailwindCSS, JavaScript, Leaflet (карта), Chart.js (графики)
- **Аутентификация** — JWT, bcrypt, 2FA (SMTP), Google reCAPTCHA
- **Инфраструктура** — Docker, Docker Compose, Nginx (reverse-proxy), HTTPS (самоподписанный сертификат)
- **Контроль версий** — Git, GitHub

---

## 🗄️ Структура базы данных

- `users` — пользователи (логин, email, хеш пароля, роль, статус, привязка к объекту)
- `infrastructure_objects` — объекты КИИ (название, тип, координаты, статус)
- `incidents` — инциденты (объект, кто инициировал, кто решил, время)
- `logs` — журнал действий (пользователь, действие, детали JSON, IP, время)
- `email_verifications` — коды двухфакторной аутентификации

---

## 🚀 Быстрый старт (локально)

### 1. Клонирование репозитория

```bash  
git clone https://github.com/swag4cat/RGR_TMP.git
cd RGR_TMP
```

### 2. Настройка переменных окружения

Создай файл .env:

```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=strongpassword123
POSTGRES_DB=infra_db
DATABASE_URL=postgresql+asyncpg://admin:strongpassword123@postgres:5432/infra_db

SECRET_KEY=supersecretkeyforjwt12345

MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_FROM=your_email@gmail.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com

RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

### 3. Запуск через Docker Compose

```bash
docker-compose up -d --build
```

### 4. Создание администратора

```bash
docker exec -it infra-backend python
```

```python
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models import User, UserRole, UserStatus
from app.auth import get_password_hash
import os

DATABASE_URL = os.getenv("DATABASE_URL")

async def create_admin():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        admin = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("AdminPass123!"),
            role="admin",
            status="ACTIVE"
        )
        session.add(admin)
        await session.commit()
        print("Админ создан")

asyncio.run(create_admin())
```

### 5. Открыть сайт

```text
http://localhost:3000
```

---

## 📦 Запуск на сервере

```bash
# Клонирование
git clone https://github.com/swag4cat/RGR_TMP.git
cd RGR_TMP

# Настройка .env (замени на реальные данные)
nano .env

# Запуск
docker-compose up -d --build

# Проверка здоровья
curl http://localhost:8000/health
```

---

## 📁 Структура проекта

```text
RGR_TMP/
├── backend/
│   ├── app/
│   │   ├── routers/        # Эндпоинты (auth, objects, admin, users, logs, stats)
│   │   ├── models.py       # Модели SQLAlchemy
│   │   ├── schemas.py      # Pydantic-схемы
│   │   ├── auth.py         # JWT, bcrypt
│   │   ├── database.py     # Подключение к БД
│   │   └── utils/          # captcha.py, email.py, logger.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html          # Приветственная страница
│   ├── login.html          # Форма входа
│   ├── register.html       # Регистрация с капчей
│   ├── verify.html         # 2FA
│   ├── dashboard.html      # Основной дашборд
│   └── js/                 # app.js (логика фронтенда)
├── docker-compose.yml
├── .env
├── .gitignore
├── backup.sh
└── README.md
```

---

## 🔒 Безопасность

- **Аутентификация** — JWT-токен (30 минут)
- **Хранение паролей** — bcrypt
- **Двухфакторная аутентификация (2FA)** — код на email (SMTP)
- **Защита от ботов** — Google reCAPTCHA v2
- **Авторизация** — ролевая модель (admin, operator, engineer) с проверкой прав на каждом эндпоинте
- **Логирование** — таблица logs (просмотр, экспорт PDF)
- **Защита API** — JWT, валидация Pydantic, запрет доступа к чужим данным
- **Защита канала** — HTTPS (самоподписанный сертификат)
- **Резервное копирование** — pg_dump

---

## 👥 Роли пользователей

- **Гость (неавторизованный)** — Приветственная страница, регистрация с капчей и 2FA, логин
- **Оператор** — Видит только свой привязанный объект на карте, тревожная кнопка
- **Инженер** — Видит все объекты в статусе «Тревога», кнопка «Решено»
- **Администратор** — Полный доступ: управление объектами, пользователями, заявками, логами, графики, экспорт PDF

---

## 📊 API документация

После запуска приложения документация доступна по адресу:

```text
http://localhost:8000/docs
```

---

## 📄 Лицензия

Проект разработан в рамках расчётно-графического задания. Свободное использование не предполагается.
