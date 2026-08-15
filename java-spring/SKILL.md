---
name: java-spring
description: >
  Core Spring Boot application conventions. Use this skill for standard Spring Boot
  app structure, layered architecture, REST API design, DTO patterns, service layer,
  JPA entities/repositories, exception handling, controller tests, and Maven/Gradle
  build setup. When the task involves Spring Security, Spring AI, or advanced data
  access (database migrations, advanced JPA/Hibernate, connection pooling, caching,
  query performance), load the dedicated skills java-spring-security, java-spring-ai,
  or java-data alongside this one.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 2.0.0
last-reviewed: 2026-08-15
applies-to: Java, Spring Boot, REST APIs, JPA entities, service layer, DTOs, exception handling, build configuration
---

# Java & Spring Boot Skill — Core Fundamentals

## When to Use This Skill

Load this skill for foundational Spring Boot work:
- Creating or modifying Spring Boot application structure
- Designing or implementing REST APIs
- Writing DTOs, services, and controllers
- Basic JPA entity, repository, and service layer patterns
- Exception handling and validation
- Unit and controller tests (MockMvc)
- Maven or Gradle project setup

When the task crosses into security, AI, or advanced data, also load the dedicated complementary skill.

## Priority Order

1. Follow existing repo architecture and package layout first
2. Use this skill's structure as default only for greenfield or unclear repos
3. If loaded project conventions differ, prefer repo-established pattern and stay consistent
4. When concerns overlap (e.g., a secured REST endpoint), load both `java-spring` and the relevant complementary skill and merge their rules

## Output Contract

- State assumptions when repo context is missing
- List files changed when making edits
- Add or update tests for behavior changes
- Avoid unrelated refactors unless required to complete task safely
- Call out blockers, risks, and follow-up work explicitly

## Conflict Resolution

Use this precedence order when instructions conflict:
1. Existing repo code and enforced automation
2. Repo docs and local agent instructions
3. Loaded `project-conventions/SKILL.md`
4. This skill + any loaded complementary skill (security, AI, data, etc.)
5. Generic framework best practices

---

## Project Structure Convention

Follow standard layered architecture:

```
src/
└── main/
    └── java/com/company/project/
        ├── controller/       # REST controllers (@RestController)
        ├── service/          # Business logic (@Service)
        ├── repository/       # Data access (@Repository, JPA)
        ├── domain/           # JPA Entities (@Entity)
        ├── dto/              # Request/Response DTOs (records preferred)
        ├── exception/        # Custom exceptions + GlobalExceptionHandler
        ├── config/           # Spring config classes (@Configuration)
        └── util/             # Utility/helper classes
└── test/
    └── java/com/company/project/
        ├── controller/       # Controller layer tests (MockMvc)
        ├── service/          # Service unit tests (Mockito)
        └── repository/       # Repository integration tests (@DataJpaTest)
```

---

## REST API Design

### Controller Rules
- Annotate with `@RestController` and `@RequestMapping("/api/v1/resource")`
- Keep controllers thin — delegate all logic to the service layer
- Always use DTOs for request/response; never expose JPA entities directly
- Use `ResponseEntity<T>` for full HTTP control

```java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse created = userService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }
}
```

### DTO Convention
- Use Java `record` for DTOs (Java 17+ feature — Spring Boot 4 / Java 25 baseline)
- Suffix: `*Request`, `*Response`, `*DTO`

```java
public record CreateUserRequest(
    @NotBlank @Size(max = 100) String name,
    @NotBlank @Email String email
) {}

public record UserResponse(Long id, String name, String email) {}
```

### HTTP Status Conventions
| Scenario              | Status Code               |
|-----------------------|---------------------------|
| Success (GET/PUT)     | 200 OK                    |
| Created (POST)        | 201 Created + Location    |
| No content (DELETE)   | 204 No Content            |
| Validation failure    | 400 Bad Request           |
| Not found             | 404 Not Found             |
| Server error          | 500 Internal Server Error |

