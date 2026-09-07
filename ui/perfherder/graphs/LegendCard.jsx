import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, Form, CloseButton } from 'react-bootstrap';

import { getFrameworkName } from '../perf-helpers/helpers';
import { graphColors } from '../perf-helpers/constants';
import { Perfdocs } from '../perf-helpers/perfdocs';
import GraphIcon from '../../shared/GraphIcon';

const LegendCard = ({
  series,
  testDataRef,
  updateState,
  updateStateParams,
  selectedDataPoint = null,
  frameworks,
  colorsRef,
  symbolsRef,
}) => {
  const updateSelectedTest = () => {
    const testData = testDataRef.current;
    const newColors = [...colorsRef.current];
    const newSymbols = [...symbolsRef.current];

    const errorMessages = [];
    let updates;
    const targetIndex = testData.findIndex(
      (item) => item.signature_id === series.signature_id,
    );
    if (targetIndex === -1) return;
    const item = testData[targetIndex];
    const isVisible = !item.visible;
    const updatedItem = { ...item };

    if (isVisible && newColors.length && newSymbols.length) {
      updatedItem.color = newColors.pop();
      updatedItem.symbol = newSymbols.pop();
      updatedItem.visible = isVisible;
      updatedItem.queued = false;
      updatedItem.data = item.data.map((test) => ({
        ...test,
        z: updatedItem.color[1],
        _z: updatedItem.symbol,
      }));
    } else if (!isVisible) {
      newColors.push(item.color);
      newSymbols.push(item.symbol);
      updatedItem.color = ['border-secondary', ''];
      updatedItem.symbol = ['circle', 'outline'];
      updatedItem.visible = isVisible;
      updatedItem.queued = false;
      updatedItem.data = item.data.map((test) => ({
        ...test,
        z: updatedItem.color[1],
        _z: updatedItem.symbol,
      }));
    } else {
      errorMessages.push(
        "The graph supports viewing 6 tests at a time. To select and view a test that isn't currently visible, first deselect a visible test",
      );
    }

    if (errorMessages.length) {
      updates = { errorMessages, visibilityChanged: false };
    } else {
      // rebuild the array by slicing around the updated item
      const newTestData = [
        ...testData.slice(0, targetIndex),
        updatedItem,
        ...testData.slice(targetIndex + 1),
      ];

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

  const addTestData = (option) => {
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
    const testData = testDataRef.current;
    const colors = colorsRef.current;
    const symbols = symbolsRef.current;

    const index = testData.findIndex(
      (item) => item.signature_id === series.signature_id
    );

    if (index === -1) {
      return;
    }

    const newData = [...testData];

    newData.splice(index, 1);

      // Removing a hidden test frees no color slot → just drop it.
    if (series.color[0] === 'border-secondary') {
      resetParams(newData);
      return;
    }
    // A visible test was removed → promote the next auto-queued test (one that
    // was force-hidden only because the palette was exhausted). Tests the user
    // deliberately hid are queued:false and are never auto-promoted.
    const promoteIndex = newData.findIndex((item) => item.queued);
    if (promoteIndex !== -1) {
      const promoted = newData[promoteIndex];
      newData[promoteIndex] = {
        ...promoted,
        color: series.color,
        symbol: series.symbol,
        visible: true,
        queued: false,
        data: promoted.data.map((item) => ({
          ...item,
          z: series.color[1],
          _z: series.symbol,
        })),
      };
      resetParams(newData);
      return;
    }
    // No auto-queued test waiting → return the freed color/symbol to the pool.
    const newColors = [...colors, series.color];
    const newSymbols = [...symbols, series.symbol];
    resetParams(newData, newColors, newSymbols);
  };

  const subtitleStyle = 'p-0 mb-0 border-0 text-secondary text-start';
  const symbolType = series.symbol || ['circle', 'outline'];

  const { suite, platform, framework_id: frameworkId } = series;
  const framework = getFrameworkName(frameworks, frameworkId);
  const perfdocs = new Perfdocs(framework, suite, platform);
  const hasDocumentation = perfdocs.hasDocumentation();
  return (
    <Form.Group className="ps-0 border position-relative">
      <CloseButton
        className="position-absolute top-0 end-0 m-2"
        onClick={removeTest}
        data-testid="remove-test-button"
        aria-label="Remove test"
      />
      <div className={`${series.color[0]} graph-legend-card p-3`}>
        <Button
          variant="outline-link"
          className={`p-0 mb-0 pointer border-0 ${
            series.visible ? series.color[0] : 'text-muted'
          } text-start`}
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
        <div className="small legend-docs">
          {hasDocumentation && (
            <a
              href={perfdocs.documentationURL}
              target="_blank"
              rel="noopener noreferrer"
            >
              (docs)
            </a>
          )}
        </div>
        <Button
          variant="outline-link"
          className={`w-100  ${subtitleStyle}`}
          onClick={() => addTestData('addRelatedBranches')}
          title="Add related branches"
        >
          {series.repository_name}
        </Button>
        <Button
          variant="outline-link"
          className={`w-100  ${subtitleStyle}`}
          onClick={() => addTestData('addRelatedPlatform')}
          title="Add related platforms and branches"
        >
          {series.platform}
        </Button>
        {series.application && (
          <Button
            variant="outline-link"
            className={`w-100  ${subtitleStyle}`}
            title="Add related applications"
            onClick={() => addTestData('addRelatedApplications')}
          >
            {series.application}
          </Button>
        )}
        <Badge> {framework} </Badge>
        <div className="small">{`should_alert: ${
          series.shouldAlert !== false
        }`}</div>
        <div className="small">{`alert_change_type: ${
          series.alertChangeType === 1 ? 'absolute' : 'percentage'
        }`}</div>
        <div className="small">{`alert_threshold: ${series.alertThreshold}`}</div>
        <div className="small">{`${series.signatureHash.slice(0, 16)}...`}</div>
      </div>
      <Form.Check
        className="show-hide-check"
        type="checkbox"
        checked={series.visible}
        aria-label="Show/Hide series"
        title="Show/Hide series"
        onChange={updateSelectedTest}
      />
    </Form.Group>
  );
};

LegendCard.propTypes = {
  series: PropTypes.shape({
    visible: PropTypes.bool,
  }).isRequired,
  updateState: PropTypes.func.isRequired,
  updateStateParams: PropTypes.func.isRequired,
  testDataRef: PropTypes.shape({ current: PropTypes.array }).isRequired,
  colorsRef: PropTypes.shape({ current: PropTypes.array }).isRequired,
  symbolsRef: PropTypes.shape({ current: PropTypes.array }).isRequired,
  selectedDataPoint: PropTypes.shape({}),};

const areEqual = (prev, next) => {
  const seriesEqual = prev.series === next.series;
  
  const prevWasSelected = prev.selectedDataPoint?.signature_id === prev.series.signature_id;
  const nextIsSelected = next.selectedDataPoint?.signature_id === next.series.signature_id;

  return seriesEqual && prevWasSelected === nextIsSelected && prev.frameworks === next.frameworks;
};

export default React.memo(LegendCard, areEqual);
