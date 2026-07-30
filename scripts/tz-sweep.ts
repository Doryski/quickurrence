import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
// Imported as a binding so child environments can be built without naming the
// global namespace object twice.
import { env as parentEnv } from 'node:process';

// The test corpus is dominated by 2024 dates (~1450 hits) with a 2026 tail
// (~214). Sampling only 2026 collapsed America/Scoresbysund onto a class whose
// representative had a different 2024 schedule, which is how that zone stayed
// red while the sweep was green. The fingerprint therefore covers every day the
// corpus can reach.
const CORPUS_YEARS = [2024, 2025, 2026] as const;

// Intl.supportedValuesOf('timeZone') returns no Etc/* zones, which leaves
// -12:00 with no representative at all.
const EXTRA_ZONES = ['Etc/GMT+12'] as const;

// Legacy aliases and Antarctic picks that the alphabetically-first rule would
// otherwise select; each must be a member of the same offset class.
const CANONICAL_OVERRIDES = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'America/Godthab': 'America/Nuuk',
  'Antarctica/Mawson': 'Asia/Karachi',
  'Antarctica/Davis': 'Asia/Bangkok',
  'Antarctica/Casey': 'Asia/Shanghai',
  'Antarctica/DumontDUrville': 'Australia/Brisbane',
  'Antarctica/Macquarie': 'Australia/Sydney',
  'Antarctica/McMurdo': 'Pacific/Auckland',
} as const;

// A truncated or stubbed Intl tzdata would silently shrink the matrix to a
// handful of classes and still exit green. Measured 68 classes from 418 zones
// with ICU 76.1 / tzdata 2024b; the floor leaves room for tzdata churn without
// permitting collapse.
const MIN_OFFSET_CLASSES = 50;

// The sampling the fingerprint replaced, kept only so the "how much coarser was
// it" number in the docs is recomputable instead of remembered: five instants in
// one year cannot see a zone whose *2024* schedule differs. Printed as
// `legacyClassCount` by `pnpm test:tz:offsets` — 60 on ICU 76.1 / tzdata 2024b
// against this fingerprint's 68.
const LEGACY_SAMPLE_INSTANTS = [
  Date.UTC(2026, 0, 1, 12),
  Date.UTC(2026, 3, 1, 12),
  Date.UTC(2026, 6, 1, 12),
  Date.UTC(2026, 9, 1, 12),
  Date.UTC(2026, 11, 1, 12),
] as const;

// The per-file test manifest, generated from a UTC reference run rather than
// hand-maintained, because a hand-maintained one drifts: the checked-in numbers
// said 554 tests against a 563-test suite, which let nine tests be deleted from
// the largest file with the sweep still printing PASSED. Both directions are
// hard failures now (see auditReferenceCollection), so a stale manifest fails
// the run instead of widening the hole. Refresh with `pnpm test:tz:manifest`.
const MANIFEST_PATH = path.join('scripts', 'expected-tests.json');

const MANIFEST_REFRESH_HINT = `Refresh it with \`pnpm test:tz:manifest\` (regenerates ${MANIFEST_PATH} from a UTC reference run) and commit the result in the same commit as the test change.`;

type Manifest = {
  total: number;
  byFile: Record<string, number>;
};

const REFERENCE_ZONE = 'UTC';

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string) => {
  const cached = formatters.get(timeZone);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timeZone, formatter);
  return formatter;
};

const zonedParts = (instant: number, timeZone: string) => {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month') - 1,
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
};

const zoneOffsetMinutesAt = (instant: number, timeZone: string) => {
  const parts = zonedParts(instant, timeZone);
  const wall = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (wall - Math.floor(instant / 1000) * 1000) / 60_000;
};

const signedOffset = (minutes: number) => {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
};

const DAY_MS = 86_400_000;

