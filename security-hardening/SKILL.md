---
name: security-hardening
description: >
  Use this skill for application security hardening. Covers OWASP Top 10 mitigation,
  secure coding patterns, dependency scanning, and Azure-ready configurations for Java
  and Python applications. Trigger for security reviews and hardening tasks.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-16
applies-to: Security, OWASP Top 10, hardening, secure coding
---
# Security Hardening & OWASP Top 10 Mitigation

Practical security guidance for Java/Python applications covering OWASP Top 10 vulnerabilities, secure coding patterns, and Azure-ready configurations.

## Non-Negotiable Security Checklist (MUST COMPLETE BEFORE PRODUCTION)

- [x] Use HTTPS everywhere (TLS 1.2+) — never allow HTTP for authenticated traffic
- [x] Validate ALL input — both format and size; never trust user input
- [x] Use parameterized queries — never concatenate SQL strings
- [x] Hash passwords with bcrypt (strength 12+) or argon2 — never MD5, SHA1, plain text
- [x] Implement rate limiting on authentication endpoints — prevent brute force and credential stuffing
- [x] Add CSRF tokens for state-changing operations in session-based apps
- [x] Use secure cookies (HttpOnly, Secure, SameSite=Strict)
- [x] Implement comprehensive logging (no PII, no secrets, structured format)
- [x] Perform regular security audits (code review + dependency scanning) — not optional
- [x] Keep dependencies updated; enable automated security patches when possible
- [x] Use Azure Key Vault or equivalent for all secrets (never hardcode)
- [x] Enable Azure Security Center recommendations and respond to findings
- [x] Implement encryption for data at rest and in transit
- [x] Never trust API clients; always validate on the server
- [x] Implement proper error handling; never expose system internals to users

## OWASP Top 10 (2021) & Mitigations

### 1. Broken Access Control

#### Java - Spring Security

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
      .authorizeHttpRequests(authz -> authz
        .requestMatchers("/public/**").permitAll()
        .requestMatchers("/admin/**").hasRole("ADMIN")
        .requestMatchers("/user/**").hasRole("USER")
        .anyRequest().authenticated()
      )
      .formLogin()
      .sessionManagement()
        .sessionFixationProtection(SessionFixationProtection.MIGRATRE)
        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED);
    return http.build();
  }
}

// Check authorization at method level
@Service
public class ResourceService {
  @PreAuthorize("hasRole('ADMIN') or @resourceOwnershipService.isOwner(#id, authentication.principal.id)")
  public Resource getResource(Long id) {
    return repository.findById(id).orElseThrow();
  }
}
```

#### Python - Flask-SQLAlchemy

```python
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, current_user, login_required

db = SQLAlchemy()
login_manager = LoginManager()

@app.before_request
def check_access():
  if current_user.is_authenticated:
    # Verify user has access to requested resource
    if request.path.startswith('/admin/') and not current_user.is_admin:
      return redirect(url_for('unauthorized'))

@app.route('/resource/<int:resource_id>')
@login_required
def get_resource(resource_id):
  resource = Resource.query.get_or_404(resource_id)
  if resource.owner_id != current_user.id and not current_user.is_admin:
    abort(403)
  return resource
```

### 2. Cryptographic Failures

#### Java - Secure Password Hashing

```java
@Configuration
public class SecurityConfig {
  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);  // Strength 12+
  }
}

// ✅ CORRECT
String hashed = passwordEncoder().encode("userPassword");

// ❌ WRONG - Never use MD5, SHA1, plain text
String wrong = DigestUtils.md5Hex("userPassword");
```

#### Python - Hashing

```python
from werkzeug.security import generate_password_hash, check_password_hash
import bcrypt

# ✅ Correct for Flask
password_hash = generate_password_hash(password, method='pbkdf2:sha256')
check_password_hash(password_hash, user_input)

# ✅ Correct with bcrypt
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12))
bcrypt.checkpw(user_input.encode('utf-8'), password_hash)

# ❌ Never do this
import hashlib
wrong = hashlib.md5(password.encode()).hexdigest()
```

#### Secrets Management

```java
// Use Azure Key Vault or Spring Cloud Config
@Configuration
public class SecretsConfig {
  @Value("${spring.datasource.password}")
  private String dbPassword;  // Loaded from vault, NOT code

  @Value("${app.jwt.secret}")
  private String jwtSecret;
}

