import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row, Container, Button, Dropdown } from 'react-bootstrap';

import SimpleTooltip from './SimpleTooltip';
import DropdownMenuItems from './DropdownMenuItems';
import InputFilter from './InputFilter';

export const createDropdowns = (dropdownOptions, colClass) => (
  <React.Fragment>
    {dropdownOptions.map((dropdown) => (
      <Col
        sm="auto"
        className={colClass}
        key={`dropdown ${dropdown.namespace || ''}${dropdown.selectedItem}`}
      >
        <Dropdown
          className="mr-0 text-nowrap"
          title={dropdown.title}
          aria-label={dropdown.title}
        >
          <Dropdown.Toggle variant="outline-secondary">
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
  dropdownOptions,
  filterOptions,
  updateFilterText,
  updateFilter,
  updateOnEnter,
  dropdownCol,
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
      {!dropdownCol && dropdownOptions.length > 0 && (
        <Row className="p-3 justify-content-left">
          {createDropdowns(dropdownOptions, 'py-0 pl-0 pr-3')}
        </Row>
      )}
      <Row className="pb-3 pl-3 justify-content-left">
        {dropdownCol &&
          dropdownOptions.length > 0 &&
          createDropdowns(dropdownOptions, 'py-2 pl-0 pr-3')}

        <Col className="col-2 py-2 pl-0 pr-2">
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
  filterOptions: PropTypes.arrayOf(PropTypes.shape({})),
  updateFilter: PropTypes.func,
  updateFilterText: PropTypes.func.isRequired,
  updateOnEnter: PropTypes.bool, // only used by the InputFilter
  dropdownCol: PropTypes.bool,
};

FilterControls.defaultProps = {
  dropdownOptions: null,
  dropdownCol: false,
  filterOptions: [],
  updateFilter: null,
  updateOnEnter: false,
};

export default FilterControls;
