---
name: code-review
description: >
  Use this skill for pull request reviews and code reviews. Provides a unified checklist
  covering correctness, security, performance, style, and testing. Trigger when the user
  asks to review a PR, review code, evaluate a diff, conduct a security audit, or assess
  code quality. Works with all languages: Java, Python, JavaScript/TypeScript, Go, Rust.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-16
applies-to: Pull requests, code reviews, diff review, security audit, architectural review
---

# Code Review & PR Review Skill

## When to Use This Skill

Load this skill whenever the task involves:
- Reviewing a pull request before merge
- Conducting a code review on any language
- Evaluating a diff for correctness or security
- Performing a security audit on code
- Assessing code quality and maintainability
- Providing feedback on architecture or design
- Evaluating test coverage and quality
- Reviewing for compliance with project standards

## Priority Order

1. Follow repo-specific code review guidelines and automation first
2. Load and apply relevant language/framework skills (java-spring, frontend, testing, etc.)
3. Use this checklist to structure and document feedback
4. Apply project-conventions rules for naming, structure, and commits

## Output Contract

- Provide feedback organized by concern (correctness, security, performance, style, testing)
- Use the caveman-review format when explicitly requested — ultra-compressed, one-line comments
- Focus on code, not person — assume best intent and professionalism
- Explain "why" only when non-obvious; assume competence
- Cite specific lines or functions
- Distinguish critical issues (must fix) from suggestions (nice-to-have)
- List verification steps when applicable
- Call out risks, edge cases, and follow-up work explicitly

## Review Principles

1. **Assume best intent** — The author made deliberate choices; understand them first
2. **Code over person** — Critique the design, not the developer
3. **Context matters** — Ask "why?" before assuming suboptimal code
4. **Teach, don't scold** — Feedback should build skills
5. **Respect constraints** — Acknowledge time, scope, and business pressures
6. **Trust expertise** — Don't micromanage experienced developers
7. **Escalate thoughtfully** — Differentiate nitpicks from blockers
8. **Lead by example** — Your review should model the standards you enforce

## Review Checklist

---

## ✅ CORRECTNESS & LOGIC

### Behavior & Logic
- [ ] Does the code do what the PR description claims?
- [ ] Is the happy path correct? Do all code paths lead to the correct state?
- [ ] Are edge cases handled (null, empty, boundaries, overflow, underflow)?
- [ ] Are loop termination conditions correct? Any risk of infinite loops?
- [ ] Are all conditional branches covered? No unreachable code?
- [ ] Is the algorithm or data structure appropriate for the problem?
- [ ] Are off-by-one errors possible (arrays, pagination, ranges)?
- [ ] Do mathematical operations handle precision, division by zero, negative values?

### State & Mutations
- [ ] Is state mutated safely? Any race conditions in concurrent code?
- [ ] Are collections modified correctly? No concurrent modification issues?
- [ ] Is the data model consistent after all changes?
- [ ] Are side effects intentional and documented?
- [ ] Is the order of operations correct when multiple steps depend on each other?

### Function & Method Contracts
- [ ] Do all parameters match their intended use?
- [ ] Are return values handled correctly at every call site?
- [ ] Are assumptions about preconditions and postconditions met?
- [ ] Is the function idempotent where expected?
- [ ] Are all documented behaviors actually implemented?

### Example Issues (Red flags)
```java
// ❌ Logic error: loop exits too early
for (int i = 0; i < items.size() - 1; i++) {  // Missing last item
    process(items.get(i));
}

// ✅ Correct
for (int i = 0; i < items.size(); i++) {
    process(items.get(i));
}
```

---

## 🔒 SECURITY

### Input Validation & Sanitization
- [ ] Is all user input validated at the entry point (controller, API, CLI)?
- [ ] Are input constraints enforced (type, length, format, range)?
- [ ] Is validation performed on the server, not just client?
- [ ] Are file uploads scanned for malicious content (MIME type, size)?
- [ ] Are SQL, NoSQL, and command injection attacks prevented (parameterized queries)?
- [ ] Are environment variables and external inputs validated?

