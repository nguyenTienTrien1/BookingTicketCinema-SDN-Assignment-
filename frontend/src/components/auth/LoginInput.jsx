import React from 'react';

/**
 * Reusable accessible input with label, leading icon, and optional right element (e.g. eye toggle)
 */
export default function LoginInput({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  required = true,
  icon,
  rightElement,
  autoComplete
}) {
  return (
    <div className="loginInputGroup">
      {label && (
        <label htmlFor={id} className="loginInputLabel">
          {label}
        </label>
      )}
      <div className="loginInputWrapper">
        {icon && (
          <div className="loginInputIcon" aria-hidden="true">
            {icon}
          </div>
        )}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          className="loginInputField"
          aria-label={label || placeholder}
        />
        {rightElement && (
          <div className="loginInputRightElement">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}
