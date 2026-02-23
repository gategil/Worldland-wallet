// src/App.js - 세션 기반 자동 로그인 기능 추가된 버전
import React, { useState, useEffect } from 'react';
import { SecureStorage } from './services/secureStorage';
import { MultiWalletManager } from './services/MultiWalletManager';
import { walletService } from './services/walletService';
import WalletSetup from './components/WalletSetup';
import WalletMain from './components/WalletMain';
import WalletList from './components/WalletList';
import LoadingScreen from './components/LoadingScreen'; 
import { useTranslation } from './hooks/useTranslation'; 

// 글로벌 스타일 import
import './App.css';

function App() {
  const { isInitialized } = useTranslation(); // 언어 초기화 상태 확인
  const [isLoading, setIsLoading] = useState(true);
  const [hasWallet, setHasWallet] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentWallet, setCurrentWallet] = useState(null);
  const [walletPassword, setWalletPassword] = useState('');
  const [error, setError] = useState('');
  const [showWalletList, setShowWalletList] = useState(false);
  const [showWalletSetup, setShowWalletSetup] = useState(false); // 새 상태 추가

  useEffect(() => {
    // 언어 시스템이 초기화된 후에 앱 초기화
    if (isInitialized) {
      initializeApp();
    }
  }, [isInitialized]);

  // 🔄 개선된 앱 초기화 함수 (자동 로그인 기능 포함)
  const initializeApp = async () => {
    try {
      setIsLoading(true);
      console.log('🚀 앱 초기화 시작...');
      
      // 1️⃣ 지갑 존재 여부 확인
      const walletExists = MultiWalletManager.hasWallets();
      setHasWallet(walletExists);
      console.log(`💼 지갑 존재 여부: ${walletExists}`);
      
      // 2️⃣ 설정 불러오기
      const settings = SecureStorage.loadSettings() || SecureStorage.getDefaultSettings();
      
      // 3️⃣ 네트워크 설정
      walletService.switchNetwork(settings.network);
      
      // 4️⃣ 자동 로그인 시도 (지갑이 있는 경우만)
      if (walletExists) {
        console.log('🔍 자동 로그인 시도 중...');
        
        // 세션 확인
        const session = SecureStorage.getSession();
        if (session && session.isValid) {
          console.log('✅ 유효한 세션 발견');
          
          // 세션에서 비밀번호 복원
          const sessionPassword = SecureStorage.getSessionPassword();
          
          if (sessionPassword) {
            console.log('🔐 세션 비밀번호 복원 성공, 자동 잠금 해제 시도...');
            
            try {
              // 5️⃣ 자동 잠금 해제 시도
              const success = await attemptAutoUnlock(sessionPassword);
              
              if (success) {
                console.log('🎉 자동 로그인 성공!');
                setIsLoading(false);
                return; // 성공 시 여기서 함수 종료
              } else {
                console.log('⚠️ 자동 잠금 해제 실패, 수동 로그인 필요');
              }
            } catch (autoUnlockError) {
              console.error('❌ 자동 잠금 해제 중 오류:', autoUnlockError);
            }
          } else {
            console.log('🔑 세션 비밀번호 없음');
          }
          
          // 세션이 유효하지 않으면 정리
          console.log('🧹 유효하지 않은 세션 정리');
          SecureStorage.clearSession();
        } else {
          console.log('💡 유효한 세션이 없음, 수동 로그인 필요');
        }
      } else {
        console.log('💼 저장된 지갑이 없음');
      }
      
      console.log('✅ 앱 초기화 완료 (수동 인증 필요)');
      setIsLoading(false);
      
    } catch (error) {
      console.error('❌ 앱 초기화 실패:', error);
      setError('앱 초기화에 실패했습니다.');
      setIsLoading(false);
    }
  };

  // 🔓 자동 잠금 해제 함수 (새로 추가)
  const attemptAutoUnlock = async (password) => {
    try {
      console.log('🔓 자동 잠금 해제 시작...');
      
      // 지갑 목록 확인
      const walletsResult = await MultiWalletManager.getWalletList(password);
      if (!walletsResult.success) {
        console.error('❌ 지갑 목록 로드 실패:', walletsResult.error);
        return false;
      }
      
      if (walletsResult.wallets.length === 0) {
        console.log('💼 등록된 지갑이 없음');
        return false;
      }
      
      // 활성 지갑 확인
      const activeWalletId = MultiWalletManager.getActiveWallet();
      
      if (activeWalletId) {
        // 활성 지갑 로드
        const activeWalletResult = await MultiWalletManager.getWallet(activeWalletId, password);
        
        if (activeWalletResult.success) {
          console.log('✅ 활성 지갑 로드 성공:', activeWalletResult.wallet.alias);
          
          // 상태 업데이트
          setCurrentWallet(activeWalletResult.wallet);
          setWalletPassword(password);
          setIsUnlocked(true);
          setShowWalletList(false);
          setShowWalletSetup(false);
          
          // 세션 연장
          SecureStorage.extendSession();
          
          return true;
        } else {
          console.error('❌ 활성 지갑 로드 실패:', activeWalletResult.error);
        }
      }
      
      // 활성 지갑이 없거나 로드 실패 시 -> 지갑 목록으로
      console.log('📋 활성 지갑 없음, 지갑 목록 표시');
      setWalletPassword(password);
      setIsUnlocked(true);
      setShowWalletList(true);
      setShowWalletSetup(false);
      
      // 세션 연장
      SecureStorage.extendSession();
      
      return true;
      
    } catch (error) {
      console.error('❌ 자동 잠금 해제 실패:', error);
      return false;
    }
  };

  // 🆕 지갑 생성/가져오기 후 콜백 (세션 저장 기능 추가)
  const handleWalletCreated = async (newWalletData, password) => {
    try {
      console.log('🆕 새 지갑 추가 중...');
      
      // 다중 지갑 매니저에 추가
      const result = await MultiWalletManager.addWallet(
        newWalletData, 
        password, 
        '메인 지갑'
      );
      
      if (result.success) {
        console.log('✅ 지갑 생성 성공');
        
        // 상태 업데이트
        setCurrentWallet(result.wallet);
        setWalletPassword(password);
        setHasWallet(true);
        setIsUnlocked(true);
        setShowWalletSetup(false);
        
        // 🔐 세션에 비밀번호 저장 (5분 = 300000ms)
        const sessionSaved = SecureStorage.setSessionWithPassword(password, 300000);
        if (sessionSaved) {
          console.log('✅ 자동 로그인용 세션 저장 완료');
        } else {
          console.warn('⚠️ 세션 저장 실패 (수동 로그인 필요)');
        }
        
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('❌ 지갑 생성 실패:', error);
      setError('지갑 생성에 실패했습니다.');
    }
  };

  // 🔓 지갑 잠금 해제 후 콜백 (세션 저장 기능 추가)
  const handleWalletUnlocked = async (password) => {
    try {
      console.log('🔓 지갑 잠금 해제 중...');
      
      setWalletPassword(password);
      setShowWalletSetup(false);
      
      // 활성 지갑 불러오기
      const activeWalletResult = await MultiWalletManager.getActiveWalletData(password);
      
      if (activeWalletResult.success) {
        console.log('✅ 활성 지갑 로드 성공');
        
        setCurrentWallet(activeWalletResult.wallet);
        setIsUnlocked(true);
        
        // 🔐 세션에 비밀번호 저장
        const sessionSaved = SecureStorage.setSessionWithPassword(password, 300000);
        if (sessionSaved) {
          console.log('✅ 자동 로그인용 세션 저장 완료');
        }
        
      } else {
        console.log('📋 활성 지갑 없음, 지갑 목록 표시');
        
        // 활성 지갑이 없으면 지갑 목록 표시
        setShowWalletList(true);
        setIsUnlocked(true);
        
        // 🔐 세션에 비밀번호 저장
        const sessionSaved = SecureStorage.setSessionWithPassword(password, 300000);
        if (sessionSaved) {
          console.log('✅ 자동 로그인용 세션 저장 완료');
        }
      }
    } catch (error) {
      console.error('❌ 지갑 잠금 해제 실패:', error);
      setError('지갑 잠금 해제에 실패했습니다.');
    }
  };

  // 지갑 선택 (지갑 목록에서)
  const handleWalletSelect = (wallet) => {
    setCurrentWallet(wallet);
    setShowWalletList(false);
    MultiWalletManager.setActiveWallet(wallet.id);
    
    // 지갑 선택 시 세션 연장
    SecureStorage.extendSession();
  };

  // 지갑 목록 표시
  const handleShowWalletList = () => {
    setShowWalletList(true);
    setCurrentWallet(null);
    
    // 지갑 목록 표시 시 세션 연장
    SecureStorage.extendSession();
  };

  // 🔒 지갑 잠금 (세션 삭제 기능 추가)
  const handleWalletLock = () => {
    console.log('🔒 지갑 잠금 중...');
    
    // 상태 초기화
    setCurrentWallet(null);
    setWalletPassword('');
    setIsUnlocked(false);
    setShowWalletList(false);
    setShowWalletSetup(false);
    
    // 🗑️ 세션 완전 삭제
    SecureStorage.clearSession();
    
    console.log('✅ 지갑 잠금 완료');
  };

  // 모든 지갑 삭제
  const handleDeleteAllWallets = async () => {
    const confirmMessage = '정말로 모든 지갑을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다. 지갑을 삭제하기 전에 개인키나 니모닉 구문을 안전한 곳에 백업했는지 확인하세요.';
    
    if (window.confirm(confirmMessage)) {
      const doubleConfirm = window.prompt('삭제를 확인하려면 "DELETE ALL"을 입력하세요:');
      if (doubleConfirm === 'DELETE ALL') {
        await MultiWalletManager.clearAllWallets();
        setCurrentWallet(null);
        setWalletPassword('');
        setHasWallet(false);
        setIsUnlocked(false);
        setShowWalletList(false);
        setShowWalletSetup(false);
        
        // 🗑️ 세션도 함께 삭제
        SecureStorage.clearSession();
      }
    }
  };

  const handleBackToMain = async () => {
    console.log('Back 버튼 클릭됨');
    
    // 지갑 목록 숨기기
    setShowWalletList(false);
    
    // 현재 활성 지갑이 있으면 그대로 표시
    if (currentWallet) {
      console.log('현재 지갑으로 돌아감:', currentWallet.alias);
      return;
    }
    
    // 활성 지갑이 없으면 첫 번째 지갑 선택
    try {
      const walletsResult = await MultiWalletManager.getWalletList(walletPassword);
      if (walletsResult.success && walletsResult.wallets.length > 0) {
        const firstWallet = walletsResult.wallets[0];
        setCurrentWallet(firstWallet);
        MultiWalletManager.setActiveWallet(firstWallet.id);
        console.log('첫 번째 지갑으로 이동:', firstWallet.alias);
      }
    } catch (error) {
      console.error('지갑 로드 실패:', error);
    }
  };

  // 에러 초기화
  const clearError = () => {
    setError('');
  };

  // 언어 시스템이 초기화되지 않았으면 로딩 표시
  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-container">
          {/* <h2>오류가 발생했습니다</h2> */}
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={() => { clearError(); initializeApp(); }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // 지갑이 없거나 잠겨있는 경우
  if (!hasWallet || !isUnlocked) {
    const dummyWallet = {
      id: 'dummy',
      address: '0x0000000000000000000000000000000000000000',
      alias: 'No Wallet',
      isDummy: true
    };
    
    // showWalletSetup이 true이면 WalletSetup 보여주기
    // showWalletSetup이 true이면 WalletSetup 보여주기
    if (showWalletSetup) {
      return (
        <WalletSetup
          hasWallet={hasWallet}
          onWalletCreated={handleWalletCreated}
          onWalletUnlocked={handleWalletUnlocked}
          onBack={() => setShowWalletSetup(false)}
        />
      );
    }
    
    return (
      <div className="App">
        <WalletMain
          walletData={dummyWallet}
          onLock={handleWalletLock}
          onDelete={handleDeleteAllWallets}
          onShowWalletList={handleShowWalletList}
          onShowWalletSetup={() => {
            console.log('지갑 설정하기 호출됨'); // 디버깅용
            setShowWalletSetup(true);
          }}
          walletPassword="dummy"
          hasWallet={hasWallet}  
        />
      </div>
    );
  }

  // 지갑 목록 표시
  if (showWalletList || !currentWallet) {
    return (
      <div className="App">
        <div className="wallet-container">
          <WalletList
            password={walletPassword}
            onWalletSelect={handleWalletSelect}
            activeWalletId={currentWallet?.id}
            onAddWallet={(wallet) => {
              // 새 지갑이 추가되면 자동으로 선택
              setCurrentWallet(wallet);
              setShowWalletList(false);
              
              // 새 지갑 선택 시 세션 연장
              SecureStorage.extendSession();
            }}
            onBackToMain={handleBackToMain}
          />
          
          {/* 하단 액션 버튼들 */}
          <div className="wallet-list-actions">
            <button 
              className="btn btn-secondary"
              onClick={handleWalletLock}
            >
              지갑 잠금
            </button>
            {/* <button 
              className="btn btn-danger"
              onClick={handleDeleteAllWallets}
            >
              모든 지갑 삭제
            </button> */}
          </div>
        </div>
      </div>
    );
  }

  // 선택된 지갑 메인 화면
  return (
    <div className="App">
      <WalletMain
        walletData={currentWallet}
        onLock={handleWalletLock}
        onDelete={handleDeleteAllWallets}
        onShowWalletList={handleShowWalletList}
        walletPassword={walletPassword}
      />
    </div>
  );
}

export default App;