// Never hardcode!
// ❌ WRONG: private static final String API_KEY = "abc123xyz";
```

### 3. Injection (SQL, NoSQL, Command)

#### Java - SQL Injection Prevention

```java
// ✅ CORRECT - Parameterized queries (JPA)
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
  @Query("SELECT u FROM User u WHERE u.email = ?1")
  User findByEmail(String email);
}

// ✅ CORRECT - Prepared statements
String query = "SELECT * FROM users WHERE email = ?";
PreparedStatement stmt = connection.prepareStatement(query);
stmt.setString(1, email);
```

#### Python - SQL Injection Prevention

```python
from sqlalchemy import text

# ✅ CORRECT - SQLAlchemy ORM (parameterized)
user = User.query.filter_by(email=email).first()

# ✅ CORRECT - Raw query with parameters
user = db.session.execute(
  text("SELECT * FROM users WHERE email = :email"),
  {"email": email}
)

# ❌ WRONG - String concatenation
query = f"SELECT * FROM users WHERE email = '{email}'"  # SQL Injection!
```

#### NoSQL Injection

```java
// ❌ WRONG
Query query = new Query(Criteria.where("username").is(userInput));
```

```python
# ✅ CORRECT
user = db.users.find_one({"email": sanitized_email})
```

### 4. Insecure Design

#### Threat Modeling

```markdown
1. Identify assets (user data, payment info, auth tokens)
2. Identify threats (tampering, spoofing, repudiation, info disclosure)
3. Identify mitigations (encryption, validation, monitoring)
4. Verify in code review
```

#### Rate Limiting

```java
@Configuration
public class RateLimitConfig {
  @Bean
  public RateLimiter loginRateLimiter() {
    return RateLimiter.create(5.0);  // 5 requests/second
  }
}

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final RateLimiter rateLimiter;
  
  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody LoginRequest req) {
    if (!rateLimiter.tryAcquire()) {
      return ResponseEntity.status(429).build();  // Too Many Requests
    }
    // ... authentication logic
  }
}
```

### 5. Broken Authentication

#### JWT Best Practices (Java)

```java
@Configuration
public class JwtConfig {
  @Value("${jwt.secret}")
  private String secret;
  
  @Value("${jwt.expiration:3600000}")  // 1 hour
  private long expiration;
  
  public String generateToken(UserDetails user) {
    return Jwts.builder()
      .setSubject(user.getUsername())
      .setIssuedAt(new Date())
      .setExpiration(new Date(System.currentTimeMillis() + expiration))
      .signWith(SignatureAlgorithm.HS512, secret)
      .compact();
  }
  
  public String validateToken(String token) {
    try {
      Jwts.parser()
        .setSigningKey(secret)
        .parseClaimsJws(token);
      return token;  // Valid
    } catch (ExpiredJwtException e) {
      // Token expired
      throw new UnauthorizedException("Token expired");
    }
  }
}
```

#### Python - JWT

```python
import jwt
from datetime import datetime, timedelta

SECRET = os.getenv('JWT_SECRET')
ALGORITHM = 'HS256'
EXPIRATION = timedelta(hours=1)

def create_token(data: dict):
  to_encode = data.copy()
  expire = datetime.utcnow() + EXPIRATION
  to_encode.update({"exp": expire})
  return jwt.encode(to_encode, SECRET, algorithm=ALGORITHM)

def verify_token(token: str):
  try:
    payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    return payload
  except jwt.ExpiredSignatureError:
    raise UnauthorizedException("Token expired")
```

### 6. Security Misconfiguration

#### Spring Boot Application Properties

```properties
# ✅ CORRECT SECURITY CONFIG
spring.security.user.password=${ADMIN_PASSWORD}
server.servlet.session.cookie.http-only=true
server.servlet.session.cookie.secure=true
server.servlet.session.cookie.same-site=strict
server.http2.enabled=true
security.require-https=true

# Disable unnecessary endpoints
management.endpoints.web.exposure.exclude=env,beans,mappings
```

#### CORS Configuration

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
      .allowedOrigins("https://trusted-domain.com")  // Specific, not "*"
      .allowedMethods("GET", "POST", "PUT", "DELETE")
      .allowedHeaders("Authorization", "Content-Type")
      .allowCredentials(true)
      .maxAge(3600);
  }
}
```

### 7. Cross-Site Scripting (XSS)

