import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlusSquare,
  faMinusSquare,
} from '@fortawesome/free-regular-svg-icons';

import { resultColorMap } from './helpers';

export default class Metric extends React.PureComponent {
  constructor(props) {
    super(props);

    const { result } = this.props;

    this.state = {
      detailsShowing: result !== 'pass',
    };
  }

  toggleDetails = () => {
    this.setState({ detailsShowing: !this.state.detailsShowing });
  };

  render() {
    const { detailsShowing } = this.state;
    const { result, name, value, details } = this.props;
    const resultColor = resultColorMap[result];
    const expandIcon = detailsShowing ? faMinusSquare : faPlusSquare;

    return (
      <td>
        <div className="d-flex flex-row">
          <div className={`bg-${resultColor} pr-2 mr-2`} />
          <div>
            <h3>
              {name}
              <span onClick={this.toggleDetails} className="btn btn-lg">
                <FontAwesomeIcon icon={expandIcon} />
              </span>
            </h3>
            {detailsShowing && (
              <React.Fragment>
                <div>Confidence: {value}/10</div>
                {details.map(detail => (
                  <div key={detail} className="ml-3">
                    {detail}
                  </div>
                ))}
              </React.Fragment>
            )}
          </div>
        </div>
      </td>
    );
  }
}

Metric.propTypes = {
  result: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  details: PropTypes.array.isRequired,
};
