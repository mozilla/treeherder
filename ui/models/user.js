import { getApiUrl } from '../helpers/url';

const uri = getApiUrl('/user/');

export default class UserModel {
  constructor(data) {
    Object.assign(this, data);
    this.isStaff = data.is_staff;
  }

  static get() {
    return fetch(`${uri}`).then((resp) =>
      resp
        .json()
        .then((data) => (data.length > 0 ? new UserModel(data[0]) : {})),
    );
  }
}
