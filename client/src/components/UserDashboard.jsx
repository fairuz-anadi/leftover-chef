import { useState } from "react";
import "./UserDashboard.css";

const mockUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  joined: "January 2025",
  points: 250
};

const mockRecipes = [];

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState("info");

  return (
    <div className="ud-page">

      <div className="ud-hero">
        <div className="ud-hero-bg" />
        <div className="ud-hero-content">
          <div className="ud-avatar">
            {mockUser.name.charAt(0)}
          </div>
          <div className="ud-hero-text">
            <h1 className="ud-name">{mockUser.name}</h1>
            <p className="ud-email">{mockUser.email}</p>
            <div className="ud-badges">
              <span className="ud-badge">🗓 {mockUser.joined}</span>
              <span className="ud-badge ud-points">⭐ 250 Points</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ud-body">
        <div className="ud-tabs">
          <button className={`ud-tab ${activeTab === "info" ? "active" : ""}`} onClick={() => setActiveTab("info")}>
            <span>👤</span> User Info
          </button>
          <button className={`ud-tab ${activeTab === "recipes" ? "active" : ""}`} onClick={() => setActiveTab("recipes")}>
            <span>📖</span> My Uploads
            <span className="ud-tab-pill">{mockRecipes.length}</span>
          </button>
        </div>

        <div className="ud-panel">
          {activeTab === "info" && (
            <div className="ud-info-grid">
              <div className="ud-info-card">
                <div className="ud-info-icon">👤</div>
                <div className="ud-info-detail">
                  <span className="ud-info-lbl">Full Name</span>
                  <span className="ud-info-val">{mockUser.name}</span>
                </div>
              </div>
              <div className="ud-info-card">
                <div className="ud-info-icon">📧</div>
                <div className="ud-info-detail">
                  <span className="ud-info-lbl">Email Address</span>
                  <span className="ud-info-val">{mockUser.email}</span>
                </div>
              </div>
              <div className="ud-info-card">
                <div className="ud-info-icon">🗓</div>
                <div className="ud-info-detail">
                  <span className="ud-info-lbl">Member Since</span>
                  <span className="ud-info-val">{mockUser.joined}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "recipes" && (
            <div className="ud-empty-state">
              <span className="ud-empty-icon">🍽️</span>
              <p>No recipes uploaded yet.</p>
              <a href="/recipes/new" className="ud-upload-btn">+ Share Your First Recipe</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
