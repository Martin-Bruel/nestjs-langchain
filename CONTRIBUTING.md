# Contributing to nestjs-langchain

First off, thank you for considering contributing to nestjs-langchain! It's people like you who make the open-source community such a great place to learn, inspire, and create.

To maintain the quality of the project and make the process as smooth as possible, please take a moment to review these guidelines.

# Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup]()
- [Pull Request Process]()
- [Coding Standards]()

## How Can I Contribute?

### Reporting Bugs

- Check the [Issues](https://github.com/Martin-Bruel/nestjs-langchain/issues) to see if the bug has already been reported.
- If not, open a new issue. Include a clear title, a description of the problem, steps to reproduce, and the expected vs. actual behavior.

### Suggesting Enhancements

- Open an issue with the tag enhancement.
- Explain why this feature would be useful and how it should work.

### Pull Requests

- Open an issue first to discuss the implementation approach.
- Follow the development setup.

## Development Setup

1. Fork the repository on GitHub.
2. Clone your fork locally:

```
git clone https://github.com/your-username/nestjs-langchain.git
```

3. Create a new git branch:

```
git checkout -b <type>/my-branch master
```

4. Install dependencies:

```
npm install
```

5. Implement your change.
6. Run integration tests:

```
npm run test:integration
```

## Pull Request Process

1. Ensure your code follows the existing style and all tests pass.
2. Update the documentation (README.md) if you are changing the API or adding features.
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (e.g., feat: add support for local LLMs).
4. Push to your fork and submit a Pull Request to the main branch.
5. A maintainer will review your PR and may suggest changes before merging.

## Coding Standards

- TypeScript: Use strict typing. Avoid using any unless absolutely necessary.
- NestJS Best Practices: Follow the standard module/provider pattern.
- Testing: New features should include unit tests. We use Jest.
- Linting: Run npm run lint before committing to ensure code consistency.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
