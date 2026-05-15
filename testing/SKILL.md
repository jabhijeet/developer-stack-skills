---
name: testing
description: >
  Use this skill for any software testing task. Covers unit, integration, and E2E
  testing strategies across the full stack: JUnit/Mockito for Java/Spring, pytest for
  Python/FastAPI, Vitest/React Testing Library for React, Jasmine/Karma for Angular, and
  Playwright for cross-browser E2E. Trigger when the user asks to write, review, debug,
  or structure tests for any layer of the application.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-05-15
applies-to: Unit tests, integration tests, E2E tests, test reviews, test debugging
---

# Testing Skill (Java · Python · React · Angular)

## When to Use This Skill

Load this skill whenever the task involves:
- Writing unit tests for any language or framework in the stack
- Writing integration tests for APIs or database layers
- Writing E2E tests with Playwright or Cypress
- Reviewing test coverage or test quality
- Structuring test files, fixtures, or test data
- Mocking external dependencies (HTTP, DB, services)
- Debugging failing tests

## Priority Order

1. Follow repo's existing test runner and patterns first
2. For new TypeScript frontend projects, default to `Vitest` + Testing Library
3. If repo already uses Jest or another runner, stay with repo choice

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

## Testing Philosophy

| Principle                  | Rule                                                              |
|----------------------------|-------------------------------------------------------------------|
| Test behavior, not implementation | Assert what the code does, not how it does it            |
| AAA structure              | Arrange → Act → Assert, clearly separated in every test           |
| One logical focus per test | Each test verifies one behavior                                   |
| Meaningful names           | `method_WhenCondition_ExpectedResult` or `should_do_X_when_Y`    |
| No test interdependence    | Tests must be runnable in any order, independently                |
| Fast by default            | Unit tests must run in milliseconds; slow tests are integration/E2E |
| Tests are documentation    | A new developer should understand the system by reading tests     |

---

## Java — JUnit 5 + Mockito

### Unit Test — Service Layer
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserMapper userMapper;
    @InjectMocks private UserService userService;

    private User user;
    private UserResponse userResponse;

    @BeforeEach
    void setUp() {
        user = new User(1L, "Alice", "alice@example.com");
        userResponse = new UserResponse(1L, "Alice", "alice@example.com");
    }

    @Test
    void findById_WhenUserExists_ReturnsUserResponse() {
        // Arrange
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userMapper.toResponse(user)).thenReturn(userResponse);

        // Act
        UserResponse result = userService.findById(1L);

        // Assert
        assertThat(result.name()).isEqualTo("Alice");
        verify(userRepository, times(1)).findById(1L);
    }

    @Test
    void findById_WhenNotFound_ThrowsResourceNotFoundException() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.findById(99L))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("99");
    }
}
```

### Integration Test — Controller (MockMvc)
```java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean  private UserService userService;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void getUser_WhenExists_Returns200WithBody() throws Exception {
        when(userService.findById(1L))
            .thenReturn(new UserResponse(1L, "Alice", "alice@example.com"));

        mockMvc.perform(get("/api/v1/users/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Alice"));
    }

    @Test
    void createUser_WhenInvalidPayload_Returns400() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\",\"email\":\"not-an-email\"}"))
            .andExpect(status().isBadRequest());
    }
}
```

### Integration Test — Repository (Testcontainers)
```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired private UserRepository userRepository;

    @Test
    void findByEmail_WhenExists_ReturnsUser() {
        userRepository.save(new User(null, "Alice", "alice@example.com"));

        Optional<User> result = userRepository.findByEmail("alice@example.com");

        assertThat(result).isPresent();
        assertThat(result.get().getName()).isEqualTo("Alice");
    }
}
```

---

## Python — pytest

### conftest.py
```python
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.core.dependencies import get_db
from app.models import Base

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(engine):
    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
    async with AsyncSession() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

### Unit Test — Service
```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.user_service import UserService
from app.exceptions import ResourceNotFoundException


@pytest.mark.asyncio
async def test_get_user_returns_user_when_found():
    mock_repo = AsyncMock()
    mock_repo.get_by_id.return_value = MagicMock(id=1, name="Alice")
    service = UserService(mock_repo)

    result = await service.get_by_id(1)

    assert result.name == "Alice"
    mock_repo.get_by_id.assert_called_once_with(1)


@pytest.mark.asyncio
async def test_get_user_raises_when_not_found():
    mock_repo = AsyncMock()
    mock_repo.get_by_id.return_value = None
    service = UserService(mock_repo)

    with pytest.raises(ResourceNotFoundException):
        await service.get_by_id(999)
```

