# CI/CD Pipeline Setup & Best Practices

Comprehensive guide for setting up CI/CD pipelines with GitHub Actions, GitLab CI, and Jenkins tailored to multi-stack projects (Java, Python, JavaScript/TypeScript).

## Non-Negotiable CI/CD Rules (CRITICAL)

- **Never** store secrets in pipeline YAML or environment variables in code — use secret management systems only
- **Never** allow merges without passing all CI checks — branch protection is mandatory
- **Never** cache dependencies without verification — verify checksums/hashes to prevent supply chain attacks
- **Always** fail the pipeline on security vulnerabilities (dependency checks, SAST, secrets scanning)
- **Always** run linting and formatting checks; fail if standards not met — enforce consistency
- **Always** run full test suite before deployment; never skip tests to speed up pipeline
- **Always** scan dependencies for CVEs on every build — both direct and transitive dependencies
- **Always** generate and publish test reports and coverage metrics
- **Always** implement deployment approvals for production — manual gating is required
- **Never** deploy from local machines to production — only deployments from main branch via CI/CD
- **Always** verify build reproducibility — the same source code should produce the same artifacts
- Log all deployments with timestamps, who triggered them, and what was deployed (for audit trails)
- Health checks are mandatory after deployment — ensure service is actually running before marking deployment successful

## Quick Reference

### GitHub Actions Workflow Structure

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          java-version: '21'
          distribution: 'temurin'
      - run: mvn clean test
```

## Environment Setup

### Java Projects (Maven)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven
      - run: mvn clean verify
      - run: mvn integration-test
```

### Java Projects (Gradle)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: gradle/gradle-build-action@v2
      - run: ./gradlew build
      - run: ./gradlew test
```

### Python Projects

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.9', '3.10', '3.11']
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'
      - run: pip install -r requirements.txt
      - run: pytest
```

### Node.js / TypeScript Projects

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ['18.x', '20.x']
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## Common Pipeline Stages

### 1. Build Stage

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-java@v3
      with:
        java-version: '21'
        distribution: 'temurin'
    - run: mvn clean package -DskipTests
    - uses: actions/upload-artifact@v3
      with:
        name: build-artifacts
        path: target/
```

### 2. Test Stage

```yaml
test:
  needs: build
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:15
      env:
        POSTGRES_PASSWORD: postgres
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432
  steps:
    - uses: actions/checkout@v3
    - uses: actions/download-artifact@v3
      with:
        name: build-artifacts
    - uses: actions/setup-java@v3
      with:
        java-version: '21'
        distribution: 'temurin'
    - run: mvn test
```

### 3. Code Quality Stage

```yaml
quality:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-java@v3
      with:
        java-version: '21'
        distribution: 'temurin'
    - run: mvn clean verify sonar:sonar
      env:
        SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
        SONAR_LOGIN: ${{ secrets.SONAR_LOGIN }}
```

### 4. Security Scanning

```yaml
security:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
    - uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
```

### 5. Deployment Stage

```yaml
deploy:
  needs: [build, test, quality]
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/download-artifact@v3
      with:
        name: build-artifacts
    - uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    - uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ secrets.AZURE_APP_NAME }}
        slot-name: 'staging'
        package: '.'
    - name: Run smoke tests
      run: |
        sleep 30
        curl -f http://staging-url/health || exit 1
```

## GitLab CI Configuration

```yaml
stages:
  - build
  - test
  - deploy

variables:
  MAVEN_OPTS: "-Dmaven.repo.local=.m2/repository"

build:
  stage: build
  image: maven:3.8.1-openjdk-21
  script:
    - mvn clean package -DskipTests
  artifacts:
    paths:
      - target/
    expire_in: 1 hour
  only:
    - merge_requests
    - main

test:
  stage: test
  image: maven:3.8.1-openjdk-21
  services:
    - postgres:15
  script:
    - mvn test
  coverage: '/.*<lineCoverage>(.*)<\/lineCoverage>.*/'
  artifacts:
    reports:
      junit: target/surefire-reports/TEST-*.xml

deploy:
  stage: deploy
  image: alpine:latest
  script:
    - apk add --no-cache curl
    - curl -X POST https://deploy-webhook/deploy
  only:
    - main
  when: manual
```

## Jenkins Pipeline

```groovy
pipeline {
  agent any
  
  environment {
    JAVA_HOME = '/usr/lib/jvm/java-21-openjdk'
    PATH = "${JAVA_HOME}/bin:${PATH}"
  }
  
  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }
    
    stage('Build') {
      steps {
        sh 'mvn clean package -DskipTests'
      }
    }
    
    stage('Test') {
      steps {
        sh 'mvn test'
        junit 'target/surefire-reports/*.xml'
      }
    }
    
    stage('Quality') {
      steps {
        sh 'mvn sonar:sonar'
      }
    }
    
    stage('Deploy to Staging') {
      when {
        branch 'main'
      }
      steps {
        sh './deploy.sh staging'
      }
    }
    
    stage('Deploy to Production') {
      when {
        branch 'main'
      }
      input {
        message "Deploy to production?"
        ok "Deploy"
      }
      steps {
        sh './deploy.sh production'
      }
    }
  }
  
  post {
    always {
      cleanWs()
    }
    success {
      echo 'Pipeline succeeded!'
    }
    failure {
      echo 'Pipeline failed!'
    }
  }
}
```

## Multi-Stack Pipeline Strategy

### Structure for Monorepo

```yaml
# .github/workflows/monorepo-ci.yml
name: Monorepo CI

on: [push, pull_request]

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      backend-changed: ${{ steps.detect.outputs.backend }}
      frontend-changed: ${{ steps.detect.outputs.frontend }}
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - name: Detect changes
        id: detect
        run: |
          if git diff --name-only HEAD~1 | grep -q '^backend/'; then
            echo "backend=true" >> $GITHUB_OUTPUT
          fi
          if git diff --name-only HEAD~1 | grep -q '^frontend/'; then
            echo "frontend=true" >> $GITHUB_OUTPUT
          fi

  backend:
    needs: setup
    if: needs.setup.outputs.backend-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
      - run: mvn -f backend/pom.xml clean verify

  frontend:
    needs: setup
    if: needs.setup.outputs.frontend-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install --prefix frontend
      - run: npm run build --prefix frontend
      - run: npm run test --prefix frontend
```

## Best Practices

1. **Parallel jobs** — Run independent tasks concurrently to reduce pipeline time
2. **Cache dependencies** — Use `cache` action for Maven, npm, pip
3. **Matrix strategy** — Test against multiple versions (Java 19, 20, 21, etc.)
4. **Service containers** — Use Docker images for databases and services
5. **Artifacts** — Save build outputs for later stages
6. **Secrets management** — Use encrypted secrets for credentials
7. **Branch protection** — Require pipeline success before merge
8. **Fail fast** — Fail early on critical errors (linting, security)

## Monitoring & Notifications

```yaml
- name: Slack notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
    text: 'Deployment ${{ job.status }}: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}'
```

## Further Reading

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [GitLab CI/CD](https://docs.gitlab.com/ee/ci/)
- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Docker in CI/CD](https://docs.docker.com/build/)