#### Prevention

```java
// ✅ CORRECT - Escape output
@RestController
public class CommentController {
  @GetMapping("/comment/{id}")
  public CommentDTO getComment(@PathVariable Long id) {
    Comment comment = service.getComment(id);
    // Return DTO - Spring MVC escapes JSON
    return new CommentDTO(
      comment.getId(),
      StringEscapeUtils.escapeHtml4(comment.getText())
    );
  }
}
```

```html
<!-- ✅ CORRECT - Use templating engine escaping (Thymeleaf, EJS) -->
<p th:text="${comment.text}"></p>

<!-- ✅ CORRECT - Vue/React escapes by default -->
<p>{{ comment.text }}</p>

<!-- ❌ WRONG - Direct HTML injection -->
<p [innerHTML]="comment.text"></p>
```

### 8. Broken Object-Level Authorization

```java
// ❌ WRONG
@GetMapping("/orders/{orderId}")
public Order getOrder(@PathVariable Long orderId) {
  return orderService.getOrder(orderId);  // No ownership check!
}

// ✅ CORRECT
@GetMapping("/orders/{orderId}")
public Order getOrder(@PathVariable Long orderId, @AuthenticationPrincipal User user) {
  Order order = orderService.getOrder(orderId);
  if (!order.getUserId().equals(user.getId()) && !user.isAdmin()) {
    throw new AccessDeniedException("Not your order");
  }
  return order;
}
```

### 9. Software & Data Integrity Failures

#### Dependency Scanning

```bash
# Maven
mvn org.owasp:dependency-check-maven:check

# Gradle
./gradlew dependencyCheckAnalyze

# Python
pip install safety
safety check
```

#### Supply Chain Security

```yaml
# GitHub Actions - Check dependencies
- name: Dependency check
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    format: 'sarif'
    output: 'trivy-results.sarif'
```

### 10. Logging & Monitoring Failures

#### Java - Structured Logging

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class UserService {
  private static final Logger logger = LoggerFactory.getLogger(UserService.class);
  
  public void login(String username, String ip) {
    try {
      User user = repository.findByUsername(username);
      logger.info("User login attempt", 
        "username", username, 
        "ip", ip, 
        "timestamp", Instant.now());
    } catch (Exception e) {
      logger.warn("Failed login attempt",
        "username", username, 
        "error", e.getMessage(), 
        "ip", ip);
    }
  }
  
  // ❌ DON'T log sensitive data
  // logger.info("Password: " + password);
  // logger.info("Card: " + cardNumber);
}
```

#### Python - Structured Logging

```python
import logging
import json

logger = logging.getLogger(__name__)

def login(username, ip):
  try:
    user = User.query.filter_by(username=username).first()
    logger.info(json.dumps({
      "event": "user_login",
      "username": username,
      "ip": ip,
      "timestamp": datetime.utcnow().isoformat()
    }))
  except Exception as e:
    logger.warning(json.dumps({
      "event": "failed_login",
      "username": username,
      "error": str(e),
      "ip": ip
    }))
```

## Azure-Specific Security

### Azure Key Vault Integration

```java
@Configuration
public class KeyVaultConfig {
  @Bean
  public SecretClient secretClient() {
    return new SecretClientBuilder()
      .vaultUrl("https://<vaultName>.vault.azure.net/")
      .credential(new DefaultAzureCredential())
      .buildClient();
  }
}
```

### Managed Identity (No Credentials in Code)

```java
// ✅ Azure Spring Cloud automatically handles authentication
// No need to manage credentials
```

## Security Best Practices Checklist

- [ ] Use HTTPS everywhere (TLS 1.2+)
- [ ] Validate ALL input
- [ ] Use parameterized queries
- [ ] Hash passwords with bcrypt (strength 12+)
- [ ] Implement rate limiting
- [ ] Add CSRF tokens for state-changing operations
- [ ] Use secure cookies (HttpOnly, Secure, SameSite)
- [ ] Implement comprehensive logging
- [ ] Perform regular security audits
- [ ] Keep dependencies updated
- [ ] Use Azure Key Vault for secrets
- [ ] Enable Azure Security Center recommendations

## Further Reading

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Spring Security Documentation](https://spring.io/projects/spring-security)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Azure Security Best Practices](https://docs.microsoft.com/en-us/azure/security/fundamentals/best-practices-and-patterns)

