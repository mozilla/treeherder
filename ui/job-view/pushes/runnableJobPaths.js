function includesPath(directory, path) {
  return directory === path || path.startsWith(`${directory}/`);
}

export function normalizeTestPaths(input) {
  const paths = new Set();
  for (const line of input.split(/\r?\n/)) {
    const path = line.trim().replace(/\/+$/, '').replace(/^\.\//, '');
    if (!line.trim()) continue;
    if (
      !path ||
      path.startsWith('/') ||
      path.startsWith('-') ||
      path.split('/').some((part) => part === '..' || part === '.') ||
      /[:\\]/.test(path)
    ) {
      return { error: `Expected a repository-relative test path: ${line}` };
    }
    paths.add(path);
  }
  return { paths: [...paths] };
}

function sourcePath(manifest) {
  if (manifest.startsWith('/_mozilla/')) {
    return `testing/web-platform/mozilla/tests/${manifest.slice('/_mozilla/'.length)}`;
  }
  if (manifest.startsWith('/')) {
    return `testing/web-platform/tests${manifest}`;
  }
  return manifest;
}

export function planPathJobs(jobs, paths) {
  const matched = new Set();
  const plan = [];
  for (const job of jobs) {
    if (!job?.pathScope) continue;
    const { suite, manifests } = job.pathScope;
    const scope = new Set();
    const requestedPaths = new Set();
    for (const manifest of manifests) {
      const source = sourcePath(manifest);
      for (const path of paths) {
        if (includesPath(path, source)) {
          scope.add(manifest);
        } else if (
          suite.startsWith('web-platform-tests') &&
          includesPath(source, path)
        ) {
          scope.add(path);
        } else {
          continue;
        }
        matched.add(path);
        requestedPaths.add(path);
      }
    }
    if (scope.size) {
      plan.push({
        label: job.name,
        suite,
        symbol: job.symbol,
        paths: [...scope],
        requestedPaths: [...requestedPaths],
      });
    }
  }
  return { plan, unmatched: paths.filter((path) => !matched.has(path)) };
}
