"""SQLAlchemy engine and session management (supports PostgreSQL and SQLite fallback)."""
import os
from sqlalchemy import create_engine, inspect, text
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
        # create_all은 기존 테이블에 컬럼을 추가하지 않으므로 비파괴적 확장을 적용합니다.
        with bind_engine.begin() as connection:
            vehicle_columns = {column['name'] for column in inspect(connection).get_columns('vehicles')}
            if 'fault_reported_at_ms' not in vehicle_columns:
                if connection.dialect.name == 'postgresql':
                    connection.execute(text('ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fault_reported_at_ms BIGINT'))
                else:
                    connection.execute(text('ALTER TABLE vehicles ADD COLUMN fault_reported_at_ms BIGINT'))
            columns = {column['name'] for column in inspect(connection).get_columns('vehicle_event_logs')}
            if 'task_id' not in columns:
                if connection.dialect.name == 'postgresql':
                    connection.execute(text('ALTER TABLE vehicle_event_logs ADD COLUMN IF NOT EXISTS task_id VARCHAR(64)'))
                else:
                    connection.execute(text('ALTER TABLE vehicle_event_logs ADD COLUMN task_id VARCHAR(64)'))
            for index in models.VehicleEventRecord.__table__.indexes:
                if any(column.name == 'task_id' for column in index.columns):
                    index.create(bind=connection, checkfirst=True)
    except Exception as exc:
        print(f"[DB Warning] 데이터베이스 초기화 실패 (인메모리 모드로 계속 동작): {exc}")


def get_db():
    """FastAPI Dependency for DB Session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
