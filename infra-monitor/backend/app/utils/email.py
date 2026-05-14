import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from dotenv import load_dotenv

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_verification_email(email_to: str, code: str):
    message = MessageSchema(
        subject="Подтверждение регистрации - Инфра Монитор",
        recipients=[email_to],
        body=f"""
        <h2>Добро пожаловать в Инфра Монитор!</h2>
        <p>Ваш код подтверждения: <b>{code}</b></p>
        <p>Этот код действителен в течение 10 минут.</p>
        <p>Если вы не регистрировались, просто проигнорируйте это письмо.</p>
        <hr>
        <p>Инфра Монитор - Система мониторинга КИИ</p>
        """,
        subtype="html"
    )
    fm = FastMail(conf)
    await fm.send_message(message)
