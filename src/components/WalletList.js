// src/components/WalletList.js
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import { 
  Wallet, PackagePlus, Plus, Edit3, Trash2, Eye, EyeOff, Copy, 
  RefreshCw, Users, CheckCircle, 
  AlertTriangle, MoreHorizontal, Star, StarOff
} from 'lucide-react';
import { MultiWalletManager } from '../services/MultiWalletManager';
import { walletService } from '../services/walletService';
import { useTranslation } from '../hooks/useTranslation';
import './WalletList.css'; 
import './common.css';

const WalletList = ({ password, onWalletSelect, activeWalletId, onAddWallet, onBackToMain }) => {
  const { t } = useTranslation();
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);

  useEffect(() => {
    loadWallets();
  }, [password]);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     updateBalances();
  //   }, 30000); // 30초마다 업데이트

  //   return () => clearInterval(interval);
  // }, [password]);

  const loadWallets = async () => {
    setIsLoading(true);
    try {
      const result = await MultiWalletManager.getWalletList(password);
      if (result.success) {
        // 니모닉별로 그룹화하여 정렬
        const sortedWallets = sortWalletsByMnemonic(result.wallets);
        setWallets(sortedWallets);
        // 잔액 업데이트
        updateBalances();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(t('WalletList.errorLoadWallets'));
    } finally {
      setIsLoading(false);
    }
  };

  // 니모닉별로 지갑들을 그룹화하고 정렬하는 함수
  const sortWalletsByMnemonic = (wallets) => {
    consolelog('🔄 지갑 그룹화 시작:', wallets.length, '개');

    // 1. 니모닉별로 그룹화
    const mnemonicGroups = {};
    const noMnemonicWallets = [];

    wallets.forEach(wallet => {
      if (wallet.mnemonic) {
        // 니모닉의 첫 4단어를 키로 사용 (같은 니모닉 식별용)
        const mnemonicKey = wallet.mnemonic.split(' ').slice(0, 4).join(' ');
        
        if (!mnemonicGroups[mnemonicKey]) {
          mnemonicGroups[mnemonicKey] = [];
        }
        mnemonicGroups[mnemonicKey].push(wallet);
      } else {
        noMnemonicWallets.push(wallet);
      }
    });

    // 2. 각 그룹 내에서 계정 인덱스 순으로 정렬
    const sortedGroups = {};
    Object.keys(mnemonicGroups).forEach(mnemonicKey => {
      const groupWallets = mnemonicGroups[mnemonicKey];
      
      // 각 지갑의 인덱스를 찾아서 정렬
      const walletsWithIndex = groupWallets.map(wallet => {
        let accountIndex = 999; // 기본값 (찾지 못한 경우 마지막에 위치)
        
        try {
          // 지갑 주소로부터 인덱스 역추적
          for (let i = 0; i < 50; i++) {
            const testResult = walletService.importFromMnemonic(wallet.mnemonic, i);
            if (testResult.success && testResult.address.toLowerCase() === wallet.address.toLowerCase()) {
              accountIndex = i;
              break;
            }
          }
        } catch (error) {
          consolewarn('인덱스 확인 실패:', wallet.alias, error);
        }
        
        return { ...wallet, accountIndex };
      });

      // 인덱스 순으로 정렬
      walletsWithIndex.sort((a, b) => a.accountIndex - b.accountIndex);
      sortedGroups[mnemonicKey] = walletsWithIndex;
      
      // consolelog(`📋 그룹 "${mnemonicKey.slice(0, 20)}...": ${walletsWithIndex.length}개 지갑, 인덱스 [${walletsWithIndex.map(w => w.accountIndex).join(', ')}]`);
    });

    // 3. 그룹들을 생성일 순으로 정렬 (첫 번째 지갑의 생성일 기준)
    const groupKeys = Object.keys(sortedGroups).sort((a, b) => {
      const groupA = sortedGroups[a];
      const groupB = sortedGroups[b];
      const createdAtA = Math.min(...groupA.map(w => w.createdAt || 0));
      const createdAtB = Math.min(...groupB.map(w => w.createdAt || 0));
      return createdAtA - createdAtB;
    });

    // 4. 최종 정렬된 배열 생성
    const sortedWallets = [];
    
    // 니모닉 그룹들 추가
    groupKeys.forEach(mnemonicKey => {
      sortedWallets.push(...sortedGroups[mnemonicKey]);
    });
    
    // 니모닉이 없는 지갑들을 마지막에 추가 (생성일 순)
    noMnemonicWallets.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    sortedWallets.push(...noMnemonicWallets);

    // consolelog('✅ 지갑 그룹화 완료:', {
    //   totalWallets: sortedWallets.length,
    //   mnemonicGroups: Object.keys(sortedGroups).length,
    //   noMnemonicWallets: noMnemonicWallets.length
    // });

    return sortedWallets;
  };

  // const updateBalances = async () => {
  //   try {
  //     const result = await MultiWalletManager.updateAllBalances(password);
  //     if (result.success) {
  //       // 잔액 업데이트 후에도 정렬 유지
  //       const sortedWallets = sortWalletsByMnemonic(result.wallets);
  //       setWallets(sortedWallets);
  //     }
  //   } catch (error) {
  //     consolewarn(t('WalletList.walletUpdateFailed'), error);
  //   }
  // };
  const updateBalances = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    const minLoadingTime = 800; // 최소 800ms는 스핀 애니메이션 표시
    
    try {
      consolelog('🔄 잔액 업데이트 시작');
      const result = await MultiWalletManager.updateAllBalances(password);
      if (result.success) {
        const sortedWallets = sortWalletsByMnemonic(result.wallets);
        setWallets(sortedWallets);
        consolelog('✅ 잔액 업데이트 완료');
      } else {
        consolewarn('❌ 잔액 업데이트 실패:', result.error);
      }
    } catch (error) {
      consolewarn(t('WalletList.walletUpdateFailed'), error);
    } finally {
      // 최소 로딩 시간을 보장
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        consolelog(`⏳ ${remainingTime}ms 추가 대기 중...`);
        setTimeout(() => {
          setIsLoading(false);
        }, remainingTime);
      } else {
        setIsLoading(false);
      }
    }
  };

  const handleAddWallet = async (walletData, alias) => {
    try {
      const result = await MultiWalletManager.addWallet(walletData, password, alias);
      if (result.success) {
        setSuccess(t('WalletList.successWalletAdded'));
        loadWallets(); // 정렬된 상태로 다시 로드
        setShowAddModal(false);
        if (onAddWallet) onAddWallet(result.wallet);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('WalletList.errorAddWallet');
    }
  };

  const handleDeleteWallet = async (walletId) => {
    if (!window.confirm(t('WalletList.confirmDeleteWallet'))) {
      return;
    }

    try {
      const result = await MultiWalletManager.removeWallet(walletId, password);
      if (result.success) {
        setSuccess(t('WalletList.successWalletDeleted'));
        loadWallets();
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(t('WalletList.errorDeleteWallet'));
    }
  };

  const handleUpdateAlias = async (walletId, newAlias) => {
    try {
      const result = await MultiWalletManager.updateWalletAlias(walletId, newAlias, password);
      if (result.success) {
        setSuccess(t('WalletList.successWalletRenamed'));
        loadWallets();
        setEditingWallet(null);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(t('WalletList.errorRenameWallet'));
    }
  };

  const handleSetActive = (walletId) => {
    MultiWalletManager.setActiveWallet(walletId);
    if (onWalletSelect) {
      const wallet = wallets.find(w => w.id === walletId);
      onWalletSelect(wallet);
    }
  };

  // 새로운 계정 추가 기능
  const handleAddAccount = async (baseWalletId, accountIndex, alias) => {
    try {
      consolelog('📱 새 계정 추가 시작:', { baseWalletId, accountIndex, alias });
      
      // 기존 지갑에서 니모닉 가져오기
      const baseWalletResult = await MultiWalletManager.getWallet(baseWalletId, password);
      if (!baseWalletResult.success) {
        throw new Error(t('WalletList.cannotFindExistingWallet'));
      }

      const baseWallet = baseWalletResult.wallet;
      if (!baseWallet.mnemonic) {
        throw new Error(t('WalletList.noMnemonicForNewAccount'));
      }

      // 새 계정 생성
      const newAccountResult = walletService.importFromMnemonic(baseWallet.mnemonic, accountIndex);
      if (!newAccountResult.success) {
        throw new Error(t('WalletList.failedToCreateNewAccount') + ': ' + newAccountResult.error);
      }

      // 중복 검사
      const isDuplicate = wallets.some(w => 
        w.address.toLowerCase() === newAccountResult.address.toLowerCase()
      );

      if (isDuplicate) {
        throw new Error(t('WalletList.duplicateWalletAddress'));
      }

      // 새 지갑으로 추가
      const addResult = await MultiWalletManager.addWallet(
        {
          ...newAccountResult,
          isImported: true
        }, 
        password, 
        alias || `${t('WalletList.accountNumber')}${accountIndex + 1}`
      );

      if (addResult.success) {
        setSuccess(`${t('WalletList.newAccountAdded')}: ${alias || `${t('WalletList.accountNumber')}${accountIndex + 1}`}`);
        loadWallets();
        setShowAddAccountModal(false);
        if (onAddWallet) onAddWallet(addResult.wallet);
      } else {
        throw new Error(addResult.error);
      }

    } catch (error) {
      consoleerror('❌ 계정 추가 실패:', error);
      setError(`${t('WalletList.accountAddFailed')}: ${error.message}`);
    }
  };

  const copyToClipboard = async (text, type = 'address') => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${t(type)}${t('WalletList.copied')}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      setError(t('WalletList.errorCopyFailed'));
    }
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance) => {
    return parseFloat(balance || 0).toFixed(4);
  };

  return (
    <div className="wallet-list">
      <div className="wallet-list-header">
        <div className="header-title">
          <Wallet size={24} />
          <h3>{t('WalletList.myWallets')}</h3>
          <span className="wallet-count">({wallets.length})</span>
        </div>
        
        <div className="header-actions">
          <button 
            className="action-btn"
            onClick={onBackToMain}
            title={t('WalletList.goHome')}
          >
            {t('WalletList.backHome')}
          </button>
          
          <button 
            className="action-btn refresh-btn"
            onClick={updateBalances}
            disabled={isLoading}
            title={t('WalletList.refreshBalance')}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
          
          <button 
            className="action-btn add-btn"
            onClick={() => setShowAddModal(true)}
            title={t('WalletList.addWallet')}
          >
            <PackagePlus size={16} />
          </button>
          
          {/* Import 버튼 제거하고 AddAccount 버튼 추가 */}
          <button 
            className="action-btn add-account-btn"
            onClick={() => setShowAddAccountModal(true)}
            title={t('WalletList.addAccountButton')}
          > 
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 메시지 */}
      {error && (
        <div className="message error">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
      {success && (
        <div className="message success">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* 지갑 목록 */}
      <div className="wallets-container">
        <div className="wallet-cards">
        {wallets.length === 0 ? (
          <div className="empty-state">
            <Wallet size={48} />
            <h3>{t('WalletList.noWallets')}</h3>
            <p>{t('WalletList.noWalletsDesc')}</p>
            <button 
              className="create-first-wallet-btn"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={16} />
              {t('WalletList.createFirstWallet')}
            </button>
          </div>
        ) : (
          wallets.map((wallet, index) => {
            // 그룹 구분선 표시 로직
            const isFirstInGroup = index === 0 || 
              !wallet.mnemonic || 
              !wallets[index - 1].mnemonic ||
              wallet.mnemonic !== wallets[index - 1].mnemonic;
            
            const isLastInGroup = index === wallets.length - 1 || 
              !wallet.mnemonic || 
              !wallets[index + 1].mnemonic ||
              wallet.mnemonic !== wallets[index + 1].mnemonic;

            // 같은 니모닉 그룹의 지갑 개수 계산
            let groupSize = 1;
            if (wallet.mnemonic) {
              groupSize = wallets.filter(w => w.mnemonic === wallet.mnemonic).length;
            }

            return (
              <div key={wallet.id}>
                {/* 그룹 시작 헤더 */}
                {isFirstInGroup && wallet.mnemonic && groupSize > 1 && (
                  <div className="wallet-group-header">
                    <div className="group-info">
                      <span className="group-label">
                        {t('WalletList.wallet')} ({groupSize} {t('WalletList.accounts')})
                      </span>
                      <span className="group-mnemonic">
                        {wallet.mnemonic.split(' ').slice(0, 1).join(' ')}...
                      </span>
                    </div>
                  </div>
                )}
                
                <WalletCard
                  wallet={wallet}
                  isActive={wallet.id === activeWalletId}
                  isEditing={editingWallet === wallet.id}
                  onSelect={() => handleSetActive(wallet.id)}
                  onEdit={() => setEditingWallet(wallet.id)}
                  onSaveEdit={(newAlias) => handleUpdateAlias(wallet.id, newAlias)}
                  onCancelEdit={() => setEditingWallet(null)}
                  onDelete={() => handleDeleteWallet(wallet.id)}
                  onCopyAddress={() => copyToClipboard(wallet.address, 'address')}
                  onCopyPrivateKey={() => copyToClipboard(wallet.privateKey, 'privateKey')}
                  formatBalance={formatBalance}
                  isInGroup={wallet.mnemonic && groupSize > 1}
                  accountIndex={wallet.accountIndex}
                /> 
                
                {/* 그룹 종료 구분선 */}
                {isLastInGroup && wallet.mnemonic && groupSize > 1 && index < wallets.length - 1 && (
                  <div className="wallet-group-divider"></div>
                )}
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* 지갑 추가 모달 */}
      {showAddModal && (
        <AddWalletModal
          onAdd={handleAddWallet}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* 계정 추가 모달 */}
      {showAddAccountModal && (
        <AddAccountModal
          wallets={wallets}
          onAddAccount={handleAddAccount}
          onClose={() => setShowAddAccountModal(false)}
        />
      )}
    </div>
  );
};

// 지갑 카드 컴포넌트
const WalletCard = ({
  wallet,
  isActive,
  isEditing, 
  onSelect,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onCopyAddress,
  onCopyPrivateKey,
  formatBalance,
  isInGroup = false,
  accountIndex
}) => {
  const { t } = useTranslation();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [editAlias, setEditAlias] = useState(wallet.alias);
  const [showMenu, setShowMenu] = useState(false);

  const handleSaveEdit = () => {
    if (editAlias.trim()) {
      onSaveEdit(editAlias.trim());
    }
  }; 

  return (
    <div className={`wallet-card ${isActive ? 'active' : ''} ${isInGroup ? 'in-group' : ''}`}>
      <div className="wallet-card-header">
        <div className="wallet-info">
          {isEditing ? (
            <div className="edit-alias">
              <input
                type="text"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                autoFocus
              />
              <div className="edit-actions">
                <button onClick={handleSaveEdit}>
                  {t('WalletList.confirm')}
                </button>
                <button onClick={onCancelEdit}>
                  {t('WalletList.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="wallet-name" onClick={onSelect}>
              <h3>
                {isInGroup && typeof accountIndex === 'number' && (
                  <span className="account-index-badge">#{accountIndex}</span>
                )}
                {wallet.alias}
              </h3>
              {isActive && <Star size={16} className="active-star" />}
            </div>
          )}
          
          <div className="wallet-address" onClick={onCopyAddress}>
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
            <Copy size={12} />
          </div>

          <div className="wallet-balance" style={{display: 'flex', flexDirection: 'row', gap: '5px'}}>
            <span className="balance-amount">{formatBalance(wallet.balance)}</span>
            <span className="balance-currency">WLC</span>
          </div>
        </div>
        
        
        
        <div className={`wallet-card ${isActive ? 'active' : ''} ${showMenu ? 'menu-open' : ''}`}>
          <div className="wallet-menu">
            <button 
              className="menu-toggle"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontal size={16} />
            </button>
            
            {showMenu && (
              <div className="menu-dropdown">
                <button onClick={() => {
                  onEdit();
                  setShowMenu(false);
                }}>
                  <Edit3 size={14} />
                  {t('WalletList.rename')}
                </button>
                <button onClick={() => {
                  setShowPrivateKey(!showPrivateKey);
                  setShowMenu(false);
                }}>
                  {showPrivateKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  {t('WalletList.privateKey')} 
                </button>
                {wallet.mnemonic && (
                  <button 
                    onClick={() => {
                      if (!showMnemonic) {
                        const confirmed = window.confirm(
                          t('WalletList.mnemonicShowConfirm')
                        );
                        if (confirmed) {
                          setShowMnemonic(true); 
                        }
                      } else {
                        setShowMnemonic(false); 
                      };
                      setShowMenu(false);
                    }}
                  >
                    {showMnemonic ? <EyeOff size={14} /> : <Eye size={14} />}
                    {t('WalletList.mnemonicPhrase')} 
                  </button>
                )} 
                <button className="delete-btn" onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}> 
                  <Trash2 size={14} />
                  {t('WalletList.delete')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showMenu && (
        <div className="wallet-details">
          <div className="wallet-type">
            {wallet.isImported ? t('WalletList.importedWallet') : t('WalletList.createdWallet')}
            {isInGroup && typeof accountIndex === 'number' && (
              <span className="account-detail"> • {t('WalletList.accountIndex')}: {accountIndex}</span>
            )}
          </div> 
        </div>
      )}
      {showPrivateKey && (
        <div className="private-key-display">
          <div className="private-key-text">
            {wallet.privateKey}
          </div>
          <button onClick={onCopyPrivateKey}>
            <Copy size={12} />
          </button>
        </div>
      )}
      {showMnemonic && wallet.mnemonic && (
      <div className="mnemonic-display">
        <div className="mnemonic-warning">
          {t('WalletList.mnemonicSafetyInstructions')}
        </div>
        <div className="mnemonic-text">
          {wallet.mnemonic}
        </div>
        <div className="mnemonic-instructions">
          {t('WalletList.mnemonicBackupInstructions')}
        </div>
      </div>
      )}
    </div>
  );
};

// 지갑 추가 모달 (기존과 동일하지만 ImportWalletModal 제거)
const AddWalletModal = ({ onAdd, onClose }) => {
  const { t } = useTranslation();
  const [method, setMethod] = useState('create');
  const [importType, setImportType] = useState('privateKey');
  const [alias, setAlias] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 다중 계정 발견 관련 상태
  const [discoveredAccounts, setDiscoveredAccounts] = useState([]);
  const [showAccountSelection, setShowAccountSelection] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());

  const handleAdd = async () => {
    setError('');
    setSuccess('');
    
    if (showAccountSelection) {
      consolelog('📋 이미 계정 선택 모드임 - 직접 가져오기 실행하지 않음');
      return;
    }
    
    setIsLoading(true);

    try {
      let walletData;

      if (method === 'create') {
        consolelog('🔄 새 지갑 생성 시작');
        const result = walletService.createWallet();
        if (!result.success) {
          throw new Error(result.error);
        }
        walletData = result;

        consolelog('✅ 새 지갑 생성 완료:', walletData.address);
        
        await onAdd(walletData, alias || t('WalletList.newWallet'));
        
        setTimeout(() => {
          alert(t('WalletList.walletCreatedBackupAlert'));
        }, 1000);
        
        return;

      } else if (importType === 'privateKey') {
        consolelog('🔄 개인키로 지갑 가져오기 시작');
        if (!privateKey.trim()) {
          throw new Error(t('WalletList.errorEnterPrivateKey'));
        }
        const result = walletService.importWallet(privateKey.trim());
        if (!result.success) {
          throw new Error(result.error);
        }
        walletData = { ...result, isImported: true };
        
        consolelog('✅ 개인키 지갑 가져오기 완료:', walletData.address);
        
        await onAdd(walletData, alias || t('WalletList.newWallet'));
        return;
        
      } else {
        // 니모닉 구문 가져오기 - 다중 계정 발견
        consolelog('🔄 니모닉으로 지갑 가져오기 시작');
        if (!mnemonic.trim()) {
          throw new Error(t('WalletList.errorEnterMnemonic'));
        }
        
        consolelog('🔍 WalletList에서 계정 발견 시작...');
        setSuccess(t('WalletList.discovering'));
        
        const firstAccountTest = walletService.importFromMnemonic(mnemonic.trim(), 0);
        if (!firstAccountTest.success) {
          throw new Error(t('WalletList.invalidMnemonic'));
        }
        
        if (typeof walletService.discoverAccountsFromMnemonic !== 'function') {
          consolewarn('⚠️ discoverAccountsFromMnemonic 메서드가 없습니다. 첫 번째 계정만 가져옵니다.');
          
          walletData = { ...firstAccountTest, isImported: true };
          consolelog('✅ 단일 니모닉 계정 가져오기 완료:', walletData.address);
          await onAdd(walletData, alias || t('WalletList.newWallet'));
          return;
        }
        
        const discoveryResult = await walletService.discoverAccountsFromMnemonic(mnemonic.trim(), 20);
        consolelog('🔍 WalletList 계정 발견 결과:', discoveryResult);
        
        if (!discoveryResult.success) {
          consolewarn('❌ 계정 발견 실패, 첫 번째 계정만 가져오기:', discoveryResult.error);
          walletData = { ...firstAccountTest, isImported: true };
          consolelog('✅ 대체 니모닉 계정 가져오기 완료:', walletData.address);
          await onAdd(walletData, alias || t('WalletList.newWallet'));
          return;
        }
        
        if (discoveryResult.accounts.length <= 1) {
          consolelog('📱 단일 계정만 발견됨');
          walletData = { ...firstAccountTest, isImported: true };
          consolelog('✅ 단일 발견 계정 가져오기 완료:', walletData.address);
          await onAdd(walletData, alias || t('WalletList.newWallet'));
          return;
        }
        
        consolelog('📋 WalletList에서 계정 선택 UI 표시');
        
        setDiscoveredAccounts(discoveryResult.accounts);
        
        const activeAccountIndices = new Set();
        discoveryResult.accounts.forEach((account, index) => {
          if (account.hasActivity) {
            activeAccountIndices.add(index);
          }
        });
        
        if (activeAccountIndices.size === 0) {
          activeAccountIndices.add(0);
        }
        
        setSelectedAccounts(activeAccountIndices);
        setShowAccountSelection(true);
        
        consolelog('✅ WalletList 계정 선택 모드 활성화:', { 
          accountCount: discoveryResult.accounts.length,
          selectedCount: activeAccountIndices.size
        });
        
        setSuccess(`${discoveryResult.accounts.length} ${t('WalletList.accountsDiscovered')}`);
        setIsLoading(false);
        return;
      }
      
    } catch (error) {
      consoleerror('❌ handleAdd 실패:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountSelection = (accountIndex, isSelected) => {
    consolelog('🔘 WalletList 계정 선택 변경:', { accountIndex, isSelected });
    const newSelected = new Set(selectedAccounts);
    if (isSelected) {
      newSelected.add(accountIndex);
    } else {
      newSelected.delete(accountIndex);
    }
    setSelectedAccounts(newSelected);
    consolelog('📋 WalletList 선택된 계정들:', Array.from(newSelected));
  };

  const handleImportSelectedAccounts = async () => {
    if (selectedAccounts.size === 0) {
      setError(t('WalletList.selectMinimumOneAccount'));
      return;
    }
    
    consolelog('📥 WalletList 선택된 계정들 가져오기 시작:', Array.from(selectedAccounts));
    setIsLoading(true);
    
    try {
      let importedCount = 0;
      let firstWallet = null;
      
      for (const accountIndex of selectedAccounts) {
        const account = discoveredAccounts[accountIndex];
        consolelog(`📱 WalletList 계정 #${account.index} 가져오기 중...`);
        
        const walletResult = walletService.importFromMnemonic(mnemonic.trim(), account.index);
        if (!walletResult.success) {
          consolewarn(`❌ WalletList 계정 ${account.index} 가져오기 실패:`, walletResult.error);
          continue;
        }
        
        walletResult.isImported = true;
        const accountAlias = alias ? `${alias} #${account.index + 1}` : `${t('WalletList.accountNumber')}${account.index + 1}`;
        
        try {
          await onAdd(walletResult, accountAlias);
          importedCount++;
          
          if (!firstWallet) {
            firstWallet = walletResult;
          }
          
          consolelog(`✅ WalletList 계정 #${account.index} 가져오기 성공`);
        } catch (addError) {
          consolewarn(`❌ WalletList 계정 #${account.index} 저장 실패:`, addError);
        }
      }
      
      if (importedCount > 0) {
        setSuccess(`${importedCount}${t('WalletList.accountsImportedSuccessfully')}`);
        
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error(t('WalletList.failedToImportSelectedAccounts'));
      }
      
    } catch (error) {
      consoleerror('❌ WalletList 계정 가져오기 실패:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content add-wallet-modal">
        <div className="modal-header">
          <h3>{showAccountSelection ? t('WalletList.accountSelectionTitle') : t('WalletList.addWallet')}</h3>
          <button onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {showAccountSelection && (
          <div className="account-selection">
            <div className="account-selection-info">
              <p>{t('WalletList.selectAccountsToImport')}</p>
              <p>{t('WalletList.activeAccountsSelected')}</p>
            </div>
            
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
                      <span className="account-index">{t('WalletList.accountNumber')}{account.index + 1}</span>
                      {account.hasActivity && <span className="activity-badge">{t('WalletList.activity')}</span>}
                    </div>
                    <div className="account-address">{account.address}</div>
                    <div className="account-details">
                      <span>{t('WalletList.balance')}: {parseFloat(account.balance).toFixed(4)} WLC</span>
                      {account.transactionCount > 0 && (
                        <span> • {t('WalletList.transactions')}: {account.transactionCount}{t('WalletList.transactionCount')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="account-selection-actions">
              <button
                className="primary-btn"
                onClick={handleImportSelectedAccounts}
                disabled={isLoading || selectedAccounts.size === 0}
              >
                {isLoading ? t('WalletList.importing') : `${t('WalletList.importSelectedAccounts')}  (${selectedAccounts.size})`}
              </button>
              
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowAccountSelection(false);
                  setDiscoveredAccounts([]);
                  setSelectedAccounts(new Set());
                  setSuccess('');
                  setError('');
                }}
              >
                {t('WalletList.cancel')}
              </button>
            </div>
          </div>
        )}

        {!showAccountSelection && (
          <div className="modal-body">
            <div className="method-selector">
              <button 
                className={`method-btn ${method === 'create' ? 'active' : ''}`}
                onClick={() => setMethod('create')}
              >
                <Plus size={16} />
                {t('WalletList.createNewWallet')}
              </button>
              <button 
                className={`method-btn ${method === 'import' ? 'active' : ''}`}
                onClick={() => setMethod('import')}
              >
                <Users size={16} />
                {t('WalletList.importWallet')}
              </button>
            </div>

            <div className="form-group">
              <label>{t('WalletList.walletName')}</label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder={t('WalletList.enterWalletName')}
              />
            </div>

            {method === 'import' && (
              <>
                <div className="import-type-selector">
                  <button 
                    className={`type-btn ${importType === 'privateKey' ? 'active' : ''}`}
                    onClick={() => setImportType('privateKey')}
                  >
                    {t('WalletList.privateKey')}
                  </button>
                  <button 
                    className={`type-btn ${importType === 'mnemonic' ? 'active' : ''}`}
                    onClick={() => setImportType('mnemonic')}
                  >
                    {t('WalletList.mnemonicPhrase')}
                  </button>
                </div>

                {importType === 'privateKey' && (
                  <div className="form-group">
                    <label>{t('WalletList.privateKey')}</label>
                    <textarea
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder={t('WalletList.enterPrivateKey')}
                      rows={3}
                    />
                  </div>
                )}

                {importType === 'mnemonic' && (
                  <div className="form-group">
                    <label>{t('WalletList.mnemonicPhrase')}</label>
                    <textarea
                      value={mnemonic}
                      onChange={(e) => setMnemonic(e.target.value)}
                      placeholder={t('WalletList.enterMnemonic')}
                      rows={3}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!showAccountSelection && (
          <div className="modal-actions">
            <button 
              className="primary-btn"
              onClick={handleAdd}
              disabled={isLoading || (method === 'import' && 
                (importType === 'privateKey' ? !privateKey : !mnemonic))}
            >
              {isLoading ? t('WalletList.processing') : method === 'create' ? t('WalletList.createWallet') : t('WalletList.importWallet')}
            </button>
            <button className="cancel-btn" onClick={onClose}>
              {t('WalletList.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 새로운 계정 추가 모달 컴포넌트
const AddAccountModal = ({ wallets, onAddAccount, onClose }) => {
  const { t } = useTranslation();
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [accountIndex, setAccountIndex] = useState(0);
  const [alias, setAlias] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usedIndices, setUsedIndices] = useState([]);

  // 니모닉이 있는 지갑들만 필터링
  const mnemonicWallets = wallets.filter(wallet => wallet.mnemonic);

  // 선택된 지갑의 니모닉으로 생성된 계정들의 인덱스 찾기
  const findUsedIndices = async (walletId) => {
    if (!walletId) {
      setUsedIndices([]);
      setAccountIndex(0);
      return;
    }

    try {
      // 선택된 지갑 정보 가져오기
      const selectedWallet = wallets.find(w => w.id === walletId);
      if (!selectedWallet || !selectedWallet.mnemonic) {
        setUsedIndices([]);
        setAccountIndex(0);
        return;
      }

      consolelog('🔍 사용된 인덱스 탐색 시작:', selectedWallet.alias);
      
      // 같은 니모닉을 사용하는 모든 지갑들 찾기
      const sameNemonicWallets = wallets.filter(wallet => 
        wallet.mnemonic === selectedWallet.mnemonic
      );

      const indices = [];
      
      // 각 지갑의 인덱스 확인
      for (const wallet of sameNemonicWallets) {
        try {
          // 지갑 주소로부터 인덱스 역추적
          for (let i = 0; i < 50; i++) { // 최대 50개까지 확인
            const testResult = walletService.importFromMnemonic(selectedWallet.mnemonic, i);
            if (testResult.success && testResult.address.toLowerCase() === wallet.address.toLowerCase()) {
              indices.push(i);
              consolelog(`📍 지갑 "${wallet.alias}" -> 인덱스 ${i}`);
              break;
            }
          }
        } catch (error) {
          consolewarn('인덱스 확인 실패:', wallet.alias, error);
        }
      }

      // 사용되지 않은 가장 작은 인덱스 찾기
      indices.sort((a, b) => a - b);
      let nextIndex = 0;
      
      for (const index of indices) {
        if (index === nextIndex) {
          nextIndex++;
        } else {
          break;
        }
      }

      consolelog('📋 사용된 인덱스들:', indices);
      consolelog('🎯 다음 사용 가능한 인덱스:', nextIndex);
      
      setUsedIndices(indices);
      setAccountIndex(nextIndex);
      
      // 기본 별칭도 자동 설정
      setAlias(`${t('WalletList.accountNumber')}${nextIndex + 1}`);
      
    } catch (error) {
      consoleerror('❌ 인덱스 탐색 실패:', error);
      setUsedIndices([]);
      setAccountIndex(0);
    }
  };

  // 지갑 선택 시 사용된 인덱스 찾기
  const handleWalletSelect = (walletId) => {
    setSelectedWalletId(walletId);
    findUsedIndices(walletId);
  };

  const handleAddAccount = async () => {
    setError('');
    setSuccess('');

    if (!selectedWalletId) {
      setError(t('WalletList.selectBaseWalletFirst'));
      return;
    }

    if (accountIndex < 0 || accountIndex > 999) {
      setError(t('WalletList.accountIndexRange'));
      return;
    }

    if (usedIndices.includes(accountIndex)) {
      setError(`${t('WalletList.accountIndex')} ${accountIndex}${t('WalletList.indexAlreadyUsed')}`);
      return;
    }

    if (!alias.trim()) {
      setError(t('WalletList.enterAccountName'));
      return;
    }

    setIsLoading(true);
    try {
      await onAddAccount(selectedWalletId, accountIndex, alias.trim());
    } catch (error) {
      setError(`${t('WalletList.accountAddFailed')}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 수동으로 인덱스 변경 시 별칭도 업데이트
  const handleIndexChange = (newIndex) => {
    setAccountIndex(newIndex);
    if (!alias || alias.match(/^계정 #\d+$/)) {
      setAlias(`${t('WalletList.accountNumber')}${newIndex + 1}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content add-account-modal">
        <div className="modal-header">
          <h3>{t('WalletList.addNewAccount')}</h3>
          <button onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        <div className="modal-body">
          {mnemonicWallets.length === 0 ? (
            <div className="no-mnemonic-wallets">
              <AlertTriangle size={24} />
              <h4>{t('WalletList.cannotAddNewAccount')}</h4>
              <p>{t('WalletList.noMnemonicWalletsAvailable')}</p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>{t('WalletList.selectBaseWallet')}</label>
                <select
                  value={selectedWalletId}
                  onChange={(e) => handleWalletSelect(e.target.value)}
                >
                  <option value="">{t('WalletList.selectWalletPlaceholder')}</option>
                  {mnemonicWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.alias} ({wallet.address.slice(0, 10)}...)
                    </option>
                  ))}
                </select>
                <small>{t('WalletList.selectWalletDescription')}</small>
              </div>

              {selectedWalletId && (
                <div className="form-group">
                  <label>
                    {t('WalletList.accountIndexLabel')}
                    {usedIndices.length > 0 && (
                      <span style={{color: '#666', fontWeight: 'normal', fontSize: '0.8rem'}}>
                        ({t('WalletList.inUse')}: {usedIndices.join(', ')})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={accountIndex}
                    onChange={(e) => handleIndexChange(parseInt(e.target.value) || 0)}
                    placeholder={t('WalletList.accountIndexPlaceholder')}
                  />
                  <small>
                    {usedIndices.includes(accountIndex) ? (
                      <span style={{color: '#dc3545'}}>
                        {t('WalletList.indexAlreadyInUse')}
                      </span>
                    ) : (
                      `${t('WalletList.indexAvailable')} ${accountIndex})`
                    )}
                  </small>
                </div>
              )}

              <div className="form-group">
                <label>{t('WalletList.newAccountName')}</label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder={t('WalletList.accountNamePlaceholder')}
                />
              </div>

              <div className="account-info">
                <h4>{t('WalletList.accountCreationGuide')}</h4>
                <ul>
                  <li>{t('WalletList.multipleAccountsFromSameMnemonic')}</li>
                  <li>{t('WalletList.eachAccountDifferentAddress')}</li>
                  <li>{t('WalletList.systemFindsAvailableIndex')}</li>
                  <li>{t('WalletList.independentAccountUsage')}</li>
                  {usedIndices.length > 0 && (
                    <li style={{color: '#e67e22'}}>
                      {t('WalletList.currentlyUsedIndices')}: {usedIndices.join(', ')}
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          {mnemonicWallets.length > 0 && (
            <button 
              className="primary-btn"
              onClick={handleAddAccount}
              disabled={isLoading || !selectedWalletId || !alias.trim()}
            >
              {isLoading ? t('WalletList.creating') : t('WalletList.addAccount')}
            </button>
          )}
          <button className="cancel-btn" onClick={onClose}>
            {t('WalletList.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletList;