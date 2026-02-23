// src/components/SafeTransfer/SafeReceive.js
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../../utils/logger.js'; 
import { Loader, ArrowLeft, Download, AlertCircle, CheckCircle, XCircle, Clock, Shield, RefreshCw, ChevronLeft } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, WORLDLAND_RPC, getStatusText, getStatusColor } from './contractConfig';
import './SafeTransfer.css';
import './SafeReceive.css';
import '../common.css';

// 에러 메시지에서 괄호 앞까지만 추출
const extractErrorMessage = (message) => {
  if (!message) return '';
  
  const openParenIndex = message.indexOf('(');
  
  if (openParenIndex === -1) {
    return message.trim();
  }
  
  return message.substring(0, openParenIndex).trim();
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

const SafeReceive = ({ account, network, walletData, initialTransferId, onBack }) => {
  const [contract, setContract] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  
  // 역제안 비율
  const [counterProposal, setCounterProposal] = useState(50);
  
  // 타이머
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // 자동 새로고침 관련 state
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
        consolelog('✅ SafeReceive 컨트랙트 초기화 완료');
      } catch (error) {
        consoleerror('❌ 컨트랙트 초기화 실패:', error);
      }
    };
    
    initContract();
  }, [walletData]);

  // 알림 모달 열기
  const showAlert = (type, title, message) => {
    setAlertModal({
      isOpen: true,
      type,
      title,
      message: extractErrorMessage(message)
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
      consolelog('📊 거래 조회:', initialTransferId);
      const t = await contract.getTransferInfo(initialTransferId);
      
      // 분쟁 정보도 조회
      let disputeInfo = { mutualCancelRequestedAt: 0, mutualCancelResponseDeadline: 0, splitProposal: 0 };
      try {
        const d = await contract.getDisputeInfo(initialTransferId);
        disputeInfo = {
          mutualCancelRequestedAt: Number(d.mutualCancelRequestedAt || d[0] || 0),
          mutualCancelResponseDeadline: Number(d.mutualCancelResponseDeadline || d[1] || 0),
          splitProposal: Number(d.splitProposal || d[2] || 0)
        };
      } catch (err) {
        consolelog('분쟁 정보 없음 (정상)');
      }
      
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
        collateralDeposited: t.collateralDeposited !== undefined ? t.collateralDeposited : t[12],
        ...disputeInfo
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
    consolelog('🔄 [SafeReceive] 수동 새로고침 시작');
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
          consolelog('🔄 [SafeSend] 자동 새로고침 (1분 간격)');
          
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

  // 보증금 예치
  const handleDepositCollateral = async () => {
    const totalAmount = BigInt(transfer.collateral) + BigInt(transfer.receiverFee);
    
    if (!window.confirm(`보증금 ${ethers.formatEther(transfer.collateral)} WLC와 수수료 ${ethers.formatEther(transfer.receiverFee)} WLC를 예치하시겠습니까?\n\n총 ${ethers.formatEther(totalAmount)} WLC가 필요합니다.`)) {
      return;
    }

    setProcessing(true);
    try {
      consolelog('보증금 예치 중:', transfer.id);
      consolelog('총 금액:', ethers.formatEther(totalAmount), 'WLC');
      
      const tx = await contract.depositCollateral(transfer.id, { value: totalAmount });
      consolelog('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      consolelog('✅ 보증금 예치 완료');
      
      showAlert('success', '보증금 예치 완료', '보증금이 예치되었습니다! 거래가 활성화되었습니다.');

      // 상태 즉시 업데이트
      await loadTransfer(false);

      // onBack();
      
    } catch (error) {
      consoleerror('❌ 보증금 예치 실패:', error);
      showAlert('error', '보증금 예치 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 거래 완료 (자금 인출)
  const handleCompleteTransfer = async () => {
    const totalAmount = BigInt(transfer.amount) + BigInt(transfer.collateral);
    
    if (!window.confirm(`총 ${ethers.formatEther(totalAmount)} WLC를 인출하시겠습니까?\n\n송금액: ${ethers.formatEther(transfer.amount)} WLC\n보증금 반환: ${ethers.formatEther(transfer.collateral)} WLC`)) {
      return;
    }

    setProcessing(true);
    try {
      consolelog('거래 완료 중:', transfer.id);
      const tx = await contract.completeTransfer(transfer.id);
      consolelog('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      consolelog('✅ 거래 완료');
      
      showAlert('success', '거래 완료', '거래가 완료되었습니다! 자금이 인출되었습니다.');
      onBack();
      
    } catch (error) {
      consoleerror('❌ 거래 완료 실패:', error);
      showAlert('error', '거래 완료 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 상호취소 승인
  const handleApproveMutualCancel = async () => {
    if (!window.confirm('상호취소에 동의하시겠습니까?\n\n양측 모두 전액 환불됩니다.')) {
      return;
    }

    setProcessing(true);
    try {
      consolelog('상호취소 승인 중:', transfer.id);
      const tx = await contract.respondToMutualCancel(transfer.id, true);
      consolelog('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      consolelog('✅ 상호취소 승인 완료');
      
      showAlert('success', '상호취소 승인 완료', '상호취소가 승인되었습니다. 자금이 환불되었습니다.');
      onBack();
      
    } catch (error) {
      consoleerror('❌ 상호취소 승인 실패:', error);
      showAlert('error', '상호취소 승인 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 상호취소 거부
  const handleRejectMutualCancel = async () => {
    if (!window.confirm('상호취소를 거부하시겠습니까?\n\n거래가 계속 진행됩니다.')) {
      return;
    }

    setProcessing(true);
    try {
      consolelog('상호취소 거부 중:', transfer.id);
      const tx = await contract.respondToMutualCancel(transfer.id, false);
      consolelog('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      consolelog('✅ 상호취소 거부 완료');
      
      showAlert('success', '상호취소 거부 완료', '상호취소가 거부되었습니다.');
      onBack();
      
    } catch (error) {
      consoleerror('❌ 상호취소 거부 실패:', error);
      showAlert('error', '상호취소 거부 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 타협안 수락
  const handleAcceptSplit = async () => {
    const senderAmount = (BigInt(transfer.amount) * BigInt(transfer.splitProposal)) / BigInt(100);
    const receiverAmount = (BigInt(transfer.amount) * BigInt(100 - transfer.splitProposal)) / BigInt(100);
    
    if (!window.confirm(`타협안을 수락하시겠습니까?\n\n송신자: ${ethers.formatEther(senderAmount + BigInt(transfer.collateral))} WLC\n나: ${ethers.formatEther(receiverAmount + BigInt(transfer.collateral))} WLC`)) {
      return;
    }

    setProcessing(true);
    try {
      consolelog('타협안 수락 중:', transfer.id);
      const tx = await contract.acceptSplit(transfer.id);
      consolelog('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      consolelog('✅ 타협안 수락 완료');
      
      showAlert('success', '타협안 수락 완료', '타협안이 수락되었습니다.');
      onBack();
      
    } catch (error) {
      consoleerror('❌ 타협안 수락 실패:', error);
      showAlert('error', '타협안 수락 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 역제안
  const handleCounterPropose = async () => {
    if (!window.confirm(`${counterProposal}% 환불을 역제안하시겠습니까?`)) {
      return;
    }

    setProcessing(true);
    try {
      consolelog('역제안 중:', transfer.id, counterProposal);
      const tx = await contract.proposeSplit(transfer.id, counterProposal);
      consolelog('트랜잭션 전송:', tx.hash);
      
      await tx.wait();
      consolelog('✅ 역제안 완료');
      
      showAlert('success', '역제안 전송 완료', '역제안이 전송되었습니다.');
      onBack();
      
    } catch (error) {
      consoleerror('❌ 역제안 실패:', error);
      showAlert('error', '역제안 실패', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="safereceive-container">
        <div className="loading">거래 정보 로딩 중...</div>
        
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
                <p>{alertModal.message}</p>
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

  // 거래 정보가 없는 경우
  if (!transfer) {
    return (
      <div className="safereceive-container">
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
                <p>{alertModal.message}</p>
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

  // 현재 단계 계산
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

  console.log(`activatedAt: ${transfer.activatedAt}`);
  console.log(`autoCompleteTime: ${autoCompleteTime}`);
  console.log(`currentTime: ${currentTime}`);

  // 시간 비교 시 activatedAt > 0 체크 추가
  const isInSafetyPeriod = isActive && transfer.activatedAt > 0 && currentTime < safetyEndTime;
  const isInConfirmPeriod = isActive && transfer.activatedAt > 0 && currentTime >= safetyEndTime && currentTime < confirmEndTime;
  const canComplete = isActive && transfer.activatedAt > 0 && (transfer.senderApproved || currentTime >= autoCompleteTime);

  // 진행률 계산
  let progress = 0;
  if (transfer.activatedAt > 0) {
    const totalTime = transfer.safetyPeriod + transfer.confirmPeriod;
    const elapsed = currentTime - transfer.activatedAt;
    progress = Math.min(100, (elapsed / totalTime) * 100);
  }

  // 상호취소 응답 기한
  const mutualCancelDeadline = transfer.mutualCancelResponseDeadline;
  const isMutualCancelExpired = mutualCancelDeadline > 0 && currentTime > mutualCancelDeadline;

  return (
    <div className="safereceive-container">
      {/* 헤더 */}
      <div className="common-header">
        {/* <button onClick={onBack} className="back-btn">
          <ArrowLeft size={20} /> 
        </button>     */}
        <ChevronLeft size={24} onClick={onBack} style={{cursor: 'pointer'}} />        
        <h1>수신 거래</h1>
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
        
        <div className="safereceive-network-info">
          <span className="network-badge">{network.name}</span>
            <span className="account-badge">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
        </div>
      </div>

      {/* 거래 정보 */} 
      <div className="transfer-info-section">
        <div className="safereceive-info-header">
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
            <span className="label">송신자</span>
            <span className="value">{transfer.sender.slice(0, 6)}...{transfer.sender.slice(-4)}</span>
          </div>
          <div className="safereceive-info-item">
            <span className="label">송금액</span>
            <span className="value">{ethers.formatEther(transfer.amount)} WLC</span>
          </div>
          <div className="safereceive-info-item">
            <span className="label">보증금</span>
            <span className="value">{ethers.formatEther(transfer.collateral)} WLC</span>
          </div>
          <div className="safereceive-info-item">
            <span className="label">안전기간</span>
            <span className="value">{formatTime(transfer.safetyPeriod)}</span>
          </div>
          <div className="safereceive-info-item">
            <span className="label">확정기간:</span>
            <span className="value">{formatTime(transfer.confirmPeriod)}</span>
          </div>
        </div>
      </div>


      

      {/* 양방향 타임라인 */}
      <div className="dual-timeline">
        <h3>🔄 거래 진행 상황</h3> 
          <div className="progress-info" style={{marginBottom: "15px"}}>
            시간 경과율: {progress.toFixed(1)}% | 자동완료까지: {getTimeRemaining(autoCompleteTime)}
          </div> 
          
          {/* 현재 가능한 액션 */}
          {!isCompleted && !isCancelled && (
            <div className="actions-section">
              <h3>🎯 현재 가능한 액션</h3>
              
              {/* 보증금 예치 필요 */}
              {isWaitingDeposit && (
                <div className="action-card warning">
                  {/* <AlertCircle size={24} /> */}
                  <div className="action-content">
                    <h4>💰 보증금 예치 필요</h4>
                    <p>거래를 시작하려면 보증금을 예치해야 합니다.</p>
                    {/* <div className="deposit-details">
                      <div className="safereceive-detail-row">
                        <span>보증금:</span>
                        <span>{ethers.formatEther(transfer.collateral)} WLC</span>
                      </div>
                      <div className="safereceive-detail-row">
                        <span>수수료:</span>
                        <span>{ethers.formatEther(transfer.receiverFee)} WLC</span>
                      </div>
                      <div className="safereceive-detail-row total">
                        <span>총 예치 필요:</span>
                        <span>{ethers.formatEther(BigInt(transfer.collateral) + BigInt(transfer.receiverFee))} WLC</span>
                      </div>
                    </div> */}
                    <button onClick={handleDepositCollateral} disabled={processing} className="action-button primary large">
                      {processing ? (
                        <>
                          <Loader size={14} className="spin" /> 처리 중...
                        </>
                      ) : ( 
                        '💰 보증금 예치하기'
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              {/* 안전기간 */}
              {isInSafetyPeriod && !canComplete && (
                <div className="action-card info">
                  {/* <Shield size={24} /> */}
                  <div className="action-content">
                    <h4>⏳ 안전기간 중 - 대기</h4>
                    <p>안전기간이 경과할 때까지 기다리시기 바랍니다. 송신자가 일방적으로 취소할 수 있는 기간입니다.</p>
                    <p className="countdown" style={{textAlign: "center"}}>안전기간 남은 시간: {getTimeRemaining(safetyEndTime)}</p>
                    <ul>
                      <li>💡 물품/서비스 제공을 준비하세요</li>
                      <li>⚠️ 송신자가 취소하면 보증금이 전액 반환됩니다</li>
                      <li>✅ 안전기간이 지나면 물품/서비스를 제공하시기 바랍니다. 거래가 더 안전해집니다</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {/* 확정기간 */}
              {isInConfirmPeriod && !isMutualCancelRequested && !isSplitProposed && !canComplete && (
                <div className="action-card info">
                  {/* <Clock size={24} /> */}
                  <div className="action-content">
                    <h4>🤝 확정기간 - 거래 진행 중</h4>
                    <p>송신자가 상호취소나 타협안을 제안할 수 있습니다.</p>
                    <p className="countdown">자동완료까지: {getTimeRemaining(autoCompleteTime)}</p>
                    <ul>
                      <li>✅ 물품/서비스를 정상적으로 제공하세요</li>
                      <li>⏰ 시간이 지나면 자동으로 완료됩니다</li>
                      <li>💰 완료 시 송금액 + 보증금을 받습니다</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 상호취소 요청 받음 */}
              {isMutualCancelRequested && (
                <div className="action-card warning">
                  <AlertCircle size={24} />
                  <div className="action-content">
                    <h4>⚠️ 상호취소 요청 받음!</h4>
                    <p>송신자가 거래 취소를 요청했습니다.</p>
                    {!isMutualCancelExpired ? (
                      <>
                        <p className="countdown urgent">
                          ⏰ 응답 기한: {getTimeRemaining(mutualCancelDeadline)}
                        </p>
                        <div className="response-warning">
                          <strong>⚠️ 무응답 시 보증금 50% 패널티</strong>
                        </div>
                        <div className="response-options">
                          <h5>선택지:</h5>
                          <div className="option">
                            <strong>1️⃣ 동의하기</strong>
                            <p>→ 양측 전액 환불 (평화적 해결)</p>
                            <button onClick={handleApproveMutualCancel} disabled={processing} className="action-button success">
                              {processing ? (
                                <>
                                  <Loader size={14} className="spin" /> 처리 중...
                                </>
                              ) : (
                                '✅ 동의하기'
                              )} 
                            </button>
                          </div>
                          <div className="option">
                            <strong>2️⃣ 거부하기</strong>
                            <p>→ 거래 계속 진행</p>
                            <button onClick={handleRejectMutualCancel} disabled={processing} className="action-button danger">
                              {processing ? (
                                <>
                                  <Loader size={14} className="spin" /> 처리 중...
                                </>
                              ) : (
                                '❌ 거부하기'
                              )}

                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="expired-notice">
                        <XCircle size={24} />
                        <p>응답 기한이 만료되었습니다. 패널티가 적용됩니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 타협안 제안 받음 */}
              {isSplitProposed && (
                <div className="action-card info">
                  <AlertCircle size={24} />
                  <div className="action-content">
                    <h4>💡 타협안 제안 받음</h4>
                    <p>송신자가 {transfer.splitProposal}% 환불을 제안했습니다.</p>
                    
                    <div className="split-preview-box">
                      <h5>제안 내용:</h5>
                      <div className="preview-row">
                        <span>송신자가 받을 금액:</span>
                        <span className="amount">
                          {ethers.formatEther(
                            (BigInt(transfer.amount) * BigInt(transfer.splitProposal)) / BigInt(100) +
                            BigInt(transfer.senderFee) / BigInt(2)
                          )} WLC
                        </span>
                      </div>
                      <div className="preview-row">
                        <span>내가 받을 금액:</span>
                        <span className="amount highlight">
                          {ethers.formatEther(
                            (BigInt(transfer.amount) * BigInt(100 - transfer.splitProposal)) / BigInt(100) +
                            BigInt(transfer.collateral) +
                            BigInt(transfer.receiverFee) / BigInt(2)
                          )} WLC
                        </span>
                      </div>
                    </div>

                    <div className="response-options">
                      <div className="option">
                        <strong>✅ 타협안 수락</strong>
                        <button onClick={handleAcceptSplit} disabled={processing} className="action-button success">
                          {processing ? (
                            <>
                              <Loader size={14} className="spin" /> 처리 중...
                            </>
                          ) : (
                            '타협안 수락하기'
                          )}
                        </button>
                      </div>

                      <div className="option">
                        <strong>💡 역제안하기</strong>
                        <div className="counter-proposal">
                          <label>송신자 환불 비율: {counterProposal}%</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={counterProposal}
                            onChange={(e) => setCounterProposal(parseInt(e.target.value))}
                            className="slider"
                          />
                          <div className="counter-preview">
                            <div>
                              <span>송신자:</span>
                              <span className="amount">
                                {ethers.formatEther(
                                  (BigInt(transfer.amount) * BigInt(counterProposal)) / BigInt(100) +
                                  BigInt(transfer.senderFee) / BigInt(2)
                                )} WLC
                              </span>
                            </div>
                            <div>
                              <span>나:</span>
                              <span className="amount">
                                {ethers.formatEther(
                                  (BigInt(transfer.amount) * BigInt(100 - counterProposal)) / BigInt(100) +
                                  BigInt(transfer.collateral) +
                                  BigInt(transfer.receiverFee) / BigInt(2)
                                )} WLC
                              </span>
                            </div>
                          </div>
                          <button onClick={handleCounterPropose} disabled={processing} className="action-button">
                            {processing ? (
                              <>
                                <Loader size={14} className="spin" /> 처리 중...
                              </>
                            ) : (
                              '💡 역제안 보내기'
                            )} 
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 거래 완료 가능 */}
              {canComplete && (
                <div className="action-card success">
                  {/* <CheckCircle size={24} /> */}
                  <div className="action-content">
                    <h4>✅ 거래 완료 가능!</h4>
                    {transfer.senderApproved ? (
                      <p>송신자가 조기 승인했습니다. 자금을 인출할 수 있습니다.</p>
                    ) : (
                      <p>모든 기간이 만료되었습니다. 자금을 인출할 수 있습니다.</p>
                    )}
                    <div className="safereceive-complete-details">
                      <div className="safereceive-detail-row">
                        <span>송금액:</span>
                        <span>{ethers.formatEther(transfer.amount)} WLC</span>
                      </div>
                      <div className="safereceive-detail-row">
                        <span>보증금:</span>
                        <span>{ethers.formatEther(transfer.collateral)} WLC</span>
                      </div>
                      <div className="safereceive-detail-row total">
                        <span>총 인출 금액</span>
                        <span>{ethers.formatEther(BigInt(transfer.amount) + BigInt(transfer.collateral))} WLC</span>
                      </div>
                    </div>
                    <div className='safereceive-submit-button' style={{display: "flex", justifyContent: "center"}}>
                      <button onClick={handleCompleteTransfer} disabled={processing} className="action-button success large">
                        {processing ? (
                          <>
                            <Loader size={14} className="spin" /> 처리 중...
                          </>
                        ) : (
                          '💰 인출하기'
                        )} 
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 완료 상태 */}
          {isCompleted && (
            <div className="action-card success">
              <CheckCircle size={32} />
              <div className="action-content">
                <h4>✅ 거래 완료</h4>
                <p>거래가 성공적으로 완료되었습니다.</p>
                <p>자금을 성공적으로 수령했습니다.</p>
                {transfer.activatedAt && Number(transfer.activatedAt) > 0 && (
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                    완료 시점: {formatDate(transfer.activatedAt)}
                  </p>
                )}
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
                <p>보증금이 환불되었습니다.</p>
                {transfer.activatedAt && Number(transfer.activatedAt) > 0 && (
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                    취소 시점: {formatDate(transfer.activatedAt)}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* 거래 진행 상황 버튼 */}
          
          <div className="safereceive-state">
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
                  {/* 수신자 타임라인 */}
                  <div className="participant-timeline receiver">
                    <div className="participant-header">
                      <span className="role-badge role-receiver">📥 수신자 (나)</span>
                      <span className="address">{transfer.receiver.slice(0, 6)}...{transfer.receiver.slice(-4)}</span>
                    </div>
                    <div className="safereceive-timeline-steps">
                      <div className="safereceive-timeline-step completed">
                        <CheckCircle size={20} color="#27ae60" />
                        <div className="step-info">
                          <strong>요청 수신</strong>
                          <span>거래 요청 받음</span>
                        </div>
                      </div>
                      
                      {isWaitingDeposit ? (
                        <div className="safereceive-timeline-step pending">
                          <Clock size={20} />
                          <div className="step-info">
                            <strong>보증금을 예치해야 함</strong>
                            <span>필요: {ethers.formatEther(transfer.collateral)} WLC</span>
                          </div>
                        </div>
                      ) : (
                        <div className="safereceive-timeline-step completed">
                          <CheckCircle size={20} color="#27ae60" />
                          <div className="step-info">
                            <strong>보증금 예치 완료</strong>
                            <span>{ethers.formatEther(transfer.collateral)} WLC</span>
                          </div>
                        </div>
                      )}
                      
                      {!isWaitingDeposit && (
                        <div className="safereceive-timeline-step pending">
                          <Clock size={20} />
                          <div className="step-info">
                            <strong>물품/서비스 제공 중</strong>
                            <span>거래 진행 중...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 송신자 타임라인 */ }
                  <div className="participant-timeline sender">
                    <div className="participant-header">
                      <span className="role-badge role-sender">📤 송신자 </span>
                      <span className="address">{transfer.sender.slice(0, 6)}...{transfer.sender.slice(-4)}</span>
                    </div>
                    <div className="safereceive-timeline-steps">
                      <div className="safereceive-timeline-step completed">
                        <CheckCircle size={20} color="#27ae60" />
                        <div className="step-info">
                          <strong>거래 생성 완료</strong>
                          <span>{ethers.formatEther(transfer.amount)} WLC 예치</span>
                        </div>
                      </div>
                      
                      {isWaitingDeposit ? (
                        <div className="safereceive-timeline-step current">
                          <Clock size={20} color="#f39c12" />
                          <div className="step-info">
                            <strong>수신자 보증금 대기 중</strong>
                            <span>필요 시 거래 취소 가능</span>
                          </div>
                        </div>
                      ) : (
                        <div className="safereceive-timeline-step completed">
                          <CheckCircle size={20} color="#27ae60" />
                          <div className="step-info">
                            <strong>거래 활성화됨</strong>
                            <span>수신자 보증금 예치 완료</span>
                          </div>
                        </div>
                      )}
                      
                      {isInSafetyPeriod && (
                        <div className="safereceive-timeline-step current">
                          <Clock size={20} color="#f39c12" />
                          <div className="step-info">
                            <strong>안전기간 진행 중</strong>
                            <span className="countdown">남은 시간: {getTimeRemaining(safetyEndTime)}</span>
                          </div>
                        </div>
                      )}
                      
                      {isInConfirmPeriod && (
                        <div className="safereceive-timeline-step current">
                          <Clock size={20} color="#f39c12" />
                          <div className="step-info">
                            <strong>확정기간 진행 중</strong>
                            <span className="countdown">남은 시간: {getTimeRemaining(confirmEndTime)}</span>
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
              <p>{alertModal.message}</p>
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

export default SafeReceive;