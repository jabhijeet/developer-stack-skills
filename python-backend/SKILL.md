---
name: python-backend
description: >
  Use this skill for any Python backend task. Covers FastAPI and Django application
  structure, Pydantic models, async patterns, dependency injection, database access
  with SQLAlchemy, pytest testing conventions, and packaging with pip/uv. Trigger when
  the user asks to create, review, debug, or refactor Python APIs, background workers,
  data pipelines, or CLI tools.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-05-15
applies-to: Python, FastAPI, Django, SQLAlchemy, background workers, CLI tools, testing
---

# Python Backend Skill

## When to Use This Skill

Load this skill whenever the task involves:
- Creating or modifying FastAPI or Django applications
- Writing Pydantic models or schema validation
- Async/await patterns in Python
- SQLAlchemy ORM models and queries
- Writing pytest tests (unit and integration)
- Structuring Python packages and managing dependencies
- Background tasks, workers, or CLI tools in Python

## Priority Order

1. Follow existing repo layout, tooling, and dependency management first
2. Use this skill's defaults only when repo does not define pattern
3. If loaded project conventions differ, prefer repo-established pattern and keep changes consistent

## Output Contract

- State assumptions when repo context is missing
- List files changed when making edits
- Add or update tests for behavior changes
- Avoid unrelated refactors unless they are required to complete task safely
- Call out blockers, risks, and follow-up work explicitly

## Conflict Resolution

Use this precedence order when instructions conflict:
1. Existing repo code and enforced automation
2. Repo docs and local agent instructions
3. Loaded `project-conventions/SKILL.md`
4. This stack skill
5. Generic framework best practices

---

## Project Structure Convention

### FastAPI Project
```
project/
├── app/
│   ├── main.py               # FastAPI app instance, router includes, lifespan
│   ├── api/
│   │   └── v1/
│   │       ├── router.py     # Aggregates all v1 routers
│   │       └── endpoints/    # One file per resource (users.py, items.py)
│   ├── core/
│   │   ├── config.py         # Settings via pydantic-settings
│   │   └── dependencies.py   # Shared FastAPI dependencies
│   ├── models/               # SQLAlchemy ORM models
│   ├── schemas/              # Pydantic request/response schemas
│   ├── services/             # Business logic layer
│   ├── repositories/         # Data access layer (DB queries)
│   └── exceptions/           # Custom exceptions + handlers
├── tests/
│   ├── conftest.py           # Fixtures (TestClient, DB session)
│   ├── unit/
│   └── integration/
├── pyproject.toml            # Project metadata + deps
└── .env                      # Environment variables (never commit)
```

### Django Project
```
project/
├── manage.py
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── local.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   └── users/
│       ├── models.py
│       ├── views.py          # ViewSets (DRF)
│       ├── serializers.py
│       ├── urls.py
│       └── tests/
├── requirements/
│   ├── base.txt
│   ├── local.txt
│   └── production.txt
```

---

## FastAPI Patterns

### Application Entry Point
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.v1.router import api_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api/v1")
```

### Settings Management (pydantic-settings)
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    PROJECT_NAME: str = "My API"
    DATABASE_URL: str
    SECRET_KEY: str
    DEBUG: bool = False


settings = Settings()
```

### Router + Endpoint Pattern
```python
# app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import UserService
from app.core.dependencies import get_user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    return await service.create(payload)
```

---

## Pydantic Schema Design

```python
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}  # ORM mode (Pydantic v2)
```

---

## SQLAlchemy ORM

### Model Definition
```python
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

### Async Session Pattern
```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

### Repository Pattern
```python
class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
```

---

## Exception Handling

```python
from fastapi import Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


class ResourceNotFoundException(AppException):
    def __init__(self, resource: str, resource_id: int):
        super().__init__(f"{resource} not found with id: {resource_id}", status_code=404)


# Register in main.py
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )
```

---

## Async Patterns

- Use `async def` for all FastAPI endpoint functions
- Use `await` for all I/O — DB queries, HTTP calls, file reads
- Use `asyncio.gather()` for concurrent independent operations
- Never mix sync blocking calls inside async functions; use `run_in_executor` if needed

```python
import asyncio

async def fetch_user_with_profile(user_id: int):
    user, profile = await asyncio.gather(
        user_repo.get_by_id(user_id),
        profile_repo.get_by_user_id(user_id),
    )
    return user, profile
```

---

## Testing with pytest

### conftest.py
```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
```

### Unit Test (Service)
```python
import pytest
from unittest.mock import AsyncMock
from app.services.user_service import UserService


@pytest.mark.asyncio
async def test_get_user_not_found():
    repo = AsyncMock()
    repo.get_by_id.return_value = None
    service = UserService(repo)

    result = await service.get_by_id(999)
    assert result is None
```

### Integration Test (API)
```python
@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post("/api/v1/users/", json={
        "name": "Alice",
        "email": "alice@example.com",
        "password": "securepass",
    })
    assert response.status_code == 201
    assert response.json()["email"] == "alice@example.com"
```

---

## Dependency Management

### pyproject.toml (recommended)
```toml
[project]
name = "my-project"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy>=2.0",
    "pydantic-settings>=2.0",
    "asyncpg>=0.29",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
    "ruff>=0.4",
    "mypy>=1.10",
]
```

### Using uv (recommended over pip)
```bash
uv venv
uv pip install -e ".[dev]"
uv run pytest
```

---

## Non-Negotiable Rules

- **Never** hardcode secrets — always use environment variables via `pydantic-settings`
- **Never** return raw ORM models from endpoints — always use Pydantic response schemas
- **Never** use mutable default arguments: `def f(items=[])` — use `None` and check inside
- **Always** use `async def` + `await` for all I/O in FastAPI
- **Always** type-annotate all function signatures and return types
- **Always** handle `None` explicitly — never assume a DB query returns a result
- Use `ruff` for linting and formatting (replaces flake8 + black + isort)
- Use `mypy` for static type checking in CI

---

## VSCode Tips

- Install **Python** + **Pylance** extensions for full IntelliSense
- Install **Ruff** extension for real-time linting and auto-fix on save
- Use `"python.defaultInterpreterPath"` pointing to your `uv` venv
- Use **REST Client** extension (`.http` files) for in-editor API testing
- Enable `"editor.formatOnSave": true` with Ruff as the formatter
