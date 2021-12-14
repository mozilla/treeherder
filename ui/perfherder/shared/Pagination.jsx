import React from 'react';
import PropTypes from 'prop-types';
import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

class PaginationGroup extends React.Component {
  navigatePage = (page) => {
    const { updateParams } = this.props;
    updateParams({ page });
  };

  render() {
    const { viewablePageNums, currentPage, count } = this.props;
    // First and last viewable pages from the pagination. The controls
    // shows maximum 5 pages.
    const firstViewablePage = viewablePageNums[0];
    const lastViewablePage = viewablePageNums[viewablePageNums.length - 1];

    const firstButtonAvailable = firstViewablePage > 1;
    const prevButtonAvailable = currentPage > 1;
    const nextButtonAvailable = currentPage < count;
    const lastButtonAvailable = lastViewablePage < count;

    return (
      /* The first and last pagination navigation links
         aren't working correctly (icons aren't visible)
         so they haven't been added */
      <Pagination aria-label={`Page ${currentPage}`}>
        <PaginationItem className="text-info" disabled={!firstButtonAvailable}>
          <PaginationLink
            className="text-info"
            first
            onClick={() => this.navigatePage(1)}
          />
        </PaginationItem>
        <PaginationItem disabled={!prevButtonAvailable}>
          <PaginationLink
            className="text-info"
            previous
            onClick={() => this.navigatePage(currentPage - 1)}
          />
        </PaginationItem>
        {viewablePageNums.map((num) => (
          <PaginationItem
            key={num}
            active={num === currentPage}
            className="text-info pagination-active"
          >
            <PaginationLink
              className="text-info"
              onClick={() => this.navigatePage(num)}
              aria-label={`pagination-button-${num}`}
            >
              {num}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem disabled={!nextButtonAvailable}>
          <PaginationLink
            className="text-info"
            next
            onClick={() => this.navigatePage(currentPage + 1)}
          />
        </PaginationItem>
        <PaginationItem className="text-info" disabled={!lastButtonAvailable}>
          <PaginationLink
            className="text-info"
            last
            onClick={() => this.navigatePage(count)}
          />
        </PaginationItem>
      </Pagination>
    );
  }
}

PaginationGroup.propTypes = {
  viewablePageNums: PropTypes.arrayOf(PropTypes.number).isRequired,
  currentPage: PropTypes.number,
  count: PropTypes.number,
  updateParams: PropTypes.func.isRequired,
};

PaginationGroup.defaultProps = {
  currentPage: 1,
  count: 1,
};

export default PaginationGroup;
