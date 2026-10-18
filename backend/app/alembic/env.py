from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config
assert config.config_file_name is not None
fileConfig(config.config_file_name)

from app.core.config import settings  # noqa: E402
from app.models import SQLModel  # noqa: E402

target_metadata = SQLModel.metadata


def get_url() -> str:
    # Use the session pooler or direct URL for migrations when supplied.
    # Runtime Vercel connections may use the transaction pooler instead.
    return str(settings.MIGRATION_DATABASE_URL or settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations without creating a database connection."""
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations using a live database connection."""
    configuration = config.get_section(config.config_ini_section)
    assert configuration is not None
    configuration["sqlalchemy.url"] = get_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
