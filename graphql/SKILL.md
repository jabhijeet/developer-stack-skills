# GraphQL: API Design, Schema Management, and Client Integration

Build type-safe GraphQL APIs with Java/Spring, Python/Strawberry, and integrate with React/Vue clients. Schema-first design patterns and production best practices.

## Non-Negotiable Security Rules

- **Never** expose the full schema to unauthenticated clients — implement introspection guards
- **Never** return sensitive data in errors — error messages leak information in production
- **Always** validate query depth to prevent infinite/deeply nested queries (DoS attacks)
- **Always** implement rate limiting on GraphQL endpoints — queries can be expensive
- **Always** authenticate and authorize every field access — not just at root level
- **Always** log all mutations (data-changing operations) for audit trails
- **Always** use HTTPS in production; never allow HTTP for authenticated GraphQL
- **Always** implement query complexity analysis to prevent expensive queries from running
- **Never** allow unlimited batching or aliasing — prevent query explosion attacks
- Field-level authorization is mandatory — some fields should only be readable by admins

## GraphQL Fundamentals

### Query vs Mutation vs Subscription

```graphql
# Query (Read)
query GetUserById {
  user(id: "123") {
    id
    name
    email
    posts {
      id
      title
    }
  }
}

# Mutation (Write)
mutation CreatePost {
  createPost(input: {
    title: "My Blog Post"
    content: "Content here"
    published: true
  }) {
    id
    title
    author {
      id
      name
    }
  }
}

# Subscription (Real-time)
subscription OnPostCreated {
  postCreated {
    id
    title
    author {
      name
    }
  }
}
```

## Java/Spring GraphQL

### Setup with Spring Boot

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-graphql</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

### Schema Definition (schema.graphqls)

```graphql
type Query {
  user(id: ID!): User
  users(first: Int, after: String): UserConnection!
  post(id: ID!): Post
  posts(filter: PostFilter): [Post!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
  createPost(input: CreatePostInput!): Post!
}

type Subscription {
  userCreated: User!
  postUpdated(id: ID!): Post!
}

type User {
  id: ID!
  name: String!
  email: String!
  createdAt: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: String!
  published: Boolean!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

type UserEdge {
  cursor: String!
  node: User!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

input CreateUserInput {
  name: String!
  email: String!
}

input UpdateUserInput {
  name: String
  email: String
}

input CreatePostInput {
  title: String!
  content: String!
  published: Boolean
}

input PostFilter {
  published: Boolean
  authorId: ID
}
```

### Resolver Implementation

```java
@Controller
public class UserController {
  private final UserService userService;
  private final PostService postService;

  public UserController(UserService userService, PostService postService) {
    this.userService = userService;
    this.postService = postService;
  }

  @QueryMapping
  public User user(@Argument("id") String id) {
    return userService.getUserById(id);
  }

  @QueryMapping
  public UserConnection users(
      @Argument(name = "first", defaultValue = "10") int first,
      @Argument(name = "after", defaultValue = "") String after) {
    return userService.getUsersPaginated(first, after);
  }

  @MutationMapping
  public User createUser(@Argument("input") CreateUserInput input) {
    return userService.createUser(input.getName(), input.getEmail());
  }

  @MutationMapping
  public Boolean deleteUser(@Argument("id") String id) {
    userService.deleteUser(id);
    return true;
  }

  @SchemaMapping
  public List<Post> posts(User user) {
    return postService.getPostsByAuthor(user.getId());
  }

  @SubscriptionMapping
  public Flux<User> userCreated() {
    return userService.getCreatedUserFlux();
  }
}

@Controller
public class PostController {
  private final PostService postService;
  private final UserService userService;

  @QueryMapping
  public List<Post> posts(@Argument(name = "filter", required = false) PostFilter filter) {
    return postService.getPosts(filter);
  }

  @MutationMapping
  public Post createPost(@Argument("input") CreatePostInput input) {
    return postService.createPost(input);
  }

  @SchemaMapping
  public User author(Post post) {
    return userService.getUserById(post.getAuthorId());
  }

  @SubscriptionMapping
  public Flux<Post> postUpdated(@Argument("id") String postId) {
    return postService.getPostUpdates(postId);
  }
}
```

### Error Handling

```java
@ControllerAdvice
public class GraphQLExceptionHandler implements DataFetcherExceptionResolver {
  @Override
  public DataFetcherResult<?> resolveException(Throwable exception,
      DataFetchingEnvironment env) {
    if (exception instanceof UserNotFoundException) {
      return DataFetcherResult.newResult()
          .error(GraphQLError.newError()
              .message("User not found")
              .path(env.getExecutionStepInfo().getPath())
              .errorType(ErrorType.NOT_FOUND)
              .build())
          .build();
    }
    // Handle other exceptions
    throw exception;
  }
}
```

### Scalar Types

```java
@Configuration
public class GraphQLScalarConfig {
  @Bean
  public GraphQLScalarType dateScalar() {
    return GraphQLScalarType.newScalar()
        .name("DateTime")
        .description("Date-Time scalar")
        .coercing(new Coercing<LocalDateTime, String>() {
          @Override
          public String serialize(Object dataFetcher) {
            if (dataFetcher instanceof LocalDateTime) {
              return ((LocalDateTime) dataFetcher).toString();
            }
            throw new CoercingSerializeException("Value must be LocalDateTime");
          }

          @Override
          public LocalDateTime parseValue(Object value) {
            if (value instanceof String) {
              return LocalDateTime.parse((String) value);
            }
            throw new CoercingParseValueException("Value must be ISO 8601 string");
          }

          @Override
          public LocalDateTime parseLiteral(Object value) {
            if (value instanceof StringValue) {
              return LocalDateTime.parse(((StringValue) value).getValue());
            }
            throw new CoercingParseLiteralException("Value must be ISO 8601 string");
          }
        })
        .build();
  }
}
```

