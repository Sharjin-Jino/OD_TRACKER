"""
Microsoft SQL Server & Azure SQL Database Connection and Session Management.
Supports:
1. Local SQL Server via Windows Authentication or SQL Authentication.
2. Azure SQL Database in Azure App Service via Managed Identity (preferred)
   or SQL Authentication (fallback).
Ensures safe environment isolation, strict production validation (no silent fallback
to localhost), credential masking, and robust connection pooling.
"""
import os
import sys
import re
import urllib.parse
from contextlib import contextmanager
from typing import Any, Dict, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session, DeclarativeBase
from sqlalchemy.pool import QueuePool

# Ensure project root is in sys.path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from backend.config import Config
except ImportError:
    from config import Config


class Base(DeclarativeBase):
    pass


def mask_credentials(text_str: Any) -> str:
    """
    Sanitize text or connection strings by masking sensitive credentials,
    passwords, and tokens so they are never printed in logs or API responses.
    """
    if not text_str:
        return ""
    s = str(text_str)
    # Mask PWD=... or Password=...
    s = re.sub(r'(PWD|pwd|Password|password)\s*=\s*([^;]+)', r'\1=***', s)
    # Mask URL passwords: ://user:password@
    s = re.sub(r'://([^:]+):([^@]+)@', r'://\1:***@', s)
    # Mask client secrets or access tokens
    s = re.sub(r'(client_secret|access_token|token)\s*=\s*([^;&\s]+)', r'\1=***', s, flags=re.IGNORECASE)
    # Mask Bearer tokens
    s = re.sub(r'Bearer\s+[A-Za-z0-9\-_\.]+', 'Bearer ***', s)
    return s


def is_production_environment() -> bool:
    """
    Detect whether the application is running in production or Azure App Service.
    Azure App Service automatically injects WEBSITE_SITE_NAME.
    """
    if os.environ.get("WEBSITE_SITE_NAME"):
        return True
    flask_env = os.environ.get("FLASK_ENV", "").lower().strip()
    if flask_env == "production":
        return True
    app_env = os.environ.get("ENVIRONMENT", "").lower().strip()
    if app_env == "production":
        return True
    if os.environ.get("AZURE_SQL_SERVER"):
        return True
    return False


def get_preferred_odbc_driver() -> str:
    """Return best available installed ODBC driver for SQL Server."""
    try:
        import pyodbc
        available = pyodbc.drivers()
        for preferred in [
            "ODBC Driver 18 for SQL Server",
            "ODBC Driver 17 for SQL Server",
            "SQL Server",
        ]:
            if preferred in available:
                return preferred
    except Exception:
        pass
    return "ODBC Driver 18 for SQL Server"


