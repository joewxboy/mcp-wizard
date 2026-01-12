import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    helperText,
    fullWidth = false,
    startAdornment,
    endAdornment,
    className,
    id,
    ...props
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const inputClasses = clsx(
      'input',
      error && 'border-red-500 focus:ring-red-500',
      startAdornment && 'pl-10',
      endAdornment && 'pr-10',
      fullWidth && 'w-full',
      className
    );

    return (
      <div className={clsx('mb-4', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}

        <div className="relative">
          {startAdornment && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {startAdornment}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            {...props}
          />

          {endAdornment && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {endAdornment}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}

        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';