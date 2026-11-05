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
  autoComplete,
  disabled = false,
  error,
  hint,
  onBlur,
  inputMode
}) {
  let descriptionId;
  if (error) descriptionId = `${id}-error`;
  else if (hint) descriptionId = `${id}-hint`;

  return (
    <div className="loginInputGroup">
      {label && (
        <label htmlFor={id} className="loginInputLabel">
          {label}
        </label>
      )}
      <div className={`loginInputWrapper${error ? ' loginInputWrapperError' : ''}`}>
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
          onBlur={onBlur}
          disabled={disabled}
          inputMode={inputMode}
          required={required}
          autoComplete={autoComplete}
          className="loginInputField"
          aria-label={label || placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionId}
        />
        {rightElement && (
          <div className="loginInputRightElement">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p id={`${id}-error`} className="recoveryFieldError">{error}</p>}
      {hint && !error && <p id={`${id}-hint`} className="recoveryFieldHint">{hint}</p>}
    </div>
  );
}
