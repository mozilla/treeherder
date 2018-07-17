import { extendProperties } from '../../../../helpers/object';

export default class LineOptionModel {
  constructor(type, id, classificationId, bugNumber,
              bugSummary, bugResolution, matches) {
    extendProperties(this, {
      type: type,
      id: id,
      classificationId: classificationId || null,
      bugNumber: bugNumber || null,
      bugSummary: bugSummary || null,
      bugResolution: bugResolution || null,
      matches: matches || null,
      isBest: false,
      hidden: false,
      score: null,
      ignoreAlways: false,
      selectable: !(type === 'classification' && !bugNumber),
    });
  }
}

