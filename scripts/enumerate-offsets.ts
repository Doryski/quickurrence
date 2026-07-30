import {
  enumerateOffsetClasses,
  legacyClassCount,
  offsetKey,
  runtimeVersions,
} from './tz-sweep';

const representatives = enumerateOffsetClasses();

console.log(
  JSON.stringify(
    {
      ...runtimeVersions(),
      classCount: representatives.length,
      // What the pre-fingerprint 5-instant sampling would have produced on this
      // runtime, so the "the old key was coarser" claim in the docs is a number
      // anyone can reproduce with this command.
      legacyClassCount: legacyClassCount(),
      // Proof that the fingerprint separates zones the old 5-instant key
      // collapsed; if these two ever match, tz-sweep.ts throws.
      discrimination: {
        'America/Scoresbysund': offsetKey('America/Scoresbysund'),
        'America/Nuuk': offsetKey('America/Nuuk'),
      },
      representatives,
    },
    null,
    2,
  ),
);