### Authentication & Authorization
- [ ] Are credentials validated on every protected endpoint?
- [ ] Is authorization checked at both layer AND object level (not just role)?
- [ ] Are JWT tokens validated for signature and expiration?
- [ ] Are session tokens secure (httpOnly, secure, sameSite cookies)?
- [ ] Can users access only their own data (not other users' records)?
- [ ] Are default credentials or hardcoded credentials present?

### Secrets & Cryptography
- [ ] Are secrets loaded from secure storage (vault, KMS, env vars) — never hardcoded?
- [ ] Are secrets never logged, even in errors or debug output?
- [ ] Are passwords hashed with bcrypt, argon2, or scrypt (never MD5, SHA1)?
- [ ] Are encryption keys rotated? Is key management clear?
- [ ] Is HTTPS enforced in production (TLS 1.2+)?
- [ ] Are certificates valid and not expired?

### Output & Error Handling
- [ ] Is user data sanitized before output (HTML escape, JSON encode)?
- [ ] Are error messages generic in production (no stack traces to users)?
- [ ] Is sensitive information excluded from error messages (passwords, tokens, PII)?
- [ ] Are security-relevant events logged with context?
- [ ] Is the response rate-limited to prevent brute force?

### Dependencies & Supply Chain
- [ ] Are all dependencies up-to-date and free of known CVEs?
- [ ] Are transitive dependencies checked (not just direct)?
- [ ] Are private dependencies from trusted sources?
- [ ] Is the build reproducible (pinned versions, lockfiles)?

### Example Issues (Red flags)
```java
// ❌ SQL Injection
String query = "SELECT * FROM users WHERE email = '" + email + "'";
connection.execute(query);

// ✅ Parameterized query
String query = "SELECT * FROM users WHERE email = ?";
PreparedStatement stmt = connection.prepareStatement(query);
stmt.setString(1, email);
stmt.executeQuery();

// ❌ Secrets in code
private static final String API_KEY = "sk-abc123xyz";

// ✅ Secrets from environment
private String apiKey = System.getenv("API_KEY");
```

---

## ⚡ PERFORMANCE

### Algorithms & Complexity
- [ ] Is the algorithm appropriate for the input size (O(n), O(log n), O(n²))?
- [ ] Are there unnecessary nested loops?
- [ ] Is recursion deep enough to cause stack overflow?
- [ ] Are expensive operations (crypto, hashing) computed only when needed?
- [ ] Can sorting, searching, or filtering be optimized?

### Database & Queries
- [ ] Are queries N+1 free (batch loading, JOIN FETCH, or eager loading)?
- [ ] Are indexes used correctly?
- [ ] Is pagination implemented for large result sets?
- [ ] Are unnecessary columns selected?
- [ ] Are transactions kept as short as possible?
- [ ] Is query caching appropriate and safe?

### Memory & Resources
- [ ] Are large objects freed or garbage-collected properly?
- [ ] Are streams and connections closed (try-with-resources)?
- [ ] Are collections pre-sized if the count is known?
- [ ] Are string concatenations using StringBuilder in loops?
- [ ] Are regular expressions compiled once, not in loops?

### Concurrency & Caching
- [ ] Are cache invalidation strategies correct?
- [ ] Is cache coherence maintained (no stale data)?
- [ ] Are locks held for the minimum duration?
- [ ] Are thread pools sized appropriately?
- [ ] Are async operations properly awaited?

### Example Issues (Red flags)
```java
// ❌ N+1 Query problem
List<users> users = userRepository.findAll();
for (User user : users) {
    List<orders> orders = orderRepository.findByUserId(user.getId());  // Query per user!
}

// ✅ Batch or join
List<users> users = userRepository.findAllWithOrders();  // Single query

// ❌ String concatenation in loop
String result = "";
for (String item : items) {
    result += item + ", ";  // Creates new String each iteration
}

// ✅ StringBuilder
StringBuilder result = new StringBuilder();
for (String item : items) {
    result.append(item).append(", ");
}
```

---

## 🎨 STYLE & CONVENTIONS

### Naming
- [ ] Class names are PascalCase (UserService, PaymentController)?
- [ ] Method/function names are camelCase (getUserById, calculateTotal)?
- [ ] Constants are UPPER_SNAKE_CASE (MAX_RETRIES, API_TIMEOUT)?
- [ ] Boolean flags start with "is", "has", "should" (isActive, hasPermission)?
- [ ] Names are descriptive and unambiguous (not `x`, `temp`, `data`)?
- [ ] Names match the actual responsibility (no misleading names)?

### Structure & Organization
- [ ] Files follow repo naming conventions (kebab-case, snake_case, PascalCase)?
- [ ] Classes are in appropriate packages/modules?
- [ ] Methods are ~20-30 lines; refactor if longer?
- [ ] Functions have single responsibility (one reason to change)?
- [ ] Classes have cohesive methods (related to the class purpose)?
- [ ] No dead code or commented-out code present?

### Language-Specific Standards
- [ ] **Java**: Uses Lombok, constructor injection, never field injection?
- [ ] **Python**: PEP 8 compliant, type hints on all functions?
- [ ] **TypeScript**: Strict mode, no `any`, explicit return types?
- [ ] **Go**: Follows idiomatic Go (error returns, defer)?
- [ ] **Rust**: Uses lifetimes correctly, borrows safely?

### Dependencies & Imports
- [ ] Imports are organized (std library, third-party, internal)?
- [ ] No circular dependencies between modules?
- [ ] No unnecessary imports (clean up unused)?
- [ ] Third-party libraries are justified (not over-engineered)?

### Example Issues (Red flags)
```typescript
// ❌ Poor naming
const x = getData(id);  // What is x?
const temp = process(x);  // Misleading: is it temporary?

// ✅ Clear naming
const user = getUserById(id);
const processedUser = enrichWithDefaults(user);

// ❌ God class (too many responsibilities)
class User {
    login() { }
    calculateTax() { }
    sendEmail() { }
    generateReport() { }
}

// ✅ Single responsibility
class User { login() { } }
class TaxCalculator { calculate() { } }
class EmailService { send() { } }
class ReportGenerator { generate() { } }
```

---

## 🧪 TESTING

### Coverage & Scope
- [ ] Is there at least one test per public method?
- [ ] Are both happy path and failure cases tested?
- [ ] Are edge cases covered (null, empty, boundary)?
- [ ] Are error conditions tested (exceptions, validation)?
- [ ] Are test names describe the behavior tested (not just "test1")?
- [ ] Is test code as clean as production code?

### Test Quality
- [ ] Do tests assert meaningful behavior (not just that code runs)?
- [ ] Are tests isolated (no dependencies between tests)?
- [ ] Are tests repeatable (deterministic, no flaky assertions)?
- [ ] Are external dependencies mocked (DB, HTTP, file system)?
- [ ] Are real implementations tested, not mocks?
- [ ] Are assertions specific (not just `assertTrue`)?

### Test Structure
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)?
- [ ] Setup and teardown are in BeforeEach/beforeEach (not mixed)?
- [ ] Test data is realistic, not minimal or unrealistic?
- [ ] Test names follow convention (method_WhenCondition_ExpectedResult)?
- [ ] No test interdependencies (can run in any order)?

