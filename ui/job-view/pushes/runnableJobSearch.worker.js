import { byLengthAsc, extendedMatch, Fzf } from 'fzf';

export function createSearchHandler(sendResults) {
  let finder;
  const symbolIndex = new Map();

  return ({ data }) => {
    if (Array.isArray(data)) {
      symbolIndex.clear();
      data.forEach(({ symbol, groupsymbol, symbolAliases }, index) => {
        const aliases = symbolAliases ?? [
          symbol,
          symbol &&
            groupsymbol &&
            groupsymbol !== '?' &&
            `${groupsymbol}(${symbol})`,
        ];
        for (const alias of aliases) {
          if (!alias) continue;
          const key = alias.toLowerCase();
          if (!symbolIndex.has(key)) symbolIndex.set(key, new Set());
          symbolIndex.get(key).add(index);
        }
      });
      finder = new Fzf(
        data.map(({ name }, index) => ({ name, index })),
        {
          selector: (job) => job.name,
          match: extendedMatch,
          tiebreakers: [byLengthAsc],
        },
      );
      return;
    }

    const matches = finder.find(data);
    // A standalone symbol can also match. Keep extended queries on task
    // labels so operators and label ranking behave like mach try fuzzy.
    const symbolMatches = symbolIndex.get(data.trim().toLowerCase());
    const indices = symbolMatches
      ? Uint32Array.from(
          new Set([...symbolMatches, ...matches.map(({ item }) => item.index)]),
        )
      : Uint32Array.from(matches, ({ item }) => item.index);
    // fzf keeps input order when a query only excludes matches.
    if (matches[0]?.score === 0 && !symbolMatches) indices.sort();
    sendResults({ query: data, indices }, [indices.buffer]);
  };
}

if (typeof WorkerGlobalScope !== 'undefined') {
  self.onmessage = createSearchHandler((data, transfer) =>
    self.postMessage(data, transfer),
  );
}
