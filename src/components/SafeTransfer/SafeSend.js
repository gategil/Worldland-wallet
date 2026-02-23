// src/components/SafeTransfer/SafeSend.js
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../../utils/logger.js';
import { QrCode, Loader, ArrowLeft, Download, Send, AlertCircle, CheckCircle, XCircle, Clock, RefreshCw, ChevronLeft, Wallet, Shield } from 'lucide-react';
import { ethers } from 'ethers'; 
import { CONTRACT_ADDRESS, CONTRACT_ABI, WORLDLAND_RPC, FEE_CONFIG, getStatusText, getStatusColor } from './contractConfig';
import './SafeTransfer.css';
import './SafeSend.css';
import '../common.css';
import{ useTranslation }from'../../hooks/useTranslation'; 
import { walletService } from '../../services/walletService';
import QrScanner from '../QrScanner';

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  } else if (hours > 0) {
    return `${hours}시간`;
  } else if (minutes > 0) {
    return `${minutes}분`;
  } else {
    return `${seconds}초`;
  }
};

// 날짜 포맷 함수 추가
const formatDate = (timestamp) => {
  if (!timestamp || timestamp === 0 || timestamp === '0') return '-';
  
  try {
    const date = new Date(Number(timestamp) * 1000);
    
    if (isNaN(date.getTime())) return '-';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    return '-';
  }
};

// 잔액 포맷 함수 추가
const formatBalance = (balance) => {
  if (!balance) return '0.00';
  return parseFloat(balance).toFixed(4);
};

