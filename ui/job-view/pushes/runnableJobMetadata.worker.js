const uncommonJobs =
  /build-.*-gcp|mingwclang|valgrind|android-geckoview-docs|android-hw|windows11-64-24h2-hw-ref|windows10-aarch64-qr|web-platform-tests.*backlog|-artifact[/-]|-profiling-|-32-.*-webgpu|nightly-simulation|notarization|^beetmover-integration-|upload-symbols/;
const specializedBuild = /(?:^|[-/])(asan|tsan|ccov)(?:[-/]|$)/;
const specializedSuites = new Set([
  'mochitest-a11y',
  'mochitest-browser-a11y',
  'mochitest-browser-media',
  'mochitest-media',
  'talos',
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
        unittest_suite: suite,
        unittest_variant: variant,
        test_platform: platform = '',
      } = attributes;
      const isBaseline =
        variant === 'webrender-sw' &&
        suite === 'mochitest-browser-chrome' &&
        platform.startsWith('linux');
      const specialized =
        uncommonJobs.test(label) ||
        specializedBuild.test(dependencies.build ?? label) ||
        Boolean(attributes['duplicate-of']) ||
        label.endsWith('-cf') ||
        Boolean(variant && !isBaseline) ||
        kind === 'browsertime' ||
        kind === 'perftest' ||
        specializedSuites.has(suite);

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
