# Contributing to Quickurrence

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run tests:
   ```bash
   pnpm test
   ```
4. Start development mode:
   ```bash
   pnpm dev
   ```

## Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Add or update tests as needed
4. Ensure all tests pass: `pnpm test`
5. Ensure the project builds: `pnpm build`
6. Ensure types are correct: `pnpm type-check`

## Pull Request Process

1. Update the README.md if your change affects the public API
2. Write a clear PR description explaining what changed and why
3. Ensure all CI checks pass
4. Request a review

## Code Style

- TypeScript strict mode
- Use `type` instead of `interface`
- Prefer type inference over explicit type annotations
- Use `as const` for constant definitions
- Write tests for all new functionality

## Reporting Issues

- Use the GitHub issue templates
- Include a minimal reproduction if reporting a bug
- Check existing issues before creating a new one

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
