# developer-stack-skills

> AI agent SKILL.md files for full-stack developers — Java, Python, React, Angular, Testing, and Project Conventions.

Compatible with **Claude**, **Cline**, **Roocode**, **GitHub Copilot**, and **Cursor**.

---

## Install

```bash
npm install developer-stack-skills
```

---

## Skills Included

| Skill | File | Use When |
|---|---|---|
| `java-spring` | `java-spring/SKILL.md` | Spring Boot, JPA, REST APIs, JUnit |
| `python-backend` | `python-backend/SKILL.md` | FastAPI, SQLAlchemy, Pydantic, pytest |
| `frontend` | `frontend/SKILL.md` | React, Angular, TypeScript, TanStack Query |
| `testing` | `testing/SKILL.md` | Unit, integration, E2E across all stacks |
| `project-conventions` | `project-conventions/SKILL.md` | Git, ADRs, naming, PR standards, README |

---

## Usage by Agent

### Claude / Cursor
Point to the skill file in your system prompt or agent config:
```
Read node_modules/developer-stack-skills/java-spring/SKILL.md before writing any Java code.
```

### Cline (VS Code)
Add to `.clinerules` in your project root:
```
skills:
  - node_modules/developer-stack-skills/java-spring/SKILL.md
  - node_modules/developer-stack-skills/testing/SKILL.md
  - node_modules/developer-stack-skills/project-conventions/SKILL.md
```

### Roocode
Add to `.roo/config.yml`:
```yaml
skills:
  - path: node_modules/developer-stack-skills/python-backend/SKILL.md
  - path: node_modules/developer-stack-skills/frontend/SKILL.md
```

### GitHub Copilot
Reference in `.github/copilot-instructions.md`:
```markdown
Follow the conventions in:
- node_modules/developer-stack-skills/frontend/SKILL.md
- node_modules/developer-stack-skills/project-conventions/SKILL.md
```

---

## Stack

- **Java**: Java 17+, Spring Boot 3.x, JPA/Hibernate, JUnit 5, Mockito
- **Python**: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.x, pytest
- **Frontend**: React 18+, Angular 17+, TypeScript 5+, TanStack Query, Vitest
- **Testing**: JUnit 5, pytest, Vitest, Testing Library, Playwright, Testcontainers
- **Conventions**: Conventional Commits, ADRs, Git Flow or Trunk-Based Development

---

## License

MIT
