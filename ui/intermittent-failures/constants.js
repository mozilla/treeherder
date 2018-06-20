import { curveLinear, format } from 'd3';

// data is passed as a prop and target is updated via a ref in graph.jsx
export const graphOneSpecs = {
  title: 'Orange Count per Push',
  data: [],
  width: 700,
  height: 300,
  right: 40,
  interpolate: curveLinear,
  color: '#dd6602',
  target: '',
  x_accessor: 'date',
  y_accessor: 'value',
  // this is a temporary fix until a bug (https://github.com/metricsgraphics/metrics-graphics/issues/844)
  // with the decimals attribute is fixed; it should be replaced with: decimals: 2
  y_mouseover: d => format('.2f')(d.value),
};

export const graphTwoSpecs = {
  data: [],
  width: 700,
  height: 300,
  right: 40,
  interpolate: curveLinear,
  color: ['blue', 'green'],
  target: '',
  x_accessor: 'date',
  y_accessor: 'value',
  legend: ['Orange Count', 'Push Count'],
  legend_target: '.legend',
};

export const treeOptions = [
  'all',
  'trunk',
  'mozilla-central',
  'mozilla-inbound',
  'mozilla-esr60',
  'autoland',
  'firefox-releases',
  'comm-central',
  'comm-esr60',
  'comm-releases',
];

export const prettyErrorMessages = {
  startday: 'startday is required and must be in YYYY-MM-DD format.',
  endday: 'endday is required and must be in YYYY-MM-DD format.',
  bug: 'bug is required and must be a valid integer.',
  tree: 'tree is required and must be a valid repository.',
  default: 'Something went wrong. Please try again later.',
  status503: 'There was a problem retrieving the data. Please try again in a minute.',
};

// names of the specific redux state slices to update when dispatching actions
export const name = {
  mainView: 'BUGS',
  mainViewGraphs: 'BUGS_GRAPHS',
  detailsView: 'BUG_DETAILS',
  detailsViewGraphs: 'BUG_DETAILS_GRAPHS',
};
