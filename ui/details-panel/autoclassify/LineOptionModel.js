import { extendProperties } from "../../helpers/objectHelper";

export default class LineOptionModel {
  constructor(type, id, classifiedFailureId, bugNumber,
              bugSummary, bugResolution, matches) {
    extendProperties(this, {
      type: type,
      id: id,
      classifiedFailureId: classifiedFailureId || null,
      bugNumber: bugNumber || null,
      bugSummary: bugSummary || null,
      bugResolution: bugResolution || null,
      matches: matches || null,
      isBest: false,
      hidden: false,
      score: null,
      ignoreAlways: false,
      selectable: !(type === "classifiedFailure" && !bugNumber),
    });
  }
}

