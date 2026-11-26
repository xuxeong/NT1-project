"""SQLAlchemy engine and session management (supports PostgreSQL and SQLite fallback)."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DATABASE_URL

Base = declarative_base()


def _build_engine(db_url: str):
    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    return create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)


engine = _build_engine(os.getenv("DATABASE_URL", DATABASE_URL))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db(target_engine=None) -> None:
    """Create all ORM tables if they do not exist."""
    from app.db import models  # noqa: F401
    bind_engine = target_engine or engine
    try:
        Base.metadata.create_all(bind=bind_engine)
    except Exception as exc:
        print(f"[DB Warning] 데이터베이스 초기화 실패 (인메모리 모드로 계속 동작): {exc}")


def get_db():
    """FastAPI Dependency for DB Session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
