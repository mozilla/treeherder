import moment from 'moment';

// string
export const removePath = (line = '') => line.replace(/\/?([\w\d-.]+\/)+/, '');

// util functions
export const sortData = function sortData(data, sortBy, desc) {
  data.sort((a, b) => {
    const item1 = desc ? b[sortBy] : a[sortBy];
    const item2 = desc ? a[sortBy] : b[sortBy];

    if (item1 < item2) {
      return -1;
    }
    if (item1 > item2) {
      return 1;
    }
    return 0;
  });
  return data;
};

// arrays
export const findObject = (list, key, value) => {
  return list.find((item) => item[key] === value);
};

// date time
// be sure to wrap date arg in a moment()
export const ISODate = function formatISODate(date) {
  return date.format('YYYY-MM-DD');
};

export const prettyDate = function formatPrettyDate(date) {
  return moment(date).format('ddd MMM D, YYYY');
};
