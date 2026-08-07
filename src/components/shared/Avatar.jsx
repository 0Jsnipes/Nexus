const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const Avatar = ({ src, name, size = 28 }) => {
  const style = { width: size, height: size };

  if (src) {
    return <img className="nx-avatar" style={style} src={src} alt="" />;
  }

  return (
    <div className="nx-avatar nx-avatar-fallback" style={style}>
      {initialsOf(name)}
    </div>
  );
};

export default Avatar;
