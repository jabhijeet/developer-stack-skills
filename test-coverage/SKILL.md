# Test Coverage & Quality Metrics

Interpret coverage reports, set meaningful thresholds, and improve test quality. Coverage ≠ Quality, but it's a useful metric for finding gaps.

## Non-Negotiable Rules

- **Never** chase 100% coverage — diminishing returns after 85%; focus on critical paths instead
- **Never** reduce coverage thresholds when tests fail — fix the code, not the test
- **Always** measure and enforce branch coverage (not just line coverage) — branch coverage is the more useful metric
- **Always** test critical paths with higher thresholds (security, payment, auth code should be 90%+)
- **Always** exclude auto-generated code from coverage (getters, setters, constructors if auto-generated)
- **Never** weaken tests to reach coverage targets — meaningful assertions only
- Don't just count lines covered; verify tests actually assert meaningful behavior
- Coverage is a floor, not a ceiling — use it to find gaps, then write meaningful tests

## Quick Reference

### Coverage Metrics Explained

| Metric | Definition | Target |
|--------|-----------|--------|
| **Line Coverage** | % of code lines executed | 75-85% |
| **Branch Coverage** | % of conditional branches taken | 70-80% |
| **Function Coverage** | % of functions/methods called | 75-85% |
| **Statement Coverage** | % of statements executed | 80%+ |

## Java Coverage (JaCoCo)

### Maven Integration

```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.10</version>
  <executions>
    <execution>
      <goals>
        <goal>prepare-agent</goal>
      </goals>
    </execution>
    <execution>
      <id>report</id>
      <phase>test</phase>
      <goals>
        <goal>report</goal>
      </goals>
    </execution>
    <execution>
      <id>jacoco-check</id>
      <goals>
        <goal>check</goal>
      </goals>
      <configuration>
        <rules>
          <rule>
            <element>PACKAGE</element>
            <excludes>
              <exclude>*Test</exclude>
            </excludes>
            <limits>
              <limit>
                <counter>LINE</counter>
                <value>COVEREDRATIO</value>
                <minimum>0.80</minimum>
              </limit>
            </limits>
          </rule>
        </rules>
      </configuration>
    </execution>
  </executions>
</plugin>
```

### Gradle Integration

```gradle
plugins {
  id 'jacoco'
}

jacoco {
  toolVersion = "0.8.10"
}

jacocoTestReport {
  dependsOn test
  reports {
    xml.required = true
    html.required = true
    csv.required = false
  }
}

jacocoTestCoverageVerification {
  violationRules {
    rule {
      element = 'PACKAGE'
      excludes = ['*Test']
      limit {
        counter = 'LINE'
        value = 'COVEREDRATIO'
        minimum = 0.80
      }
    }
  }
}
```

### Interpreting JaCoCo Reports

```
- **Red** (0-0.5): Critical gaps — requires tests
- **Yellow** (0.5-0.75): Partial coverage — test missing edge cases
- **Green** (0.75+): Good coverage — focus on branch coverage
```

## Python Coverage (coverage.py)

### Setup

```bash
pip install coverage pytest pytest-cov
```

### Configuration (.coveragerc)

```ini
[run]
source = src
branch = True
omit =
  */tests/*
  */test_*.py

[report]
precision = 2
exclude_lines =
  pragma: no cover
  def __repr__
  raise AssertionError
  raise NotImplementedError
  if __name__ == .__main__.:
  if TYPE_CHECKING:
  @abstractmethod
fail_under = 80

[html]
directory = htmlcov
```

### Run Coverage

```bash
pytest --cov=src --cov-report=html --cov-report=term-missing
```

### GitHub Actions Integration

```yaml
- name: Run tests with coverage
  run: pytest --cov=src --cov-report=term --cov-report=html

- name: Comment PR with coverage
  uses: py-cov-action/python-coverage-comment-action@v3
  with:
    GITHUB_TOKEN: ${{ github.token }}
```

