# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-09

### Added

- Spec, nine-part plan and the first three decision records (stack, AI provider, hosting and tests).
- Express API with `GET /api/health` and `GET /api/clinic` for the made-up clinic's facts.
- Clinic page in React with the demo notice, services, opening hours and facts.
- Safety from the start: strict Content Security Policy, `noindex`, no-store API answers, a 20 KB
  body limit, short error messages and a startup check of production settings.
- 11 tests and a GitHub Actions workflow (tests, build, dependency audit).
