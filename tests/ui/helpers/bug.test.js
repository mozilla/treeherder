import { parseSummary } from '../../../ui/helpers/bug';

describe('parseSummary', () => {
  const crashLine =
    'application crashed [@ linux-vdso.so.1 + 0x0000000000000c4b] | dom/animation/test/mochitest.toml';
  const searchTerms = [
    'application crashed [@ linux-vdso.so.1 + 0x0000000000000c4b]',
  ];

  test('keeps the fields of a PROCESS-CRASH line without a crash dump UUID', () => {
    const [summaryParts] = parseSummary({
      search: `PROCESS-CRASH | ${crashLine}`,
      search_terms: searchTerms,
    });
    expect(summaryParts.join(' | ')).toBe(crashLine);
  });

  test.each([
    '2b81f563-8ae7-3b04-a638-914a564ffb12',
    '1FC759EC-5164-4A18-AB68-35A904906A7E',
  ])('drops the crash dump UUID %s from a PROCESS-CRASH line', (crashId) => {
    const [summaryParts] = parseSummary({
      search: `PROCESS-CRASH | ${crashId} | ${crashLine}`,
      search_terms: searchTerms,
    });
    expect(summaryParts.join(' | ')).toBe(crashLine);
  });
});
