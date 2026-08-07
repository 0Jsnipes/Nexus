const Logo = ({ size = 20, className = "" }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="22" height="22" rx="6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.4" />
    <path d="M7 17V7L17 17V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Logo;