def build_sql_server_url() -> str:
    """
    Construct a valid SQLAlchemy connection URL for Microsoft SQL Server or Azure SQL Database.
    Strictly differentiates between local development and production (Azure App Service):
    - In production: mandates Azure SQL server, prevents silent fallback to local instances,
      enforces TLS encryption, and supports Managed Identity or SQL Authentication.
    - In local development: reads local instance and configuration from environment / local .env.
    """
    is_prod = is_production_environment()

    raw_url = (
        os.environ.get("AZURE_SQL_CONNECTIONSTRING")
        or os.environ.get("DATABASE_URL")
        or os.environ.get("SQL_DATABASE_URI")
        or getattr(Config, "SQLALCHEMY_DATABASE_URI", None)
    )

    if raw_url and not str(raw_url).startswith("sqlite"):
        raw_str = str(raw_url).strip()
        if is_prod:
            # Validate raw URL in production does not point to localhost
            raw_lower = raw_str.lower()
            if "localhost" in raw_lower or "127.0.0.1" in raw_lower or "desktop-" in raw_lower:
                raise ValueError(
                    "Production environment detected, but DATABASE_URL points to a local SQL Server instance. "
                    "Silent fallback to local databases in production is forbidden."
                )
        if raw_str.startswith("mssql+"):
            return raw_str
        if raw_str.startswith("mssql://"):
            return raw_str.replace("mssql://", "mssql+pyodbc://", 1)

    # Resolve server and database from environment (AZURE_SQL_* takes precedence in production)
    if is_prod:
        server = (os.environ.get("AZURE_SQL_SERVER") or os.environ.get("SQL_SERVER") or "").strip() or None
        database = (os.environ.get("AZURE_SQL_DATABASE") or os.environ.get("SQL_DATABASE") or "").strip() or "ODTRACKINGDB"
    else:
        server = (os.environ.get("SQL_SERVER") or getattr(Config, "SQL_SERVER", "") or "").strip() or None
        database = (os.environ.get("SQL_DATABASE") or getattr(Config, "SQL_DATABASE", "") or "").strip() or "ODTRACKINGDB"

    # ── Strict Production Environment Guards ─────────────────────────────────
    if is_prod:
        if not server:
            raise ValueError(
                "Production / Azure App Service environment detected, but database server is not configured. "
                "Please configure AZURE_SQL_SERVER (e.g. 'yourserver.database.windows.net') and "
                "AZURE_SQL_DATABASE in Azure App Service Configuration (Application Settings)."
            )
        server_clean = server.lower().strip()
        if (
            server_clean in ("localhost", "127.0.0.1", ".")
            or "desktop-" in server_clean
            or ("\\" in server and not server_clean.endswith(".database.windows.net"))
        ):
            raise ValueError(
                f"Production environment detected, but database server '{server}' appears to be a local instance. "
                "Silent fallback to local databases in production is forbidden. "
                "Please configure your Azure SQL Database server hostname (e.g. yourserver.database.windows.net)."
            )
    else:
        # Local development check
        if not server:
            raise ValueError(
                "Database configuration missing: SQL_SERVER is not set. "
                "Please set SQL_SERVER (e.g. SQL_SERVER=localhost or your local SQL Server instance) in your .env file."
            )

    driver = (
        os.environ.get("SQL_DRIVER")
        or getattr(Config, "SQL_DRIVER", None)
        or get_preferred_odbc_driver()
    )

    is_azure = is_prod or (".database.windows.net" in server.lower())

    # Format server endpoint for Azure SQL (standard port 1433 over TCP)
    if is_azure and not server.startswith("tcp:") and not server.startswith("np:"):
        if ",1433" not in server and ":" not in server:
            server_endpoint = f"tcp:{server},1433"
        else:
            server_endpoint = f"tcp:{server}"
    else:
        server_endpoint = server

    user = (
        os.environ.get("AZURE_SQL_USER")
        or os.environ.get("SQL_USER")
        or getattr(Config, "SQL_USER", None)
    )
    password = (
        os.environ.get("AZURE_SQL_PASSWORD")
        or os.environ.get("SQL_PASSWORD")
        or getattr(Config, "SQL_PASSWORD", None)
    )

    auth_type = (
        os.environ.get("AZURE_SQL_AUTH_TYPE")
        or os.environ.get("SQL_AUTH_TYPE")
        or getattr(Config, "SQL_AUTH_TYPE", "")
    ).lower().strip()

    # Encryption and certificate trust settings
    if is_azure:
        # Azure SQL Database mandates encryption and uses valid Microsoft public CA certificates
        azure_encrypt_val = os.environ.get("AZURE_SQL_ENCRYPT")
        if azure_encrypt_val is not None:
            encrypt = azure_encrypt_val.lower().strip() in ("1", "true", "yes")
        elif is_prod:
            encrypt = True
        else:
            encrypt = os.environ.get("SQL_ENCRYPT", "yes").lower().strip() in ("1", "true", "yes")

        azure_trust_cert_val = os.environ.get("AZURE_SQL_TRUST_SERVER_CERTIFICATE")
        if azure_trust_cert_val is not None:
            trust_cert = azure_trust_cert_val.lower().strip() in ("1", "true", "yes")
        elif is_prod:
            trust_cert = False
        else:
            trust_cert = os.environ.get("SQL_TRUST_SERVER_CERTIFICATE", "no").lower().strip() in ("1", "true", "yes")
    else:
        # Local SQL Server defaults (Windows Authentication, local certificate)
        encrypt = (
            os.environ.get("SQL_ENCRYPT", "no")
            .lower()
            .strip() in ("1", "true", "yes")
        )
        trust_cert = (
            os.environ.get("SQL_TRUST_SERVER_CERTIFICATE", "yes")
            .lower()
            .strip() in ("1", "true", "yes")
        )

    trusted = (
        os.environ.get("SQL_TRUSTED_CONNECTION", "")
        .lower()
        .strip()
    )
    timeout = str(
        os.environ.get("SQL_TIMEOUT")
        or os.environ.get("SQL_CONNECT_TIMEOUT")
        or getattr(Config, "SQL_TIMEOUT", 30)
    )

    odbc_parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server_endpoint}",
        f"DATABASE={database}",
    ]

    # ── Authentication Strategy ───────────────────────────────────────────────
    if is_azure:
        # Azure SQL Database: Managed Identity, Microsoft Entra ID, or SQL Authentication
        if is_prod and auth_type not in ("interactive", "sql", "entra_password"):
            # Azure App Service System-Assigned or User-Assigned Managed Identity
            odbc_parts.append("Authentication=ActiveDirectoryMsi")
            client_id = (
                os.environ.get("AZURE_SQL_CLIENT_ID")
                or os.environ.get("AZURE_CLIENT_ID")
                or getattr(Config, "SQL_CLIENT_ID", None)
            )
            if client_id:
                odbc_parts.append(f"UID={client_id.strip()}")

        elif auth_type in ("msi", "managed_identity") or (not user and not password and auth_type not in ("interactive", "mfa")):
            odbc_parts.append("Authentication=ActiveDirectoryMsi")
            client_id = (
                os.environ.get("AZURE_SQL_CLIENT_ID")
                or os.environ.get("AZURE_CLIENT_ID")
                or getattr(Config, "SQL_CLIENT_ID", None)
            )
            if client_id:
                odbc_parts.append(f"UID={client_id.strip()}")

        elif auth_type in ("interactive", "activedirectoryinteractive", "mfa"):
            # Microsoft Entra Interactive (Browser login / MFA prompt)
            odbc_parts.append("Authentication=ActiveDirectoryInteractive")
            if user:
                odbc_parts.append(f"UID={user}")

        elif auth_type in ("entra_password", "activedirectorypassword", "entra", "aad") or (user and "@" in user and auth_type != "sql"):
            # Microsoft Entra Password (organizational email account e.g. user@institution.edu.in)
            odbc_parts.append("Authentication=ActiveDirectoryPassword")
            odbc_parts.append(f"UID={user}")
            if password:
                odbc_parts.append(f"PWD={password}")
            else:
                raise ValueError("Microsoft Entra Password authentication requires SQL_PASSWORD to be provided.")

        else:
            # Azure SQL Authentication (standard database login e.g. sqladmin)
            if not user or not password:
                raise ValueError(
                    "Azure SQL Authentication requires both AZURE_SQL_USER (or SQL_USER) and "
                    "AZURE_SQL_PASSWORD (or SQL_PASSWORD) to be set in environment."
                )
            odbc_parts.append(f"UID={user}")
            odbc_parts.append(f"PWD={password}")
    else:
        # Local SQL Server: Windows Authentication or SQL Authentication
        use_windows_auth = False
        if trusted in ("1", "true", "yes"):
            use_windows_auth = True
        elif not user and not password:
            use_windows_auth = True

        if use_windows_auth:
            odbc_parts.append("Trusted_Connection=yes")
        else:
            if user:
                odbc_parts.append(f"UID={user}")
            if password:
                odbc_parts.append(f"PWD={password}")

    # Security connection attributes
    odbc_parts.append("Encrypt=yes" if encrypt else "Encrypt=no")
    odbc_parts.append("TrustServerCertificate=yes" if trust_cert else "TrustServerCertificate=no")
    odbc_parts.append(f"Connection Timeout={timeout}")

    odbc_str = ";".join(odbc_parts) + ";"
    encoded_params = urllib.parse.quote_plus(odbc_str)
    return f"mssql+pyodbc:///?odbc_connect={encoded_params}"


