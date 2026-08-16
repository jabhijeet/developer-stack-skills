---
name: java-spring-ai
description: >
  Spring AI 1.x / 2.x integration for Java applications. Use this skill when the task
  involves adding LLM chat clients, RAG pipelines, vector stores, prompt templates,
  structured output, AI agents with function calling, embedding models, streaming
  responses, or observability for AI features.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-15
applies-to: Spring AI, OpenAI, Anthropic, Ollama, Azure OpenAI, RAG, vector stores, embeddings, AI agents
---

# Java Spring AI Skill

## When to Use This Skill

Load this skill for AI/LLM integration work in Spring Boot:
- Adding chat completions with OpenAI, Anthropic, Ollama, or Azure OpenAI
- Building RAG pipelines with document loaders and vector stores
- Configuring embedding models and similarity search
- Using prompt templates, system messages, and structured output
- Implementing AI agents with function calling and tool use
- Streaming chat responses to clients
- Observability and cost tracking for AI features

## Priority Order

1. Follow repo-local AI patterns and existing client wrappers first
2. Prefer Spring AI 2.x APIs when available; fall back to 1.x if the project is pinned
3. If this skill conflicts with `java-spring`, prefer `java-spring` for standard controller/service structure and merge this skill for AI-specific concerns

## Output Contract

- State model provider, version, and deployment assumptions when repo context is missing
- List files changed when making edits
- Add or update tests for AI behavior changes
- Call out token costs, latency, and fallback risks explicitly

## Conflict Resolution

1. Existing repo AI config and enforced automation
2. Repo docs and local agent instructions
3. Loaded `project-conventions/SKILL.md`
4. This skill
5. Generic AI integration best practices

---

## Project Structure Convention

```
src/main/java/com/company/project/
├── ai/
│   ├── config/           # AiClient, ChatOptions, VectorStore beans
│   ├── service/          # AI orchestration, RAG pipelines
│   ├── model/            # Domain objects for AI (Message, Citation, etc.)
│   ├── prompt/           # Prompt templates and system messages
│   └── tool/             # Function calling definitions
```

---

## Dependencies

### Maven
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-pgvector-store-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle
```kotlin
implementation("org.springframework.ai:spring-ai-openai-spring-boot-starter:1.0.0")
implementation("org.springframework.ai:spring-ai-pgvector-store-spring-boot-starter:1.0.0")
```

> Spring AI version tracks Spring Boot version in 2.x line. Check compatibility matrix when upgrading.

---

## Chat Client

### Basic Chat
```java
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatClient chatClient;

    public String ask(String question) {
        return chatClient.prompt()
            .user(question)
            .call()
            .content();
    }
}
```

### Structured Output
```java
public record Itinerary(String destination, int days, List<String> activities) {}

@Service
@RequiredArgsConstructor
public class TravelService {

    private final ChatClient chatClient;

    public Itinerary planTrip(String destination) {
        return chatClient.prompt()
            .user(u -> u.text("Plan a 3-day trip to {destination}")
                .param("destination", destination))
            .call()
            .entity(Itinerary.class);
    }
}
```

### Streaming Responses
```java
@GetMapping(value = "/api/v1/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ChatResponse> streamChat(@RequestParam String message) {
    return chatClient.prompt()
        .user(message)
        .stream()
        .chatResponses();
}
```

---

## RAG — Retrieval Augmented Generation

### Document Loading
```java
@Configuration
public class RagConfig {

    @Bean
    public VectorStore vectorStore(EmbeddingModel embeddingModel,
                                   DataSource dataSource) {
        return new PgVectorStore(dataSource, embeddingModel);
    }

    // In-memory alternative for local development — enable exactly one VectorStore bean
    @Bean
    public SimpleVectorStore localVectorStore(EmbeddingModel embeddingModel) {
        return new SimpleVectorStore(embeddingModel);
    }
}

@Service
@RequiredArgsConstructor
public class DocumentIngestionService {

    private final VectorStore vectorStore;
    private final DocumentLoader documentLoader;

    public void ingest(Path file) {
        List<Document> documents = documentLoader.load(file);
        vectorStore.add(documents);
    }
}
```

