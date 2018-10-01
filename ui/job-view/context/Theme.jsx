import React from 'react';
import PropTypes from 'prop-types';

const lightTheme = {
  jobListClass: 'job-list-light',
  globalContentClass: 'th-global-content-light',
  platformClass: 'platform-light',
  groupSymbolClass: 'group-symbol-light',
  groupContentClass: 'group-content-light',
  detailsPanelClass: 'details-panel-light',
  getNextClass: 'get-next-light',
  getNextBtnTheme: 'btn-light-bordered',
  failureSummaryListTheme: 'failure-summary-list-light',
  summaryPanelTheme: 'summary-panel-light',
  quickFilterTheme: 'quick-filter-light',
};

const darkTheme = {
  jobListClass: 'job-list-dark',
  globalContentClass: 'th-global-content-dark',
  platformClass: 'platform-dark',
  groupSymbolClass: 'group-symbol-dark',
  groupContentClass: 'group-content-dark',
  detailsPanelClass: 'details-panel-dark',
  getNextClass: 'get-next-dark',
  getNextBtnTheme: 'btn-dark-bordered',
  failureSummaryListTheme: 'failure-summary-list-dark',
  summaryPanelTheme: 'summary-panel-dark',
  quickFilterTheme: 'quick-filter-dark',
};

const ThemeContext = React.createContext({});

export class Theme extends React.Component {
  constructor(props) {
    super(props);

    this.state = lightTheme;
    this.state = darkTheme;
  }

  componentDidMount() {
    // TODO: Load the selected theme from localStorage.  Default to light.
    // set the state to have the library of values for dark.  Each object it
    // touches will get the class for the themed version
  }

  render() {
    return (
      <ThemeContext.Provider value={this.state}>
        {this.props.children}
      </ThemeContext.Provider>
    );
  }
}

Theme.propTypes = {
  children: PropTypes.object.isRequired,
};

export function withTheme(Component) {
  return function ThemeComponent(props) {
    return (
      <ThemeContext.Consumer>
        {context => (
          <Component
            {...props}
            jobListClass={context.jobListClass}
            globalContentClass={context.globalContentClass}
            platformClass={context.platformClass}
            groupSymbolClass={context.groupSymbolClass}
            groupContentClass={context.groupContentClass}
            detailsPanelClass={context.detailsPanelClass}
            getNextClass={context.getNextClass}
            getNextBtnTheme={context.getNextBtnTheme}
            failureSummaryListTheme={context.failureSummaryListTheme}
            summaryPanelTheme={context.summaryPanelTheme}
            quickFilterTheme={context.quickFilterTheme}
          />
        )}
      </ThemeContext.Consumer>
    );
  };
}
