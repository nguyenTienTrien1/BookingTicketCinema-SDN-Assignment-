import React from 'react';

/**
 * Left visual column recreated from the reference design
 */
export default function LoginVisual() {
  return (
    <div className="loginVisualCard">
      <img
        src="/images/login-illustration.png"
        alt="Atmospheric landscape illustration"
        className="loginVisualImage"
      />
      <div className="loginVisualOverlay" />
    </div>
  );
}