// Per UTC day: the offset at 00:00Z, the offset at 12:00Z, and whether the
// zone's own wall-clock midnight is skipped that day (the spring-forward-at-
// midnight property that separates Azores / Scoresbysund / Godthab from every
// other zone at the same offsets).
const dayFingerprint = (utcDayStart: number, timeZone: string) => {
  const midnightOffset = zoneOffsetMinutesAt(utcDayStart, timeZone);
  const noonOffset = zoneOffsetMinutesAt(utcDayStart + DAY_MS / 2, timeZone);
  const guess = utcDayStart - midnightOffset * 60_000;
  const midnightSkipped = zonedParts(guess, timeZone).hour !== 0;
  return `${midnightOffset},${noonOffset},${midnightSkipped ? 1 : 0}`;
};

const fingerprints = new Map<string, string>();

const computeFingerprint = (timeZone: string) => {
  const days: string[] = [];
  const end = Date.UTC(CORPUS_YEARS[CORPUS_YEARS.length - 1] + 1, 0, 1);
  for (
    let instant = Date.UTC(CORPUS_YEARS[0], 0, 1);
    instant < end;
    instant += DAY_MS
  ) {
    days.push(dayFingerprint(instant, timeZone));
  }
  const digest = createHash('sha1')
    .update(days.join('|'))
    .digest('hex')
    .slice(0, 16);
  const january = signedOffset(
    zoneOffsetMinutesAt(Date.UTC(CORPUS_YEARS[0], 0, 15, 12), timeZone),
  );
  const july = signedOffset(
    zoneOffsetMinutesAt(Date.UTC(CORPUS_YEARS[0], 6, 15, 12), timeZone),
  );
  return `${digest} jan${january} jul${july}`;
};

/** Dense schedule fingerprint over {@link CORPUS_YEARS}; memoised per zone. */
export const offsetKey = (timeZone: string) => {
  const cached = fingerprints.get(timeZone);
  if (cached) {
    return cached;
  }
  const fingerprint = computeFingerprint(timeZone);
  fingerprints.set(timeZone, fingerprint);
  return fingerprint;
};

const allZones = () => [...Intl.supportedValuesOf('timeZone'), ...EXTRA_ZONES];

/**
 * How many classes the pre-fingerprint sampling would produce on this runtime.
 * Exported so the "the old key was coarser by N" claim in the docs is a
 * recomputed number (`pnpm test:tz:offsets`) rather than a remembered one.
 */
export const legacyClassCount = () =>
  new Set(
    allZones().map((zone) =>
      LEGACY_SAMPLE_INSTANTS.map((instant) =>
        zoneOffsetMinutesAt(instant, zone),
      ).join(','),
    ),
  ).size;

// America/Scoresbysund and America/Nuuk shared a class under the old 5-instant
// key (identical 2026 offsets) yet fail differently, because their 2024
// schedules differ. If a tzdata update ever makes these two genuinely
// identical, the sweep loses a known-red zone silently — hence a hard failure
// rather than a comment.
const DISCRIMINATION_PAIRS = [['America/Scoresbysund', 'America/Nuuk']] as const;

const assertFingerprintDiscrimination = () => {
  for (const [left, right] of DISCRIMINATION_PAIRS) {
    if (offsetKey(left) !== offsetKey(right)) {
      continue;
    }
    throw new Error(
      `tz-sweep fingerprint is too coarse: ${left} and ${right} collapsed into one class (${offsetKey(left)}). Densify the fingerprint before trusting a green sweep.`,
    );
  }
};

type OffsetClass = {
  offsets: string;
  zone: string;
  memberCount: number;
};

const pickRepresentative = (offsets: string, members: string[]) => {
  const first = [...members].sort()[0];
  const override =
    CANONICAL_OVERRIDES[first as keyof typeof CANONICAL_OVERRIDES];
  if (!override) {
    return first;
  }
  // An override that drifted into another class would silently change what the
  // sweep covers, so fall back to the alphabetical pick instead.
  return offsetKey(override) === offsets ? override : first;
};

