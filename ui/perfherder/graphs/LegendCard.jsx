import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, FormGroup, Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import { getFrameworkName } from '../helpers';
import { graphColors } from '../constants';
import GraphIcon from '../../shared/GraphIcon';

const LegendCard = ({
  series,
  testData,
  updateState,
  updateStateParams,
  selectedDataPoint,
  frameworks,
  colors,
  symbols,
}) => {
  const updateSelectedTest = () => {
    const newColors = [...colors];
    const newSymbols = [...symbols];
    const errorMessages = [];
    let updates;
    const newTestData = [...testData].map(item => {
      if (item.signature_id === series.signature_id) {
        const isVisible = !item.visible;

        if (isVisible && newColors.length && newSymbols.length) {
          item.color = newColors.pop();
          item.symbol = newSymbols.pop();
          item.visible = isVisible;
          item.data = item.data.map(test => ({
            ...test,
            z: item.color[1],
            _z: item.symbol,
          }));
        } else if (!isVisible) {
          newColors.push(item.color);
          newSymbols.push(item.symbol);
          item.color = ['border-secondary', ''];
          item.symbol = ['circle', 'outline'];
          item.visible = isVisible;
          item.data = item.data.map(test => ({
            ...test,
            z: item.color[1],
            _z: item.symbol,
          }));
        } else {
          errorMessages.push(
            "The graph supports viewing 6 tests at a time. To select and view a test that isn't currently visible, first deselect a visible test",
          );
        }
      }
      return item;
    });

    if (errorMessages.length) {
      updates = { errorMessages, visibilityChanged: false };
    } else {
      updates = {
        testData: newTestData,
        colors: newColors,
        symbols: newSymbols,
        errorMessages,
        visibilityChanged: true,
      };
    }
    updateStateParams(updates);
  };

  const addTestData = option => {
    const options = { option, relatedSeries: series };
    updateState({ options, showModal: true });
  };

  const resetParams = (testData, newColors = null, newSymbols = null) => {
    const updates = { testData };
    if (newColors) updates.colors = newColors;
    if (newSymbols) updates.symbols = newSymbols;

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

    // when removing a test, check to see if the next test in the queue had a color;
    // if it had secondary and was deselected, reset its color and visibility to
    // the removed test's color, otherwise push that color back into the colors list
    if (
      newData[graphColors.length - 1] &&
      newData[graphColors.length - 1].color[0] === 'border-secondary'
    ) {
      newData[graphColors.length - 1].color = series.color;
      newData[graphColors.length - 1].visible = true;
      newData[graphColors.length - 1].data = newData[
        graphColors.length - 1
      ].data.map(item => ({
        ...item,
        z: series.color[1],
      }));
      resetParams(newData);
    } else if (series.color[0] === 'border-secondary') {
      resetParams(newData);
    } else {
      const newColors = [...colors, ...[series.color]];
      resetParams(newData, newColors);
    }
  };

  const subtitleStyle = 'p-0 mb-0 border-0 text-secondary text-left';
  const symbolType = series.symbol || ['circle', 'outline'];

  return (
    <FormGroup check className="pl-0 border">
      <Button
        className="close mr-3 my-2 ml-2 bg-transparent"
        onClick={removeTest}
      >
        <FontAwesomeIcon
          className="pointer"
          icon={faTimes}
          size="xs"
          title=""
        />
      </Button>
      <div className={`${series.color[0]} graph-legend-card p-3`}>
        <Button
          color="link"
          outline
          className={`p-0 mb-0 pointer border-0 ${
            series.visible ? series.color[0] : 'text-muted'
          } text-left`}
          onClick={() => addTestData('addRelatedConfigs')}
          title="Add related configurations"
        >
          <GraphIcon
            iconType={symbolType[0]}
            fill={symbolType[1] === 'fill' ? series.color[1] : '#ffffff'}
            stroke={series.color[1]}
          />

          {series.name}
        </Button>
        <Button
          color="link"
          outline
          className={`w-100  ${subtitleStyle}`}
          onClick={() => addTestData('addRelatedBranches')}
          title="Add related branches"
        >
          {series.repository_name}
        </Button>
        <Button
          color="link"
          outline
          className={`w-100  ${subtitleStyle}`}
          onClick={() => addTestData('addRelatedPlatform')}
          title="Add related platforms and branches"
        >
          {series.platform}
        </Button>
        {series.application && (
          <Button
            color="link"
            outline
            className={`w-100  ${subtitleStyle}`}
            title="Add related applications"
            onClick={() => addTestData('addRelatedApplications')}
          >
            {series.application}
          </Button>
        )}
        <Badge> {getFrameworkName(frameworks, series.framework_id)} </Badge>
        <div className="small">{`${series.signatureHash.slice(0, 16)}...`}</div>
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
