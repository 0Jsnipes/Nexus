const Modal = ({ title, onClose, children, width }) => (
  <div className="nx-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
    <div className="nx-modal" style={width ? { width } : undefined}>
      <div className="nx-modal-header">
        <h2>{title}</h2>
        <button type="button" className="nx-btn nx-btn-ghost nx-btn-icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default Modal;
