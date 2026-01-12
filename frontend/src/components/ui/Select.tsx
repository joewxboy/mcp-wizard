import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, fullWidth = false, options, className, id, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    const selectClasses = clsx(
      'select',
      error && 'border-red-500 focus:ring-red-500',
      fullWidth && 'w-full',
      className,
    );

    return (
      <div className={clsx('mb-4', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={selectId} className="label">
            {label}
          </label>
        )}

        <select ref={ref} id={selectId} className={selectClasses} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value} title={option.description}>
              {option.label}
            </option>
          ))}
        </select>

        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

        {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
