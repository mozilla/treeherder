import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row, Container, Button, Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from './SimpleTooltip';
import DropdownMenuItems from './DropdownMenuItems';
import InputFilter from './InputFilter';

export const createMultiSelectDropdowns = (multiSelectDropdowns, colClass = 'py-2 ps-0 pe-3') => (
  <React.Fragment>
    {multiSelectDropdowns.map((dropdown) => {
      const { options, selectedItems, updateData, namespace, defaultLabel } = dropdown;
      const toggleLabel =
        selectedItems.length === 0 ? defaultLabel : selectedItems.join(', ');
      return (
        <Col sm="auto" className={colClass} key={`multiselect-${namespace}`}>
          <Dropdown autoClose="outside" className="me-0 text-nowrap">
            <Dropdown.Toggle variant="secondary">{toggleLabel}</Dropdown.Toggle>
            <Dropdown.Menu className="overflow-auto dropdown-menu-height">
              {options.map((option) => (
                <Dropdown.Item
                  as="a"
                  key={`${namespace}${option}`}
                  onClick={() => updateData(option)}
                >
                  <FontAwesomeIcon
                    icon={faCheck}
                    className={`me-1 ${selectedItems.includes(option) ? '' : 'hide'}`}
                    title={selectedItems.includes(option) ? 'Selected' : ''}
                  />
                  {option}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Col>
      );
    })}
  </React.Fragment>
);

export const createDropdowns = (dropdownOptions, colClass) => (
  <React.Fragment>
    {dropdownOptions.map((dropdown) => (
      <Col
        sm="auto"
        className={colClass}
        key={`dropdown ${dropdown.namespace || ''}${dropdown.selectedItem}`}
      >
        <Dropdown
          className="me-0 text-nowrap"
          title={dropdown.title}
          aria-label={dropdown.title}
        >
          <Dropdown.Toggle variant="secondary">
            {dropdown.selectedItem}
          </Dropdown.Toggle>
          <Dropdown.Menu className="overflow-auto dropdown-menu-height">
            <DropdownMenuItems
              pinned={dropdown.pinnedProjects || dropdown.pinned}
              otherPinned={dropdown.otherPinned}
              options={dropdown.options}
              selectedItem={dropdown.selectedItem}
              updateData={dropdown.updateData}
              namespace={dropdown.namespace}
            />
          </Dropdown.Menu>
        </Dropdown>
      </Col>
    ))}
  </React.Fragment>
);

const FilterControls = ({
  dropdownOptions = [],
  multiSelectDropdowns = [],
  filterOptions = [],
  updateFilterText,
  updateFilter = null,
  updateOnEnter = false,
  dropdownCol = false,
  filteredTextValue,
}) => {
  const createButton = (filter) => (
    <Button
      variant="outline-secondary"
      onClick={() => updateFilter(filter.stateName)}
      active={filter.state}
      disabled={filter.disable}
    >
      {filter.text}
    </Button>
  );

  return (
    <Container fluid className="my-3 px-0">
      {!dropdownCol && (dropdownOptions.length > 0 || multiSelectDropdowns.length > 0) && (
        <Row className="p-3 justify-content-left">
          {createDropdowns(dropdownOptions, 'py-0 ps-0 pe-3')}
          {createMultiSelectDropdowns(multiSelectDropdowns, 'py-0 ps-0 pe-3')}
        </Row>
      )}
      {dropdownCol && (dropdownOptions.length > 0 || multiSelectDropdowns.length > 0) && (
        <Row className="ps-3 justify-content-left">
          {createDropdowns(dropdownOptions, 'py-2 ps-0 pe-3')}
          {createMultiSelectDropdowns(multiSelectDropdowns, 'py-2 ps-0 pe-3')}
        </Row>
      )}
      <Row className="ps-3 justify-content-left">
        <Col className="col-2 py-2 ps-0 pe-2">
          <InputFilter
            filteredTextValue={filteredTextValue}
            updateFilterText={updateFilterText}
            updateOnEnter={updateOnEnter}
          />
        </Col>

        {filterOptions.length > 0 &&
          filterOptions.map((filter) => (
            <Col sm="auto" className="p-2" key={filter.stateName}>
              {filter.tooltipText ? (
                <SimpleTooltip
                  text={createButton(filter)}
                  tooltipText={filter.tooltipText}
                />
              ) : (
                createButton(filter)
              )}
            </Col>
          ))}
      </Row>
    </Container>
  );
};

FilterControls.propTypes = {
  dropdownOptions: PropTypes.arrayOf(PropTypes.shape({})),
  multiSelectDropdowns: PropTypes.arrayOf(PropTypes.shape({})),
  filterOptions: PropTypes.arrayOf(PropTypes.shape({})),
  updateFilter: PropTypes.func,
  updateFilterText: PropTypes.func.isRequired,
  updateOnEnter: PropTypes.bool,
  dropdownCol: PropTypes.bool,
};

export default FilterControls;