### Integration Test — API
```python
@pytest.mark.asyncio
async def test_create_user_returns_201(client: AsyncClient):
    response = await client.post("/api/v1/users/", json={
        "name": "Alice",
        "email": "alice@example.com",
        "password": "securepass123",
    })
    assert response.status_code == 201
    assert response.json()["email"] == "alice@example.com"


@pytest.mark.asyncio
async def test_get_user_not_found_returns_404(client: AsyncClient):
    response = await client.get("/api/v1/users/99999")
    assert response.status_code == 404
```

---

## React — Vitest + React Testing Library

### Component Test
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { UserCard } from "./UserCard";

describe("UserCard", () => {
  it("renders user name and email", () => {
    render(<UserCard user={{ id: 1, name: "Alice", email: "alice@example.com" }} />);
    expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("calls onEdit when Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<UserCard user={{ id: 1, name: "Alice", email: "alice@example.com" }} onEdit={onEdit} />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith(1);
  });
});
```

### Query Priority (React Testing Library)
1. `getByRole` — always first (accessible)
2. `getByLabelText` — for form inputs
3. `getByPlaceholderText` — fallback for inputs
4. `getByText` — for non-interactive text
5. `getByTestId` — last resort only

Use `userEvent` (not `fireEvent`) — it simulates real browser interactions.

---

## Angular — Jasmine + Karma

### Component Test
```typescript
describe("UserCardComponent", () => {
  let fixture: ComponentFixture<UserCardComponent>;
  let userServiceSpy: jasmine.SpyObj<UserService>;

  beforeEach(async () => {
    userServiceSpy = jasmine.createSpyObj("UserService", ["getUser"]);
    userServiceSpy.getUser.and.returnValue(
      of({ id: 1, name: "Alice", email: "alice@example.com" })
    );

    await TestBed.configureTestingModule({
      imports: [UserCardComponent],
      providers: [{ provide: UserService, useValue: userServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    fixture.componentRef.setInput("userId", 1);
    fixture.detectChanges();
  });

  it("should display user name", () => {
    const h2 = fixture.nativeElement.querySelector("h2");
    expect(h2.textContent).toContain("Alice");
  });
});
```

### Service Test
```typescript
describe("UserService", () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("should fetch user by id", () => {
    service.getUser(1).subscribe((user) => {
      expect(user.name).toBe("Alice");
    });

    const req = httpMock.expectOne("/api/v1/users/1");
    expect(req.request.method).toBe("GET");
    req.flush({ id: 1, name: "Alice", email: "alice@example.com" });
  });
});
```

---

## E2E — Playwright (recommended for all frameworks)

### Page Object Model Pattern
```typescript
// e2e/pages/LoginPage.ts
import { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.submitButton = page.getByRole("button", { name: "Sign In" });
  }

  async goto() { await this.page.goto("/login"); }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

### E2E Test
```typescript
test("user can log in with valid credentials", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login("alice@example.com", "password123");

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Welcome, Alice" })).toBeVisible();
});
```

---

## Coverage Targets

| Layer        | Minimum | Priority                         |
|--------------|---------|----------------------------------|
| Service      | 90%     | All happy paths + error paths    |
| Controller   | 80%     | All endpoints + validation cases |
| Repository   | 70%     | Custom queries                   |
| UI Component | 70%     | Render + user interaction        |
| E2E          | Critical flows | Login, core user journeys  |

---

## Non-Negotiable Rules

- **Never** test private methods or internal implementation details
- **Never** use `Thread.sleep()` / `setTimeout` in tests — use proper async utilities
- **Always** clean up state in `@BeforeEach` / `beforeEach` / `setUp`
- **Always** test at least one happy path and one failure path per behavior
- **Always** use the Page Object Model for E2E tests
- Mock only external dependencies (DB, HTTP, filesystem) — not your own code
- If a test is hard to write, the production code is probably too tightly coupled — refactor
