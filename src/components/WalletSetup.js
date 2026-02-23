// src/components/WalletSetup.js - 다중 지갑 시스템 호환 + 계정 발견 기능
import React, { useState } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import{ useTranslation } from '../hooks/useTranslation';
import { Wallet, Lock, Import, Plus, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { walletService } from '../services/walletService';
import { SecureStorage } from '../services/secureStorage';
import { MultiWalletManager } from '../services/MultiWalletManager';
import './WalletSetup.css';
import './common.css';

const WalletSetup = ({ hasWallet, onWalletCreated, onWalletUnlocked, onBack }) => {
  const { t }=useTranslation();
  const [activeTab, setActiveTab] = useState(hasWallet ? 'unlock' : 'create');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 지갑 생성 상태
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 지갑 가져오기 상태
  const [importMethod, setImportMethod] = useState('privateKey'); // 'privateKey' or 'mnemonic'
  const [privateKey, setPrivateKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');

  // 지갑 잠금 해제 상태
  const [unlockPassword, setUnlockPassword] = useState('');

  // 계정 선택 상태 (다중 계정 발견용)
  const [discoveredAccounts, setDiscoveredAccounts] = useState([]);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // 새 지갑 생성
  const handleCreateWallet = async () => {
    clearMessages();
    setIsLoading(true);

    try {
      // 비밀번호 검증
      const passwordValidation = SecureStorage.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(t('WalletSetup.error_password_validation'));
      }

      if (password !== confirmPassword) {
        throw new Error(t('WalletSetup.error_password_mismatch'));
      }

      if (!agreedToTerms) {
        throw new Error(t('WalletSetup.error_terms_agreement'));
      }

      // 지갑 생성
      const walletResult = walletService.createWallet();
      if (!walletResult.success) {
        throw new Error(walletResult.error);
      }

      // 다중 지갑 매니저에 첫 번째 지갑으로 추가
      const addResult = await MultiWalletManager.addWallet(
        walletResult, 
        password, 
        t('WalletSetup.wallet_name_main')
      );

      if (!addResult.success) {
        throw new Error(addResult.error);
      }

      setSuccess(t('WalletSetup.success_wallet_created'));
      
      // 부모 컴포넌트에 알림
      setTimeout(() => {
        onWalletCreated(addResult.wallet, password);
      }, 1000);

    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 지갑 가져오기
  const handleImportWallet = async () => {
    clearMessages();
    consolelog('🔄 handleImportWallet 시작', { importMethod, mnemonic: !!mnemonic, password: !!password });
    
    // showAccountSelection이 true이면 실제 가져오기 실행하지 않음
    if (showAccountSelection) {
      consolelog('📋 이미 계정 선택 모드임');
      return;
    }
    
    setIsLoading(true);

    try {
      const passwordValidation = SecureStorage.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error(t('WalletSetup.error_password_validation'));
      }

      if (password !== confirmPassword) {
        throw new Error(t('WalletSetup.error_password_mismatch'));
      }

      if (importMethod === 'privateKey') {
        consolelog('📱 개인키로 가져오기');
        if (!privateKey.trim()) {
          throw new Error(t('WalletSetup.error_enter_private_key'));
        }
        
        const walletResult = walletService.importWallet(privateKey.trim());
        if (!walletResult.success) {
          throw new Error(walletResult.error);
        }

        walletResult.isImported = true;
        const addResult = await MultiWalletManager.addWallet(
          walletResult, 
          password, 
          t('WalletSetup.wallet_name_imported')
        );

        if (!addResult.success) {
          throw new Error(addResult.error);
        }

        setSuccess(t('WalletSetup.success_wallet_imported'));
        setTimeout(() => {
          onWalletCreated(addResult.wallet, password);
        }, 1000);
        
      } else {
        // 니모닉 구문 가져오기 - 다중 계정 발견
        consolelog('🔤 니모닉으로 가져오기 시작');
        
        if (!mnemonic.trim()) {
          throw new Error(t('WalletSetup.error_enter_mnemonic'));
        }
        
        consolelog('🔍 계정 발견 시작...');
        setSuccess(t('WalletSetup.discovering_accounts'));
        
        // 먼저 첫 번째 계정이 유효한지 확인
        const firstAccountTest = walletService.importFromMnemonic(mnemonic.trim(), 0);
        if (!firstAccountTest.success) {
          throw new Error(t('WalletSetup.invalid_mnemonic'));
        }
        
        // walletService에 discoverAccountsFromMnemonic 메서드가 있는지 확인
        if (typeof walletService.discoverAccountsFromMnemonic !== 'function') {
          consolewarn('⚠️ discoverAccountsFromMnemonic 메서드가 없습니다. 첫 번째 계정만 가져옵니다.');
          
          // 계정 발견 기능이 없으면 첫 번째 계정만 가져오기
          firstAccountTest.isImported = true;
          const addResult = await MultiWalletManager.addWallet(
            firstAccountTest, 
            password, 
            t('WalletSetup.account_alias_default')
          );

          if (!addResult.success) {
            throw new Error(addResult.error);
          }

          setSuccess(t('WalletSetup.success_wallet_imported'));
          setTimeout(() => {
            onWalletCreated(addResult.wallet, password);
          }, 1000);
          return;
        }
        
        // 계정 발견 (더 많은 계정을 확인)
        const discoveryResult = await walletService.discoverAccountsFromMnemonic(mnemonic.trim(), 20);
        consolelog('🔍 계정 발견 결과:', discoveryResult);
        
        if (!discoveryResult.success) {
          consoleerror('❌ 계정 발견 실패:', discoveryResult.error);
          
          // 계정 발견이 실패해도 첫 번째 계정은 가져올 수 있게 함
          consolelog('🔄 첫 번째 계정만 가져오기로 대체');
          const firstAccount = firstAccountTest;
          firstAccount.isImported = true;
          
          const addResult = await MultiWalletManager.addWallet(
            firstAccount, 
            password, 
            t('WalletSetup.account_alias_default')
          );

          if (!addResult.success) {
            throw new Error(addResult.error);
          }

          setSuccess(t('WalletSetup.first_account_imported'));
          setTimeout(() => {
            onWalletCreated(addResult.wallet, password);
          }, 1000);
          return;
        }
        
        consolelog(`📊 발견된 계정 수: ${discoveryResult.accounts.length}`);
        
        // 발견된 계정이 1개 이하면 첫 번째 계정만 가져오기
        if (discoveryResult.accounts.length <= 1) {
          consolelog('📱 단일 계정 가져오기');
          const firstAccount = firstAccountTest;
          firstAccount.isImported = true;
          
          const addResult = await MultiWalletManager.addWallet(
            firstAccount, 
            password, 
            t('WalletSetup.account_alias_default')
          );

          if (!addResult.success) {
            throw new Error(addResult.error);
          }

          setSuccess(t('WalletSetup.success_wallet_imported'));
          setTimeout(() => {
            onWalletCreated(addResult.wallet, password);
          }, 1000);
          return;
        }
        
        // 여러 계정이 발견되면 선택 UI 표시
        consolelog('📋 계정 선택 UI 표시');
        
        setDiscoveredAccounts(discoveryResult.accounts);
        
        // 활동이 있는 계정들을 자동 선택
        const activeAccountIndices = new Set();
        discoveryResult.accounts.forEach((account, index) => {
          if (account.hasActivity) {
            activeAccountIndices.add(index);
          }
        });
        
        // 활동이 있는 계정이 없으면 첫 번째 계정을 기본 선택
        if (activeAccountIndices.size === 0) {
          activeAccountIndices.add(0);
        }
        
        setSelectedAccounts(activeAccountIndices);
        setShowAccountSelection(true);
        
        consolelog('✅ 계정 선택 모드 활성화:', { 
          showAccountSelection: true, 
          accountCount: discoveryResult.accounts.length,
          selectedCount: activeAccountIndices.size
        });
        
        setSuccess(t('WalletSetup.accounts_discovered', { count: discoveryResult.accounts.length }));
      }

    } catch (error) {
      consoleerror('❌ 가져오기 실패:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 지갑 잠금 해제
  const handleUnlockWallet = async () => {
    clearMessages();
    setIsLoading(true);

    try {
      if (!unlockPassword.trim()) {
        throw new Error(t('WalletSetup.error_enter_password'));
      }

      // 다중 지갑 매니저로 지갑 목록 확인
      const walletsResult = await MultiWalletManager.getWalletList(unlockPassword);
      if (!walletsResult.success) {
        throw new Error(walletsResult.error);
      }

      if (walletsResult.wallets.length === 0) {
        throw new Error(t('WalletSetup.error_no_saved_wallet'));
      }

      setSuccess(t('WalletSetup.success_wallet_unlocked'));
      
      setTimeout(() => {
        onWalletUnlocked(unlockPassword);
      }, 500);

    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 계정 선택 처리
  const handleAccountSelection = (accountIndex, isSelected) => {
    consolelog('🔘 계정 선택 변경:', { accountIndex, isSelected });
    const newSelected = new Set(selectedAccounts);
    if (isSelected) {
      newSelected.add(accountIndex);
    } else {
      newSelected.delete(accountIndex);
    }
    setSelectedAccounts(newSelected);
    consolelog('📋 선택된 계정들:', Array.from(newSelected));
  };

  // 선택된 계정들 가져오기
  const handleImportSelectedAccounts = async () => {
    if (selectedAccounts.size === 0) {
      setError(t('WalletSetup.select_at_least_one'));
      return;
    }
    
    consolelog('📥 선택된 계정들 가져오기 시작:', Array.from(selectedAccounts));
    setIsLoading(true);
    
    try {
      let firstWallet = null;
      let importedCount = 0;
      
      for (const accountIndex of selectedAccounts) {
        const account = discoveredAccounts[accountIndex];
        consolelog(`📱 계정 #${account.index} 가져오기 중...`);
        
        const walletResult = walletService.importFromMnemonic(mnemonic.trim(), account.index);
        if (!walletResult.success) {
          consolewarn(`❌ 계정 ${account.index} 가져오기 실패:`, walletResult.error);
          continue;
        }
        
        walletResult.isImported = true;
        const alias = t('WalletSetup.account_alias_numbered', { number: account.index + 1 });
        
        const addResult = await MultiWalletManager.addWallet(
          walletResult, 
          password, 
          alias
        );
        
        if (addResult.success) {
          importedCount++;
          if (!firstWallet) {
            firstWallet = addResult.wallet;
          }
          consolelog(`✅ 계정 #${account.index} 가져오기 성공`);
        } else {
          consolewarn(`❌ 계정 #${account.index} 저장 실패:`, addResult.error);
        }
      }
      
      if (importedCount > 0) {
        setSuccess(t('WalletSetup.accounts_imported_success', { count: importedCount }));
        setTimeout(() => {
          onWalletCreated(firstWallet, password);
        }, 1500);
      } else {
        throw new Error(t('WalletSetup.import_selected_failed'));
      }
      
    } catch (error) {
      consoleerror('❌ 계정 가져오기 실패:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="wallet-setup">
      <div className="setup-container">        
        <div className="setup-header">
          {onBack && (
            <button onClick={onBack} className="back-btn">
              <ArrowLeft size={20} />
            </button>
          )}
          <h1>WorldLand Wallet</h1>
          <p>{t('WalletSetup.SafeandFastWorldLandMultiWallet')}</p>
        </div>

        {/* 계정 선택 화면이 활성화되지 않은 경우에만 탭 표시 */}
        {!showAccountSelection && (
          <div className="setup-tabs">
            {!hasWallet && (
              <>
                <button
                  className={`tab ${activeTab === 'create' ? 'active' : ''}`}
                  onClick={() => setActiveTab('create')}
                >
                  <Plus size={16} />
                  {t('WalletSetup.CreateNewWallet')}
                </button>
                <button
                  className={`tab ${activeTab === 'import' ? 'active' : ''}`}
                  onClick={() => setActiveTab('import')}
                >
                  <Import size={16} />
                  {t('WalletSetup.ImportWallet')}
                </button>
              </>
            )}
            {hasWallet && (
              <button
                className={`tab ${activeTab === 'unlock' ? 'active' : ''}`}
                onClick={() => setActiveTab('unlock')}
              >
                <Lock size={16} />
                {t('WalletSetup.Unlockthewallet')}
              </button>
            )}
          </div>
        )}

        {/* 메시지 */}
        {error && (
          <div className="message error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {success && (
          <div className="message success">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {/* 계정 선택 화면 */}
        {showAccountSelection && (
          <div className="account-selection"> 
            <h3>{t('WalletSetup.discovered_accounts_title')}</h3>
            <p>{t('WalletSetup.select_accounts_description')}</p>
            
            <div className="accounts-list">
              {discoveredAccounts.map((account, index) => (
                <div key={account.index} className={`account-item ${account.hasActivity ? 'active' : 'inactive'}`}>
                  <div className="account-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.has(index)}
                      onChange={(e) => handleAccountSelection(index, e.target.checked)}
                    />
                  </div>
                  
                  <div className="account-info">
                    <div className="account-header">
                      <span className="account-index">{t('WalletSetup.account_number', { number: account.index + 1 })}</span>
                      {account.hasActivity && <span className="activity-badge">{t('WalletSetup.activity_badge')}</span>}
                    </div>
                    <div className="account-address">{account.address}</div>
                    <div className="account-details">
                      <span>{t('WalletSetup.balance_label')}: {parseFloat(account.balance).toFixed(4)} WLC</span>
                      {account.transactionCount > 0 && (
                        <span> • {t('WalletSetup.transactions_label')}: {t('WalletSetup.transactions_count', { count: account.transactionCount })}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="account-selection-actions">
              <button
                className="primary-button"
                onClick={handleImportSelectedAccounts}
                disabled={isLoading || selectedAccounts.size === 0}
              >
                {isLoading ? t('WalletSetup.button_importing') : t('WalletSetup.button_import_selected_accounts', { count: selectedAccounts.size })}
              </button>
              
              <button
                className="secondary-button"
                onClick={() => {
                  setShowAccountSelection(false);
                  setDiscoveredAccounts([]);
                  setSelectedAccounts(new Set());
                  setSuccess('');
                }}
              >
                {t('WalletSetup.button_cancel')}
              </button>
            </div>
          </div>
        )}

        {/* 기존 탭 콘텐츠들은 계정 선택이 활성화되지 않은 경우에만 표시 */}
        {!showAccountSelection && (
          <>
            {/* 새 지갑 생성 */}
            {activeTab === 'create' && (
              <div className="tab-content">
                <div className="form-group">
                  <label>{t('WalletSetup.Password')}</label>
                  <div className="password-input">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('WalletSetup.Astrongpasswordwithatleast8characters')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && (
                    <PasswordStrength password={password} />
                  )}
                </div>

                <div className="form-group">
                  <label>{t('WalletSetup.ConfirmPassword')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('WalletSetup.Pleaseenteryourpasswordagain')}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                    />
                    <span>{t('WalletSetup.IagreetotheTermsofServiceandPrivacyPolicy')}</span>
                  </label>
                </div>

                <button
                  className="primary-button"
                  onClick={handleCreateWallet}
                  disabled={isLoading || !password || !confirmPassword || !agreedToTerms}
                >
                  {isLoading ? t('WalletSetup.button_generating') : t('WalletSetup.button_my_first_wallet')}
                </button>
              </div>
            )}

            {/* 지갑 가져오기 */}
            {activeTab === 'import' && (
              <div className="tab-content">
                <div className="import-method">
                  <button
                    className={`method-tab ${importMethod === 'privateKey' ? 'active' : ''}`}
                    onClick={() => setImportMethod('privateKey')}
                  >
                    {t('WalletSetup.PrivateKey')}
                  </button>
                  <button
                    className={`method-tab ${importMethod === 'mnemonic' ? 'active' : ''}`}
                    onClick={() => setImportMethod('mnemonic')}
                  >
                    {t('WalletSetup.Mnemonicphrase')}
                  </button>
                </div>

                {/* 개발/테스트용 버튼들 */}
                {false && activeTab === 'import' && importMethod === 'mnemonic' && process.env.NODE_ENV === 'development' && (
                  <div className="test-buttons" style={{ margin: '10px 0', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>{t('WalletSetup.test_buttons_label')}</p>
                    <button 
                      type="button"
                      className="test-btn"
                      onClick={() => {
                        consolelog('🧪 테스트: 계정 선택 화면 표시');
                        // 더미 계정 데이터 생성
                        const dummyAccounts = [
                          {
                            index: 0,
                            address: '0x742d35Cc6634C0532925a3b8D0Ea4c07146896F4',
                            privateKey: '0x1234567890abcdef...',
                            derivationPath: "m/44'/60'/0'/0/0",
                            hasActivity: true,
                            balance: '10.5234',
                            transactionCount: 15
                          },
                          {
                            index: 1,
                            address: '0x8ba1f109551bD432803012645Hac136c12345678',
                            privateKey: '0xabcdef1234567890...',
                            derivationPath: "m/44'/60'/0'/0/1",
                            hasActivity: true,
                            balance: '0.0000',
                            transactionCount: 3
                          },
                          {
                            index: 2,
                            address: '0x9876543210fedcba9876543210fedcba98765432',
                            privateKey: '0x9876543210fedcba...',
                            derivationPath: "m/44'/60'/0'/0/2",
                            hasActivity: false,
                            balance: '0.0000',
                            transactionCount: 0
                          }
                        ];
                        
                        setDiscoveredAccounts(dummyAccounts);
                        
                        // 활동이 있는 계정들을 자동 선택
                        const activeAccountIndices = new Set();
                        dummyAccounts.forEach((account, index) => {
                          if (account.hasActivity) {
                            activeAccountIndices.add(index);
                          }
                        });
                        setSelectedAccounts(activeAccountIndices);
                        
                        setShowAccountSelection(true);
                        setSuccess(t('WalletSetup.test_accounts_created'));
                      }}
                      style={{ 
                        padding: '5px 10px', 
                        margin: '0 5px', 
                        fontSize: '12px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      {t('WalletSetup.button_test_account_selection')}
                    </button>
                    
                    <button 
                      type="button"
                      className="test-btn"
                      onClick={() => {
                        consolelog('🧪 테스트: 계정 선택 화면 숨기기');
                        setShowAccountSelection(false);
                        setDiscoveredAccounts([]);
                        setSelectedAccounts(new Set());
                        setSuccess('');
                      }}
                      style={{ 
                        padding: '5px 10px', 
                        margin: '0 5px', 
                        fontSize: '12px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      {t('WalletSetup.button_reset_screen')}
                    </button>
                  </div>
                )}

                {importMethod === 'privateKey' && (
                  <div className="form-group">
                    <label>{t('WalletSetup.PrivateKey')}</label>
                    <textarea
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder={t('WalletSetup.placeholder_enter_private_key')}
                      rows={2}
                      style={{height: '20px'}}
                    />
                  </div>
                )}

                {importMethod === 'mnemonic' && (
                  <div className="form-group">
                    <label>{t('WalletSetup.label_mnemonic_12_words')}</label>
                    <textarea
                      value={mnemonic}
                      onChange={(e) => setMnemonic(e.target.value)}
                      placeholder={t('WalletSetup.placeholder_enter_mnemonic')}
                      rows={3}
                    />
                  </div>
                )}

                <div className="form-group"  style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px'}}>
                  <label style={{minWidth: '120px', flexShrink: 0, marginBottom: 0}}>{t('WalletSetup.label_new_password')}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('WalletSetup.Astrongpasswordwithatleast8characters')}
                    style={{flex: 1, maxWidth: '300px'}}
                  />
                </div>

                <div className="form-group"  style={{display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px'}}>
                  <label style={{minWidth: '120px', flexShrink: 0, marginBottom: 0}}>{t('WalletSetup.ConfirmPassword')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('WalletSetup.Pleaseenteryourpasswordagain')}
                    style={{flex: 1, maxWidth: '300px'}}
                  />
                </div>

                <button
                  className="primary-button"
                  onClick={handleImportWallet}
                  disabled={isLoading || !password || !confirmPassword || 
                           (importMethod === 'privateKey' ? !privateKey : !mnemonic)}
                >
                  {isLoading ? t('WalletSetup.button_loading') : t('WalletSetup.ImportWallet')}
                </button>
              </div>
            )}

            {/* 지갑 잠금 해제 */}
            {activeTab === 'unlock' && (
              <div className="tab-content">
                <div className="unlock-info">
                  <p>{t('WalletSetup.unlock_info_text')}</p>
                </div>

                <div className="form-group">
                  <label>{t('WalletSetup.Password')}</label>
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder={t('WalletSetup.placeholder_wallet_password')}
                    onKeyPress={(e) => e.key === 'Enter' && handleUnlockWallet()}
                    autoComplete="new-password"  // "off" 대신 "new-password" 사용
                    data-form-type="other"       // 브라우저가 폼 타입을 인식하지 못하게 함
                  />
                </div>

                <button
                  className="primary-button"
                  onClick={handleUnlockWallet}
                  disabled={isLoading || !unlockPassword}
                >
                  {isLoading ? t('WalletSetup.button_checking') : t('WalletSetup.button_unlock')}
                </button>

                <div className="unlock-options">
                  <button
                    className="text-button"
                    onClick={() => setActiveTab('import')}
                  >
                    {t('WalletSetup.button_recover_another')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// 비밀번호 강도 표시 컴포넌트
const PasswordStrength = ({ password }) => {
  const { t } = useTranslation();
  const validation = SecureStorage.validatePassword(password);
  
  const getStrengthColor = () => {
    switch (validation.strength) {
      case 'strong': return '#10b981';
      case 'medium': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  return (
    <div className="password-strength">
      <div className="strength-bar">
        <div 
          className="strength-fill"
          style={{ 
            width: `${(validation.score / 5) * 100}%`,
            backgroundColor: getStrengthColor()
          }}
        />
      </div>
      <div className="strength-text">
        {t('WalletSetup.password_strength_label')} <span style={{ color: getStrengthColor() }}>
          {validation.strength === 'strong' ? t('WalletSetup.password_strength_strong') : 
           validation.strength === 'medium' ? t('WalletSetup.password_strength_medium') : 
           t('WalletSetup.password_strength_weak')}
        </span>
      </div>
    </div>
  );
};

export default WalletSetup;