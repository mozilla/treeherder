import React from 'react';
import PropTypes from 'prop-types';

const ThemeContext = React.createContext({});

export class Theme extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      jobListClass: 'job-list-dark',
      globalContentClass: 'th-global-content-dark',
      platformClass: 'platform-dark',
      groupSymbolClass: 'group-symbol-dark',
      groupContentClass: 'group-content-dark',
    };
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
          />
        )}
      </ThemeContext.Consumer>
    );
  };
}