export const enumerateOffsetClasses = (): OffsetClass[] => {
  assertFingerprintDiscrimination();
  const zones = allZones();
  const classes = new Map<string, string[]>();

  for (const zone of zones) {
    const key = offsetKey(zone);
    const bucket = classes.get(key);
    if (!bucket) {
      classes.set(key, [zone]);
      continue;
    }
    bucket.push(zone);
  }

  if (classes.size < MIN_OFFSET_CLASSES) {
    throw new Error(
      `tz-sweep enumerated only ${classes.size} DST-schedule classes from ${zones.length} zones (floor ${MIN_OFFSET_CLASSES}). The runtime's Intl tzdata looks truncated; refusing to report a green sweep.`,
    );
  }

  return [...classes.entries()]
    .map(([offsets, members]) => ({
      offsets,
      zone: pickRepresentative(offsets, members),
      memberCount: members.length,
    }))
    .sort((a, b) => a.offsets.localeCompare(b.offsets));
};

export const runtimeVersions = () => ({
  node: process.version,
  icu: process.versions.icu ?? 'unknown',
  tzdata: process.versions.tz ?? 'unknown',
  unicode: process.versions.unicode ?? 'unknown',
});

type VitestReport = {
  success?: boolean;
  numFailedTests?: number;
  numFailedTestSuites?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  numTotalTests?: number;
  testResults?: {
    name?: string;
    assertionResults?: {
      status: string;
      fullName?: string;
      title?: string;
      location?: { line?: number };
    }[];
  }[];
};

type ZoneResult = {
  zone: string;
  offsets: string;
  failed: number;
  total: number;
  durationSec: string;
  failures: string[];
  countsByFile: Record<string, number>;
};

const slugify = (zone: string) => zone.replace(/[^a-zA-Z0-9]+/g, '-');

const canonicalZone = (zone: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions()
      .timeZone;
  } catch {
    return undefined;
  }
};

/**
 * Intl (bundled ICU) and TZ (the OS zoneinfo database) are orthogonal sources,
 * so MIN_OFFSET_CLASSES cannot catch a zone the OS cannot resolve: measured,
 * `TZ=Bogus/Zone` runs at GMT+0000 with `resolvedOptions().timeZone` undefined
 * while Intl still enumerates every zone. Without this check such a child
 * executes the whole suite as UTC and the sweep prints PASSED.
 */
export const zoneAdoptionProblem = (
  requested: string,
  adopted: string,
  who = 'child',
) => {
  const wanted = canonicalZone(requested);
  if (!wanted) {
    return `Intl does not recognise "${requested}" as a timezone`;
  }
  if (canonicalZone(adopted) === wanted) {
    return undefined;
  }
  return `${who} adopted TZ "${adopted}" instead of "${requested}" — so this run did not execute under the zone it claims to cover`;
};

