import React from 'react';
import PropTypes from 'prop-types';

const choices = [
  { url: '/', text: 'Treeherder' },
  { url: '/perf.html', text: 'Perfherder' },
  { url: '/intermittent-failures.html', text: 'Intermittent Failures' },
];

export default function LogoMenu(props) {
  const { menuText, menuTitle, menuImage } = props;

  const menuChoices = choices.filter(choice => choice.text !== menuText);

  return (
    <span className="dropdown">
      <button
        id="th-logo"
        title={menuTitle}
        data-toggle="dropdown"
        className="btn btn-view-nav dropdown-toggle"
      >
        <img src={menuImage} alt={menuText} />
      </button>
      <ul className="dropdown-menu" role="menu" aria-labelledby="th-logo">
        {menuChoices.map(choice => (
          <li key={choice.text}><a href={choice.url} className="dropdown-item">{choice.text}</a></li>
        ))}
      </ul>
    </span>
  );
}

LogoMenu.propTypes = {
  menuText: PropTypes.string.isRequired,
  menuTitle: PropTypes.string.isRequired,
  menuImage: PropTypes.string,
};

LogoMenu.defaultProps = {
  menuImage: null,
};
