import { toMercurialDateStr } from '../../../ui/helpers/display';

describe('toMercurialDateStr helper', () => {
  const dateScenarios = [
    [new Date('2021-02-14T20:40:03Z'), 'Sun Feb 14 20:40:03 2021 +0000'], // basic UTC date, no timezone offset
    [new Date('2021-02-14T20:40:03+0000'), 'Sun Feb 14 20:40:03 2021 +0000'], // no timezone offset
    [new Date('2021-02-14T20:40:03+0200'), 'Sun Feb 14 18:40:03 2021 +0000'], // positive timezone offset
    [new Date('2021-02-14T20:40:03-0200'), 'Sun Feb 14 22:40:03 2021 +0000'], // negative timezone offset
    [new Date('2200-02-14T22:38:22.000Z'), 'Fri Feb 14 22:38:22 2200 +0000'], // far future date
  ];

  test("formats dates similar to those from Mercurial' s push log", () => {
    dateScenarios.forEach(([awareDate, dateStr]) => {
      expect(toMercurialDateStr(awareDate)).toBe(dateStr);
    });
  });
});
