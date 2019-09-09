import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const LegendCard = ({
  series,
  testData,
  updateState,
  updateStateParams,
  selectedDataPoint,
  colors,
}) => {
  const updateSelectedTest = () => {
    const newColors = [...colors];
    const errorMessages = [];
    let updates;
    const newTestData = [...testData].map(item => {
      if (item.signature_id === series.signature_id) {
        const isVisible = !item.visible;

        if (isVisible && newColors.length) {
          item.color = newColors.pop();
          item.visible = isVisible;
        } else if (!isVisible) {
          newColors.push(item.color);
          item.color = ['border-secondary', ''];
          item.visible = isVisible;
        } else {
          errorMessages.push(
            "The graph supports viewing 6 tests at a time. To select and view a test that isn't currently visible, first deselect a visible test",
          );
        }
      }
      return item;
    });

    if (errorMessages.length) {
      updates = { errorMessages };
    } else {
      updates = { testData: newTestData, colors: newColors, errorMessages };
    }
    updateStateParams(updates);
  };

  const addTestData = option => {
    const options = { option, relatedSeries: series };
    updateState({ options, showModal: true });
  };

  const resetParams = testData => {
    const updates = { testData, colors: [...colors, ...[series.color]] };

    if (
      selectedDataPoint &&
      selectedDataPoint.signature_id === series.signature_id
    ) {
      updates.selectedDataPoint = null;
    }

    if (testData.length === 0) {
      updates.highlightedRevisions = ['', ''];
      updates.zoom = {};
    }
    updateStateParams(updates);
  };

  const removeTest = () => {
    const index = testData.findIndex(test => test === series);
    const newData = [...testData];

    if (index === -1) {
      return;
    }

    newData.splice(index, 1);
    resetParams(newData);
  };

  const subtitleStyle = 'p-0 mb-0 border-0 text-secondary text-left';

  return (
    <FormGroup check className="pl-0 border">
      <span className="close mr-3 my-2 ml-2" onClick={removeTest}>
        <FontAwesomeIcon
          className="pointer"
          icon={faTimes}
          size="xs"
          title=""
        />
      </span>
      <div className={`${series.color[0]} graph-legend-card p-3`}>
        <p
          className={`p-0 mb-0 pointer border-0 ${
            series.visible ? series.color[0] : 'text-muted'
          } text-left`}
          onClick={() => addTestData('addRelatedConfigs')}
          title="Add related configurations"
          type="button"
        >
          {series.name}
        </p>
        <p
          className={subtitleStyle}
          onClick={() => addTestData('addRelatedBranches')}
          title="Add related branches"
          type="button"
        >
          {series.repository_name}
        </p>
        <p
          className={subtitleStyle}
          onClick={() => addTestData('addRelatedPlatform')}
          title="Add related platforms"
          type="button"
        >
          {series.platform}
        </p>
        <span className="small">{`${series.signatureHash.slice(
          0,
          16,
        )}...`}</span>
      </div>
      <Input
        className="show-hide-check"
        type="checkbox"
        checked={series.visible}
        aria-label="Show/Hide series"
        title="Show/Hide series"
        onChange={updateSelectedTest}
      />
    </FormGroup>
  );
};

LegendCard.propTypes = {
  series: PropTypes.PropTypes.shape({
    visible: PropTypes.bool,
  }).isRequired,
  updateState: PropTypes.func.isRequired,
  testData: PropTypes.arrayOf(PropTypes.shape({})),
  updateStateParams: PropTypes.func.isRequired,
  colors: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  selectedDataPoint: PropTypes.shape({}),
};

LegendCard.defaultProps = {
  testData: [],
  selectedDataPoint: null,
};

export default LegendCard;
