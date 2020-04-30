import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import NotificationList from '../shared/NotificationList';

import { clearNotification } from './redux/stores/notifications';

const Notifications = (props) => {
  const { notifications, clearNotification } = props;

  return (
    <NotificationList
      notifications={notifications}
      clearNotification={clearNotification}
    />
  );
};

Notifications.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      created: PropTypes.number.isRequired,
      message: PropTypes.string.isRequired,
      severity: PropTypes.oneOf(['danger', 'warning', 'info', 'success']),
      sticky: PropTypes.bool,
    }),
  ).isRequired,
  clearNotification: PropTypes.func.isRequired,
};

const mapStateToProps = ({ notifications: { notifications } }) => ({
  notifications,
});

export default connect(mapStateToProps, { clearNotification })(Notifications);
