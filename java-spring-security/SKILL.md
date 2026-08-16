---
name: java-spring-security
description: >
  Spring Security 6 / Spring Boot 4 authentication, authorization, and hardening.
  Use this skill when the task involves securing REST APIs, OAuth2 / OIDC / JWT,
  method-level security, password encoding, CORS, CSRF, session management, security
  headers, rate limiting, testing secured endpoints, or migrating from Spring Security 5/6.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-15
applies-to: Spring Security, Spring Boot 4, OAuth2, OIDC, JWT, RBAC, method security, CORS, CSRF
---

# Java Spring Security Skill

## When to Use This Skill

Load this skill for any Spring Security concern:
- Securing REST APIs or web apps
- Authentication (basic, form-based, LDAP, OAuth2, OIDC, JWT)
- Authorization (RBAC, role hierarchy, method-level security)
- Password encoding and credential management
- CORS, CSRF, session, and cookie configuration
- Security headers, HSTS, CSP, and rate limiting
- Testing secured endpoints
- Migrating from Spring Security 5 to Spring Security 6 / Spring Boot 4

## Priority Order

1. Follow repo-local security configuration and patterns first
2. Prefer Spring Security 6 / Boot 4 defaults and DSLs
3. If this skill conflicts with `java-spring`, prefer `java-spring` for non-security concerns and merge both for secured endpoints

## Output Contract

- State assumptions about auth model (sessions, JWT, OAuth2) when repo context is missing
- List files changed when making edits
- Add or update tests for secured behavior changes
- Call out security risks and follow-up work explicitly

## Conflict Resolution

1. Existing repo security config and enforced automation
2. Repo docs and local agent instructions
3. Loaded `project-conventions/SKILL.md`
4. This skill
5. Generic framework security best practices

---

## Security Filter Chain (Boot 4 / Security 6)

### Standard REST API Configuration
```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'"))
            );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://app.example.com"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

### Key Security 6 Changes from Security 5
- `authorizeRequests()` replaced by `authorizeHttpRequests()`
- `antMatchers()` replaced by `requestMatchers()`
- `hasRole('ADMIN')` still works; `hasAuthority('ROLE_ADMIN')` is equivalent
- `SecurityFilterChain` bean replaces the old `WebSecurityConfigurerAdapter`

---

## Authentication Strategies

### JWT Authentication
```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
                                    throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null && jwtService.isValid(token)) {
            String username = jwtService.extractUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
            auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }
}
```

### OAuth2 Resource Server (JWT)
```java
@Configuration
@EnableMethodSecurity
public class ResourceServerConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            );
        return http.build();
    }

    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoleConverter());
        return converter;
    }
}
```

### OAuth2 Client (Authorization Code)
```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: ${GOOGLE_CLIENT_ID}
            client-secret: ${GOOGLE_CLIENT_SECRET}
            scope: openid, profile, email
        provider:
          google:
            issuer-uri: https://accounts.google.com
```

---

## Authorization

### Role-Based Access Control
```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
    public UserResponse getUser(Long userId) {
        // ...
    }

    @RolesAllowed({"ADMIN", "MANAGER"})
    public List<UserResponse> getAllUsers() {
        // ...
    }
}
```

### Custom Permission Evaluator
```java
@Component
public class CustomPermissionEvaluator implements PermissionEvaluator {

    @Override
    public boolean hasPermission(HttpServletRequest request,
                                 Authentication authentication,
                                 Long resourceId) {
        // Business-specific permission logic
        return true;
    }
}
```

---

## Password Encoding

```java
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}

@Service
@RequiredArgsConstructor
public class AuthService {

    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;

    public UserResponse register(CreateUserRequest request) {
        User user = new User();
        user.setPassword(passwordEncoder.encode(request.password()));
        return userMapper.toResponse(userRepository.save(user));
    }

    public boolean matches(String raw, String encoded) {
        return passwordEncoder.matches(raw, encoded);
    }
}
```

### Password Strength Validation
```java
public record PasswordRequest(
    @NotBlank @StrongPassword String password
) {}

// Or with regex:
@Pattern(regexp = "^(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{12,}$",
         message = "Password must be 12+ chars with uppercase, digit, and special char")
String password;
```

---

## Testing Secured Endpoints

### MockMvc with Security
```java
@WebMvcTest(UserController.class)
class SecuredUserControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean UserService userService;

    @Test
    @WithMockUser(roles = "USER")
    void getUser_AsUser_Returns200() throws Exception {
        when(userService.findById(1L))
            .thenReturn(new UserResponse(1L, "Alice", "alice@example.com"));

        mockMvc.perform(get("/api/v1/users/1")
                .with(csrf()))  // CSRF enabled in test profile
            .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "USER")
    void deleteUser_AsUser_Returns403() throws Exception {
        mockMvc.perform(delete("/api/v1/users/1"))
            .andExpect(status().isForbidden());
    }
}
```

### Testcontainers Integration
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
class SecurityIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18-alpine");

    @Test
    void authenticate_ReturnsJwt() {
        // Full stack security verification
    }
}
```

---

## Common Security Headers and Hardening

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .headers(headers -> headers
            .frameOptions(frame -> frame.deny())               // Prevent clickjacking
            .contentSecurityPolicy(csp -> csp
                .policyDirectives("default-src 'self'; script-src 'self' 'unsafe-inline'"))
            .httpStrictTransportSecurity(hsts -> hsts
                .includeSubDomains(true)
                .maxAgeInSeconds(31536000))
        )
        .requiresChannel(channel -> channel
            .anyRequest().requiresSecure())  // Force HTTPS
        .sessionManagement(session -> session
            .sessionFixation().migrateSession()
            .maximumSessions(1)
            .maxSessionsPreventsLogin(true));

    return http.build();
}
```

---

## Non-Negotiable Rules

- **Never** store or log plaintext passwords — always hash with BCrypt strength 12+, never MD5 or SHA1
- **Never** disable CSRF for state-changing browser apps — only for stateless REST APIs with `SessionCreationPolicy.STATELESS`
- **Never** trust JWT tokens without validating signature, expiration, and issuer — validate on every request
- **Never** send authentication details in URL parameters — use Authorization headers or secure cookies only
- **Never** hardcode secrets — load JWT secrets, OAuth credentials from environment or Key Vault
- **Never** return sensitive data in error messages — never expose user IDs, hashes, or system internals to attackers
- **Always** use HTTPS in production; enforce with `requiresChannel()` or equivalent — never allow HTTP for authenticated endpoints
- **Always** use `SessionCreationPolicy.STATELESS` for JWT-based REST APIs — stateless scales; sessions don't
- **Always** scope OAuth2 tokens minimally — avoid broad scopes like `admin`; use fine-grained permissions
- **Always** validate JWT signatures and expiration on the resource server — do not trust the client
- **Always** use `@EnableMethodSecurity` not the deprecated `@EnableGlobalMethodSecurity`
- **Always** test both authorized AND unauthorized access paths — never assume defaults work
- **Always** check authorization at object level, not just role level — verify user owns the resource
- Implement explicit session fixation protection; use `migrateSession()` or `newSession()` on login
- Rate-limit authentication endpoints (login, token refresh) to prevent brute force and credential stuffing

---

## Related Skills

- `java-spring` — Core controllers, services, and DTOs that secured endpoints must still follow
- `java-data` — Data access patterns when integrating with user stores or audit tables
- `testing` — Advanced test patterns for security-focused test suites
