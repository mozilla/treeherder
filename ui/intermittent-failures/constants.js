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

// we only want bug_ui and tree_ui to be used for UI validation, because
// if there is a valid type used but its a non-existent repo or bug_id
// we want to see that message from the api response
export const prettyErrorMessages = {
  startday: 'startday is required and must be in YYYY-MM-DD format.',
  endday: 'endday is required and must be in YYYY-MM-DD format.',
  bug_ui: 'bug is required and must be a valid integer.',
  tree_ui:
    'tree is required and must be a valid repository or repository group.',
  default: 'Something went wrong.',
  status503:
    'There was a problem retrieving the data. Please try again in a minute.',
};

export const errorMessageClass = 'text-danger py-4 d-block';
