/**
 * Text Log Error model
 */
export default class ErrorLineModel {
  constructor(line) {
    this.id = line.id;
    this.data = line;
    // If there was no metadata we get `undefined` here but we need
    // an actual boolean later
    if (line.metadata) {
      this.verified = line.metadata.best_is_verified;
      this.bestClassification = line.metadata.best_classification ?
        line.classified_failures
          .find(cf => cf.id === line.metadata.best_classification) : null;
    } else {
      this.verified = false;
      this.bestClassification = null;
      line.metadata = {};
    }
    this.bugNumber = this.bestClassification ?
      this.bestClassification.bug_number : null;
    this.verifiedIgnore = this.verified && (this.bugNumber === 0 ||
      this.bestClassification === null);
    this.bugSummary = (this.bestClassification && this.bestClassification.bug) ?
      this.bestClassification.bug.summary : null;
  }
}
