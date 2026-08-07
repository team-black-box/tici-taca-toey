// The app version lives in three files that cannot import each other: a
// TypeScript constant the UI shows, Gradle's versionName, and Xcode's
// MARKETING_VERSION. Nothing stops them drifting, and a build that tells
// the user one version while the store lists another is the kind of bug
// nobody notices until someone is trying to reproduce a report.
//
// So: read all three, fail if they disagree. Runs in `bun run typecheck`.
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const read = async (path: string) => Bun.file(join(ROOT, path)).text();

const pick = (source: string, pattern: RegExp, label: string): string => {
  const found = source.match(pattern);
  if (!found) {
    throw new Error(`could not find ${label}`);
  }
  return found[1].trim();
};

const [ts, gradle, pbxproj] = await Promise.all([
  read("src/version.ts"),
  read("android/app/build.gradle"),
  read("ios/TiciTacaToey.xcodeproj/project.pbxproj"),
]);

const found = {
  "src/version.ts": pick(ts, /APP_VERSION\s*=\s*"([^"]+)"/, "APP_VERSION"),
  "android versionName": pick(
    gradle,
    /versionName\s+"([^"]+)"/,
    "versionName"
  ),
  // Xcode repeats the setting per build configuration; they must agree
  // with each other before they can agree with anything else.
  "ios MARKETING_VERSION": (() => {
    const all = [...pbxproj.matchAll(/MARKETING_VERSION\s*=\s*([^;]+);/g)].map(
      (match) => match[1].trim()
    );
    if (all.length === 0) {
      throw new Error("could not find MARKETING_VERSION");
    }
    const distinct = new Set(all);
    if (distinct.size > 1) {
      throw new Error(
        `iOS build configurations disagree: ${[...distinct].join(", ")}`
      );
    }
    return all[0];
  })(),
};

const distinct = new Set(Object.values(found));
if (distinct.size !== 1) {
  console.error("version mismatch:");
  Object.entries(found).forEach(([where, value]) =>
    console.error(`  ${where.padEnd(24)} ${value}`)
  );
  console.error(
    "\nbump all three together - see the comment in src/version.ts"
  );
  process.exit(1);
}

console.log(`versions agree: ${[...distinct][0]}`);
