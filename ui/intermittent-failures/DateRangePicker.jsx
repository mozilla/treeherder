import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import dayjs from '../helpers/dayjs';

const DateRangePicker = ({ updateState }) => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const updateData = () => {
    if (!startDate || !endDate) {
      return;
    }

    // Convert dayjs dates to ISO format (YYYY-MM-DD)
    const startday = startDate.format('YYYY-MM-DD');
    const endday = endDate.format('YYYY-MM-DD');

    updateState({ startday, endday });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="InputFromTo d-inline-block">
        <DatePicker
          label="Start Date"
          value={startDate}
          onChange={(newValue) => setStartDate(newValue)}
          maxDate={dayjs()}
          slotProps={{
            textField: {
              size: 'small',
              sx: { width: 180 },
            },
          }}
        />
        <span className="mx-2">to</span>
        <DatePicker
          label="End Date"
          value={endDate}
          onChange={(newValue) => setEndDate(newValue)}
          minDate={startDate}
          maxDate={dayjs()}
          slotProps={{
            textField: {
              size: 'small',
              sx: { width: 180 },
            },
          }}
        />
        <Button variant="secondary" className="ms-3" onClick={updateData}>
          update
        </Button>
      </div>
    </LocalizationProvider>
  );
};

DateRangePicker.propTypes = {
  updateState: PropTypes.func.isRequired,
};

export default DateRangePicker;
