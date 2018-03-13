import React from 'react';
import MG from 'metrics-graphics';
import 'metrics-graphics/dist/metricsgraphics.css';
import PropTypes from 'prop-types';

// Pass a specs object and data array as props;
// specs.target will be updated with a ref callback and
// specs.data will be updated with your data prop
// const yourSpecs = {
//     title: 'your title',
//     data: [],
//     target: '',
//     width: 700,
//     height: 300,
//     x_accessor: 'date',
//     y_accessor: 'value'
// };

export default class Graph extends React.Component {

  componentWillReceiveProps(nextProps) {
    const { specs } = this.props;
    if (specs.data !== nextProps.data) {
      specs.data = nextProps.data;
      MG.data_graphic(this.props.specs);
    }
  }

  updateSpecs(element) {
    if (element) {
      const { specs, data } = this.props;

      specs.target = element;
      specs.data = data;
      MG.data_graphic(this.props.specs);
    }
  }

  render() {
    return (
      <div className="mx-auto pb-3" ref={ele => this.updateSpecs(ele)}>
        {this.props.specs.legend && <div className="legend" />}
      </div>
    );
  }
}

Graph.propTypes = {
  specs: PropTypes.shape({
    legend: PropTypes.oneOfType([
      PropTypes.string, PropTypes.arrayOf(PropTypes.string),
    ]),
  }).isRequired,
  data: PropTypes.oneOfType([
    PropTypes.shape({}),
    PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.shape({ Date: PropTypes.string }),
        value: PropTypes.number,
      }),
    ),
    PropTypes.arrayOf(
      PropTypes.arrayOf(
        PropTypes.shape({
          date: PropTypes.shape({ Date: PropTypes.string }),
          value: PropTypes.number,
        }),
      ), PropTypes.arrayOf(
        PropTypes.shape({
          date: PropTypes.shape({ Date: PropTypes.string }),
          value: PropTypes.number,
        }),
      ),
    ),
  ]),
};

Graph.defaultProps = {
  graphOneData: null,
  graphTwoData: null,
  data: null,
};
