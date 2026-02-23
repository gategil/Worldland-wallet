// src/components/WalletSettings.js
import React, { useState, useEffect } from 'react'; 
import { consolelog, consoleerror } from '../utils/logger.js';
import { 
  Wallet, Settings, Network, Lock, Trash2, Key, Globe, Bell, 
  Shield, Download, Upload, AlertTriangle, Eye, EyeOff, Copy, CheckCircle 
} from 'lucide-react'; 

import { useTranslation } from '../hooks/useTranslation';
import LanguageSelector from './LanguageSelector';
import { walletService } from '../services/walletService';
import { SecureStorage } from '../services/secureStorage';
import { NETWORKS } from '../services/networkConfig';
import { MultiWalletManager } from '../services/MultiWalletManager';
import './WalletSettings.css';

const WalletSettings = ({ walletData, onLock, onDelete, onNetworkChange }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(SecureStorage.getDefaultSettings());
  const [currentNetwork, setCurrentNetwork] = useState('mainnet');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // 설정 로드
  useEffect(() => {
    const savedSettings = SecureStorage.loadSettings();
    if (savedSettings) {
      setSettings(savedSettings);
      setCurrentNetwork(savedSettings.network);
    }
  }, []);

  // 설정 저장
  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    SecureStorage.saveSettings(newSettings);
    setMessage({ type: 'success', text: t('WalletSettings.settingsSaved') });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const copyToClipboard = async (text, type = '주소') => {
    try {
      await navigator.clipboard.writeText(text);
      const message = type === '주소' ? 
        t('WalletSettings.addressCopied') : 
        t('WalletSettings.privateKeyCopied');
      setSuccess(message);
      
      // 0.5초 후 자동으로 메시지 제거
      setTimeout(() => setSuccess(''), 500);
    } catch (error) {
      setError(t('WalletSettings.copyFailed'));
      setTimeout(() => setError(''), 3000);
    }
  };

  // 네트워크 변경
  const handleNetworkChange = (network) => {
    setCurrentNetwork(network);
    walletService.switchNetwork(network);
    
    const newSettings = { ...settings, network };
    saveSettings(newSettings);
    
    if (onNetworkChange) {
      onNetworkChange();
    }
  };

  // 자동 잠금 시간 변경
  const handleAutoLockChange = (timeout) => {
    const newSettings = { ...settings, lockTimeout: timeout };
    saveSettings(newSettings);
  };

  // 가스 가격 설정 변경
  const handleGasPriceChange = (gasPrice) => {
    const newSettings = { ...settings, gasPrice };
    saveSettings(newSettings);
  };

  const handleResetWallet = async () => {
    const confirmMessage = t('WalletMain.resetConfirmMessage');

    if (window.confirm(confirmMessage)) {
      const doubleConfirm = window.prompt(t('WalletMain.resetDoubleConfirm'));
      
      if (doubleConfirm === 'RESET ALL') {
        try {
          consolelog('🗑️ 전체 데이터 리셋 시작...');
          
          // 1. 모든 지갑 데이터 삭제
          await MultiWalletManager.clearAllWallets();
          
          // 2. SecureStorage 모든 데이터 삭제
          SecureStorage.removeWallet();
          SecureStorage.secureDeleteTokens();
          SecureStorage.clearAllSessionData();
          
          // 3. localStorage 완전 정리
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('worldland_')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          
          // 4. sessionStorage도 정리
          sessionStorage.clear();
          
          consolelog('✅ 전체 데이터 리셋 완료');
          
          // 5. 성공 메시지 표시 후 페이지 새로고침
          alert(t('WalletMain.resetSuccessMessage'));
          window.location.reload();
          
        } catch (error) {
          consoleerror('❌ 데이터 리셋 실패:', error);
          setError(t('WalletMain.resetErrorMessage') + error.message);
        }
      } else {
        alert(t('WalletMain.resetInputMismatch'));
      }
    }
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="wallet-settings">
      {/* <div className="settings-header">
        <Settings size={24} />
        <h2>설정</h2>
      </div> */}

      {/* 언어 설정 섹션 */}
      <div className="settings-section">
        {/* <div className="section-header">
          <Globe size={20} />
          <h3>{t('settings.language')}</h3>
        </div> */}
        
        <LanguageSelector />
      </div>

      {/* 메시지 */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* 성공/에러 메시지 */}
      {success && (
        <div className="message success">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {error && (
        <div className="message error">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="settings-content">
        {/* 네트워크 설정 */}
        <div className="settings-section">
          <div className="section-header" style={{display: 'flex', flexDirection: 'row'}}>
            <Network size={20} />
            <h3>{t('WalletSettings.networkSettings')}</h3>
          </div>
          
          <div className="setting-item">
            <label>{t('WalletSettings.selectNetwork')}</label>
            <select 
              value={currentNetwork}
              onChange={(e) => handleNetworkChange(e.target.value)}
            >
              {Object.entries(NETWORKS).map(([key, network]) => (
                <option key={key} value={key}>
                  {network.name} (Chain ID: {network.chainId})
                </option>
              ))}
            </select>
          </div>

          <div className="network-details">
            <div className="detail-row" style={{display: 'flex', flexDirection: 'row'}}>
              <span>{t('WalletSettings.rpcUrl')}</span>
              <span className="mono">{NETWORKS[currentNetwork].rpcUrl}</span>
            </div>
            {/* <div className="detail-row">
              <span>체인 ID:</span>
              <span>{NETWORKS[currentNetwork].chainId}</span>
            </div>
            <div className="detail-row">
              <span>심볼:</span>
              <span>{NETWORKS[currentNetwork].symbol}</span>
            </div> */}
            <div className="detail-row" style={{display: 'flex', flexDirection: 'row'}}>
              <span>{t('WalletSettings.explorer')}</span>
              <a 
                href={NETWORKS[currentNetwork].explorer} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {t('WalletSettings.openLink')}
              </a>
            </div>
          </div>
        </div>

        <div className="settings-section"> 
            <div className="section-header" style={{display: 'flex', flexDirection: 'row'}}>
              <Wallet size={20} />
              <h3>{t('WalletSettings.currentWalletInfo')}</h3>
            </div> 
            <div className="detail-row" style={{display: 'flex', flexDirection: 'row'}}>
              <div className="wallet-address" onClick={() => copyToClipboard(walletData.address)}>
                {formatAddress(walletData.address)}
                <Copy size={16} />
              </div>
              <button 
                className="toggle-btn"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
              >
                {showPrivateKey ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPrivateKey ? t('WalletSettings.hidePrivateKey') : t('WalletSettings.showPrivateKey')}
              </button>
            </div> 
            
            {showPrivateKey && (
              <div className="private-key-display">
                <div className="private-key-text">
                  {walletData.privateKey}
                </div>
                <button 
                  onClick={() => copyToClipboard(walletData.privateKey, '개인키')}
                >
                  <Copy size={12} />
                </button>
              </div>
            )} 
        </div>

        {/* 보안 설정 */}
        <div className="settings-section">
          <div className="section-header" style={{display: 'flex', flexDirection: 'row'}}>
            <Shield size={20} />
            <h3>{t('WalletSettings.securitySettings')}</h3>
          </div>
          
          <div className="setting-item" style={{display: 'flex', flexDirection: 'row'}}>
            <label>{t('WalletSettings.autoLock')}</label>
            <select 
                value={settings.lockTimeout}
                onChange={(e) => handleAutoLockChange(parseInt(e.target.value))}
              >
                <option value={60000}>{t('WalletSettings.oneMinute')}</option>
                <option value={300000}>{t('WalletSettings.fiveMinutes')}</option>
                <option value={900000}>{t('WalletSettings.fifteenMinutes')}</option>
                <option value={1800000}>{t('WalletSettings.thirtyMinutes')}</option>
                <option value={3600000}>{t('WalletSettings.oneHour')}</option>
              </select>
            <div className="wallsettings-toggle-switch">
              <input
                type="checkbox"
                checked={settings.autoLock}
                onChange={(e) => saveSettings({ ...settings, autoLock: e.target.checked })}
              />
              <span className="wallsettings-slider"></span>
            </div>
          </div>

          {/* {settings.autoLock && (
            <div className="setting-item">
              <label>자동 잠금 시간</label>
              <select 
                value={settings.lockTimeout}
                onChange={(e) => handleAutoLockChange(parseInt(e.target.value))}
              >
                <option value={60000}>1분</option>
                <option value={300000}>5분</option>
                <option value={900000}>15분</option>
                <option value={1800000}>30분</option>
                <option value={3600000}>1시간</option>
              </select>
            </div>
          )} */}

          <div className="setting-actions">
            <button 
              className="setting-button"
              onClick={() => setShowChangePassword(true)}
            >
              <Key size={16} />
              {t('WalletSettings.changePassword')}
            </button>
            
            {/* <button 
              className="setting-button"
              onClick={onLock}
            >
              <Lock size={16} />
              지갑 잠금
            </button> */}
          </div>
        </div>

        {/* 거래 설정 */}
        <div className="settings-section">
          <div className="section-header" style={{display: 'flex', flexDirection: 'row'}}>
            <Globe size={20} />
            <h3>{t('WalletSettings.transactionSettings')}</h3>
          </div>
          
          <div className="setting-item" style={{display: 'flex', flexDirection: 'row'}}>
            <label>{t('WalletSettings.defaultGasPrice')}</label>
            <select 
              value={settings.gasPrice}
              onChange={(e) => handleGasPriceChange(e.target.value)}
            >
              <option value="slow">{t('WalletSettings.slow')}</option>
              <option value="standard">{t('WalletSettings.standard')}</option>
              <option value="fast">{t('WalletSettings.fast')}</option>
            </select>
          </div>

          <div className="setting-item" style={{display: 'flex', flexDirection: 'row'}}>
            <label>{t('WalletSettings.notifications')}</label>
            <div className="wallsettings-toggle-switch">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => saveSettings({ ...settings, notifications: e.target.checked })}
              />
              <span className="wallsettings-slider"></span>
            </div>
          </div>
        </div>

        {/* 지갑 관리 */}
        {/* <div className="settings-section">
          <div className="section-header">
            <Key size={20} />
            <h3>지갑 관리</h3>
          </div>
          
          <div className="wallet-info">
            <div className="info-row">
              <span>지갑 주소:</span>
              <span className="mono">{walletData.address}</span>
            </div>
          </div>

          <div className="setting-actions">
            <button 
              className="setting-button"
              onClick={() => setShowExportModal(true)}
            >
              <Download size={16} />
              지갑 내보내기
            </button>
          </div>
        </div> */}

        {/* 위험한 작업 */}
        {/* <div className="settings-section danger-zone">
          <div className="section-header">
            <AlertTriangle size={20} />
            <h3>위험한 작업</h3>
          </div>
          
          <div className="danger-warning">
            아래 작업들은 되돌릴 수 없습니다. 신중하게 진행하세요.
          </div>

          <div className="setting-actions">
            <button 
              className="danger-button"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={16} />
              지갑 삭제
            </button>
          </div>
        </div> */}
        {/* 위험한 작업 섹션 추가 */}
        <div className="settings-section danger-zone">
          <div className="section-header" style={{display: 'flex', flexDirection: 'row'}}>
            <AlertTriangle size={20} />
            <h3>{t('settings.dangerZone')}</h3>
          </div>
          
          <div className="danger-warning">
            {t('WalletMain.resetWalletTooltip')}
          </div>

          <div className="setting-actions">
            <button 
              className="danger-button"
              onClick={handleResetWallet}
              title={t('WalletMain.resetWalletTooltip')}
            >
              <Trash2 size={16} />
              {t('WalletMain.resetWallet')}
            </button>
          </div>
        </div>
      </div>

      {/* <div className="reset-wallet-container">
          <button 
            className="reset-wallet-btn"
            onClick={handleResetWallet}
            title={t('WalletMain.resetWalletTooltip')}
          >
            {t('WalletMain.resetWallet')}
          </button>
        </div> */}

      {/* 지갑 내보내기 모달 */}
      {showExportModal && (
        <ExportWalletModal 
          walletData={walletData}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* 지갑 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <DeleteConfirmModal 
          onConfirm={onDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* 비밀번호 변경 모달 */}
      {showChangePassword && (
        <ChangePasswordModal 
          walletData={walletData}
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowChangePassword(false);
            setMessage({ type: 'success', text: t('WalletSettings.settingsSaved') });
          }}
        />
      )}
    </div>
  );
};

// 지갑 내보내기 모달
const ExportWalletModal = ({ walletData, onClose }) => {
  const { t } = useTranslation();
  const [exportType, setExportType] = useState('privateKey');
  const [showData, setShowData] = useState(false);

  const exportData = {
    privateKey: walletData.privateKey,
    mnemonic: walletData.mnemonic,
    keystore: JSON.stringify({
      address: walletData.address,
      crypto: { /* 암호화된 키스토어 데이터 */ }
    }, null, 2)
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(t('WalletSettings.copiedToClipboard'));
    } catch (error) {
      consoleerror('복사 실패:', error);
    }
  };

  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content export-modal">
        <div className="modal-header">
          <h3>{t('WalletSettings.exportWalletTitle')}</h3>
          <button onClick={onClose}>×</button>
        </div>
        
        <div className="export-warning">
          {t('WalletSettings.exportWarning')}
        </div>

        <div className="export-options">
          <label className="export-option">
            <input
              type="radio"
              value="privateKey"
              checked={exportType === 'privateKey'}
              onChange={(e) => setExportType(e.target.value)}
            />
            <span>{t('WalletSettings.privateKey')}</span>
          </label>
          
          {walletData.mnemonic && (
            <label className="export-option">
              <input
                type="radio"
                value="mnemonic"
                checked={exportType === 'mnemonic'}
                onChange={(e) => setExportType(e.target.value)}
              />
              <span>{t('WalletSettings.mnemonic')}</span>
            </label>
          )}
          
          <label className="export-option">
            <input
              type="radio"
              value="keystore"
              checked={exportType === 'keystore'}
              onChange={(e) => setExportType(e.target.value)}
            />
            <span>{t('WalletSettings.keystore')}</span>
          </label>
        </div>

        <div className="export-content">
          <button 
            className="show-data-button"
            onClick={() => setShowData(!showData)}
          >
            {showData ? t('WalletSettings.hideData') : t('WalletSettings.showData')}
          </button>
          
          {showData && (
            <div className="export-data">
              <pre>{exportData[exportType]}</pre>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button 
            className="copy-button"
            onClick={() => copyToClipboard(exportData[exportType])}
          >
            {t('WalletSettings.copy')}
          </button>
          
          <button 
            className="download-button"
            onClick={() => downloadFile(
              exportData[exportType], 
              `worldland-wallet-${exportType}.txt`
            )}
          >
            {t('WalletSettings.download')}
          </button>
          
          <button className="cancel-button" onClick={onClose}>
            {t('WalletSettings.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

// 지갑 삭제 확인 모달
const DeleteConfirmModal = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState('');
  const requiredText = 'DELETE';

  return (
    <div className="modal-overlay">
      <div className="modal-content delete-modal">
        <div className="modal-header">
          <h3>{t('WalletSettings.deleteConfirmTitle')}</h3>
        </div>
        
        <div className="delete-warning">
          <AlertTriangle size={48} className="warning-icon" />
          <h4>{t('WalletSettings.deleteConfirmQuestion')}</h4>
          <p>
            {t('WalletSettings.deleteWarningText')}
          </p>
        </div>

        <div className="confirm-input">
          <label>
            {t('WalletSettings.deleteConfirmInstruction')}
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredText}
          />
        </div>

        <div className="modal-actions">
          <button 
            className="danger-button"
            onClick={onConfirm}
            disabled={confirmText !== requiredText}
          >
            {t('WalletSettings.deleteWallet')}
          </button>
          <button className="cancel-button" onClick={onCancel}>
            {t('WalletSettings.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

// 비밀번호 변경 모달
const ChangePasswordModal = ({ walletData, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async () => {
    setError('');
    
    if (newPassword !== confirmPassword) {
      setError(t('WalletSettings.passwordMismatch'));
      return;
    }

    const validation = SecureStorage.validatePassword(newPassword);
    if (!validation.isValid) {
      setError(t('WalletSettings.passwordRequirements'));
      return;
    }

    setIsLoading(true);
    try {
      // 현재 비밀번호로 지갑 로드
      const loadResult = await SecureStorage.loadWallet(currentPassword);
      if (!loadResult.success) {
        setError(t('WalletSettings.wrongCurrentPassword'));
        return;
      }

      // 새 비밀번호로 저장
      const saveResult = await SecureStorage.saveWallet(walletData, newPassword);
      if (!saveResult.success) {
        setError(t('WalletSettings.changePasswordFailed'));
        return;
      }

      onSuccess();
    } catch (error) {
      setError(t('WalletSettings.changePasswordError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content password-modal">
        <div className="modal-header">
          <h3>{t('WalletSettings.changePasswordTitle')}</h3>
          <button onClick={onClose}>×</button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="password-form">
          <div className="form-group">
            <label>{t('WalletSettings.currentPassword')}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('WalletSettings.currentPasswordPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label>{t('WalletSettings.newPassword')}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('WalletSettings.newPasswordPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label>{t('WalletSettings.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('WalletSettings.confirmPasswordPlaceholder')}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="primary-button"
            onClick={handleChangePassword}
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
          >
            {isLoading ? t('WalletSettings.changing') : t('WalletSettings.changePasswordButton')}
          </button>
          <button className="cancel-button" onClick={onClose}>
            {t('WalletSettings.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletSettings;