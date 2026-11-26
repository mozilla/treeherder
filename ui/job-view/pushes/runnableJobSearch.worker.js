import { byLengthAsc, extendedMatch, Fzf } from 'fzf';

export function createSearchHandler(sendResults) {
  let finder;

  return ({ data }) => {
    if (Array.isArray(data)) {
      finder = new Fzf(
        data.map((name, index) => ({ name, index })),
        {
          selector: (job) => job.name,
          match: extendedMatch,
          tiebreakers: [byLengthAsc],
        },
      );
      return;
    }

    const matches = finder.find(data);
    const indices = Uint32Array.from(matches, ({ item }) => item.index);
    // fzf keeps input order when a query only excludes matches.
    if (matches[0]?.score === 0) indices.sort();
    sendResults({ query: data, indices }, [indices.buffer]);
  };
}

if (typeof WorkerGlobalScope !== 'undefined') {
  self.onmessage = createSearchHandler((data, transfer) =>
    self.postMessage(data, transfer),
  );
}
