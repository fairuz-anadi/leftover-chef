import { useState } from "react";
import { api } from "../api/api";
import { useToast } from "./useToast";

export default function TipModal({ user, onClose, onSuccess }) {
  const [amount, setAmount] = useState(5);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.sendTip({
        recipient_id: user.id,
        amount: parseFloat(amount),
        message: message || null,
      });

      showToast(`Tip sent to ${user.name}! 🎉`, "success");
      setAmount(5);
      setMessage("");
      onSuccess?.();
      onClose();
    } catch (error) {
      showToast(error.rawMessage || "Failed to send tip", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tipAmounts = [2.5, 5, 10, 20, 50];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>☕ Buy a Coffee for {user?.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tip-form">
          <div className="form-group">
            <label>Select amount or enter custom:</label>
            <div className="amount-buttons">
              {tipAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`amount-btn ${
                    parseFloat(amount) === amt ? "amount-btn--active" : ""
                  }`}
                  onClick={() => setAmount(amt)}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0.50"
              max="1000"
              step="0.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="custom-amount"
              placeholder="Custom amount"
            />
          </div>

          <div className="form-group">
            <label htmlFor="message">Add a message (optional):</label>
            <textarea
              id="message"
              rows="3"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something nice!"
              maxLength="500"
            />
            <span className="char-count">{message.length}/500</span>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : `Send $${amount}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
