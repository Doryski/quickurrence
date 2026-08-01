# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-07-30

### Changed

- Dropped the date-library peer dependencies. All timezone math now goes through the
  platform's own `Intl` APIs, and every API returns plain `Date` objects instead of
  library-specific wrappers.

## [0.3.2] - 2026-07-06

### Fixed

- `timesOfDay` next-occurrence lookups no longer scan linearly over the expanded
  datetime set; days are walked lazily instead.

## [0.3.1] - 2026-07-05

### Fixed

- `excludeDates` no longer degrades to O(n·e) when many exclusions are configured.
- Fixed a far-future next-occurrence bug.

### Changed

- Migrated releases to the shared
  [`@doryski/release`](https://www.npmjs.com/package/@doryski/release) workflow.

## [0.3.0] - 2026-04-30

### Added

- `timesOfDay: string[]` (`"HH:MM"`, 24-hour) expands each matching day into N
  datetimes, sorted and timezone-correct. `count`, `endDate` and `excludeDates` apply
  at datetime level when it is set, and stay day-level otherwise — fully backward
  compatible.
- Validator support for the new option, with an `INVALID_TIMES_OF_DAY` error code, plus
  a `getTimesOfDay()` getter and `toHumanText`/`clean()`/`update()` pass-through.
- v8 coverage tooling scoped to `src/`.

## [0.2.1] - 2026-04-30

### Fixed

- Corrected the ESM/CJS `exports` field.

## [0.2.0] - 2026-04-18

### Added

- Release pipeline and interactive release script.
- `@types/node` and the ES2023 lib for type-checking.

## [0.1.0] - 2026-04-16

### Added

- Initial release of `quickurrence`, a type-safe recurrence rule engine for TypeScript:
  daily, weekly, monthly and yearly rules with presets, nth weekday and custom
  conditions, IANA timezone handling, rule merging, and a validator with actionable
  error messages.

[Unreleased]: https://github.com/doryski/quickurrence/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/doryski/quickurrence/releases/tag/v0.4.0
[0.3.2]: https://github.com/doryski/quickurrence/releases/tag/v0.3.2
[0.3.1]: https://github.com/doryski/quickurrence/releases/tag/v0.3.1
[0.3.0]: https://github.com/doryski/quickurrence/releases/tag/v0.3.0
[0.2.1]: https://github.com/doryski/quickurrence/releases/tag/v0.2.1
[0.2.0]: https://github.com/doryski/quickurrence/releases/tag/v0.2.0