### Example Issues (Red flags)
```java
// ❌ Poor test: no assertions, doesn't assert behavior
@Test
void testUser() {
    User user = new User("John", 25);  // Setup
    // No act, no assert!
}

// ✅ Good test: clear structure, meaningful assertion
@Test
void createUser_WithValidInput_ReturnsUser() {
    // Arrange
    String name = "John";
    int age = 25;
    
    // Act
    User user = new User(name, age);
    
    // Assert
    assertEquals(name, user.getName());
    assertEquals(age, user.getAge());
}

// ❌ Flaky test: depends on time
@Test
void testCacheExpiration() {
    cache.set("key", "value");
    Thread.sleep(1000);  // Relies on timing!
    assertNull(cache.get("key"));
}

// ✅ Test with control: mock time
@Test
void testCacheExpiration() {
    cache.set("key", "value", duration);
    clock.advance(duration + 1);
    assertNull(cache.get("key"));
}
```

---

## 📋 CROSS-CUTTING CONCERNS

### Documentation
- [ ] Are public APIs documented (comments, docstrings)?
- [ ] Are non-obvious algorithms explained?
- [ ] Are assumptions documented?
- [ ] Is the PR description clear and comprehensive?
- [ ] Are breaking changes documented?
- [ ] Are migration guides provided if needed?

### Logging & Observability
- [ ] Are important state changes logged?
- [ ] Is log level appropriate (DEBUG, INFO, WARN, ERROR)?
- [ ] Are logs useful for debugging (include context)?
- [ ] Is sensitive data excluded from logs?
- [ ] Are performance-critical paths traceable?

### Backwards Compatibility
- [ ] Are changes breaking or non-breaking (documented)?
- [ ] Are deprecations handled gracefully?
- [ ] Is the migration path clear for users?
- [ ] Are database migrations reversible (for breaking schema)?

### Environment & Configuration
- [ ] Are environment-specific configs separated?
- [ ] Are defaults reasonable and secure?
- [ ] Is configuration validated on startup?
- [ ] Are required variables checked (fail fast)?