---

## Service Layer

- Annotate with `@Service` and `@Transactional` at class or method level
- Keep business logic here, not in controllers or repositories
- Throw domain-specific exceptions; never let JPA exceptions leak upward

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    public UserResponse findById(Long id) {
        return userRepository.findById(id)
            .map(userMapper::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        User user = userMapper.toEntity(request);
        return userMapper.toResponse(userRepository.save(user));
    }
}
```

---

## JPA / Hibernate — Basics

For advanced JPA patterns, query optimization, migrations, and caching, load the `java-data` skill.

### Entity Rules
- Use `@Entity` + `@Table(name = "table_name")` explicitly
- Always define `equals()` and `hashCode()` based on business key, not `id`
- Prefer `Long` for primary keys with `GenerationType.IDENTITY`
- Use `LocalDateTime` (not `Date`) for timestamps; annotate with `@CreatedDate` / `@LastModifiedDate`
- Use `FetchType.LAZY` for all associations by default

```java
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

### Repository Rules
- Extend `JpaRepository<Entity, ID>`
- Use `@Query` with JPQL (not native SQL) unless performance demands it
- Name derived query methods clearly: `findByEmailAndActiveTrue()`

---

## Exception Handling

```java
// Base
public abstract class AppException extends RuntimeException {
    public AppException(String message) { super(message); }
}

// Specific
public class ResourceNotFoundException extends AppException {
    public ResourceNotFoundException(String resource, Object id) {
        super(resource + " not found with id: " + id);
    }
}
```

### Global Handler
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse(ex.getMessage(), HttpStatus.NOT_FOUND.value()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + ": " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(message, 400));
    }
}
```

---

## Testing — Basics

For advanced testing patterns (Testcontainers, contract testing, mutation testing), load the `testing` skill.

### Unit Tests (Service Layer)
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock UserMapper userMapper;
    @InjectMocks UserService userService;

    @Test
    void findById_WhenUserExists_ReturnsResponse() {
        User user = new User(); user.setId(1L);
        UserResponse expected = new UserResponse(1L, "Alice", "alice@example.com");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userMapper.toResponse(user)).thenReturn(expected);

        UserResponse result = userService.findById(1L);
        assertThat(result).isEqualTo(expected);
    }

    @Test
    void findById_WhenNotFound_ThrowsException() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> userService.findById(99L))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
```

### Controller Tests (MockMvc)
```java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean UserService userService; // @MockBean removed in Spring Boot 4

    @Test
    void getUser_Returns200() throws Exception {
        when(userService.findById(1L))
            .thenReturn(new UserResponse(1L, "Alice", "alice@example.com"));

        mockMvc.perform(get("/api/v1/users/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Alice"));
    }
}
```

---

## Build Configuration

### Maven — Key Dependencies
```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### Gradle — Key Dependencies
```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

For advanced build topics (multi-module, dependency management, code quality, releases), load the `java-build-tools` skill.

---

## Non-Negotiable Rules

- **Never** use field injection (`@Autowired` on fields) — always constructor injection
- **Never** expose JPA entities in API responses — always use DTOs
- **Never** catch generic `Exception` — catch specific types
- **Always** validate input at controller layer with `@Valid`
- **Always** use `Optional` return from repositories; never return `null`
- **Always** write at least one test per public service method
- Use Lombok to reduce boilerplate; use `@Slf4j` for logging (never `System.out.println`)
- Log meaningful context: `log.warn("User not found: id={}", id)` not `log.warn("error")`

---

## IntelliJ IDEA Tips

- Enable **Save Actions** → auto-format + organize imports on save
- Use **HTTP Client** (`.http` files) for in-IDE REST endpoint testing
- Enable **SonarLint** plugin for real-time code quality feedback
- Use **Database** tool window to validate JPA schema alignment
- Use **Endpoints** tool window (Spring) to see all mapped routes at a glance
