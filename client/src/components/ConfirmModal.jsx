export default function ConfirmModal({
  open,
  title = "Confirm action",
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel confirm-modal" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">{title}</p>
        <h2>{message}</h2>
        <div className="confirm-modal__actions">
          <button
            className={`button ${danger ? "" : "button--secondary"}`}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? "Processing..." : confirmLabel}
          </button>
          <button className="button button--ghost" disabled={busy} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