const SafeSend = ({ account, network, walletData, initialTransferId, onBack }) => {
  const{ t }=useTranslation();
  const [contract, setContract] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false); 
  const [balance, setBalance] = useState('0.0000');
  
  // 새 거래 생성 관련
  const [isCreating, setIsCreating] = useState(!initialTransferId);
  const [receiverAddress, setReceiverAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [isCollateralManuallySet, setIsCollateralManuallySet] = useState(false); // 수동 설정 여부 추적
  const [safetyHours, setSafetyHours] = useState('1');
  const [safetyMinutes, setSafetyMinutes] = useState('00');
  const [confirmHours, setConfirmHours] = useState('1');
  const [confirmMinutes, setConfirmMinutes] = useState('00');
  const [showQrScanner, setShowQrScanner] = useState(false);
  
  // 타협안 비율
  const [splitPercentage, setSplitPercentage] = useState(50);
  
  // 타이머
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false); 
  
  // ✅ 새로 추가: 거래 정보 새로고침 트리거
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);

  // 알림 모달 관련 state
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    type: 'info', // 'success', 'error', 'warning', 'info'
    title: '',
    message: ''
  });

  // QR 스캐너 열기
  const handleQrScan = () => {
    setShowQrScanner(true);
  };

  // QR 코드 스캔 성공 시 처리
  const handleQrScanSuccess = (decodedText) => {
    console.log('QR 코드 인식:', decodedText);
    
    // 지갑 주소 추출 (ethereum: 프로토콜 제거)
    let address = decodedText;
    if (decodedText.startsWith('ethereum:')) {
      address = decodedText.replace('ethereum:', '').split('?')[0];
    }
    
    // 주소 유효성 검사
    if (walletService.isValidAddress(address)) {
      setReceiverAddress(address);
      setShowQrScanner(false);
      showAlert('success', t('SafeSend.qrScanSuccess') || 'QR 코드 스캔 완료', t('SafeSend.addressSetSuccessfully') || '주소가 설정되었습니다');
    } else {
      setShowQrScanner(false);
      showAlert('error', t('SafeSend.invalidQRCode') || '유효하지 않은 QR 코드', t('SafeSend.notValidAddress') || '올바른 지갑 주소가 아닙니다');
    }
  };

  // QR 스캐너 닫기
  const handleQrScanClose = () => {
    setShowQrScanner(false);
  };

  // 컨트랙트 초기화
  useEffect(() => {
    const initContract = async () => {
      try {
        if (!walletData || !walletData.privateKey) {
          consoleerror('❌ walletData 없음');
          return;
        }

        const provider = new ethers.JsonRpcProvider(WORLDLAND_RPC);
        const wallet = new ethers.Wallet(walletData.privateKey, provider);
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
        
        setContract(contractInstance);
        console.log('✅ SafeSend 컨트랙트 초기화 완료');
      } catch (error) {
        consoleerror('❌ 컨트랙트 초기화 실패:', error);
      }
    };
    
    initContract();
  }, [walletData]);

  // 잔액 로드 함수
  const loadBalance = async () => {
    if (!walletData?.address) return;
    
    try {
      const result = await walletService.getBalance(walletData.address);
      if (result.success) {
        setBalance(result.balance);
      }
    } catch (error) {
      consoleerror('잔액 조회 실패:', error);
    }
  };

  // 초기 잔액 로드
  useEffect(() => {
    loadBalance();
  }, [walletData]);

  // amount가 변경될 때 collateralAmount를 자동으로 동기화 (수동 설정이 아닐 경우에만)
  useEffect(() => {
    if (!isCollateralManuallySet && amount) {
      setCollateralAmount(amount);
    }
  }, [amount, isCollateralManuallySet]);

  // 알림 모달 열기
  const showAlert = (type, title, message) => {
    console.log(message);
    setAlertModal({
      isOpen: true,
      type,
      title,
      message
    });
  };

  // 알림 모달 닫기
  const closeAlert = () => {
    setAlertModal({
      isOpen: false,
      type: 'info',
      title: '',
      message: ''
    });
  };

  // 에러 메시지에서 괄호 앞까지만 추출
  const extractErrorMessage = (message) => {
    if (!message) return '';
    
    // 첫 번째 여는 괄호의 위치 찾기
    const openParenIndex = message.indexOf('(');
    
    // 괄호가 없으면 전체 메시지 반환
    if (openParenIndex === -1) {
      return message.trim();
    }
    
    // 괄호 앞까지만 추출하고 공백 제거
    return message.substring(0, openParenIndex).trim();
  };

  // 거래 정보 조회 함수 분리
  const loadTransfer = async (showLoading = true) => {
    if (!contract || !initialTransferId) {
      setLoading(false);
      return;
    }
    
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      console.log('📊 거래 조회:', initialTransferId);
      const t = await contract.getTransferInfo(initialTransferId);
      
      const transferData = {
        id: initialTransferId,
        sender: t.sender || t[0],
        receiver: t.receiver || t[1],
        amount: t.amount || t[2],
        collateral: t.collateral || t[3],
        senderFee: t.senderFee || t[4],
        receiverFee: t.receiverFee || t[5],
        createdAt: Number(t.createdAt || t[6]),
        activatedAt: Number(t.activatedAt || t[7]),
        safetyPeriod: Number(t.safetyPeriod || t[8]),
        confirmPeriod: Number(t.confirmPeriod || t[9]),
        state: Number(t.state !== undefined ? t.state : t[10]),
        senderApproved: t.senderApproved !== undefined ? t.senderApproved : t[11],
        collateralDeposited: t.collateralDeposited !== undefined ? t.collateralDeposited : t[12]
      };
      
      setTransfer(transferData);
      setLastUpdateTime(new Date());
      
    } catch (error) {
      consoleerror('❌ 거래 조회 실패:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setIsRefreshing(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadTransfer(true);
  }, [contract, initialTransferId]);

  // 수동 새로고침
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    console.log('🔄 [SafeSend] 수동 새로고침 시작');
    await loadTransfer(false);
    
  }; 
    

  // 자동 새로고침 시작
  const startAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    const interval = setInterval(async () => {
      if (!isRefreshing) {
        setIsRefreshing(true);
        console.log('🔄 [SafeSend] 자동 새로고침 (1분 간격)');
        
        // 최소 2000ms 동안 spin 표시
        const minSpinTime = 5000;
        const startTime = Date.now();
        
        await loadTransfer(false);  // 👈 false로 변경
        
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minSpinTime) {
          await new Promise(resolve => setTimeout(resolve, minSpinTime - elapsedTime));
        }
        
        setIsRefreshing(false);
      }
    }, 1 * 60 * 1000);
    
    setAutoRefreshInterval(interval);
  };

  // 자동 새로고침 중지
  const stopAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      setAutoRefreshInterval(null);
    }
  };

  // 자동 새로고침 시작 및 정리
  useEffect(() => {
    if (contract && initialTransferId) {
      startAutoRefresh();
    }
    
    return () => {
      stopAutoRefresh();
    };
  }, [contract, initialTransferId]);

  // 1초마다 타이머 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // 시간 계산 헬퍼
  const getTimeRemaining = (deadline) => {
    // deadline이 0이면 (거래 미활성화) 대기 중 표시
    if (deadline === 0) return '보증금 대기 중';
    
    const remaining = deadline - currentTime;
    if (remaining <= 0) return '만료됨';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    return `${hours}시간 ${minutes}분 ${seconds}초`;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}시간 ${minutes}분`;
  };

  // 송신자 수수료 계산 (V3: 0%)
  const calculateSenderFee = (amountWei) => {
      const feePercentage = FEE_CONFIG.senderFeePercentage; // 0
      const minFee = ethers.parseEther(FEE_CONFIG.minFeePerParty);
      const calculatedFee = (amountWei * BigInt(feePercentage)) / BigInt(10000);
      return calculatedFee > minFee ? calculatedFee : minFee;
  };

  // 기존 함수명 유지 (하위 호환성) 
  const calculateFee = calculateSenderFee;

  // ✨ V3 추가: 수신자 수수료 계산 (0.1%)
  const calculateReceiverFee = (collateralWei) => {
      const feePercentage = FEE_CONFIG.receiverFeePercentage; // 10
      const minFee = ethers.parseEther(FEE_CONFIG.minFeePerParty);
      const calculatedFee = (collateralWei * BigInt(feePercentage)) / BigInt(10000);
      return calculatedFee > minFee ? calculatedFee : minFee;
  };

  // ✅ 수정: 초 단위로 변환
  const convertToSeconds = (hours, minutes) => {
      const totalHours = parseFloat(hours);
      const totalMinutes = parseFloat(minutes);
      return Math.floor((totalHours * 3600) + (totalMinutes * 60));
  };

  // ✅ 새로 추가: 확인 모달 열기
  const handleShowConfirmModal = () => {
    // 입력값 검증
    if (!receiverAddress || !amount || !collateralAmount) {
      showAlert('warning', '입력 오류', '모든 필수 항목을 입력해주세요.');
      return;
    }

    // 주소 유효성 검증
    if (!walletService.isValidAddress(receiverAddress)) {
      showAlert('error', '주소 오류', '올바른 지갑 주소를 입력해주세요.');
      return;
    }

    // 금액 검증
    const amountNum = parseFloat(amount);
    const collateralNum = parseFloat(collateralAmount);  

    if (isNaN(amountNum) || amountNum <= 0) {
      showAlert('error', '금액 오류', '올바른 송금액을 입력해주세요.');
      return;
    }
    
    if (isNaN(collateralNum) || collateralNum <= 0) {
      showAlert('error', '금액 오류', '올바른 보증금을 입력해주세요.');
      return;
    }

    // 확인 모달 열기
    setShowConfirmModal(true);
  };

  // 새 거래 생성
  const handleCreateTransfer = async () => {
    if (!receiverAddress || !amount || !collateralAmount) {
      showAlert('warning', '입력 필요', '모든 필드를 입력해주세요.');
      return;
    }

    if (!ethers.isAddress(receiverAddress)) {
      showAlert('error', '주소 오류', '올바른 주소 형식이 아닙니다.');
      return;
    }

    // ✅ 시간을 시간 단위(소수점)로 변환
    const totalSafetySeconds = convertToSeconds(safetyHours, safetyMinutes);
    const totalConfirmSeconds = convertToSeconds(confirmHours, confirmMinutes);

    // ✅ 수정: 최소 초 검증
    if (totalSafetySeconds < 60) {  // 60초 = 1분
        showAlert('warning', '시간 설정 오류', '안전기간은 최소 1분 이상이어야 합니다.');
        return;
    }

    if (totalConfirmSeconds < 60) {  // 60초 = 1분
        showAlert('warning', '시간 설정 오류', '확정기간은 최소 1분 이상이어야 합니다.');
        return;
    }

    setProcessing(true);
    try {
      const amountWei = ethers.parseEther(amount);
      const collateralWei = ethers.parseEther(collateralAmount);
      const fee = calculateFee(amountWei);
      const totalAmount = amountWei + fee;
      
      console.log('거래 생성 중...');
      console.log('- Receiver:', receiverAddress);
      console.log('- Amount:', ethers.formatEther(amountWei), 'WLC');
      console.log('- Fee:', ethers.formatEther(fee), 'WLC');
      console.log('- Total:', ethers.formatEther(totalAmount), 'WLC');
      console.log('- Collateral:', ethers.formatEther(collateralWei), 'WLC');
      console.log('- Safety Seconds:', totalSafetySeconds);  // ✅ 초 단위
      console.log('- Confirm Seconds:', totalConfirmSeconds);  // ✅ 초 단위

      // ✅ 초 단위로 전달  
      const tx = await contract.createTransfer(
          receiverAddress,
          collateralWei,
          totalSafetySeconds,    // ✅ 초 단위로 전달 (1시간 30분 → 5400)
          totalConfirmSeconds,   // ✅ 초 단위로 전달
          { value: totalAmount }
      );
            
      console.log('트랜잭션 전송:', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ 거래 생성 완료:', receipt);
      
      showAlert('success', '거래 생성 완료', '거래가 성공적으로 생성되었습니다!');
      onBack();
      
    } catch (error) {
      consoleerror('❌ 거래 생성 실패:', error);
      showAlert('error', '거래 생성 실패', error.message);
    } finally {
      setProcessing(false);
    }
  }; 

  // 거래 취소
  const handleCancel = async () => {
    if (!window.confirm('정말 거래를 취소하시겠습니까? 수수료의 50%가 차감됩니다.')) {
      return;
    }

    setProcessing(true);
    try {
      console.log('거래 취소 중:', transfer.id);
      const tx = await contract.cancelTransfer(transfer.id);
      console.log('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      console.log('✅ 거래 취소 완료');
      
      showAlert('success', '거래 취소 완료', '거래가 취소되었습니다.');
      onBack();

      // 상태 즉시 업데이트
      await loadTransfer(true);
      
    } catch (error) {
      consoleerror('❌ 거래 취소 실패:', error);
      showAlert('error', '거래 취소 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 상호취소 요청
  const handleRequestMutualCancel = async () => {
    if (!window.confirm('상호취소를 요청하시겠습니까?\n\n수신자가 24시간 내에 응답해야 합니다.\n무응답 시 자동으로 거래가 취소됩니다.')) {
      return;
    }

    setProcessing(true);
    try {
      console.log('상호취소 요청 중:', transfer.id);
      const tx = await contract.requestMutualCancel(transfer.id);
      console.log('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      console.log('✅ 상호취소 요청 완료');
      
      showAlert('success', '상호취소 요청 완료', '상호취소가 요청되었습니다. 수신자의 응답을 기다려주세요.');
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      consoleerror('❌ 상호취소 요청 실패:', error);
      showAlert('error', '상호취소 요청 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 타협안 제안
  const handleProposeSplit = async () => {
    if (!window.confirm(`타협안을 제안하시겠습니까?\n\n제안 비율: 내가 ${splitPercentage}%, 상대방이 ${100 - splitPercentage}%`)) {
      return;
    }

    setProcessing(true);
    try {
      console.log('타협안 제안 중:', transfer.id, splitPercentage);
      const tx = await contract.proposeSplit(transfer.id, splitPercentage);
      console.log('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      console.log('✅ 타협안 제안 완료');
      
      showAlert('success', '타협안 제안 완료', '타협안이 제안되었습니다. 수신자의 응답을 기다려주세요.');
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      consoleerror('❌ 타협안 제안 실패:', error);
      showAlert('error', '타협안 제안 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 조기 승인
  const handleEarlyApprove = async () => {
    if (!window.confirm('조기 승인하시겠습니까? 수신자가 즉시 자금을 인출할 수 있습니다.')) {
      return;
    }

    setProcessing(true);
    try {
      console.log('조기 승인 중:', transfer.id);
      const tx = await contract.approveEarlyRelease(transfer.id);
      console.log('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      console.log('✅ 조기 승인 완료');
      
      showAlert('success', '조기 승인 완료', '조기 승인이 완료되었습니다!');

      // 상태 즉시 업데이트
      await loadTransfer(false);
      
      // ✅ 거래 정보 새로고침하여 화면 업데이트
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      consoleerror('❌ 조기 승인 실패:', error);
      showAlert('error', '조기 승인 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="safetransfer-container">
        <div className="loading">거래 정보를 불러오는 중...</div>
        
        

        {/* 알림 모달 */}
        {alertModal.isOpen && (
          <div className="safetransfer-modal-overlay" onClick={closeAlert}>
            <div className="safetransfer-safetransfer-modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
              <div className={`alert-safetransfer-modal-header alert-${alertModal.type}`}>
                {alertModal.type === 'success' && <CheckCircle size={32} />}
                {alertModal.type === 'error' && <XCircle size={32} />}
                {alertModal.type === 'warning' && <AlertCircle size={32} />}
                {alertModal.type === 'info' && <AlertCircle size={32} />}
                <h3>{alertModal.title}</h3>
              </div>
              <div className="alert-safetransfer-modal-body">
                <p>{extractErrorMessage(alertModal.message)}</p> 
              </div>
              <div className="alert-safetransfer-modal-footer">
                <button className="safetransfer-modal-btn-primary" onClick={closeAlert}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 새 거래 생성 화면
  if (isCreating) {
    return (
      <div className="send-transaction">
        {/* 헤더 */}
        <div className="common-header">
          {/* <ChevronLeft size={24} onClick={onBack} style={{cursor: 'pointer'}} /> */}
          <div 
            onClick={onBack} style={{cursor: 'pointer'}}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#f0f0f0',  // 배경색
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={24} />
          </div>
          
          <h1> 안심결제 생성하기</h1>
        </div>

        {/* 선택된 자산 정보 */}
        <div className="selected-asset-info">
          <div className="asset-header" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center'}}>

              <div className="asset-icon">🏆</div>
              <div className="asset-details">
                <div className="asset-name" style={{color: 'white'}}>WorldLand Coin</div>
                <div className="asset-symbol" style={{color: 'white'}}>WLC</div>
              </div>
            </div> 
            <div className="asset-balance" style={{display: 'flex', flexDirection: 'column' }}>
              <div className="balance-label" style={{color: 'white'}}>Available Balance</div>
              <div className="balance-amount" style={{color: 'white'}}>
                {formatBalance(balance)} WLC
              </div>
            </div> 
          </div>
        </div>

        <div className="send-form">
          {/* 수신자 주소 */}
          <div className="form-group">
            <label>👨‍🚒 수신자 지갑주소</label>
            <div className="address-input-group-send">
              <textarea
                value={receiverAddress}
                onChange={(e) => setReceiverAddress(e.target.value)}
                placeholder="0x..."
                className={receiverAddress && !walletService.isValidAddress(receiverAddress) ? 'invalid' : ''}
                rows={3}
              />
              <button 
                type="button" 
                className="qr-button"
                onClick={handleQrScan}
                title={t('SendTransaction.scanQRCode')}
              >
                <QrCode size={20} />
              </button>
            </div>
            {receiverAddress && !walletService.isValidAddress(receiverAddress) && (
              <div className="field-error">
                <AlertCircle size={14} />
                유효하지 않은 주소입니다
              </div>
            )}
          </div>

          {/* 송금액 */}
          <div className="form-group">
            <label>💸 송금액</label>
            <div className="amount-input-group">
              <input
                type="number"
                step="0.01"
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (!isCollateralManuallySet) {
                    setCollateralAmount(e.target.value);
                  }
                }}
              />
              <span className="currency">WLC</span>
              <button 
                onClick={() => {
                  setAmount(balance);
                  if (!isCollateralManuallySet) {
                    setCollateralAmount(balance);
                  }
                }}
                className="max-button"
              >
                Max
              </button>
            </div>
            {/* <div className="balance-info">
              <Wallet size={14} />
              Available: {formatBalance(balance)} WLC
            </div> */}
          </div>

          {/* 수신자 보증금 */}
          <div className="form-group">
            <label
              onClick={(e) => {
                e.preventDefault();
                showAlert('info', '수신자 보증금이란?', 
                  '수신자가 예치해야 할 보증금으로서, 거래 완료 시 수신자에게 전액 반환됩니다. 수신자와 사전에 금액을 협의하셔야 합니다. 수신자를 신뢰하지 못하는 경우에는 송금액과 보증금이 같게 설정하는 것이 안전합니다.');
              }}
              style={{cursor: 'pointer'}}
            >
              💰 수신자 보증금 (수신자와 사전 협의된 담보를 입력하세요.)
            </label>
            <div className="amount-input-group">
              <input
                type="number"
                step="0.01"
                placeholder="0.0"
                value={collateralAmount}
                onChange={(e) => {
                  setCollateralAmount(e.target.value);
                  setIsCollateralManuallySet(true);
                }}
              />
              <span className="currency">WLC</span>
            </div>
          </div>

          {/* 거래 생성하기 버튼 */}
          <button 
            onClick={handleShowConfirmModal}
            disabled={processing || !receiverAddress || !amount || !collateralAmount}
            className="send-button"
          >
            {processing ? (
              <>
                <Loader size={20} className="spin" /> 생성 중...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                거래 생성하기
              </>
            )}
          </button>

          

          {/* 기간 설정 */}
          <div className="form-group" style={{marginTop: '20px'}}>
            <label>
              {/* <Clock size={16} /> */}
              🎯 거래취소 가능한 안전기간과 거래완료까지의 확정기간(deadline)
            </label>
            
            <div className="gas-price-options">
              <div className="gas-option">
                <div 
                  className="option-label"
                  onClick={(e) => {
                    e.preventDefault();
                    showAlert('info', '안전기간이란?', 
                      '송신자가 일방적으로 취소할 수 있는 기간입니다. 이 기간 동안에는 송신자가 언제든지 거래를 취소하고 환불받을 수 있습니다.');
                  }}
                  style={{cursor: 'pointer'}}
                >
                  {/* <Shield size={16} /> */}
                  ⚖️ 안전기간
                </div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px'}}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={safetyHours}
                    onChange={(e) => setSafetyHours(e.target.value)}
                    style={{width: '50px', textAlign: 'center', padding: '6px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)'}}
                  />
                  <span className="option-time">시간</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    placeholder="0"
                    value={safetyMinutes}
                    onChange={(e) => setSafetyMinutes(e.target.value)}
                    style={{width: '50px', textAlign: 'center', padding: '6px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)'}}
                  />
                  <span className="option-time">분</span>
                </div>
              </div>

              <div className="gas-option">
                <div 
                  className="option-label"
                  onClick={(e) => {
                    e.preventDefault();
                    showAlert('info', '확정기간이란?', 
                      '안전기간 종료 후 자동 완료까지의 기간입니다. 이 기간에 수신자는 약속한 물품/서비스를 제공해야 합니다. 문제가 있을 경우 상호취소나 타협이 가능합니다.');
                  }}
                  style={{cursor: 'pointer'}}
                >
                  {/* <Clock size={16} /> */}
                  💸 확정기간
                </div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px'}}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={confirmHours}
                    onChange={(e) => setConfirmHours(e.target.value)}
                    style={{width: '50px', textAlign: 'center', padding: '6px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)'}}
                  />
                  <span className="option-time">시간</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="1"
                    placeholder="0"
                    value={confirmMinutes}
                    onChange={(e) => setConfirmMinutes(e.target.value)}
                    style={{width: '50px', textAlign: 'center', padding: '6px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-sm)'}}
                  />
                  <span className="option-time">분</span>
                </div>
              </div>
            </div>
          </div>

          {/* 입력된 송금 내역 */}
          {/* <div className="fee-info">
            <div className="fee-row">
              <span>송금액:</span>
              <span className="fee-amount">{amount || '0'} WLC</span>
            </div>
            <div className="fee-row">
              <span>수수료:</span>
              <span className="fee-amount">{amount ? ethers.formatEther(calculateFee(ethers.parseEther(amount))) : '0'} WLC</span>
            </div>
            <div className="fee-row total">
              <span>총 필요 금액:</span>
              <span className="fee-amount">
                {amount ? ethers.formatEther(ethers.parseEther(amount) + calculateFee(ethers.parseEther(amount))) : '0'} WLC
              </span>
            </div>
          </div> */}
        </div>

        {/* 거래 생성 확인 모달 */}
        {showConfirmModal && (
          <div className="safetransfer-modal-overlay" onClick={() => setShowConfirmModal(false)}>
            <div className="safetransfer-safetransfer-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="safetransfer-modal-header">
                <h3>📋 입력된 송금 내역 확인</h3>
                <button 
                  className="safetransfer-modal-close-button"
                  onClick={() => setShowConfirmModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="safetransfer-modal-body">
                <div style={{ 
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
                  padding: '20px', 
                  borderRadius: '12px',
                  border: '2px solid #bae6fd',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '700', 
                    color: '#0c4a6e', 
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    💰 거래 정보
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0f2fe' }}>
                      <span style={{ color: '#64748b', fontSize: '14px' }}>수신자 주소</span>
                      <span style={{ 
                        fontWeight: '600', 
                        color: '#0f172a', 
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                        maxWidth: '60%',
                        textAlign: 'right'
                      }}>
                        {receiverAddress}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0f2fe' }}>
                      <span style={{ color: '#64748b', fontSize: '14px' }}>송금액</span>
                      <span style={{ fontWeight: '700', color: '#0284c7', fontSize: '16px' }}>
                        {amount} WLC
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0f2fe' }}>
                      <span style={{ color: '#64748b', fontSize: '14px' }}>수신자 보증금</span>
                      <span style={{ fontWeight: '700', color: '#0284c7', fontSize: '16px' }}>
                        {collateralAmount} WLC
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0f2fe' }}>
                      <span style={{ color: '#64748b', fontSize: '14px' }}>송신자 수수료</span>
                      <span style={{ fontWeight: '600', color: '#059669', fontSize: '14px' }}>
                        {amount && !isNaN(parseFloat(amount)) ? ethers.formatEther(calculateFee(ethers.parseEther(amount))) : '0'} WLC
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e0f2fe' }}>
                      <span style={{ color: '#64748b', fontSize: '14px' }}>수신자 수수료</span>
                      <span style={{ fontWeight: '600', color: '#059669', fontSize: '14px' }}>
                        {amount && !isNaN(parseFloat(amount)) ? ethers.formatEther(calculateReceiverFee(ethers.parseEther(amount))) : '0'} WLC
                      </span>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '12px 0',
                      marginTop: '8px',
                      borderTop: '2px solid #0ea5e9'
                    }}>
                      <span style={{ color: '#0c4a6e', fontSize: '16px', fontWeight: '700' }}>총 필요 금액</span>
                      <span style={{ fontWeight: '700', color: '#0284c7', fontSize: '20px' }}>
                        {amount && !isNaN(parseFloat(amount)) ? ethers.formatEther(ethers.parseEther(amount) + calculateFee(ethers.parseEther(amount))) : '0'} WLC
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                  padding: '16px', 
                  borderRadius: '12px',
                  border: '2px solid #fcd34d',
                  marginBottom: '16px'
                }}>
                  <h4 style={{ 
                    fontSize: '14px', 
                    fontWeight: '700', 
                    color: '#92400e', 
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    ⏰ 기간 설정
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#713f12', fontSize: '13px' }}>안전기간</span>
                      <span style={{ fontWeight: '600', color: '#854d0e', fontSize: '13px' }}>
                        {safetyHours}시간 {safetyMinutes}분
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#713f12', fontSize: '13px' }}>확정기간</span>
                      <span style={{ fontWeight: '600', color: '#854d0e', fontSize: '13px' }}>
                        {confirmHours}시간 {confirmMinutes}분
                      </span>
                    </div>
                  </div>
                </div>

                <p style={{ 
                  fontSize: '13px', 
                  color: '#64748b', 
                  textAlign: 'center',
                  lineHeight: '1.5'
                }}>
                  위 내용으로 거래를 생성하시겠습니까?<br/>
                  생성 후에는 수정할 수 없습니다.
                </p>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <button 
                  className="safetransfer-modal-btn-secondary"
                  onClick={() => setShowConfirmModal(false)}
                  style={{ flex: 1 }}
                >
                  취소
                </button>
                <button 
                  className="safetransfer-modal-btn-primary"
                  onClick={() => {
                    setShowConfirmModal(false);
                    handleCreateTransfer();
                  }}
                  disabled={processing}
                  style={{ flex: 1 }}
                >
                  {processing ? '처리 중...' : '확인 및 생성'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 알림 모달 */}
        {alertModal.isOpen && (
          <div className="safetransfer-modal-overlay" onClick={closeAlert}>
            <div className="safetransfer-safetransfer-modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
              <div className={`alert-safetransfer-modal-header alert-${alertModal.type}`}>
                {alertModal.type === 'success' && <CheckCircle size={32} />}
                {alertModal.type === 'error' && <XCircle size={32} />}
                {alertModal.type === 'warning' && <AlertCircle size={32} />}
                {alertModal.type === 'info' && <AlertCircle size={32} />}
                <h3>{alertModal.title}</h3>
              </div>
              <div className="alert-safetransfer-modal-body">
                <p>{extractErrorMessage(alertModal.message)}</p>
              </div>
              <div className="alert-safetransfer-modal-footer">
                <button className="safetransfer-modal-btn-primary" onClick={closeAlert}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR 스캐너 */}
        {showQrScanner && (
          <QrScanner 
            onScanSuccess={handleQrScanSuccess}
            onClose={handleQrScanClose}
          />
        )}
      </div>
    );
  }

  // 거래 정보가 없는 경우
  if (!transfer) {
    return (
      <div className="safetransfer-container">
        <div className="error">거래 정보를 찾을 수 없습니다.</div>
        
        {/* 알림 모달 */}
        {alertModal.isOpen && (
          <div className="safetransfer-modal-overlay" onClick={closeAlert}>
            <div className="safetransfer-safetransfer-modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
              <div className={`alert-safetransfer-modal-header alert-${alertModal.type}`}>
                {alertModal.type === 'success' && <CheckCircle size={32} />}
                {alertModal.type === 'error' && <XCircle size={32} />}
                {alertModal.type === 'warning' && <AlertCircle size={32} />}
                {alertModal.type === 'info' && <AlertCircle size={32} />}
                <h3>{alertModal.title}</h3>
              </div>
              <div className="alert-safetransfer-modal-body">
                <p>{extractErrorMessage(alertModal.message)}</p>
              </div>
              <div className="alert-safetransfer-modal-footer">
                <button className="safetransfer-modal-btn-primary" onClick={closeAlert}>
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 상태 계산
  const isWaitingDeposit = transfer.state === 0;
  const isActive = transfer.state === 1;
  const isMutualCancelRequested = transfer.state === 2;
  const isSplitProposed = transfer.state === 3;
  const isCompleted = transfer.state === 4;
  const isCancelled = transfer.state === 5;

  // activatedAt이 0이면 시간 계산 건너뛰기
  const safetyEndTime = transfer.activatedAt > 0 
    ? transfer.activatedAt + transfer.safetyPeriod 
    : 0;
  const confirmEndTime = transfer.activatedAt > 0 
    ? safetyEndTime + transfer.confirmPeriod 
    : 0;
  const autoCompleteTime = confirmEndTime;

  // 시간 비교 시 activatedAt > 0 체크 추가
  const isInSafetyPeriod = isActive && transfer.activatedAt > 0 && currentTime < safetyEndTime;
  const isInConfirmPeriod = isActive && transfer.activatedAt > 0 && currentTime >= safetyEndTime && currentTime < confirmEndTime;
  const canAutoComplete = isActive && transfer.activatedAt > 0 && currentTime >= autoCompleteTime;

  // 진행률 계산
  const totalPeriod = transfer.safetyPeriod + transfer.confirmPeriod;
  const elapsed = currentTime - transfer.activatedAt;
  const progress = transfer.activatedAt > 0 ? Math.min((elapsed / totalPeriod) * 100, 100) : 0;

  // const getTimeRemaining = (targetTime) => {
  //   if (!targetTime || targetTime === 0 || currentTime >= targetTime) {
  //     return '0초';
  //   }
  //   const remaining = targetTime - currentTime;
  //   return formatTime(remaining);
  // };

  // 거래 관리 화면
  return (
    <div className="safesend-container">
      <div className="safesend-header">
        {/* <button onClick={onBack} className="back-btn">
          <ArrowLeft size={20} /> 
        </button>    */}

        {/* <ChevronLeft size={24} onClick={onBack} style={{cursor: 'pointer'}} /> */}

        <div 
          onClick={onBack} style={{cursor: 'pointer'}}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#f0f0f0',  // 배경색
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <ChevronLeft size={24} />
        </div>
        
        <h1>송신 거래 </h1>
        <button 
          onClick={handleManualRefresh} 
          className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
          disabled={isRefreshing}
          title="새로고침"
        >
          <RefreshCw size={18} />
        </button> 
      </div>
      <div className="safesend-header-subinfo">

        {lastUpdateTime && (
          <div className="last-update-info">
            마지막 업데이트: {lastUpdateTime.toLocaleTimeString('ko-KR')}
          </div>
        )}

        <div className="safesend-network-info">
          <span className="network-badge">{network.name}</span>
            <span className="account-badge">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
        </div>
      </div>

      {/* 거래 정보 카드 */}
      <div className="safesend-transfer-info-card">
        <div className="safesend-info-header">
          <h3>거래 정보</h3> <span className="value">{formatDate(transfer.createdAt)}</span>
          <span className="status-badge" style={{ backgroundColor: getStatusColor(transfer.state) }}>
            {getStatusText(transfer.state)}
          </span>
        </div>

        <div className="safereceive-info-grid">
          <div className="safesend-info-item">
            <span className="label">거래 ID</span>
            <span className="value">#{transfer.id}</span>
          </div>
          {/* <div className="safesend-info-item">
            <span className="label">생성 일시</span>
            <span className="value">{formatDate(transfer.createdAt)}</span>
          </div>
          {transfer.activatedAt && Number(transfer.activatedAt) > 0 && (
            <div className="safesend-info-item">
              <span className="label">활성화 일시</span>
              <span className="value">{formatDate(transfer.activatedAt)}</span>
            </div>
          )} */}
          <div className="safesend-info-item">
            <span className="label">수신자</span>
            <span className="value">{transfer.receiver.slice(0, 6)}...{transfer.receiver.slice(-4)}</span>
          </div>
          <div className="safesend-info-item">
            <span className="label">송금액</span>
            <span className="value">{ethers.formatEther(transfer.amount)} WLC</span>
          </div>
          <div className="safesend-info-item">
            <span className="label">보증금</span>
            <span className="value">{ethers.formatEther(transfer.collateral)} WLC</span>
          </div>
          <div className="safesend-info-item">
            <span className="label">안전기간</span>
            <span className="value">{formatTime(transfer.safetyPeriod)}</span>
          </div>
          <div className="safesend-info-item">
            <span className="label">확정기간</span>
            <span className="value">{formatTime(transfer.confirmPeriod)}</span>
          </div>
        </div>
      </div>

      

      {/* 양방향 타임라인 */}
      {/* {!isCompleted && !isCancelled && ( */}
      <div className="dual-timeline">
        <h3>🔄 거래 진행 상황</h3>
        <div className="progress-info" style={{marginBottom: "15px"}}>
          시간경과율: {progress.toFixed(1)}% | 자동완료까지: {getTimeRemaining(autoCompleteTime)}
        </div>
        
        {/* 보증금 대기 상태 */}
        {isWaitingDeposit && (
          <div className="action-section">
            <div className="action-card warning">
              <Clock size={24} />
              <div className="action-content">
                <h4>⏳ 수신자 보증금 대기 중</h4>
                <p>수신자가 보증금 {ethers.formatEther(transfer.collateral)} WLC를 예치해야 거래가 시작됩니다.</p>
                <p className="help-text">필요 시 거래를 취소할 수 있습니다.</p>
                <button onClick={handleCancel} disabled={processing} className="safesend-action-button danger">
                  {processing ? (
                    <>
                      <Loader size={14} className="spin" /> 처리 중...
                    </>
                  ) : (
                    '❌ 거래 취소'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ 조기 승인 완료 메시지 */}
        {!isCreating && transfer && transfer.senderApproved && !isCompleted && (
          <div className="action-section">
            <div className="action-card success">
              <CheckCircle size={32} />
              <div className="action-content">
                <h4>✅ 조기 승인 완료</h4>
                <p>거래를 조기 승인했습니다.</p>
                <p>수신자가 즉시 자금을 인출할 수 있습니다.</p>
                <div style={{ 
                  marginTop: '15px', 
                  padding: '12px', 
                  backgroundColor: '#d1fae5', 
                  borderRadius: '8px',
                  color: '#065f46'
                }}>
                  <strong>💰 수신자 인출 가능 금액</strong>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '8px' }}>
                    {ethers.formatEther(BigInt(transfer.amount) + BigInt(transfer.collateral))} WLC
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>
                    (송금액: {ethers.formatEther(transfer.amount)} WLC + 보증금 반환: {ethers.formatEther(transfer.collateral)} WLC)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 안전기간 액션 - 조기 승인하지 않은 경우만 표시 */}
        {!isCreating && transfer && isInSafetyPeriod && !transfer.senderApproved && (
          <div className="action-section">
            <h3>🛡️ 안전기간 중 가능한 액션</h3>
            <p className="period-info">
              안전기간이 경과할 때까지 기다리시기 바랍니다. 송신자는 안전기간 중 거래를 취소하거나 조기 승인할 수 있습니다.
            </p>
            <p className="countdown" style={{textAlign: "center"}}>안전기간 남은 시간: {getTimeRemaining(safetyEndTime)}</p>

            <div className='twocards-container'>
            <div className="action-card success">
              {/* <CheckCircle size={24} /> */}
              <div className="action-content">
                <h4>✅ 조기 승인하기</h4>
                <p>상대방이 미리 제공한 물품/서비스에 만족하면 조기 승인할 수 있습니다.</p>
                <p>승인된 거래는 되돌릴 수 없습니다.</p>
                <button onClick={handleEarlyApprove} disabled={processing} className="safesend-action-button success">
                  {processing ? (
                    <>
                      <Loader size={14} className="spin" /> 처리 중...
                    </>
                  ) : (
                    '✅ 조기 승인'
                  )}
                </button>
              </div>
            </div> 
            <div className="action-card danger">
              {/* <XCircle size={24} /> */}
              <div className="action-content">
                <h4>❌ 거래 취소하기</h4>
                <p>안전기간 중에는 언제든지 거래를 취소할 수 있습니다.</p>
                <p className="warning-text">⚠️ 수수료의 50%가 차감됩니다.</p>
                <button onClick={handleCancel} disabled={processing} className="safesend-action-button danger">
                  {processing ? (
                    <>
                      <Loader size={14} className="spin" /> 처리 중...
                    </>
                  ) : (
                    '❌ 거래 취소'
                  )}
                </button>
              </div>
            </div>
            </div>

            
          </div>
        )}

        {/* 확정기간 액션 - 조기 승인하지 않은 경우만 표시 */}
        {!isCompleted && !isCancelled && isInConfirmPeriod && !isMutualCancelRequested && !isSplitProposed && !transfer.senderApproved && (
          <div className="action-section">
            <h3>🤝 확정기간 중 가능한 액션</h3>
            <p className="period-info">
              안전기간이 종료되었습니다. 상호취소 또는 타협안을 제안할 수 있습니다.
            </p>

            <div className="action-card danger">
              <XCircle size={24} />
              <div className="action-content">
                <h4>🔄 상호취소 요청</h4>
                <p>수신자와 합의하여 거래를 취소합니다.</p>
                <p className="help-text">수신자가 24시간 내 응답해야 합니다.</p>
                <button onClick={handleRequestMutualCancel} disabled={processing} className="safesend-action-button warning">
                  {processing ? (
                    <>
                      <Loader size={14} className="spin" /> 처리 중...
                    </>
                  ) : (
                    '🔄 상호취소 요청'
                  )}
                </button>
              </div>
            </div>

            <div className="action-card">
              <div className="action-content">
                <h4>💡 타협안 제시</h4>
                <p>부분 환불을 제안합니다.</p>
                <div className="split-slider">
                  <label>나에게 환불될 비율: {splitPercentage}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splitPercentage}
                    onChange={(e) => setSplitPercentage(parseInt(e.target.value))}
                    className="slider"
                  />
                  <div className="split-preview">
                    <div>
                      <span>내가 받을 금액:</span>
                      <span className="amount">
                        {ethers.formatEther(
                          (BigInt(transfer.amount) * BigInt(splitPercentage)) / BigInt(100) + 
                          BigInt(transfer.senderFee) / BigInt(2)
                        )} WLC
                      </span>
                    </div>
                    <div>
                      <span>상대방이 받을 금액:</span>
                      <span className="amount">
                        {ethers.formatEther(
                          (BigInt(transfer.amount) * BigInt(100 - splitPercentage)) / BigInt(100) + 
                          BigInt(transfer.collateral) +
                          BigInt(transfer.receiverFee) / BigInt(2)
                        )} WLC
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={handleProposeSplit} disabled={processing} className="safesend-action-button">
                  {processing ? (
                    <>
                      <Loader size={14} className="spin" /> 처리 중...
                    </>
                  ) : (
                    '💡 타협안 제안하기'
                  )}
                </button>
              </div>
            </div>

            {/* 조기 승인하지 않은 경우만 버튼 표시 */}
            {!transfer.senderApproved && (
              <div className="action-card success">
                <CheckCircle size={24} />
                <div className="action-content">
                  <h4>✅ 조기 승인하기</h4>
                  <p>물품/서비스에 만족하면 조기 승인할 수 있습니다.</p>
                  <button onClick={handleEarlyApprove} disabled={processing} className="safesend-action-button success">
                    {processing ? '처리 중...' : '✅ 조기 승인'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 상호취소 요청 대기 */}
        {isMutualCancelRequested && (
          <div className="action-card warning">
            <Clock size={24} />
            <div className="action-content">
              <h4>⏳ 상호취소 요청 중</h4>
              <p>수신자의 응답을 기다리고 있습니다.</p>
              <p>응답 기한: 24시간</p>
            </div>
          </div>
        )}

        {/* 타협안 제안 대기 */}
        {isSplitProposed && (
          <div className="action-card info">
            <Clock size={24} />
            <div className="action-content">
              <h4>💡 타협안 제안 중</h4>
              <p>제안한 비율: {splitPercentage}%</p>
              <p>수신자의 응답을 기다리고 있습니다.</p>
            </div>
          </div>
        )}

        {/* 자동 완료 가능 */}
        {canAutoComplete && (
          <div className="action-card success">
            <CheckCircle size={24} />
            <div className="action-content">
              <h4>✅ 자동 완료 가능</h4>
              <p>모든 기간이 만료되었습니다.</p>
              <p>수신자가 자금을 인출할 수 있습니다.</p>
            </div>
          </div>
        )}

        {/* 완료 상태 */}
        {isCompleted && (
          <div className="action-card success">
            <CheckCircle size={32} />
            <div className="action-content">
              <h4>✅ 거래 완료</h4>
              <p>거래가 성공적으로 완료되었습니다.</p>
              <p>수신자가 자금을 인출했습니다.</p>
            </div>
          </div>
        )}

        {/* 취소 상태 */}
        {isCancelled && (
          <div className="action-card warning">
            <XCircle size={32} />
            <div className="action-content">
              <h4>❌ 거래 취소됨</h4>
              <p>거래가 취소되었습니다.</p>
              <p>자금이 환불되었습니다.</p>
              {transfer.activatedAt && Number(transfer.activatedAt) > 0 ? (
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                    취소 시점: {formatDate(transfer.activatedAt)}
                  </p>
                ):(<p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                    취소 시점: {formatDate(transfer.createdAt)}
                  </p>)}
            </div>
          </div>
        )}

        {/* 거래 진행 상황 버튼 */}
        <div className="safesend-state">
          <button 
            className="timeline-button"
            onClick={() => setIsTimelineModalOpen(true)}
          >
            <span>📋</span>
            거래 진행 상황 상세 보기
          </button>
        </div>

        {/* 타임라인 모달 */}
        {isTimelineModalOpen && (
          <div className="safetransfer-modal-overlay" onClick={() => setIsTimelineModalOpen(false)}>
            <div className="safetransfer-safetransfer-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="safetransfer-modal-header">
                <h3>🔄 거래 진행 상황</h3>
                <button 
                  className="safetransfer-modal-close-button"
                  onClick={() => setIsTimelineModalOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="safetransfer-modal-body" onClick={() => setIsTimelineModalOpen(false)}>
                {/* 송신자 타임라인 */ }
                <div className="participant-timeline sender">
                  <div className="participant-header">
                    <span className="role-badge role-sender">📤 송신자 (나)</span>
                    <span className="address">{transfer.sender.slice(0, 6)}...{transfer.sender.slice(-4)}</span>
                  </div>
                  <div className="safesend-timeline-steps">
                    <div className="safesend-timeline-step completed">
                      <CheckCircle size={20} color="#27ae60" />
                      <div className="step-info">
                        <strong>거래 생성 완료</strong>
                        <span>{ethers.formatEther(transfer.amount)} WLC 예치</span>
                      </div>
                    </div>
                    
                    {isWaitingDeposit ? (
                      <div className="safesend-timeline-step current">
                        <Clock size={20} color="#f39c12" />
                        <div className="step-info">
                          <strong>수신자 보증금 대기 중</strong>
                          <span>필요 시 거래 취소 가능</span>
                        </div>
                      </div>
                    ) : (
                      <div className="safesend-timeline-step completed">
                        <CheckCircle size={20} color="#27ae60" />
                        <div className="step-info">
                          <strong>거래 활성화됨</strong>
                          <span>수신자 보증금 예치 완료</span>
                        </div>
                      </div>
                    )}
                    
                    {isInSafetyPeriod && (
                      <div className="safesend-timeline-step current">
                        <Clock size={20} color="#f39c12" />
                        <div className="step-info">
                          <strong>안전기간 진행 중</strong>
                          <span className="countdown">남은 시간: {getTimeRemaining(safetyEndTime)}</span>
                        </div>
                      </div>
                    )}
                    
                    {isInConfirmPeriod && (
                      <div className="safesend-timeline-step current">
                        <Clock size={20} color="#f39c12" />
                        <div className="step-info">
                          <strong>확정기간 진행 중</strong>
                          <span className="countdown">남은 시간: {getTimeRemaining(confirmEndTime)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 수신자 타임라인 */}
                <div className="participant-timeline receiver">
                  <div className="participant-header">
                    <span className="role-badge role-receiver">📥 수신자</span>
                    <span className="address">{transfer.receiver.slice(0, 6)}...{transfer.receiver.slice(-4)}</span>
                  </div>
                  <div className="safesend-timeline-steps">
                    <div className="safesend-timeline-step completed">
                      <CheckCircle size={20} color="#27ae60" />
                      <div className="step-info">
                        <strong>요청 수신</strong>
                        <span>거래 요청 받음</span>
                      </div>
                    </div>
                    
                    {isWaitingDeposit ? (
                      <div className="safesend-timeline-step pending">
                        <Clock size={20} />
                        <div className="step-info">
                          <strong>보증금을 예치해야 함</strong>
                          <span>필요: {ethers.formatEther(transfer.collateral)} WLC</span>
                        </div>
                      </div>
                    ) : (
                      <div className="safesend-timeline-step completed">
                        <CheckCircle size={20} color="#27ae60" />
                        <div className="step-info">
                          <strong>보증금 예치 완료</strong>
                          <span>{ethers.formatEther(transfer.collateral)} WLC</span>
                        </div>
                      </div>
                    )}
                    
                    {!isWaitingDeposit && (
                      <div className="safesend-timeline-step pending">
                        <Clock size={20} />
                        <div className="step-info">
                          <strong>물품/서비스 제공 중</strong>
                          <span>거래 진행 중...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        
      </div>
      {/* )} */}

      {/* 진행 바 */}
      {/* {transfer.activatedAt > 0 && !isCompleted && !isCancelled && (
        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-labels">
            <span>생성</span>
            <span>활성화</span>
            <span>안전기간</span>
            <span>확정기간</span>
            <span>완료</span>
          </div>
          <div className="progress-info">
            진행률: {progress.toFixed(1)}% | 자동완료까지: {getTimeRemaining(autoCompleteTime)}
          </div>
        </div>
      )} */}

      {/* 알림 모달 */}
      {alertModal.isOpen && (
        <div className="safetransfer-modal-overlay" onClick={closeAlert}>
          <div className="safetransfer-safetransfer-modal-content alert-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`alert-safetransfer-modal-header alert-${alertModal.type}`}>
              {alertModal.type === 'success' && <CheckCircle size={32} />}
              {alertModal.type === 'error' && <XCircle size={32} />}
              {alertModal.type === 'warning' && <AlertCircle size={32} />}
              {alertModal.type === 'info' && <AlertCircle size={32} />}
              <h3>{alertModal.title}</h3>
            </div>
            <div className="alert-safetransfer-modal-body">
              <p>{extractErrorMessage(alertModal.message)}</p>
            </div>
            <div className="alert-safetransfer-modal-footer">
              <button className="safetransfer-modal-btn-primary" onClick={closeAlert}>
                확인
              </button>
            </div>
          </div>
        </div>
      )} 
    </div>
  );
};

export default SafeSend;