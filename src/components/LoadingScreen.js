// src/components/LoadingScreen.js
import React from 'react';
import { Wallet } from 'lucide-react';
import './LoadingScreen.css';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-container">
        <div className="loading-logo">
          <Wallet size={64} className="logo-icon" />
          <div className="loading-spinner"></div>
        </div>
        
        <h1 className="loading-title">WorldLand Wallet</h1>
        <p className="loading-subtitle">지갑을 초기화하는 중...</p>
        
        <div className="loading-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <div className="progress-text">네트워크 연결 확인 중</div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;