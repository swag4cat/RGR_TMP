import httpx
import os

async def verify_recaptcha(token: str) -> bool:
    """
    Проверяет Google reCAPTCHA токен.
    Возвращает True, если капча пройдена.
    """
    secret_key = os.getenv("RECAPTCHA_SECRET_KEY")
    
    if not secret_key:
        print("WARNING: RECAPTCHA_SECRET_KEY not set, skipping verification")
        return True  # Для разработки — пропускаем, если нет ключа
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={
                "secret": secret_key,
                "response": token
            }
        )
        result = response.json()
        return result.get("success", False)
