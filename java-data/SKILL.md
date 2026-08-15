---
name: java-data
description: >
  Production-grade data access for Java/Spring applications. Use this skill for database
  migrations, advanced JPA/Hibernate patterns, transaction management, connection
  pooling, pagination, query optimization, caching, and data integrity concerns.
  Covers Flyway, Liquibase, HikariCP, and Spring Data JPA advanced features.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-15
applies-to: Flyway, Liquibase, JPA/Hibernate, transactions, connection pooling, query optimization, caching
---

# Java Data Skill

## When to Use This Skill

Load this skill for data layer concerns beyond basic CRUD:
- Database schema migrations
- Advanced JPA/Hibernate patterns (fetching, caching, N+1 prevention)
- Transaction boundaries, propagation, and isolation
- Connection pool tuning (HikariCP)
- Pagination, batching, and bulk operations
- Query optimization and the Criteria API
- Second-level caching with Hibernate or Spring Cache

## Priority Order

1. Follow repo-local data access patterns and migration history first
2. Prefer Spring Data JPA derived queries over `@Query` when expressive enough
3. If this skill conflicts with `java-spring`, prefer `java-spring` for basic entity/repository setup and merge this skill for advanced data concerns

## Output Contract

- State migration tool, database vendor, and connection pool assumptions when repo context is missing
- List files changed when making edits
- Add or update tests for query and transaction behavior changes
- Call out data integrity risks, lock contention, and performance trade-offs explicitly

## Conflict Resolution

1. Existing repo data layer and enforced automation
2. Repo docs and local agent instructions
3. Loaded `project-conventions/SKILL.md`
4. This skill
5. Generic persistence best practices

---

## Database Migrations

### Flyway

#### Configuration
```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    clean-disabled: true   # Never allow flyway clean against real data
```

#### Migration Naming
```
db/migration/
├── V1__create_users_table.sql
├── V2__add_email_to_users.sql
├── V3__create_orders_table.sql
└── R__seed_roles.sql          # Repeatable migration
```

#### Example Migration
```sql
-- V4__add_status_to_orders.sql
ALTER TABLE orders
    ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'PENDING';

CREATE INDEX idx_orders_status ON orders(status);
```

#### Best Practices
- **Never** modify an already-executed migration — create a new version
- Always include rollback logic or reversible SQL for risky changes
- Use repeatable migrations (`R__`) for views, stored procedures, or seed data
- Keep migrations idempotent when possible
- Test migrations locally before pushing

### Liquibase

```yaml
spring:
  liquibase:
    change-log: classpath:/db/changelog/db.changelog-master.yaml
    contexts: dev,prod
```

```yaml
# db/changelog/001-create-users.yaml
databaseChangeLog:
  - changeSet:
      id: 001-create-users
      author: abhijeet
      changes:
        - createTable:
            tableName: users
            columns:
              - column:
                  name: id
                  type: BIGINT
                  autoIncrement: true
                  constraints:
                    primaryKey: true
```

---

## Transactions

### Propagation and Isolation
```java
@Service
@RequiredArgsConstructor
public class OrderService {

    @Transactional(propagation = Propagation.REQUIRED, isolation = Isolation.READ_COMMITTED)
    public Order createOrder(CreateOrderRequest request) {
        // Default: join existing transaction or start new one
        return orderRepository.save(order);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void auditLog(String action) {
        // Always starts a new transaction, suspending the current one
        auditRepository.save(new AuditEntry(action));
    }
}
```

### Transactional Rules
- Keep `@Transactional` on service layer, not controllers or repositories
- Use `readOnly = true` for query-only methods to hint the persistence provider
- Never catch exceptions inside a transactional method without rethrowing or marking rollback
- Use `@Transactional(noRollbackFor = SpecificException.class)` sparingly and document why

---

## Connection Pooling (HikariCP — Spring Boot Default)

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      leak-detection-threshold: 60000
```

### Tuning Guidelines
| Metric | Guideline |
|--------|-----------|
| Pool size | Start with `CPU cores * 2 + spindles`; adjust based on DB wait time |
| Connection timeout | 30s default; reduce if app is failing fast |
| Idle timeout | 10min default; tune to match DB `wait_timeout` |
| Leak detection | Enable in non-prod to catch unclosed connections |
| Max lifetime | Keep below DB/network idle timeout (typically 30min) |

---

## Pagination and Batching

### Pagination
```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public Page<UserResponse> listUsers(Pageable pageable) {
        return userRepository.findAll(pageable)
            .map(userMapper::toResponse);
    }
}

// Controller
@GetMapping("/api/v1/users")
public Page<UserResponse> getUsers(Pageable pageable) {
    return userService.listUsers(pageable);
}
```

### Batch Operations
```java
@Transactional
public void batchInsert(List<User> users) {
    int batchSize = 50;
    for (int i = 0; i < users.size(); i++) {
        entityManager.persist(users.get(i));
        if (i % batchSize == 0 && i > 0) {
            entityManager.flush();
            entityManager.clear();
        }
    }
}
```

---

## Query Optimization

### Criteria API
```java
public List<UserResponse> searchUsers(String name, LocalDate createdAfter) {
    return userRepository.findAll((root, query, cb) -> {
        List<Predicate> predicates = new ArrayList<>();
        if (name != null) {
            predicates.add(cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%"));
        }
        if (createdAfter != null) {
            predicates.add(cb.greaterThan(root.get("createdAt"), createdAfter));
        }
        return cb.and(predicates);
    });
}
```

### N+1 Prevention
```java
@EntityGraph(attributePaths = {"orders", "orders.items"})
@Query("SELECT u FROM User u WHERE u.active = true")
List<User> findActiveUsersWithOrdersAndItems();
```

### Fetch Tuning
- Default all associations to `FetchType.LAZY`
- Use `@EntityGraph` or JPQL `JOIN FETCH` only for known hot paths
- Use pagination with `JOIN FETCH` carefully — it can produce Cartesian products
- Monitor with `spring.jpa.show-sql=true` and `format_sql=true` in dev

---

## Caching

### Spring Cache Abstraction
```java
@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "users")
public class UserService {

    private final UserRepository userRepository;

    @Cacheable(key = "#id")
    public User findById(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    @CacheEvict(key = "#id")
    public User update(Long id, UpdateUserRequest request) {
        // ...
    }

    @CacheEvict(allEntries = true)
    public void refreshAll() {
        // ...
    }
}
```

### Caffeine (In-Memory) Configuration
```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CaffeineCacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager("users", "products");
        manager.setCaffeine(Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(10))
            .maximumSize(1000));
        return manager;
    }
}
```

### Second-Level Cache (Hibernate)
```yaml
spring:
  jpa:
    properties:
      hibernate:
        cache:
          use_second_level_cache: true
          use_query_cache: true
          region.factory_class: org.hibernate.cache.jcache.JCacheRegionFactory
```

---

## Non-Negotiable Rules

- **Always** use parameterized queries or derived query methods — never concatenate SQL strings
- **Never** return `null` from a repository — return `Optional<T>`
- **Always** test migrations on a copy of production data before applying to prod
- **Always** keep transaction boundaries as narrow as possible
- **Never** swallow exceptions in transactional code without explicit rollback handling
- **Always** close `EntityManager` and `Session` resources properly
- Use `READ_COMMITTED` as the default isolation level; escalate only with proven need
- Profile before optimizing — N+1 problems should be detected with logging or APM, not assumed

---

## Related Skills

- `java-spring` — Basic entity and repository setup
- `testing` — Testcontainers and repository integration tests