// A cheap pre-flight only: it proves the OS zoneinfo database can resolve the
// name before a whole suite run is spent on it. It says nothing about the vitest
// worker, which is what workerZoneProblems below actually interrogates.
const adoptedZone = (zone: string) =>
  new Promise<string>((resolve) => {
    const child = spawn(
      process.execPath,
      ['-p', 'String(Intl.DateTimeFormat().resolvedOptions().timeZone)'],
      { env: { ...parentEnv, TZ: zone }, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', () => resolve('<spawn failed>'));
    child.on('close', () => resolve(stdout.trim()));
  });

/**
 * A setup file that records the zone the *worker* resolved, appended to whatever
 * setup files the project config already has so it runs last. Recorded twice —
 * once while setup files execute and once in a `beforeAll`, i.e. after every
 * setup file has run — because a setup file that reassigns the worker's TZ takes
 * effect at whatever point it runs, and Node re-reads TZ on the next Intl call.
 *
 * Asking a sibling `node -p` child instead (what this replaced) proves nothing:
 * a `setupFiles` entry that pins the zone inside the worker made every run
 * execute under one zone while the sibling still reported the requested one and
 * the sweep printed PASSED.
 */
const workerZoneProbeSource = (recordPath: string) => `import { appendFileSync } from 'node:fs';
import { beforeAll } from 'vitest';

const record = (phase) => {
  appendFileSync(
    ${JSON.stringify(recordPath)},
    phase + '\\t' + String(Intl.DateTimeFormat().resolvedOptions().timeZone) + '\\n',
  );
};

record('setup');
beforeAll(() => record('beforeAll'));
`;

/**
 * The project's own vitest config with the probe appended. Generated rather than
 * passed as `--setupFiles`, which *replaces* the config's list instead of adding
 * to it: that would both hide the tampering this check exists to find and drop
 * any setup file the project legitimately needs.
 */
const sweepConfigSource = (
  baseConfig: string,
  probePath: string,
  root: string,
) => `import { defineConfig } from 'vitest/config';
import base from ${JSON.stringify(baseConfig)};

export default defineConfig(async (env) => {
  const resolved = typeof base === 'function' ? await base(env) : base;
  const existing = resolved.test?.setupFiles ?? [];
  return {
    ...resolved,
    root: ${JSON.stringify(root)},
    test: {
      ...resolved.test,
      setupFiles: [
        ...(Array.isArray(existing) ? existing : [existing]),
        ${JSON.stringify(probePath)},
      ],
    },
  };
});
`;

const recordedWorkerZones = async (recordPath: string) => {
  try {
    const lines = (await readFile(recordPath, 'utf8'))
      .split('\n')
      .filter(Boolean);
    return [...new Set(lines)];
  } catch {
    return [];
  }
};

/**
 * Judges the worker's own resolved zone. An empty record is red: it means the
 * probe never executed, so nothing about the worker's zone was established.
 */
export const workerZoneProblems = (requested: string, records: string[]) => {
  if (records.length === 0) {
    return [
      `the worker-zone probe never recorded anything for "${requested}" — the injected setup file did not run, so this run cannot be reported as covering that zone`,
    ];
  }
  return records.flatMap((record) => {
    const [phase, zone = ''] = record.split('\t');
    const problem = zoneAdoptionProblem(
      requested,
      zone,
      `vitest worker (at ${phase})`,
    );
    return problem ? [problem] : [];
  });
};

const relativeName = (name: string | undefined) =>
  name ? path.relative(process.cwd(), name) : '<unknown file>';

const countsByFile = (report: VitestReport) =>
  Object.fromEntries(
    (report.testResults ?? []).map((file) => [
      relativeName(file.name),
      (file.assertionResults ?? []).length,
    ]),
  );

const skippedNames = (report: VitestReport) =>
  (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? [])
      .filter(
        (assertion) =>
          assertion.status !== 'passed' && assertion.status !== 'failed',
      )
      .map(
        (assertion) =>
          `${assertion.fullName ?? assertion.title ?? '<unnamed>'} (${relativeName(file.name)}, ${assertion.status})`,
      ),
  );

/**
 * Turns a report plus the child's exit code into a failure count. Neither
 * source is sufficient alone:
 * - `numFailedTests` is 0 (not undefined) when a module-level throw kills a
 *   suite, so the old `numFailedTests ?? (exitCode === 0 ? 0 : 1)` never fell
 *   through to the exit code and the zone came back green.
 * - `numPendingTests` is counted inside `numTotalTests`, so `it.skip` on the
 *   red DST tests kept both the failure count and the collected-test count
 *   green. Skipping is not passing.
 */
export const interpretReport = (report: VitestReport, exitCode: number) => {
  const failures = collectFailures(report);
  const skipped = skippedNames(report);
  if (skipped.length > 0) {
    failures.push(
      `${skipped.length} skipped/todo test(s) — skipping is not passing:`,
      ...skipped,
    );
  }

  const reported = report.numFailedTests ?? 0;
  const failedSuites = report.numFailedTestSuites ?? 0;
  const brokenRun =
    report.success === false || failedSuites > 0 || exitCode !== 0;
  if (brokenRun && reported === 0) {
    failures.push(
      `vitest reported 0 failed tests but success=${report.success}, numFailedTestSuites=${failedSuites}, exit ${exitCode} — a suite failed to load or the run crashed`,
    );
  }

  const failed = Math.max(
    reported,
    brokenRun || failures.length > 0 ? 1 : 0,
  );
  return { failed, failures };
};

type SweepPaths = {
  /** Per-zone JSON reports; disposable, so the OS temp dir is the right home. */
  reportDir: string;
  /**
   * Generated config + setup file. Must live *inside* the project so that their
   * bare `vitest` / `vitest/config` imports resolve: measured, the identical
   * files under the OS temp dir make every run die with an unparseable report.
   */
  harnessDir: string;
  baseConfig: string;
};

const runZone = async (
  offsetClass: OffsetClass,
  paths: SweepPaths,
): Promise<ZoneResult> => {
  const { reportDir, harnessDir, baseConfig } = paths;
  const slug = slugify(offsetClass.zone);
  const reportPath = path.join(reportDir, `${slug}.json`);
  const zoneRecordPath = path.join(reportDir, `${slug}.worker-zone`);
  const probePath = path.join(harnessDir, `${slug}.worker-zone-probe.mjs`);
  const configPath = path.join(harnessDir, `${slug}.vitest.config.mts`);
  const startedAt = Date.now();
  const adoptionProblem = zoneAdoptionProblem(
    offsetClass.zone,
    await adoptedZone(offsetClass.zone),
  );
  // Running the suite under the wrong zone proves nothing, so skip it.
  if (adoptionProblem) {
    return {
      ...offsetClass,
      failed: 1,
      total: 0,
      durationSec: ((Date.now() - startedAt) / 1000).toFixed(1),
      failures: [adoptionProblem],
      countsByFile: {},
    };
  }
  await writeFile(probePath, workerZoneProbeSource(zoneRecordPath), 'utf8');
  await writeFile(
    configPath,
    sweepConfigSource(baseConfig, probePath, process.cwd()),
    'utf8',
  );
  // No --bail: reportRedZone names every failing test, which needs them all.
  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--maxWorkers=1',
        '--includeTaskLocation',
        '--config',
        configPath,
        '--root',
        process.cwd(),
        '--reporter=json',
        '--outputFile',
        reportPath,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, TZ: offsetClass.zone },
        stdio: 'ignore',
      },
    );
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code ?? 1));
  });
  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const report = await readReport(reportPath);
  const workerProblems = workerZoneProblems(
    offsetClass.zone,
    await recordedWorkerZones(zoneRecordPath),
  );

  // A missing report is red whatever the exit code says: a green exit with no
  // collected tests is exactly the vacuous pass this sweep exists to catch.
  if (!report) {
    return {
      ...offsetClass,
      failed: 1,
      total: 0,
      durationSec,
      failures: [
        `vitest produced no parseable JSON report (exit ${exitCode}) — crash or collection failure`,
        ...workerProblems,
      ],
      countsByFile: {},
    };
  }

  const interpreted = interpretReport(report, exitCode);
  return {
    ...offsetClass,
    total: report.numTotalTests ?? 0,
    durationSec,
    countsByFile: countsByFile(report),
    failed: Math.max(interpreted.failed, workerProblems.length > 0 ? 1 : 0),
    failures: [...workerProblems, ...interpreted.failures],
  };
};

