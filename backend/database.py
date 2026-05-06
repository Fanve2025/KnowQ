import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text, inspect
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{BASE_DIR / 'knowq.db'}"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _migrate(conn)
    print("数据库初始化完成")


async def _migrate(conn):
    from models import SystemSettings, SearchConfig

    def _table_exists(sync_conn, table_name):
        inspector = inspect(sync_conn)
        return table_name in inspector.get_table_names()

    def _column_exists(sync_conn, table_name, column_name):
        inspector = inspect(sync_conn)
        if table_name not in inspector.get_table_names():
            return False
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        return column_name in columns

    def _do_migrate(sync_conn):
        if not _table_exists(sync_conn, SystemSettings.__tablename__):
            SystemSettings.__table__.create(sync_conn, checkfirst=True)

        if _table_exists(sync_conn, SearchConfig.__tablename__):
            if not _column_exists(sync_conn, SearchConfig.__tablename__, 'endpoint'):
                sync_conn.execute(text('ALTER TABLE search_configs ADD COLUMN endpoint VARCHAR(500)'))
            if not _column_exists(sync_conn, SearchConfig.__tablename__, 'cx'):
                sync_conn.execute(text('ALTER TABLE search_configs ADD COLUMN cx VARCHAR(200)'))

    await conn.run_sync(_do_migrate)
