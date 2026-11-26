const instrumentedBuild = /(?:^|[-/])(asan|tsan|ccov)(?:[-/]|$)/;
// Task label suffixes from Gecko's taskcluster/test_configs/variants.yml.
const specializedSuffixes = [
  '1proc',
  'a11y-checks',
  'aab',
  'async',
  'cf',
  'condprof',
  'csp-next',
  'emesigned',
  'emewmf',
  'fis-hv',
  'headless',
  'http2',
  'http3',
  'ioi',
  'isolated',
  'java-media',
  'mda-gpu',
  'msix',
  'nofis',
  'nogpu',
  'np',
  'openh264',
  'pb',
  'pb-ioi',
  'repeat',
  's',
  'standalone',
  'swr',
  'trainhop-beta',
  'trainhop-rel',
  'uipc',
  'vt',
  'wmfme',
  'wr-dc0',
  'wr-dc1-p',
  'wr-dc2-o',
  'wr-dc3-c',
  'xorig',
  'zygote',
];
const specializedSuffix = new RegExp(`-(?:${specializedSuffixes.join('|')})$`);

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

      const suite = attributes.unittest_suite;
      const chunks = extra.chunks;
      const chunked = Number.isInteger(chunks) || chunks?.total > 1;
      const unchunkedLabel = chunked ? label.replace(/-\d+$/, '') : label;
      const buildSettings = extra['test-setting']?.build;
      const specialized =
        instrumentedBuild.test(dependencies.build ?? label) ||
        Boolean(
          buildSettings?.asan || buildSettings?.tsan || buildSettings?.ccov,
        ) ||
        Boolean(attributes['duplicate-of']) ||
        specializedSuffix.test(unchunkedLabel) ||
        kind === 'browsertime' ||
        kind === 'perftest' ||
        suite === 'talos';

      return [
        [
          label,
          {
            tier: treeherder.tier,
            chunkPattern: chunkPattern(label, chunks),
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