const readReport = async (reportPath: string) => {
  try {
    return JSON.parse(await readFile(reportPath, 'utf8')) as VitestReport;
  } catch {
    return undefined;
  }
};

const collectFailures = (report: VitestReport) =>
  (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? [])
      .filter((assertion) => assertion.status === 'failed')
      .map((assertion) => {
        const name = assertion.fullName ?? assertion.title ?? '<unnamed>';
        const line = assertion.location?.line ? `:${assertion.location.line}` : '';
        return `${name} (${relativeName(file.name)}${line})`;
      }),
  );

/**
 * Checks the reference run against the committed manifest, in *both*
 * directions and per file. A shortfall means a file vanished from the whole
 * sweep, since the reference run is what every other zone is compared against.
 * A surplus is equally fatal, even though the tests it names exist and pass:
 * while a surplus was only a warning, the manifest sat nine tests below the
 * suite, and nine tests could be deleted from the largest file without the
 * sweep noticing. Exact equality is the only shape in which a stale manifest
 * fails instead of licensing deletions.
 */
export const auditReferenceCollection = (
  counts: Record<string, number>,
  manifest: Manifest,
) => {
  const files = [
    ...new Set([...Object.keys(manifest.byFile), ...Object.keys(counts)]),
  ].sort();
  const problems = files.flatMap((file) => {
    const expected = manifest.byFile[file] ?? 0;
    const actual = counts[file] ?? 0;
    if (actual === expected) {
      return [];
    }
    return [`${file}: collected ${actual} tests, manifest says ${expected}`];
  });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total !== manifest.total) {
    problems.push(
      `total: collected ${total} tests, manifest says ${manifest.total}`,
    );
  }
  return problems;
};