## JavaScript/TypeScript Coverage (Vitest, Jest)

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
      all: true,
    },
  },
});
```

### Jest Configuration

```json
{
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/**/*.test.ts",
      "!src/**/*.spec.ts"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 80,
        "lines": 80,
        "statements": 80
      },
      "src/critical/": {
        "branches": 90,
        "functions": 90,
        "lines": 90,
        "statements": 90
      }
    }
  }
}
```

### Run Coverage

```bash
npm run test:coverage
# or
vitest run --coverage
```

## Reading & Interpreting Reports

### HTML Report Structure

```
htmlcov/
├── index.html          # Overall summary
├── status.js          # Drill-down navigation
├── src/
│   ├── index.html    # Per-file coverage
│   └── util.html
```

### Key Insights from Reports

1. **Identify untested files** — Sort by coverage %, find red ones
2. **Branch gaps** — Look for conditional branches not exercised
3. **Dead code** — Code with 0% coverage may be unused
4. **Edge cases** — Test error paths, boundary conditions, null checks

## Coverage vs Quality

### ❌ High Coverage ≠ Quality

```java
// 100% line coverage, but tests nothing
@Test
void testUserCreation() {
  User user = new User("John", 25);  // Line covered
  // No assertions!
}
```

### ✅ Meaningful Coverage

```java
@Test
void testUserCreationWithValidInput() {
  User user = new User("John", 25);
  assertEquals("John", user.getName());
  assertEquals(25, user.getAge());
}

@Test
void testUserCreationWithInvalidAge() {
  assertThrows(IllegalArgumentException.class, 
    () -> new User("John", -5));
}
```

## Setting Coverage Thresholds

### By Project Type

| Type | Recommended |
|------|------------|
| **Core library** | 85-95% |
| **API backend** | 75-85% |
| **UI frontend** | 70-80% |
| **Utilities** | 80-90% |
| **Test code** | Exclude from coverage |

### Enforce with CI

```yaml
# GitHub Actions
- name: Check coverage
  run: |
    npm run test:coverage
    if [ $(cat coverage/coverage-final.json | grep -o '"lines"' | wc -l) -lt 80 ]; then
      echo "Coverage below 80%"
      exit 1
    fi
```

## Best Practices

1. **Don't chase 100%** — Diminishing returns after 85%
2. **Focus on critical paths** — Higher thresholds for security, payment code
3. **Test behavior, not implementation** — Avoid brittle tests
4. **Use mutation testing** — Check if tests actually catch bugs
5. **Regular reviews** — Re-evaluate coverage quarterly
6. **Exclude auto-generated code** — Constructors, getters, serialization
7. **Mock external dependencies** — Focus on unit logic
8. **Measure branch, not just lines** — More useful metric

## Common Coverage Gaps

### What NOT to Test (Usually)

```java
// Exclude getters/setters
public String getName() { return name; }

// Exclude toString()
@Override
public String toString() { return "User{" + name + "}"; }

// Exclude equals/hashCode from small classes
@Override
public boolean equals(Object o) { ... }

// Exclude auto-generated code
// Exclude logging statements in success paths
```

### WHAT TO TEST

```java
// ✅ Business logic
calculateDiscount(customerType, amount);

// ✅ Error handling
validateEmail(invalidEmail);

// ✅ Edge cases
processOrder(maxInt, minInt, zero);

// ✅ Security checks
isAuthorized(user, resource);

// ✅ State changes
userService.updateProfile(user);
```

## Tools & Integration

### Codecov Integration

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella
```

### SonarQube Integration

```bash
mvn clean verify sonar:sonar \
  -Dsonar.projectKey=my-project \
  -Dsonar.sources=src \
  -Dsonar.junit.reportPaths=target/surefire-reports \
  -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml
```

## Further Reading

- [JaCoCo Documentation](https://www.jacoco.org/)
- [Coverage.py Docs](https://coverage.readthedocs.io/)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

