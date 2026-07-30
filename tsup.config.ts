import { createRequire } from 'node:module';
import { defineConfig } from 'tsup';

const pkg = createRequire(import.meta.url)('./package.json') as {
  devDependencies: Record<string, string>;
};

const DATE_LIB = /^(date-fns|@date-fns\/[^/]+)(\/.*)?$/;

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Nothing dev-only may be inlined into the bundle. esbuild checks `external`
  // before it runs plugins, so the date libraries are deliberately left out of
  // this list: the plugin below has to see them to fail the build.
  external: Object.keys(pkg.devDependencies).filter(
    (name) => !DATE_LIB.test(name)
  ),
  esbuildPlugins: [
    {
      name: 'no-date-libs-in-shipped-code',
      setup(build) {
        build.onResolve({ filter: DATE_LIB }, (args) => ({
          errors: [
            {
              text: `Shipped code must not import '${args.path}': date-fns and @date-fns/* are devDependencies (test fixtures only) and are not installed for consumers.`,
              location: { file: args.importer },
            },
          ],
        }));
      },
    },
  ],
});