const manifestFrom = (counts: Record<string, number>): Manifest => ({
  total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  byFile: Object.fromEntries(Object.entries(counts).sort()),
});

const readManifest = async (): Promise<Manifest | undefined> => {
  try {
    const parsed = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Manifest;
    if (
      typeof parsed?.total !== 'number' ||
      typeof parsed?.byFile !== 'object'
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

const writeManifest = async (counts: Record<string, number>) => {
  const manifest = manifestFrom(counts);
  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        comment: `Generated by \`pnpm test:tz:manifest\` from a ${REFERENCE_ZONE} reference run. Do not hand-edit: scripts/tz-sweep.ts requires an exact match in both directions.`,
        generatedWith: runtimeVersions(),
        ...manifest,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(
    `Wrote ${MANIFEST_PATH}: ${manifest.total} tests across ${Object.keys(manifest.byFile).length} files.`,
  );
};

/**
 * A zone that collected a different set of tests than the reference zone had a
 * file fail to load, so its 0 failures mean nothing. Compared per file, not
 * only in total, so a lost file cannot be masked by another file gaining tests.
 */
export const withCollectionAudit = (
  result: ZoneResult,
  reference: ZoneResult,
): ZoneResult => {
  const files = new Set([
    ...Object.keys(reference.countsByFile),
    ...Object.keys(result.countsByFile),
  ]);
  const problems = [...files].flatMap((file) => {
    const expected = reference.countsByFile[file] ?? 0;
    const actual = result.countsByFile[file] ?? 0;
    if (actual === expected) {
      return [];
    }
    return [
      `${file}: collected ${actual} tests, ${REFERENCE_ZONE} collected ${expected}`,
    ];
  });
  if (result.total !== reference.total) {
    problems.unshift(
      `collected ${result.total} tests, expected ${reference.total}`,
    );
  }
  if (problems.length === 0) {
    return result;
  }
  return {
    ...result,
    failed: Math.max(result.failed, 1),
    failures: [...problems, ...result.failures],
  };
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  if (limit < 1) {
    throw new Error(`mapWithConcurrency needs limit >= 1, got ${limit}`);
  }
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    })(),
  );
  await Promise.all(runners);
  return results;
};

const parseConcurrency = () => {
  const raw = process.env.TZ_SWEEP_CONCURRENCY;
  if (raw === undefined || raw === '') {
    return Math.max(1, Math.min(4, os.cpus().length));
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      `TZ_SWEEP_CONCURRENCY must be an integer >= 1, got "${raw}". A value of 0 or NaN used to spawn zero runners and report a green sweep over zero zones.`,
    );
  }
  return parsed;
};

const readFlag = (name: string) => {
  const flagIndex = process.argv.indexOf(name);
  if (flagIndex === -1) {
    return undefined;
  }
  return process.argv[flagIndex + 1] || undefined;
};

const parseZonesFlag = () => {
  const raw = readFlag('--zones');
  if (!raw) {
    return undefined;
  }
  return raw
    .split(',')
    .map((zone) => zone.trim())
    .filter(Boolean);
};

// The project config the per-zone configs extend. Overridable only so the
// worker-zone guard itself can be tested against a config that tampers with the
// worker's TZ, which is not something the committed config may do.
const baseConfigPath = () =>
  readFlag('--base-config') ?? path.join(process.cwd(), 'vitest.config.ts');

const parseShardFlag = () => {
  const raw = readFlag('--shard');
  if (!raw) {
    return undefined;
  }
  const [index, count] = raw.split('/').map(Number);
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(count) ||
    count < 1 ||
    index < 1 ||
    index > count
  ) {
    throw new Error(`--shard expects i/n with 1 <= i <= n, got "${raw}"`);
  }
  return { index, count };
};

