import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/api";
import TipModal from "../components/TipModal";
import { useToast } from "../components/useToast";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return toNumber(value).toFixed(2);
}

export default function UserProfile({ user: currentUser }) {
  const { userId } = useParams();
  const [tips, setTips] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTipModal, setShowTipModal] = useState(false);
  const { showToast } = useToast();

  const loadUserProfile = useCallback(async () => {
    setLoading(true);
    try {
      // Get user details from leaderboards or create a dedicated endpoint
      const response = await api.getUserTips(userId);
      setTips(response.data || []);
      setStats(response.stats);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, userId]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleTipSuccess = () => {
    loadUserProfile();
  };

  if (loading) {
    return <div className="simple-page"><p>Loading profile...</p></div>;
  }

  const isOwnProfile = currentUser && parseInt(currentUser.id) === parseInt(userId);

  return (
    <div className="simple-page">
      {showTipModal && (
        <TipModal
          user={{ id: userId } }
          onClose={() => setShowTipModal(false)}
          onSuccess={handleTipSuccess}
        />
      )}

      <div className="profile-header">
        <div>
          <h1>Support This Chef ☕</h1>
          <p className="section-copy">
            Help your favorite recipe creator continue cooking amazing dishes
          </p>
        </div>
        {!isOwnProfile && (
          <button
            className="button button--tip"
            onClick={() => setShowTipModal(true)}
          >
            ☕ Buy a Coffee
          </button>
        )}
      </div>

      {stats && (
        <div className="tip-stats">
          <div className="tip-stat">
            <span className="tip-stat-value">${formatCurrency(stats.total_received)}</span>
            <span className="tip-stat-label">Raised</span>
          </div>
          <div className="tip-stat">
            <span className="tip-stat-value">{toNumber(stats.tips_count)}</span>
            <span className="tip-stat-label">Supporters</span>
          </div>
        </div>
      )}

      <div className="tips-section">
        <h2>Recent Tips</h2>
        {tips.length > 0 ? (
          <ul className="tip-list">
            {tips.map((tip) => (
              <li key={tip.id} className="tip-item">
                <div className="tip-item-from">
                  <strong>{tip.sender?.name || "Anonymous"}</strong>
                  {tip.message && <em>{tip.message}</em>}
                </div>
                <span className="tip-item-amount">${formatCurrency(tip.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="feedback">
            No tips yet. Be the first to support this chef!
          </p>
        )}
      </div>
    </div>
  );
}
