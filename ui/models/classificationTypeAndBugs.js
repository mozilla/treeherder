import { destroyMany } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';

const uri = '/classification/';

export default class JobClassificationTypeAndBugsModel {
  static destroy(pinnedJobs) {
    return destroyMany(`${getProjectUrl(uri)}`, pinnedJobs);
  }
}
