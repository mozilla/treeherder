const instrumentedBuild = /(?:^|[-/])(asan|tsan|ccov)(?:[-/]|$)/;
const pathSuites =
  /^(mochitest|xpcshell|reftest|crashtest|web-platform-tests)(-|$)/;

function chunkPattern(label, chunks) {
  if (!/-\d+$/.test(label)) return label;
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

      const suite = attributes.unittest_suite;
      const chunks = extra.chunks;
      const isConfirmFailure = label.endsWith('-cf');
      const buildSettings = extra['test-setting']?.build;
      const specialized =
        instrumentedBuild.test(dependencies.build ?? label) ||
        Boolean(
          buildSettings?.asan || buildSettings?.tsan || buildSettings?.ccov,
        ) ||
        Boolean(attributes['duplicate-of']) ||
        Boolean(attributes.unittest_variant) ||
        isConfirmFailure ||
        kind === 'browsertime' ||
        kind === 'perftest' ||
        suite === 'talos';

      const metadata = {
        tier: treeherder.tier,
        chunkPattern: isConfirmFailure ? label : chunkPattern(label, chunks),
        specialized,
        buildDependency: dependencies.build,
      };
      // Gecko's decision task does not resolve per-chunk manifests for
      // reftest-qr and crashtest-qr. This picker needs those mappings to
      // choose chunks from an existing graph, as opposed to recomputing them.
      if (
        pathSuites.test(suite ?? '') &&
        !isConfirmFailure &&
        !['reftest-qr', 'crashtest-qr'].includes(suite) &&
        Array.isArray(attributes.test_manifests) &&
        attributes.test_manifests.length &&
        task.payload?.env?.MOZHARNESS_TEST_PATHS
      ) {
        metadata.pathScope = { suite, manifests: attributes.test_manifests };
      }

      return [[label, metadata]];
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