### RAG Query Pipeline
```java
@Service
@RequiredArgsConstructor
public class RagService {

    private final VectorStore vectorStore;
    private final ChatClient chatClient;

    public String answer(String question) {
        List<Document> relevant = vectorStore.similaritySearch(question);
        String context = relevant.stream()
            .map(Document::getContent)
            .collect(Collectors.joining("\n"));

        return chatClient.prompt()
            .system(s -> s.text("Answer using only this context: {context}")
                .param("context", context))
            .user(question)
            .call()
            .content();
    }
}
```

---

## Prompt Templates

```java
@Component
public class PromptTemplates {

    private static final PromptTemplate FIXTURE_SUMMARY =
        PromptTemplate.from("""
            Summarize the following fixture in 3 bullet points:
            
            Context:
            {context}
            
            Fixture:
            {fixture}
            """);

    public String summarizeFixture(String context, String fixture) {
        return FIXTURE_SUMMARY.render(Map.of(
            "context", context,
            "fixture", fixture
        ));
    }
}
```

---

## Function Calling / Tool Use

```java
public record WeatherTool(
    String name,
    String description,
    JsonSchema inputSchema,
    FunctionCallback handler
) {}

@Service
@RequiredArgsConstructor
public class AgentService {

    private final ChatClient chatClient;

    public String runAgent(String userMessage) {
        return chatClient.prompt()
            .user(userMessage)
            .tools(
                new FunctionTool(
                    "getCurrentWeather",
                    "Get the current weather for a location",
                    new JsonSchema(...),
                    args -> fetchWeather(args.get("location").toString())
                )
            )
            .call()
            .getResponse();
    }
}
```

---

## Observability

```java
@Configuration
public class AiObservabilityConfig {

    @Bean
    public AiObservationHandler aiObservationHandler(MeterRegistry registry) {
        return new AiObservationHandler(registry);
    }
}
```

Track:
- Token usage per request (prompt + completion)
- Latency distribution for LLM calls
- Error rate by model provider
- Cost estimates (prompt tokens * input price + completion tokens * output price)

---

## Testing

### Unit Test with Mock AI Client
```java
@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock(answer = Answers.RETURNS_DEEP_STUBS)
    ChatClient chatClient;
    @InjectMocks ChatService chatService;

    @Test
    void ask_ReturnsResponse() {
        when(chatClient.prompt().user("hi").call().content())
            .thenReturn("Hello");

        String result = chatService.ask("hi");
        assertThat(result).isEqualTo("Hello");
    }
}
```

### Integration Test with Testcontainers
```java
@SpringBootTest
class RagServiceIT {

    @Container
    static PostgreSQLContainer<?> pgvector = new PostgreSQLContainer<>("pgvector/pgvector:17")
        .withDatabaseName("test")
        .withUsername("test")
        .withPassword("test");

    @Test
    void rag_ReturnsContextualAnswer() {
        // Verify embedding storage and retrieval against real PGVector
    }
}
```

---

## Non-Negotiable Rules

- **Never** commit API keys or secrets — use environment variables or Spring Vault; rotate immediately if exposed
- **Always** set a timeout on LLM calls (e.g., 30s default, max 60s) — without timeout, hanging requests cripple services
- **Always** implement fallback behavior when the AI service is unavailable — assume external services will fail
- **Always** validate and sanitize user inputs before sending them to the model — prompt injection is a real vulnerability
- **Always** log token usage and cost for production AI features — costs scale exponentially; monitor continuously
- **Never** trust model output blindly — apply business validation, guardrails, and sanity checks; LLMs hallucinate
- **Always** version prompt templates and track changes in ADRs when prompts affect product behavior — prompt changes are code changes
- Prefer parameterized prompts over string concatenation to avoid injection attacks and accidental data leakage
- Implement rate limiting on AI endpoints — token costs are passed through; unlimited access = unlimited bill
- Cache responses when applicable — embeddings and common queries should be cached to reduce latency and cost

---

## Related Skills

- `java-spring` — Core controller and service structure for AI endpoints
- `java-data` — Vector store configuration and database access patterns
- `testing` — Advanced mocking and Testcontainers patterns for AI tests
