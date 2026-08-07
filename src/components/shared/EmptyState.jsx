const EmptyState = ({ icon, title, description, action }) => (
  <div className="nx-empty">
    {icon}
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action}
  </div>
);

export default EmptyState;