// Stable modulo over the sorted class list, so shard membership only moves when
// the class list itself moves.
const applyShard = <T>(
  items: T[],
  shard: { index: number; count: number } | undefined,
) => {
  if (!shard) {
    return items;
  }
  return items.filter(
    (_, position) => position % shard.count === shard.index - 1,
  );
};

// Every failure, not a slice: a truncated list turns "which tests broke in this
// zone" into a second sweep run, and the per-zone JSON report is the only other
// place the names exist.
const reportRedZone = (result: ZoneResult) => {
  console.error(
    `TZ SWEEP FAILURE  zone=${result.zone}  offsets=<${result.offsets}>  failed=${result.failed}`,
  );
  for (const failure of result.failures) {
    console.error(`  - ${failure}`);
  }
};

const reportZone = (result: ZoneResult) => {
  if (result.failed === 0) {
    console.log(
      `ok ${result.zone} ${result.offsets} (${result.total} tests, ${result.durationSec}s)`,
    );
    return;
  }
  reportRedZone(result);
};

const annotateGithub = async (red: ZoneResult[], total: number) => {
  if (!process.env.GITHUB_ACTIONS) {
    return;
  }
  for (const result of red) {
    // Annotations are capped by GitHub, so this one is deliberately a sample;
    // the full list is in the job log via reportRedZone.
    const shown = result.failures.slice(0, 3);
    const rest =
      result.failures.length > shown.length
        ? ` (+${result.failures.length - shown.length} more in the job log)`
        : '';
    console.log(
      `::error title=TZ sweep::${result.zone} (${result.offsets}) — ${result.failed} failing tests: ${shown.join(' | ') || 'unknown'}${rest}`,
    );
  }
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }
  const rows = red
    .map(
      (result) =>
        `| ${result.zone} | \`${result.offsets}\` | ${result.failed} | ${result.failures[0] ?? '—'} |`,
    )
    .join('\n');
  await appendFile(
    summaryPath,
    `\n## TZ sweep: ${red.length} of ${total} classes red\n\n| zone | offsets | failed | first failure |\n| --- | --- | --- | --- |\n${rows}\n`,
  );
};

const resolveTargets = (): OffsetClass[] => {
  const requested = parseZonesFlag();
  if (requested) {
    const unknown = requested.filter((zone) => !canonicalZone(zone));
    if (unknown.length > 0) {
      throw new Error(
        `--zones lists zones this runtime does not know: ${unknown.join(', ')}. A run under an unresolvable zone executes as UTC, so it cannot be reported as a pass.`,
      );
    }
    return requested.map((zone) => ({
      zone,
      offsets: offsetKey(zone),
      memberCount: 1,
    }));
  }
  return applyShard(enumerateOffsetClasses(), parseShardFlag());
};

/**
 * A run whose targets all share one DST schedule compares nothing: the whole
 * point of the sweep is that two hosts disagree, and `--zones UTC` used to print
 * "1/1 classes ... PASSED" — indistinguishable from the exhaustive run's summary
 * — while proving only that the suite passes somewhere.
 */
const singleClassWarning = (targets: OffsetClass[]) => {
  const classes = new Set([
    offsetKey(REFERENCE_ZONE),
    ...targets.map((target) => target.offsets),
  ]);
  if (classes.size > 1) {
    return undefined;
  }
  return `TZ sweep warning: every target shares one DST schedule (${[...classes][0]}), so this run proves the suite passes under that schedule and nothing about host-timezone independence. Use at least two schedules — pnpm test:tz is the smallest meaningful gate.`;
};

