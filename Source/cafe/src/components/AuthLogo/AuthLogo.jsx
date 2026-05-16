import React, { useState, useEffect } from 'react';
import { getJson, getImageUrl } from '../../utils/api';
import './AuthLogo.css';

export default function AuthLogo() {
  const [cafeName, setCafeName] = useState('Cafe System');
  const [cafeLogo, setCafeLogo] = useState(null);

  useEffect(() => {
    async function fetchPublicSettings() {
      try {
        const data = await getJson('/api/manager/settings/public');
        if (data) {
          const name = data.cafeName || data.CafeName;
          const logo = data.cafeLogo || data.CafeLogo;
          if (name) {
            setCafeName(name);
            localStorage.setItem('cachedCafeName', name);
          }
          if (logo) {
            setCafeLogo(logo);
            localStorage.setItem('cachedCafeLogo', logo);
          }
        }
      } catch (err) {
        console.error('Failed to load public settings:', err);
      }
    }
    fetchPublicSettings();
  }, []);

  return (
    <div className="auth-banner-content">
      {cafeLogo ? (
        <img src={getImageUrl(cafeLogo)} alt="Cafe Logo" className="auth-logo-img transition-logo" />
      ) : (
        <div className="auth-logo-placeholder transition-logo">☕</div>
      )}
      <h2 className="auth-logo-name transition-name">{cafeName}</h2>
      <p className="auth-banner-subtitle">
        Manage your cafe efficiently and serve with excellence.
      </p>
    </div>
  );
}
