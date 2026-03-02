import os
import re
import smtplib
from email.message import EmailMessage

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


def _clean_app_password(raw_password: str) -> str:
    # Gmail app passwords are 16 chars; users often store with spaces/dashes.
    return re.sub(r"[\s-]+", "", raw_password or "")


class ContactPayload(BaseModel):
    name: str
    email: str
    company: str | None = ""
    message: str


app = FastAPI(title="Mercity Contact Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4321",
        "http://127.0.0.1:4321",
        "https://mercity.ai",
        "https://www.mercity.ai",
        "http://5.78.43.33",
    ],
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/contact")
def send_contact_email(payload: ContactPayload) -> dict[str, str]:
    sender_email = os.getenv("GMAIL_SENDER_EMAIL", "prince9453125809@gmail.com").strip()
    receiver_email = os.getenv("CONTACT_RECEIVER_EMAIL", "pranav2278@gmail.com").strip()
    app_password = _clean_app_password(os.getenv("GMAIL_APP_PASSWORD", ""))

    if not app_password:
        raise HTTPException(status_code=500, detail="Missing GMAIL_APP_PASSWORD")

    if "@" not in payload.email:
        raise HTTPException(status_code=422, detail="Invalid sender email")

    name = payload.name.strip()
    email = payload.email.strip()
    company = (payload.company or "").strip()
    message = payload.message.strip()

    if not name or not message:
        raise HTTPException(status_code=422, detail="Name and message are required")

    subject = f"Mercity inquiry from {name}"
    if company:
        subject += f" ({company})"

    email_body = (
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Company: {company or 'N/A'}\n\n"
        f"Message:\n{message}\n"
    )

    mail = EmailMessage()
    mail["Subject"] = subject
    mail["From"] = sender_email
    mail["To"] = receiver_email
    mail["Reply-To"] = email
    mail.set_content(email_body)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(sender_email, app_password)
            smtp.send_message(mail)
    except smtplib.SMTPException as exc:
        raise HTTPException(status_code=502, detail=f"SMTP error: {exc}") from exc
    except OSError as exc:
        raise HTTPException(status_code=502, detail=f"Network error: {exc}") from exc

    return {"status": "sent"}