const main = async () => {
  const versions = runtimeVersions();
  const concurrency = parseConcurrency();
  const writeMode = process.argv.includes('--write-manifest');
  const targets = writeMode
    ? [
        {
          zone: REFERENCE_ZONE,
          offsets: offsetKey(REFERENCE_ZONE),
          memberCount: 1,
        },
      ]
    : resolveTargets();

  if (targets.length === 0) {
    throw new Error(
      'TZ sweep selected zero zones — check --zones / --shard. A zero-zone run is a failure, not a pass.',
    );
  }

  const manifest = writeMode ? undefined : await readManifest();
  if (!writeMode && !manifest) {
    throw new Error(
      `TZ sweep cannot read the test manifest ${MANIFEST_PATH}. It is required, not optional: without it the sweep cannot tell a passing suite from a deleted one. ${MANIFEST_REFRESH_HINT}`,
    );
  }

  const reportDir = await mkdtemp(path.join(os.tmpdir(), 'quickurrence-tz-'));
  const cacheRoot = path.join(process.cwd(), 'node_modules', '.cache');
  await mkdir(cacheRoot, { recursive: true });
  const paths: SweepPaths = {
    reportDir,
    harnessDir: await mkdtemp(path.join(cacheRoot, 'quickurrence-tz-')),
    baseConfig: path.resolve(baseConfigPath()),
  };
  // The harness dir lives inside the project (see SweepPaths), so nothing else
  // will ever collect it.
  process.on('exit', () =>
    rmSync(paths.harnessDir, { recursive: true, force: true }),
  );

  console.log(
    `TZ sweep: ${targets.length} zone(s), concurrency ${concurrency}, node ${versions.node}, ICU ${versions.icu}, tzdata ${versions.tzdata}, reports in ${reportDir}`,
  );

  const warning = writeMode ? undefined : singleClassWarning(targets);
  if (warning) {
    console.warn(warning);
  }

  const reference = await runZone(
    {
      zone: REFERENCE_ZONE,
      offsets: offsetKey(REFERENCE_ZONE),
      memberCount: 1,
    },
    paths,
  );
  reportZone(reference);

  if (reference.failed > 0) {
    console.error(
      `TZ SWEEP FAILED: reference zone ${REFERENCE_ZONE} is already red; fix that before interpreting other zones`,
    );
    process.exitCode = 1;
    return;
  }

  if (writeMode) {
    await writeManifest(reference.countsByFile);
    return;
  }

  const referenceTotal = reference.total;
  const drift = auditReferenceCollection(reference.countsByFile, manifest!);
  if (drift.length > 0) {
    console.error(
      `TZ SWEEP FAILED: the ${REFERENCE_ZONE} reference run does not match ${MANIFEST_PATH} exactly. Either a test file failed to load or was removed, or tests were added without refreshing the manifest — both are failures, because a manifest that sits below the suite lets tests be deleted unnoticed. ${MANIFEST_REFRESH_HINT}`,
    );
    for (const problem of drift) {
      console.error(`  - ${problem}`);
    }
    process.exitCode = 1;
    return;
  }

  const remaining = targets.filter((target) => target.zone !== REFERENCE_ZONE);
  const swept = await mapWithConcurrency(
    remaining,
    concurrency,
    async (item) => {
      const result = withCollectionAudit(
        await runZone(item, paths),
        reference,
      );
      reportZone(result);
      return result;
    },
  );

  if (swept.length !== remaining.length || swept.some((result) => !result)) {
    console.error(
      `TZ SWEEP FAILED: ${swept.filter(Boolean).length} of ${remaining.length} zones produced a result`,
    );
    process.exitCode = 1;
    return;
  }

  const results = [reference, ...swept];
  const red = results.filter((result) => result.failed > 0);

  if (red.length === 0) {
    console.log(
      `TZ SWEEP PASSED: ${results.length}/${results.length} classes, ${referenceTotal} tests each (ICU ${versions.icu}, tzdata ${versions.tzdata})`,
    );
    // Repeated here because the PASSED line is what people read and grep for,
    // and "1/1 classes ... PASSED" reads like the exhaustive run's summary.
    if (warning) {
      console.warn(warning);
    }
    return;
  }

  console.error(
    `TZ SWEEP FAILED: ${red.length} of ${results.length} classes red -> ${red
      .map((result) => result.zone)
      .join(', ')}`,
  );
  await annotateGithub(red, results.length);
  process.exitCode = 1;
};

// Importable so scripts/enumerate-offsets.ts shares the enumeration instead of
// keeping a second, drifting copy of the sampling rules.
if (process.argv[1] && path.resolve(process.argv[1]).endsWith('tz-sweep.ts')) {
  await main();
}
