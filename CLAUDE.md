# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Factory Inventory Management System Demo with GitHub integration - Full-stack application with Vue 3 frontend, Python FastAPI backend, and in-memory mock data (no database).

## Critical Tool Usage Rules

### Subagents
Use the Task tool with these specialized subagents for appropriate tasks:

- **vue-expert**: Use for Vue 3 frontend features, UI components, styling, and client-side functionality
  - Examples: Creating components, fixing reactivity issues, performance optimization, complex state management
  - **MANDATORY RULE: ANY time you need to create or significantly modify a .vue file, you MUST delegate to vue-expert**
- **code-reviewer**: Use after writing significant code to review quality and best practices
- **Explore**: Use for understanding codebase structure, searching for patterns, or answering questions about how components work
- **general-purpose**: Use for complex multi-step tasks or when other agents don't fit

### Skills
- **backend-api-test** skill: Use when writing or modifying tests in `tests/backend` directory with pytest and FastAPI TestClient

### MCP Tools
- **ALWAYS use GitHub MCP tools** (`mcp__github__*`) for ALL GitHub operations
  - Exception: Local branches only - use `git checkout -b` instead of `mcp__github__create_branch`
- **ALWAYS use Playwright MCP tools** (`mcp__playwright__*`) for browser testing
  - Test against: `http://localhost:3000` (frontend), `http://localhost:8001` (API)

## Stack
- **Frontend**: Vue 3 + Composition API + Vite (port 3000)
- **Backend**: Python FastAPI (port 8001)
- **Data**: JSON files in `server/data/` loaded via `server/mock_data.py`

## Commands

```bash
# Backend
cd server && uv run python main.py

# Frontend
cd client && npm install && npm run dev

# Run all backend tests
cd tests && uv run pytest backend/ -v

# Run a single test file
cd tests && uv run pytest backend/test_inventory.py -v

# Run a single test by name
cd tests && uv run pytest backend/ -k "test_function_name" -v

# Run tests with coverage
cd tests && uv run pytest backend/ --cov
```

No lint tooling is configured (no ESLint, Prettier, black, or ruff).

## Architecture

### Filter System
`client/src/composables/useFilters.js` is a **global singleton** — it exports reactive refs directly, not a factory function. Every component that calls `useFilters()` shares the same 4 refs (`selectedPeriod`, `selectedLocation`, `selectedCategory`, `selectedStatus`). Changes in `FilterBar.vue` immediately propagate to all views. `getCurrentFilters()` maps these to API query params.

### Data Flow
Vue filters → `client/src/api.js` (axios, `http://localhost:8001/api`) → FastAPI → In-memory filtering via `apply_filters()` / `filter_by_month()` → Pydantic validation → Computed properties in Vue views

### State Management
No Vuex or Pinia. `useFilters` is the only app-wide state. All other state (fetched data, modal visibility) is component-local refs. Each view fetches on mount with no caching or request deduplication.

### i18n / Currency
`useI18n.js` persists locale to localStorage. Switching language (en/ja) automatically switches currency (USD/JPY) — it is not a separate user setting. The `currentCurrency` computed property is derived from `currentLocale`.

### Backend Data Loading
`server/mock_data.py` loads all JSON files once at startup into module-level globals. **A server restart is required to pick up changes to any file in `server/data/`.**

## Known Gaps (Incomplete Features)
`client/src/api.js` calls endpoints that **do not exist in `server/main.py`**:
- `GET/POST/DELETE /api/tasks` — used by `TasksModal.vue`
- `GET/POST /api/purchase-orders` — used by `BacklogDetailModal.vue`

These will return 404. Do not add frontend logic that depends on them without first adding the backend endpoints.

Several KPIs in `Dashboard.vue` are hardcoded in the Vue template (Inventory Turnover: 4.2, Avg Processing Time: 8.5 days) — they are not returned by any API endpoint.

## API Endpoints
- `GET /api/inventory` - Filters: warehouse, category
- `GET /api/orders` - Filters: warehouse, category, status, month
- `GET /api/dashboard/summary` - All filters
- `GET /api/demand`, `/api/backlog` - No filters
- `GET /api/spending/*` - Summary, monthly, categories, transactions
- `GET /api/reports/quarterly`, `/api/reports/monthly-trends`

Backend supports quarters (`Q1-2025`) and direct months (`2025-01`) for the `month` filter param.

## Tests
- `tests/pytest.ini`: asyncio_mode = auto, testpaths = backend
- `tests/backend/conftest.py`: provides `client` (FastAPI TestClient), `sample_inventory_item`, and `sample_order` fixtures
- No frontend tests exist (no Vitest/Jest config)

## Common Issues
1. Use unique keys in v-for (not `index`) - use `sku`, `month`, etc.
2. Validate dates before `.getMonth()` calls
3. Update Pydantic models when changing JSON data structure
4. Inventory filters don't support month (no time dimension)
5. Revenue goals: $800K/month single, $9.6M YTD all months

## File Locations
- Views: `client/src/views/*.vue`
- Components: `client/src/components/*.vue`
- Composables: `client/src/composables/` (useFilters.js, useI18n.js, useAuth.js)
- API Client: `client/src/api.js`
- Backend: `server/main.py`, `server/mock_data.py`
- Data: `server/data/*.json`
- Global styles: `client/src/App.vue`

## Design System
- Colors: Slate/gray (#0f172a, #64748b, #e2e8f0)
- Status: green/blue/yellow/red
- Charts: Custom SVG, CSS Grid for layouts
- No emojis in UI
- Warehouses: San Francisco, London, Tokyo
- Categories: Circuit Boards, Sensors, Actuators, Controllers
