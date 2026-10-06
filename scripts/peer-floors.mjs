/**
 * The lowest versions the manifest accepts, for one NestJS major: what CI pins
 * to run the suite and `verify:package` on the floors of the peer ranges.
 *
 * Each peer takes the lowest version of its range, and `@nestjs/*` the lowest
 * of the `||` branch of that major. `@nestjs/testing` follows `@nestjs/core`.
 * A development dependency peering on `@langchain/core` takes its newest
 * release, within its own range, that accepts those versions.
 *
 * Usage: node scripts/peer-floors.mjs <nestjs-major>
 * Prints `name@version` pairs separated by spaces.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import semver from 'semver';

const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const manifest = readJson('../package.json');

const floorOf = (name, range, nest) => {
  const branch = name.startsWith('@nestjs/')
    ? range.split('||').find((part) => semver.minVersion(part)?.major === nest)
    : range;

  if (!branch) {
    throw new Error(`${name}: "${range}" has no branch for NestJS ${nest}`);
  }

  return semver.minVersion(branch).version;
};

/** Every peer at its floor, plus `@nestjs/testing` at `@nestjs/core`'s. */
export const peerFloors = (nest) => {
  const floors = Object.fromEntries(
    Object.entries(manifest.peerDependencies).map(([name, range]) => [
      name,
      floorOf(name, range, Number(nest)),
    ]),
  );

  return { ...floors, '@nestjs/testing': floors['@nestjs/core'] };
};

// `npm view` gives one object for a single matching release, an array else.
const releases = (spec) =>
  [
    JSON.parse(
      execFileSync(
        'npm',
        ['view', spec, 'version', 'peerDependencies', '--json'],
        {
          encoding: 'utf8',
        },
      ),
    ),
  ].flat();

const accepts = (peerDependencies = {}, floors) =>
  Object.entries(peerDependencies).every(
    ([name, range]) =>
      !(name in floors) || semver.satisfies(floors[name], range),
  );

/** The development dependencies peering on `@langchain/core`, at `floors`. */
export const devFloors = (floors) =>
  Object.fromEntries(
    Object.entries(manifest.devDependencies)
      .filter(([name]) => !(name in floors))
      .filter(
        ([name]) =>
          '@langchain/core' in
          (readJson(`../node_modules/${name}/package.json`).peerDependencies ??
            {}),
      )
      .map(([name, range]) => {
        const [newest] = semver.rsort(
          releases(`${name}@${range}`)
            .filter(({ version }) => !semver.prerelease(version))
            .filter(({ peerDependencies }) => accepts(peerDependencies, floors))
            .map(({ version }) => version),
        );

        if (!newest) {
          throw new Error(
            `${name}: no release in "${range}" accepts the floors`,
          );
        }

        return [name, newest];
      }),
  );

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const nest = process.argv[2];

  if (!nest) {
    console.error('usage: node scripts/peer-floors.mjs <nestjs-major>');
    process.exit(1);
  }

  const floors = peerFloors(nest);

  console.log(
    Object.entries({ ...floors, ...devFloors(floors) })
      .map(([name, version]) => `${name}@${version}`)
      .join(' '),
  );
}
