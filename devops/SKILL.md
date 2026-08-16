---
name: devops
description: >
  Use this skill for infrastructure and containerization. Covers Docker, Kubernetes,
  Terraform/Bicep Infrastructure as Code, and Azure-native DevOps practices. Trigger
  when working with containers, orchestration, IaC, or deployment infrastructure.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-16
applies-to: Docker, Kubernetes, Terraform, Bicep, IaC
---
# DevOps: Docker, Kubernetes, and Infrastructure as Code

Containerization strategies, Kubernetes deployments, Infrastructure as Code (Terraform, Bicep), and Azure-native DevOps practices.

## Non-Negotiable Security Rules (CRITICAL)

- **Never** run containers as root — always create a non-root user and switch before running
- **Never** use `latest` tags in production — pin specific versions for reproducibility and control
- **Never** hardcode secrets in Dockerfiles or Kubernetes manifests — use Secret objects or Azure Key Vault
- **Always** scan Docker images for vulnerabilities (`docker scan`, Trivy, Snyk) before pushing to registry
- **Always** use multi-stage builds to minimize final image size and reduce surface area
- **Always** specify resource limits (memory, CPU) for containers to prevent resource exhaustion attacks
- **Always** enable Pod Security Policies / Pod Security Standards in Kubernetes
- **Always** use Network Policies to restrict inter-pod traffic to only necessary flows
- **Never** expose Kubernetes services publicly unless explicitly necessary — use private endpoints, VPCs
- **Always** implement RBAC (Role-Based Access Control) with minimal permissions — follow principle of least privilege
- **Always** use image pull secrets and private container registries for internal images
- **Always** enable audit logging for all API calls in Kubernetes — required for security compliance
- Container images must be signed and verified — prevent tampering with unsigned images

## Quick Reference

### Multi-Stage Builds (Minimize Image Size)

#### Java Application

```dockerfile
# Stage 1: Build
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:resolve
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### Python Application

```dockerfile
# Stage 1: Build
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]
```

#### Node.js Application

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Security in Dockerfile

```dockerfile
# ✅ CORRECT - Non-root user
FROM alpine:latest
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
WORKDIR /app
COPY --chown=appuser:appgroup . .
ENTRYPOINT ["./app"]

# ✅ CORRECT - Use specific version tags
FROM eclipse-temurin:21-jre-alpine  # Not 'latest'

# ✅ CORRECT - Scan for vulnerabilities
# docker scan image:tag

# ❌ WRONG - Running as root
# FROM alpine
# COPY . .
# (implicitly runs as root)
```

### .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
*.env
.env.local
coverage
dist
build
.vscode
.DS_Store
```

## Kubernetes Deployment

### Basic Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-backend
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: api-backend
    spec:
      containers:
      - name: api
        image: myregistry.azurecr.io/api-backend:1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: connection-string
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
          limits:
            cpu: "500m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - api-backend
              topologyKey: kubernetes.io/hostname
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-backend-service
spec:
  selector:
    app: api-backend
  type: ClusterIP
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
    name: http
```

### ConfigMap & Secrets

```yaml
# ✅ Non-sensitive config
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "INFO"
  ENVIRONMENT: "production"
  API_TIMEOUT: "30"

---
# ✅ Secrets - Use Azure Key Vault instead of hardcoding
apiVersion: v1
kind: Secret
metadata:
  name: db-secrets
type: Opaque
data:
  connection-string: base64encodedvalue
  password: base64encodedvalue
```

### Ingress with HTTPS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls-cert
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-backend-service
            port:
              number: 80
```

## Infrastructure as Code

### Bicep (Azure)

```bicep
// main.bicep
param location string = resourceGroup().location
param environment string = 'prod'
param tags object = {}

var appServicePlanName = 'asp-${environment}-${uniqueString(resourceGroup().id)}'
var appServiceName = 'app-${environment}-${uniqueString(resourceGroup().id)}'

resource appServicePlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B2'
    capacity: 2
  }
  tags: tags
  properties: {
    reserved: true
  }
}

resource appService 'Microsoft.Web/sites@2021-02-01' = {
  name: appServiceName
  location: location
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      http20Enabled: true
      minTlsVersion: '1.2'
      linuxFxVersion: 'JAVA|21-java21'
      alwaysOn: true
      appSettings: [
        {
          name: 'DATABASE_URL'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault::dbConnectionString})'
        }
      ]
    }
  }
}

output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
```

### Terraform (Multi-Cloud)

```hcl
# main.tf
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${var.environment}"
  location = var.location
}

resource "azurerm_container_registry" "main" {
  name                = "acr${var.environment}${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false
}

resource "azurerm_container_app_environment" "main" {
  name                           = "cae-${var.environment}"
  location                       = azurerm_resource_group.main.location
  resource_group_name            = azurerm_resource_group.main.name
  log_analytics_workspace_id     = azurerm_log_analytics_workspace.main.id
}

output "registry_url" {
  value = azurerm_container_registry.main.login_server
}
```

## Database Migrations

### Flyway (Java)

```xml
<plugin>
  <groupId>org.flywaydb</groupId>
  <artifactId>flyway-maven-plugin</artifactId>
  <version>9.0.0</version>
  <configuration>
    <url>jdbc:postgresql://localhost:5432/mydb</url>
    <user>postgres</user>
    <password>${db.password}</password>
    <locations>
      <location>classpath:db/migration</location>
    </locations>
  </configuration>
</plugin>
```

```sql
-- db/migration/V1__Initial_schema.sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- db/migration/V2__Add_roles.sql
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'USER';
```

### Liquibase (Java, Python)

```xml
<databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog">
  <changeSet id="1" author="dev">
    <createTable tableName="users">
      <column name="id" type="int" autoIncrement="true">
        <constraints primaryKey="true"/>
      </column>
      <column name="email" type="varchar(255)">
        <constraints unique="true" nullable="false"/>
      </column>
    </createTable>
  </changeSet>
</databaseChangeLog>
```

## Monitoring & Observability

### Prometheus Metrics (Java)

```java
@Configuration
public class MetricsConfig {
  @Bean
  public MeterRegistry meterRegistry() {
    return new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
  }
}

@RestController
public class MetricsController {
  private final MeterRegistry meterRegistry;
  
  @PostMapping("/api/users")
  public ResponseEntity<?> createUser(@RequestBody UserRequest req) {
    meterRegistry.counter("users.created").increment();
    // ... logic
  }
}
```

### Azure Monitor Integration

```java
@Configuration
public class AzureMonitorConfig {
  @Bean
  public TelemetryClient telemetryClient() {
    return new TelemetryClient();
  }
}
```

## Security Best Practices (DevOps)

- [ ] Use secrets management (Azure Key Vault, HashiCorp Vault)
- [ ] Scan Docker images for vulnerabilities (Trivy, Aqua)
- [ ] Enable Pod Security Standards
- [ ] Use Network Policies to limit traffic
- [ ] Implement RBAC (Role-Based Access Control)
- [ ] Use image pull secrets
- [ ] Enable container registry scanning
- [ ] Use managed identities (no secrets in code)
- [ ] Enable audit logging
- [ ] Regular security patches and updates

## Further Reading

- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure Container Apps](https://docs.microsoft.com/en-us/azure/container-apps/)
- [Helm Package Manager](https://helm.sh/)

