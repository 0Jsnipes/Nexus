const Logo = ({ size = 20, className = "" }) => (
  <img
    src="/nexus-mark.png"
    alt="Nexus"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
  />
);

export default Logo;
