import os
try:
    # pyrefly: ignore [missing-import]
    from dotenv import load_dotenv  # type: ignore
except ImportError:
    def load_dotenv(*args, **kwargs):
        pass

# Search and load .env from project root or backend folder
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))

env_path_root = os.path.join(ROOT_DIR, '.env')
env_path_backend = os.path.join(BASE_DIR, '.env')

if os.path.exists(env_path_root):
    load_dotenv(env_path_root, override=True)
if os.path.exists(env_path_backend):
    load_dotenv(env_path_backend, override=True)

def _csv_to_list(raw: str) -> list:
    """Convert a comma-separated string to a stripped list of values."""
    return [s.strip() for s in raw.split(',') if s.strip()]


class Config:
    BASE_DIR = BASE_DIR
    ROOT_DIR = ROOT_DIR

    # ── Secret Key ────────────────────────────────────────────────────────────
    # NEVER use the fallback in production. Set SECRET_KEY in your environment.
    SECRET_KEY = os.environ.get('SECRET_KEY', 'CHANGE_ME_IN_PRODUCTION_USE_SECRET_KEY_ENV')

    # ── Database Environment & Azure Configuration ────────────────────────────
    # Environment detection: Azure App Service sets WEBSITE_SITE_NAME
    IS_AZURE = bool(os.environ.get('WEBSITE_SITE_NAME'))
    IS_PRODUCTION = (os.environ.get('FLASK_ENV', '').lower() == 'production') or (os.environ.get('ENVIRONMENT', '').lower() == 'production') or IS_AZURE

    # Azure SQL / Microsoft SQL Server Configuration
    # Azure-specific variables take precedence; falls back to standard SQL_* variables
    SQL_SERVER = os.environ.get('AZURE_SQL_SERVER') or os.environ.get('SQL_SERVER')
    SQL_DATABASE = os.environ.get('AZURE_SQL_DATABASE') or os.environ.get('SQL_DATABASE', 'ODTRACKINGDB')
    SQL_DRIVER = os.environ.get('SQL_DRIVER')
    SQL_USER = os.environ.get('AZURE_SQL_USER') or os.environ.get('SQL_USER')
    SQL_PASSWORD = os.environ.get('AZURE_SQL_PASSWORD') or os.environ.get('SQL_PASSWORD')
    SQL_AUTH_TYPE = os.environ.get('AZURE_SQL_AUTH_TYPE') or os.environ.get('SQL_AUTH_TYPE', '')
    SQL_CLIENT_ID = os.environ.get('AZURE_SQL_CLIENT_ID') or os.environ.get('AZURE_CLIENT_ID')
    SQL_TRUSTED_CONNECTION = os.environ.get('SQL_TRUSTED_CONNECTION', '')
    SQL_TRUST_SERVER_CERTIFICATE = os.environ.get('SQL_TRUST_SERVER_CERTIFICATE', '')
    SQL_ENCRYPT = os.environ.get('SQL_ENCRYPT', '')
    SQL_TIMEOUT = int(os.environ.get('SQL_TIMEOUT', os.environ.get('SQL_CONNECT_TIMEOUT', 30)))

    # Direct database URL override (or generated from SQL Server / Azure SQL settings)
    SQLALCHEMY_DATABASE_URI = os.environ.get('AZURE_SQL_CONNECTIONSTRING') or os.environ.get('DATABASE_URL', '')

    # ── MongoDB Configuration (Preserved for migration & dual mode) ───────────
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://127.0.0.1:27017/od_tracking')
    MONGO_DB_NAME = os.environ.get('MONGO_DB_NAME', 'od_tracking')

    # ── Upload Directories ────────────────────────────────────────────────────
    # In Azure App Service, store under /home/uploads so files are visible in Kudu file manager and persisted
    if os.environ.get('UPLOAD_FOLDER'):
        UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER')
    elif IS_AZURE and os.path.exists('/home'):
        UPLOAD_FOLDER = '/home/uploads'
    else:
        UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))

    OD_LETTERS_FOLDER = os.path.join(UPLOAD_FOLDER, 'od_letters')
    CERTIFICATES_FOLDER = os.path.join(UPLOAD_FOLDER, 'certificates')

    # ── Azure Blob Storage Configuration ──────────────────────────────────────
    AZURE_STORAGE_ACCOUNT_NAME = os.environ.get('AZURE_STORAGE_ACCOUNT_NAME', 'odtrackerstorage')
    AZURE_STORAGE_CONNECTION_STRING = os.environ.get('AZURE_STORAGE_CONNECTION_STRING', '')
    AZURE_STORAGE_KEY = os.environ.get('AZURE_STORAGE_KEY', '')
    AZURE_BLOB_CONTAINER_OD_LETTERS = os.environ.get('AZURE_BLOB_CONTAINER_OD_LETTERS', 'odletters')
    AZURE_BLOB_CONTAINER_CERTIFICATES = os.environ.get('AZURE_BLOB_CONTAINER_CERTIFICATES', 'certificates')
    AZURE_BLOB_ENABLED = bool(os.environ.get('AZURE_STORAGE_CONNECTION_STRING') or os.environ.get('AZURE_STORAGE_ACCOUNT_NAME') or IS_AZURE)

    # ── Allowed File Extensions ───────────────────────────────────────────────
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'webp'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload

    # ── CORS Origins ──────────────────────────────────────────────────────────
    # In production, set CORS_ORIGINS env var to a comma-separated list of
    # your deployed frontend URL(s), e.g.:
    #   CORS_ORIGINS=https://od-tracker.vercel.app,https://www.yourdomain.com
    _raw_cors = os.environ.get('CORS_ORIGINS', '')
    if _raw_cors:
        CORS_ORIGINS = _csv_to_list(_raw_cors)
    else:
        # Development fallback origins
        CORS_ORIGINS = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    # ── Flask Session ─────────────────────────────────────────────────────────
    SESSION_COOKIE_SECURE = os.environ.get('FLASK_ENV', 'development') == 'production'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # ── Environment ───────────────────────────────────────────────────────────
    ENV = os.environ.get('FLASK_ENV', 'development')
    DEBUG = ENV == 'development'
    TESTING = False

    # ── Email / SMTP Configuration ────────────────────────────────────────────
    SMTP_HOST = os.environ.get('SMTP_HOST', '')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_EMAIL = os.environ.get('SMTP_EMAIL', os.environ.get('SMTP_USERNAME', ''))
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('SMTP_FROM_EMAIL', 'noreply@rajalakshmi.edu.in'))
    SMTP_USE_TLS = os.environ.get('SMTP_USE_TLS', 'true').lower() in ('true', '1', 'yes')
    APP_BASE_URL = os.environ.get('APP_BASE_URL', 'http://localhost:5173')

    # ── Resend REST API Configuration ─────────────────────────────────────────
    RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
    RESEND_FROM_EMAIL = os.environ.get('RESEND_FROM_EMAIL', os.environ.get('RESEND_SENDER_EMAIL', os.environ.get('MAIL_DEFAULT_SENDER', 'onboarding@resend.dev')))
    RESEND_FROM_NAME = os.environ.get('RESEND_FROM_NAME', os.environ.get('RESEND_SENDER_NAME', 'OD Tracking Application'))

