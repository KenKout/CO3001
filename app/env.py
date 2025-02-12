import os

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./studyspace.db")

# JWT Settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Email Settings (for future use)
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = os.getenv("SMTP_PORT")
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# Google OAuth Settings (for future use)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# Application Settings
APP_NAME = "Study Space Management System"
API_VERSION = "1.0"