## Python GraphQL (Strawberry)

### Setup

```bash
pip install strawberry-graphql strawberry-graphql-django
pip install fastapi uvicorn
```

### Schema Definition

```python
from typing import List, Optional
from strawberry import type, field
import strawberry

@type
class User:
  id: strawberry.ID
  name: str
  email: str
  created_at: str

@type
class Post:
  id: strawberry.ID
  title: str
  content: str
  author: User
  published: bool

@type
class Query:
  @field
  def user(self, id: strawberry.ID) -> Optional[User]:
    # Fetch from database
    return user_service.get_by_id(id)

  @field
  def users(self, first: int = 10, after: Optional[str] = None) -> List[User]:
    return user_service.get_paginated(first, after)

  @field
  def posts(self, published: Optional[bool] = None) -> List[Post]:
    return post_service.filter(published=published)

@type
class Mutation:
  @field
  def create_user(self, name: str, email: str) -> User:
    return user_service.create(name, email)

  @field
  def create_post(self, title: str, content: str, published: bool = False) -> Post:
    return post_service.create(title, content, published)

schema = strawberry.Schema(query=Query, mutation=Mutation)
```

### FastAPI Integration

```python
from strawberry.fastapi import GraphQLRouter
from fastapi import FastAPI

app = FastAPI()

graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/graphql")

@app.get("/health")
async def health():
  return {"status": "ok"}
```

## React/Vue GraphQL Client

### React with Apollo Client

```bash
npm install @apollo/client graphql
```

```typescript
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { gql } from '@apollo/client';

const client = new ApolloClient({
  link: new HttpLink({ 
    uri: 'http://localhost:8080/graphql',
    credentials: 'include', // For cookies
  }),
  cache: new InMemoryCache(),
});

// Query
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      posts {
        id
        title
      }
    }
  }
`;

// Component
import { useQuery } from '@apollo/client';

export function UserProfile({ userId }) {
  const { data, loading, error } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
      <h2>Posts</h2>
      <ul>
        {data.user.posts.map(post => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Mutation Example

```typescript
const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      author {
        name
      }
    }
  }
`;

export function CreatePostForm() {
  const [createPost, { loading }] = useMutation(CREATE_POST, {
    refetchQueries: [{ query: GET_POSTS }],
  });

  const handleSubmit = async (formData) => {
    try {
      const result = await createPost({
        variables: { input: formData },
      });
      console.log('Post created:', result.data.createPost);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit({ title: 'Test', content: 'Test content' });
    }}>
      <input type="text" placeholder="Title" />
      <button type="submit" disabled={loading}>
        Create
      </button>
    </form>
  );
}
```

### Vue with Apollo

```bash
npm install @vue/apollo-composable graphql
```

```vue
<script setup lang="ts">
import { useQuery, useMutation } from '@vue/apollo-composable';
import { gql } from '@apollo/client';

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

const { result, loading, error } = useQuery(GET_USER, () => ({
  id: userId.value,
}));
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>
    <h1>{{ result?.user?.name }}</h1>
    <p>{{ result?.user?.email }}</p>
  </div>
</template>
```

## Performance & Best Practices

### DataLoader Pattern (N+1 Prevention)

```java
@Configuration
public class DataLoaderConfig {
  @Bean
  public DataLoaderRegistry dataLoaderRegistry() {
    DataLoaderRegistry registry = new DataLoaderRegistry();

    DataLoader<String, User> userLoader = DataLoader.newDataLoader((userIds) ->
        CompletableFuture.supplyAsync(() ->
            userService.getUsersByIds(userIds)
        )
    );

    registry.register("user", userLoader);
    return registry;
  }
}

@Controller
public class PostController {
  @SchemaMapping
  public CompletableFuture<User> author(Post post, DataLoaderRegistry registry) {
    DataLoader<String, User> userLoader = registry.getDataLoader("user");
    return userLoader.load(post.getAuthorId());
  }
}
```

### Query Complexity Analysis

```java
@Configuration
public class GraphQLConfig {
  @Bean
  public GraphQLInstrumentation queryComplexityInstrumentation() {
    return new MaxQueryComplexityInstrumentation(1000);
  }
}
```

## Security Best Practices

- [ ] Validate query depth (prevent infinite queries)
- [ ] Implement rate limiting
- [ ] Use authentication/authorization decorators
- [ ] Sanitize inputs
- [ ] Hide error details in production
- [ ] Log all mutations
- [ ] Use HTTPS
- [ ] Implement field-level security

## Testing GraphQL APIs

```java
@WebGraphQlTest
public class UserControllerTest {
  @Autowired
  private GraphQlTester graphQlTester;

  @Test
  void testGetUser() {
    graphQlTester
        .documentName("getUser")
        .variable("id", "1")
        .execute()
        .path("user.name")
        .entity(String.class)
        .isEqualTo("John");
  }
}
```

## Further Reading

- [GraphQL.org Documentation](https://graphql.org/)
- [Spring GraphQL](https://spring.io/projects/spring-graphql)
- [Strawberry GraphQL](https://strawberry.rocks/)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

