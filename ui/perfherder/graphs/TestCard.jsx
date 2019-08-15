import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

export class TestContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      checked: this.props.series.visible,
    };
  }

  updateSelectedTest = () => {
    const { checked } = this.state;
    const { series, showHideSeries } = this.props;
    this.setState({ checked: !checked });
    showHideSeries(series.signature);
  };

  render() {
    const { series, addTestData, removeSeries } = this.props;
    const { checked } = this.state;
    const subtitleStyle = 'p-0 mb-0 border-0 text-secondary text-left';

    return (
      <FormGroup check className="pl-0 border">
        <span
          className="close mr-3 my-2 ml-2"
          onClick={() => removeSeries(series.projectName, series.signature)}
        >
          <FontAwesomeIcon
            className="pointer"
            icon={faTimes}
            size="xs"
            title=""
          />
        </span>
        <div
          className={`${
            checked && series.color ? series.color[0] : 'border-secondary'
          } graph-legend-card p-3`}
        >
          <p
            className="p-0 mb-0 border-0 text-left"
            onClick={() => addTestData('addRelatedConfigs', series.signature)}
            title="Add related configurations"
            type="button"
          >
            {series.name}
          </p>
          <p
            className={subtitleStyle}
            onClick={() => addTestData('addRelatedBranches', series.signature)}
            title="Add related branches"
            type="button"
          >
            {series.projectName}
          </p>
          <p
            className={subtitleStyle}
            onClick={() => addTestData('addRelatedPlatform', series.signature)}
            title="Add related branches"
            type="button"
          >
            {series.platform}
          </p>
          <span className="small text-muted">{`${series.signature.slice(
            0,
            16,
          )}...`}</span>
        </div>
        <Input
          className="show-hide-check"
          type="checkbox"
          checked={checked}
          aria-label="Show/Hide series"
          title="Show/Hide series"
          onChange={this.updateSelectedTest}
        />
      </FormGroup>
    );
  }
}

TestContainer.propTypes = {
  series: PropTypes.PropTypes.shape({
    visible: PropTypes.bool,
  }).isRequired,
  addTestData: PropTypes.func,
  removeSeries: PropTypes.func,
  showHideSeries: PropTypes.func,
};

TestContainer.defaultProps = {
  showHideSeries: undefined,
  addTestData: undefined,
  removeSeries: undefined,
};

export default TestContainer;