---

## Self-Review Before Requesting Review

Before submitting a PR for review, do a self-review:

1. **Read the diff carefully** — Does it match the PR description?
2. **Scan for obvious bugs** — Typos, logic errors, incomplete refactors
3. **Check consistency** — Does it follow project patterns?
4. **Verify tests** — Are they present, meaningful, isolated?
5. **Run locally** — Do all tests pass? Does the app start?
6. **Security check** — No secrets, no injection vulnerabilities?
7. **Performance check** — Any N+1 queries, unnecessary loops?
8. **Lint & format** — Are there style violations?
9. **Documentation** — Are comments clear, code self-explanatory?
10. **Size check** — Is the PR too large? Should it be split?

---

## Giving Effective Feedback

### ✅ GOOD Comments (Caveman Review Format)

Location + Problem + Suggestion — one line only.

```
src/user/UserService.java:42 | N+1 query: orders loaded per user | Use @EntityGraph or batch load
frontend/UserCard.tsx:18 | Missing null check on user.address | Guard: if (!user?.address) return null
config/application.yml:15 | DB password in code | Use ${DB_PASSWORD} env var instead
```

### ❌ BAD Comments (Avoid)

```
// Too vague
"This looks wrong"

// Too long (not caveman style)
"I think we need to refactor this entire service because the logic is too complex
and we should consider using a different pattern..."

// Personal/harsh
"Why would you write it like this?"

// Not actionable
"This is bad"
```

### Escalation Levels

| Level | Action | Example |
|-------|--------|---------|
| **Nitpick** | Suggest if obvious improvement | "Consider using `contains()` instead of `indexOf() > -1`" |
| **Style** | Suggest for consistency | "Follow repo convention: private static final" |
| **Warning** | Should fix, minor risk | "This could leak if exception occurs; use try-finally" |
| **Blocker** | Must fix before merge | "SQL injection vulnerability; use parameterized queries" |

### Comment Do's & Don'ts

| Do's | Don'ts |
|------|--------|
| ✅ Be specific — cite line numbers | ❌ Be vague — "this area" |
| ✅ Ask questions — "Did you consider...?" | ❌ Demand — "You must..." |
| ✅ Offer alternatives — "Try X or Y" | ❌ Nitpick everything — focus on impact |
| ✅ Acknowledge trade-offs — "I see the constraint, but..." | ❌ Assume incompetence — "obvious, you should..." |
| ✅ Praise good choices — "Nice use of streams!" | ❌ Ignore good work — comment only on negatives |
| ✅ Link to examples — "See ProjectHelper.java:45" | ❌ Leave no context — comment dangling |

---

## Approval Criteria

Approve (✅) when:
- All correctness issues are addressed
- No security vulnerabilities remain unmitigated
- Tests are present and meaningful
- Code follows project conventions
- Performance is acceptable
- Comments resolve all questions

Request changes (🔴) when:
- **Critical issues**: Logic errors, security vulns, data loss
- **High-impact issues**: Missing tests, poor performance, pattern violations
- **Unclear code**: Non-obvious logic without comments
- **Non-compliance**: Violates project standards

Comment without blocking (💬) when:
- Nice-to-have improvements (refactoring)
- Follow-up work suggestions
- Nitpicks or style preferences

---

## Non-Negotiable Standards

- **Never** approve code with unmitigated security vulnerabilities
- **Never** approve code that reduces test coverage without justification
- **Never** approve code with secrets hardcoded
- **Never** approve code with SQL/NoSQL injection risks
- **Always** request tests for bug fixes (reproduce + fix validation)
- **Always** request explicit verification for performance changes
- **Always** ensure error handling is robust and informative
- **Always** verify no dead code, debug logging, or commented-out code remains

---

## Related Skills

- `project-conventions` — Naming, branching, commits, PR process
- `java-spring`, `python-backend`, `frontend` — Language-specific patterns
- `testing` — Test structure, mocking, coverage standards
- `security-hardening` — OWASP Top 10, secure coding
- `loop-engineering` — Iterative refinement when major changes needed

---

## Further Reading & Resources

- [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
- [PEP 8 Python Style Guide](https://pep8.org/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [OWASP Secure Code Review](https://owasp.org/www-project-code-review-guide/)
- [Best Practices in Code Review](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)
- [The Art of Code Review](https://blog.github.com/2015-09-22-the-art-of-code-review/)


