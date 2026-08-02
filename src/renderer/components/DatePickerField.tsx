import React from 'react';
import { Box } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

interface DatePickerFieldProps {
  label?: string;
  value: string | Date | null;
  onChange: (isoDate: string) => void;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  error?: boolean;
  helperText?: string;
  sx?: any;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  fullWidth,
  size = 'small',
  required,
  disabled,
  minDate,
  maxDate,
  error,
  helperText,
  sx,
}: DatePickerFieldProps) {
  const dayValue = value ? dayjs(value) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={sx}>
        <DatePicker
          label={label}
          value={dayValue}
          onChange={(newValue) => {
            if (newValue && newValue.isValid()) {
              onChange(newValue.format('YYYY-MM-DD'));
            } else {
              onChange('');
            }
          }}
          format="DD-MM-YYYY"
          slotProps={{
            textField: {
              fullWidth,
              size,
              required,
              disabled,
              error,
              helperText,
              placeholder: 'DD-MM-YYYY',
            },
          }}
          minDate={minDate ? dayjs(minDate) : undefined}
          maxDate={maxDate ? dayjs(maxDate) : undefined}
        />
      </Box>
    </LocalizationProvider>
  );
}
