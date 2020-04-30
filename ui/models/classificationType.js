import { getApiUrl } from '../helpers/url';

const classificationColors = {
  1: '', // not classified
  2: 'label-info', // expected fail",
  3: 'label-success', // fixed by backout",
  4: 'label-warning', // intermittent",
  5: 'label-default', // infra",
  6: 'label-danger', // intermittent needs filing",
};

const uri = getApiUrl('/failureclassification/');

export default class ClassificationTypeModel {
  static getList() {
    return fetch(uri).then(async (resp) => resp.json());
  }

  static getMap(classificationTypes) {
    return classificationTypes.reduce(
      (acc, { id, name }) => ({
        ...acc,
        [id]: { name, star: classificationColors[id] },
      }),
      {},
    );
  }
}
