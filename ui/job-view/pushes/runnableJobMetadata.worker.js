const instrumentedBuild = /(?:^|[-/])(asan|tsan|ccov)(?:[-/]|$)/;
const supplementalVariants = new Set([
  'a11y-checks',
  'confirm-failure',
  'repeat',
  'standalone',
  'urlbar-ipc',
  'vertical-tabs',
]);

function chunkPattern(label, chunks) {
  if (label.endsWith('-cf') || !/-\d+$/.test(label)) return label;
  if (Number.isInteger(chunks) && chunks > 1)
    return label.replace(/-\d+$/, `-*/${chunks}`);
  return chunks?.total > 1 ? label.replace(/-\d+$/, '-*') : label;
}

export function getPickerMetadata(graph) {
  return Object.fromEntries(
    Object.entries(graph).flatMap(([label, node]) => {
      const { attributes = {}, dependencies = {}, kind, task } = node;
      const extra = task?.extra;
      const treeherder = extra?.treeherder;
      if (!treeherder) return [];

      const {
        run_on_projects: projects,
        unittest_suite: suite,
        unittest_variant: variant,
      } = attributes;
      const buildSettings = extra['test-setting']?.build;
      const specialized =
        instrumentedBuild.test(dependencies.build ?? label) ||
        Boolean(
          buildSettings?.asan || buildSettings?.tsan || buildSettings?.ccov,
        ) ||
        Boolean(attributes['duplicate-of']) ||
        label.endsWith('-cf') ||
        Boolean(
          variant &&
          (projects?.length === 0 ||
            variant.split('+').some((id) => supplementalVariants.has(id))),
        ) ||
        kind === 'browsertime' ||
        kind === 'perftest' ||
        suite === 'talos';

      return [
        [
          label,
          {
            tier: treeherder.tier,
            chunkPattern: chunkPattern(label, extra.chunks),
            specialized,
            buildDependency: dependencies.build,
          },
        ],
      ];
    }),
  );
}

if (typeof WorkerGlobalScope !== 'undefined') {
  self.onmessage = async ({ data: url }) => {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Task graph returned ${response.status}`);
      self.postMessage({ metadata: getPickerMetadata(await response.json()) });
    } catch (error) {
      self.postMessage({ error: error.message });
    }
  };
}
