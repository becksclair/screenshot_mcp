# AGENTS.md for screenshot-mcp

## Development Commands
- Build: `bun run build`
- Dev (hot reload): `bun run dev`
- Test: `bun test`
- Single test: `bun test -- <test-file>` (e.g., `bun test -- src/index.test.ts`)
- Type check: `bun run typecheck`
- Lint/format: `bun run check` (Biome)
- Quality assurance: `bun run qa` (runs check, typecheck, test)

## Code Style Guidelines
- **Indentation**: Tabs (4 spaces wide)
- **Line width**: 120 characters
- **Semicolons**: Required
- **Trailing commas**: No
- **Imports**: Relative paths within `src/` directory
- **Error handling**: Return `{ content: [{ type: 'text', text }], isError: true }`
- **Input validation**: Use Zod schemas with `.describe()` for clarity
- **TypeScript**: Use modern TypeScript features, `noImplicitAny` enabled

## Additional Guidelines from Copilot Instructions
- Prefer Bun-native APIs (`Bun.spawn`, `fetch`)
- Keep handlers stateless
- Use regex for parsing external process output
- Tests should tolerate environment variability
- Mirror logic in test files for isolated validation
- Add new source files under `src/` directory