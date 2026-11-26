"""Keep simulator database hooks isolated from developer databases in all tests."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import vehicles
from app.db import repository
from app.db.database import Base


@pytest.fixture(autouse=True)
def isolated_simulator_database(monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    logger = repository.DatabaseLogger(session_factory=sessionmaker(bind=engine))
    logger._initialized = True
    monkeypatch.setattr(repository, 'db_logger', logger)
    monkeypatch.setattr(vehicles, 'db_logger', logger)
    yield logger
    engine.dispose()