class SQLServerDB:
    _engine = None
    _session_factory = None
    _is_connected = False
    _connection_error = None
    _server_name = None
    _database_name = None
    _driver_name = None
    _auth_mode = "unknown"
    _is_azure = False

    @classmethod
    def connect(cls):
        """Initialize and verify SQLAlchemy engine connected to Microsoft SQL Server / Azure SQL."""
        if cls._is_connected and cls._engine is not None:
            return cls._engine

        try:
            db_url = build_sql_server_url()
            cls._driver_name = get_preferred_odbc_driver()

            server_var = (
                os.environ.get("AZURE_SQL_SERVER")
                or os.environ.get("SQL_SERVER")
                or getattr(Config, "SQL_SERVER", None)
                or "configured-server"
            )
            cls._server_name = server_var
            cls._is_azure = is_production_environment() or (".database.windows.net" in str(server_var).lower())

            # Detect auth mode for diagnostics
            auth_type_var = (
                os.environ.get("AZURE_SQL_AUTH_TYPE")
                or os.environ.get("SQL_AUTH_TYPE", "")
            ).lower()
            user_var = os.environ.get("AZURE_SQL_USER") or os.environ.get("SQL_USER")

            if cls._is_azure:
                if auth_type_var in ("msi", "managed_identity") or not user_var:
                    cls._auth_mode = "managed_identity"
                elif auth_type_var in ("interactive", "mfa"):
                    cls._auth_mode = "entra_interactive"
                elif auth_type_var in ("entra_password", "entra", "aad") or (user_var and "@" in user_var and auth_type_var != "sql"):
                    cls._auth_mode = "entra_password"
                else:
                    cls._auth_mode = "sql_authentication"
            else:
                trusted_var = os.environ.get("SQL_TRUSTED_CONNECTION", "").lower()
                if trusted_var in ("1", "true", "yes") or not user_var:
                    cls._auth_mode = "windows_authentication"
                else:
                    cls._auth_mode = "sql_authentication"

            engine_kwargs = {
                "poolclass": QueuePool,
                "pool_pre_ping": True,       # Validates connection health before checkout
                "pool_recycle": 300,         # Recycles idle connections every 5 minutes
                "pool_size": 10,             # Stable connection pool size
                "max_overflow": 20,          # Accommodates concurrent burst requests
                "pool_timeout": 30,          # Connection checkout timeout
                "echo": False,
            }

            cls._engine = create_engine(db_url, **engine_kwargs)

            # Test connection immediately with lightweight query
            with cls._engine.connect() as conn:
                row = conn.execute(
                    text("SELECT @@VERSION AS ver, DB_NAME() AS current_db")
                ).fetchone()
                cls._database_name = row.current_db if row else (
                    os.environ.get("AZURE_SQL_DATABASE")
                    or os.environ.get("SQL_DATABASE")
                    or "ODTRACKINGDB"
                )

            cls._session_factory = scoped_session(
                sessionmaker(
                    bind=cls._engine,
                    autocommit=False,
                    autoflush=False,
                    expire_on_commit=False,
                )
            )
            cls._is_connected = True
            cls._connection_error = None

            db_label = "Azure SQL Database" if cls._is_azure else "Microsoft SQL Server"
            print(
                f"[+] {db_label} connected: Database '{cls._database_name}' on '{cls._server_name}' (Auth: {cls._auth_mode})"
            )
            return cls._engine

        except Exception as e:
            safe_err = mask_credentials(str(e))
            db_label = "Azure SQL Database" if cls._is_azure else "Microsoft SQL Server"
            print(f"[-] {db_label} connection failed: {safe_err}")

            # In local development: if Azure SQL fails (e.g. Entra ID MFA prevents password grant),
            # safely attempt connection to the local development SQL Server instance (ODTRACKINGDB)
            if not is_production_environment():
                local_candidates = [
                    os.environ.get("LOCAL_SQL_SERVER"),
                    r"DESKTOP-OTLUI9C\MSSQLSERVER02",
                    "localhost",
                    "127.0.0.1",
                    "."
                ]
                # Filter out None, empty, and remote Azure endpoints from local candidates
                local_servers = [
                    s for s in local_candidates 
                    if s and ".database.windows.net" not in s.lower()
                ]
                local_db = (
                    os.environ.get("LOCAL_SQL_DATABASE")
                    or "ODTRACKINGDB"
                )
                driver = cls._driver_name or get_preferred_odbc_driver()
                for srv in local_servers:
                    try:
                        local_odbc = (
                            f"DRIVER={{{driver}}};"
                            f"SERVER={srv};"
                            f"DATABASE={local_db};"
                            f"Trusted_Connection=yes;"
                            f"Encrypt=no;"
                            f"TrustServerCertificate=yes;"
                            f"Connection Timeout=3;"
                        )
                        local_url = f"mssql+pyodbc:///?odbc_connect={urllib.parse.quote_plus(local_odbc)}"
                        fallback_engine = create_engine(local_url, poolclass=QueuePool, pool_pre_ping=True)
                        with fallback_engine.connect() as conn:
                            row = conn.execute(text("SELECT DB_NAME() AS current_db")).fetchone()
                            cls._database_name = row.current_db if row else local_db

                        cls._engine = fallback_engine
                        cls._session_factory = scoped_session(
                            sessionmaker(
                                bind=cls._engine,
                                autocommit=False,
                                autoflush=False,
                                expire_on_commit=False,
                            )
                        )
                        cls._is_connected = True
                        cls._connection_error = None
                        cls._is_azure = False
                        cls._server_name = srv
                        cls._auth_mode = "windows_authentication"
                        print(
                            f"[!] Local Development Fallback: Connected to Microsoft SQL Server '{cls._database_name}' on '{srv}'."
                        )
                        return cls._engine
                    except Exception:
                        continue

            cls._is_connected = False
            cls._connection_error = safe_err
            return None

    @classmethod
    def ping(cls) -> bool:
        """Execute a quick lightweight ping query to verify live connection."""
        if cls._engine is None:
            cls.connect()
        if cls._engine is None:
            return False
        try:
            with cls._engine.connect() as conn:
                conn.execute(text("SELECT 1")).scalar()
            return True
        except Exception:
            return False

    @classmethod
    def get_engine(cls):
        if cls._engine is None:
            cls.connect()
        return cls._engine

    @classmethod
    def get_session(cls):
        if cls._session_factory is None:
            cls.connect()
        if cls._session_factory is None:
            raise RuntimeError(
                f"SQL database session factory not initialized: {cls._connection_error}"
            )
        return cls._session_factory()

    @classmethod
    def close_session(cls):
        if cls._session_factory:
            cls._session_factory.remove()

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Diagnostic status for health check endpoint without exposing sensitive credentials."""
        is_prod = is_production_environment()
        db_type = "Azure SQL Database" if cls._is_azure else "Microsoft SQL Server"

        return {
            "status": "connected" if cls._is_connected else "disconnected",
            "type": db_type,
            "connected": cls._is_connected,
            "server": cls._server_name,
            "database_name": cls._database_name,
            "auth_type": cls._auth_mode,
            "driver": cls._driver_name or get_preferred_odbc_driver(),
            "environment": "production" if is_prod else "development",
            "error": cls._connection_error,
        }


@contextmanager
def session_scope():
    """
    Transactional session scope context manager.
    Automatically commits on normal exit, rolls back on exception,
    and always closes the session.
    """
    session = SQLServerDB.get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_session():
    """Return a database session. Caller must close or use in a context."""
    return SQLServerDB.get_session()


def init_db():
    """Initialize SQL Server / Azure SQL database engine and connection."""
    return SQLServerDB.connect()


# Module-level convenience aliases
engine = property(lambda: SQLServerDB.get_engine())
SessionLocal = SQLServerDB.get_session
