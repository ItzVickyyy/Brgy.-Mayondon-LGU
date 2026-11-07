from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import User, UserCreate, UserRole

engine = create_engine(str(settings.DATABASE_URL), pool_pre_ping=True)


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            role=UserRole.admin,
        )
        user = crud.create_user(session=session, user_create=user_in)

    if settings.FIRST_STAFF and settings.FIRST_STAFF_PASSWORD:
        staff = crud.get_user_by_email(session=session, email=settings.FIRST_STAFF)
        if not staff:
            staff_in = UserCreate(
                email=settings.FIRST_STAFF,
                password=settings.FIRST_STAFF_PASSWORD,
                role=UserRole.staff,
            )
            crud.create_user(session=session, user_create=staff_in)
