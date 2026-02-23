// src/components/SafeTransfer/SafeTransfer.js
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../../utils/logger.js';
import { ArrowLeft, Send, Download, Shield, Clock, CheckCircle, X, RefreshCw, ChevronLeft } from 'lucide-react';
import { ethers } from 'ethers';
import SafeSend from './SafeSend';
import SafeReceive from './SafeReceive';
import { CONTRACT_ADDRESS, CONTRACT_ABI, WORLDLAND_RPC, getStatusText, getStatusColor } from './contractConfig';

import './SafeTransfer.css';
import '../common.css';

const SafeTransfer = ({ account, network, walletData, onBack }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedTransferId, setSelectedTransferId] = useState(null);
  const [myTransfers, setMyTransfers] = useState([]);
  const [completedTransfers, setCompletedTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  
  // 모달 관련 state
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [isActiveModalOpen, setIsActiveModalOpen] = useState(false);

  // 자동 새로고침 관련 state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);

  
  // 날짜 포맷 함수 추가
  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === 0 || timestamp === '0') return '-';
    
    try {
      const date = new Date(Number(timestamp) * 1000);
      
      // 유효한 날짜인지 확인
      if (isNaN(date.getTime())) return '-';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
      consoleerror('날짜 포맷 오류:', error);
      return '-';
    }
  };

  useEffect(() => {
    if (!account || account.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      consolewarn('⚠️ 유효하지 않은 계정 주소. WalletMain.js로 돌아갑니다.');
      onBack();
    }
  }, [account, onBack]);

  consolelog('SafeTransfer Component - Account:', account);
  consolelog('SafeTransfer Component - Network:', network); 
  
  // 컨트랙트 초기화
  useEffect(() => {
    const initContract = async () => {
      try {
        if (!walletData || !walletData.privateKey) {
          consoleerror('❌ walletData 또는 privateKey 없음');
          return;
        }

        consolelog('🔗 컨트랙트 초기화 시작...');
        
        const provider = new ethers.JsonRpcProvider(WORLDLAND_RPC);
        consolelog('✅ Provider 생성 완료:', WORLDLAND_RPC);
        
        const wallet = new ethers.Wallet(walletData.privateKey, provider);
        consolelog('✅ Wallet 생성 완료:', wallet.address);
        
        const code = await provider.getCode(CONTRACT_ADDRESS);
        if (code === '0x') {
          consoleerror('❌ 컨트랙트가 배포되어 있지 않습니다!');
          return;
        }
        
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS, 
          CONTRACT_ABI, 
          wallet
        );
        
        consolelog('✅ 컨트랙트 인스턴스 생성 완료');
        setContract(contractInstance);
      } catch (error) {
        consoleerror('❌ 컨트랙트 초기화 실패:', error);
      }
    };
    
    initContract();
  }, [walletData, account]);

  // 거래 목록 조회 함수 분리
  const loadMyTransfers = async (showLoading = true) => {
    consolelog('\n=== 거래 조회 시작 ===');
    
    if (!contract || !account) {
      consolelog('❌ Contract 또는 Account 없음');
      setLoading(false);
      return;
    }
    
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      consolelog('📊 NextTransferId 조회 중...');
      const nextId = await contract.getNextTransferId();
      consolelog('✅ Next Transfer ID:', nextId.toString());
      
      const totalTransfers = Number(nextId) - 1;
      consolelog('📋 Total Transfers:', totalTransfers);
      
      if (totalTransfers === 0) {
        consolelog('⚠️ 생성된 거래가 없습니다');
        setMyTransfers([]);
        setLoading(false);
        return;
      }
      
      const transfers = [];
      const completed = [];
      
      for (let i = 1; i <= totalTransfers; i++) {
        try {
          consolelog(`\n--- Transfer #${i} 조회 중 ---`);
          
          const transfer = await contract.getTransferInfo(i);
          
          consolelog('Transfer 정보:');
          consolelog('  Sender:', transfer.sender || transfer[0]);
          consolelog('  Receiver:', transfer.receiver || transfer[1]);
          consolelog('  State:', transfer.state !== undefined ? transfer.state.toString() : transfer[10]);
          
          const sender = transfer.sender || transfer[0];
          const receiver = transfer.receiver || transfer[1];
          const amount = transfer.amount || transfer[2];
          const collateral = transfer.collateral || transfer[3];
          const state = transfer.state !== undefined ? Number(transfer.state) : Number(transfer[10]);
          const collateralDeposited = transfer.collateralDeposited !== undefined ? transfer.collateralDeposited : transfer[12];
          
          const isSender = sender && sender.toLowerCase() === account.toLowerCase();
          const isReceiver = receiver && receiver.toLowerCase() === account.toLowerCase();
          
          consolelog('  Is Sender?:', isSender);
          consolelog('  Is Receiver?:', isReceiver);
          
          if (isSender || isReceiver) {
            consolelog('✅ 내 거래 발견!');
            
            const transferData = {
              id: i,
              sender: sender,
              receiver: receiver,
              amount: amount,
              collateral: collateral,
              state: state,
              status: state,
              collateralDeposited: collateralDeposited,
              role: isSender ? 'sender' : 'receiver',
              senderFee: transfer.senderFee || transfer[4],
              receiverFee: transfer.receiverFee || transfer[5],
              createdAt: transfer.createdAt || transfer[6],
              activatedAt: transfer.activatedAt || transfer[7],
              safetyPeriod: transfer.safetyPeriod || transfer[8],
              confirmPeriod: transfer.confirmPeriod || transfer[9],
              senderApproved: transfer.senderApproved || transfer[11]
            };
            
            // State: 0=WAITING_FOR_DEPOSIT, 1=ACTIVE, 2=MUTUAL_CANCEL_REQUESTED, 
            //        3=SPLIT_PROPOSED, 4=COMPLETED, 5=CANCELLED
            if (state === 4 || state === 5) {
              consolelog('✅ 완료/취소된 거래로 추가 (State:', state, ')');
              completed.push(transferData);
            } else {
              consolelog('✅ 진행 중인 거래로 추가');
              transfers.push(transferData);
            }
          } else {
            consolelog('❌ 내 거래 아님');
          }
        } catch (err) {
          consoleerror(`❌ Transfer ${i} 조회 실패:`, err);
        }
      }
      
      consolelog('\n=== 최종 거래 목록 ===');
      consolelog('진행 중인 거래 수:', transfers.length);
      consolelog('완료된 거래 수:', completed.length);
      
      // 최신순 정렬
      transfers.sort((a, b) => b.id - a.id);
      completed.sort((a, b) => b.id - a.id);
      
      setMyTransfers(transfers);
      setCompletedTransfers(completed);

      setLastUpdateTime(new Date());
      
    } catch (error) {
      consoleerror('❌ 거래 목록 조회 실패:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
      setIsRefreshing(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    if (contract && account) {
      loadMyTransfers(true);
    }
  }, [contract, account]);

  // 수동 새로고침
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    consolelog('🔄 수동 새로고침 시작');
    await loadMyTransfers(false);
  };

  // 자동 새로고침 시작
  const startAutoRefresh = () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    const interval = setInterval(async () => {
      if (!isRefreshing) {
        consolelog('🔄 자동 새로고침 (1분 간격)');
        setIsRefreshing(true);
        await loadMyTransfers(false);
      }
    }, 1 * 60 * 1000); // 5분
    
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
    if (contract && account && !selectedRole) {
      startAutoRefresh();
    }
    
    return () => {
      stopAutoRefresh();
    };
  }, [contract, account, selectedRole]);

  // 거래 클릭 핸들러 - 모달 열기
  const handleTransferClick = (transfer) => {
    // 1. 모달 관련 상태 초기화 (기존 상세 내역을 띄우던 상태)
    setSelectedTransfer(null);
    setIsModalOpen(false); 

    // 2. 해당 거래의 역할(role)과 ID를 설정하여 '거래 진행 화면'으로 전환
    // transfer.role 값은 loadMyTransfers 함수에서 'sender' 또는 'receiver'로 설정됩니다.
    setSelectedRole(transfer.role);
    setSelectedTransferId(transfer.id); 
  };

  // 모달에서 거래 계속하기 버튼 클릭
  const handleContinueTransfer = () => {
    if (selectedTransfer) {
      setSelectedTransferId(selectedTransfer.id);
      setSelectedRole(selectedTransfer.role);
      setIsModalOpen(false);
    }
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTransfer(null);
  };
  
  // Sender 화면으로 전환
  if (selectedRole === 'sender') {
    return (
      <SafeSend
        account={account}
        network={network}
        walletData={walletData}
        initialTransferId={selectedTransferId}
        onBack={() => {
          setSelectedRole(null);
          setSelectedTransferId(null);
          // 메인 화면으로 돌아갈 때 거래 목록 새로고침
          loadMyTransfers(true);
        }}
      />
    );
  }

  // Receiver 화면으로 전환
  if (selectedRole === 'receiver') {
    return (
      <SafeReceive
        account={account}
        network={network}
        walletData={walletData}
        initialTransferId={selectedTransferId}
        onBack={() => {
          setSelectedRole(null);
          setSelectedTransferId(null);
          // 메인 화면으로 돌아갈 때 거래 목록 새로고침
          loadMyTransfers(true);
        }}
      />
    );
  }

  // 메인 화면
  return (
    <div className="safetransfer-container"> 
      <div className="safetransfer-header"> 
        {/* <button onClick={onBack} className="back-btn">
          <ArrowLeft size={20} /> 
        </button>   */}

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
          
        <h1 onClick={() => setIsGuideModalOpen(true)}>WorldLand Pay</h1>
  
        <button 
          onClick={handleManualRefresh} 
          className={`refresh-button ${isRefreshing ? 'refreshing' : ''}`}
          disabled={isRefreshing}
        >
          <RefreshCw size={18} />
        </button>
      </div>
        <p className="header-description" style={{ textAlign: 'center', marginTop: '4px' }}>
          지연송금과 담보 기반으로 안전하게 송금하세요. 
        </p> 

        {lastUpdateTime && (
          <div className="last-update-info">
            마지막 업데이트: {lastUpdateTime.toLocaleTimeString('ko-KR')}
          </div>
        )}    

      
        {/* 네트워크 정보 */}
        {network && (
          <div className="safetransfer-network-info">
            <span className="network-badge">{network.name}</span>
            <span className="account-badge">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          </div>
        )}     

      <div className="safetransfer-content"> 
        <div 
          className="safetransfer-new-transfer-card"
          onClick={() => setSelectedRole('sender')}
        >     
                  <h2> 💰  새로운 송금거래 시작하기  🎁</h2>    
        </div>   
      </div>

      <div className="safetransfer-content">  
          <h3>📋 진행 중인 거래 ({myTransfers.length}건)</h3> 

        {loading ? (
          <div className="loading-transfers">
            <p>거래 목록 조회 중...</p>
          </div>
        )  : myTransfers.length > 0 ? (
          <div className="active-transfers-section"> 
            <div className="transfers-list">
              {myTransfers.slice(0, 2).map(transfer => (
                <div 
                  key={transfer.id}
                  className="transfer-item-compact"
                  onClick={() => handleTransferClick(transfer)}
                >
                  {/* 왼쪽: ID와 역할 */}
                      <div className="transfer-left">
                        <span className="transfer-date" style={{width: '60px', fontSize: '11px', color: '#6b7280' }}>
                          {formatDate(transfer.createdAt)}
                        </span>
                        <span 
                          className={`role-badge ${transfer.role === 'sender' ? 'role-sender' : 'role-receiver'}`}
                        >
                          {transfer.role === 'sender' ? '📤Send' : '📩Recv'}
                        </span> 
                      </div>

                      {/* 중앙: 주요 정보 */}
                      <div className="transfer-center">
                        <span className="transfer-amount">
                          {ethers.formatEther(transfer.amount)} WLC
                        </span>
                        <span className="transfer-counterparty">
                          {transfer.role === 'sender' 
                            ? `${transfer.receiver.slice(0, 4)}...${transfer.receiver.slice(-4)}`
                            : `${transfer.sender.slice(0, 4)}...${transfer.sender.slice(-4)}`
                          }
                        </span>
                      </div>

                      {/* 오른쪽: 상태 */}
                      <div className="transfer-right">
                        <span 
                          className="transfer-status-badge"
                          style={{ 
                            backgroundColor: getStatusColor(transfer.status),
                            color: 'white'
                          }}
                        >
                          {getStatusText(transfer.status)}
                        </span>
                      </div>
                </div>
              ))}
            </div>
            
            
          </div>
        ) : <div  
              className="notransfer-item-compact"
              style={{marginBottom: '20px' }}
              >
          진행 중인 거래가 없습니다. "새로운 안심결제 시작하기" 버튼을 눌러 거래를 시작해보세요! 
          </div>
        }

        {/* 진행중인 거래가 2건 이상일 때만 "모두 보기" 버튼 표시 */}
        {myTransfers.length > 2 && (
          <div 
            className="safetransfer-transfer-card"
            onClick={() => setIsActiveModalOpen(true)} 
            style={{ marginTop: '10px', background: 'linear-gradient(135deg, #9df580ff 0%, #2da1e4ff 100%)',
  padding: '10px' }}
          >    
            <h3>진행중인 거래 모두 보기 ({myTransfers.length}건)</h3>
          </div>
        )}

        <div 
          className="safetransfer-transfer-card"
          style={{ background: 'linear-gradient(135deg, #d5d5d9ff 0%, #3f413fff 100%)',
  padding: '10px' }}
          onClick={() => setIsCompletedModalOpen(true)}
        >    
          <h3> 완료된 거래 보기 ({completedTransfers.length}건) </h3>
        </div> 

        <div style={{ 
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontFamily: '"Montserrat", "Helvetica Neue", sans-serif',
          fontSize: '18px',
          fontWeight: '700',
          fontStyle: 'italic',
          color: '#2c3e50',
          letterSpacing: '0.5px',
          lineHeight: '1.6',
          background: 'linear-gradient(90deg, rgba(39, 218, 29, 0.05) 0%, rgba(56, 27, 220, 0.05) 100%)',
          borderLeft: '3px solid #27da1d',
          padding: '0 24px',
          margin: '20px 0'
        }}>
          "Decentralized AI is our future."
        </div> 

     </div>
 

      

      {/* 거래 상세 모달 */}
      {isModalOpen && selectedTransfer && (
        <div className="safetransfer-modal-overlay" onClick={handleCloseModal}>
          <div className="safetransfer-safetransfer-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="safetransfer-modal-header">
              <h3>거래 #{selectedTransfer.id} 상세 정보</h3>
              <button className="safetransfer-modal-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>

            {/* 모달 바디 */}
            <div className="safetransfer-modal-body">
              {/* 거래 ID와 역할 */}
              <div className="safetransfer-modal-section">
                <h4>📊 기본 정보</h4>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">거래 ID:</span>
                  <span className="safetransfer-modal-value">#{selectedTransfer.id}</span>
                </div>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">생성 일시:</span>
                  <span className="safetransfer-modal-value">{formatDate(selectedTransfer.createdAt)}</span>
                </div>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">송신자:</span>
                  <span className="safetransfer-modal-value address">
                    {selectedTransfer.sender.slice(0, 10)}...{selectedTransfer.sender.slice(-8)}
                    {selectedTransfer.role === 'sender' && ' (나)'}
                  </span>
                </div>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">수신자:</span>
                  <span className="safetransfer-modal-value address">
                    {selectedTransfer.receiver.slice(0, 10)}...{selectedTransfer.receiver.slice(-8)}
                    {selectedTransfer.role === 'receiver' && ' (나)'}
                  </span>
                </div>
              </div>

              {/* 금액 정보 */}
              <div className="safetransfer-modal-section">
                <h4>💰 금액 정보</h4>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">송금액:</span>
                  <span className="safetransfer-modal-value highlight">
                    {ethers.formatEther(selectedTransfer.amount)} WLC
                  </span>
                </div>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">송신자 수수료:</span>
                  <span className="safetransfer-modal-value">
                    {ethers.formatEther(selectedTransfer.senderFee)} WLC
                  </span>
                </div>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">수신자 수수료:</span>
                  <span className="safetransfer-modal-value">
                    {ethers.formatEther(selectedTransfer.receiverFee)} WLC
                  </span>
                </div>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">보증금 (수신자):</span>
                  <span className="safetransfer-modal-value">
                    {ethers.formatEther(selectedTransfer.collateral)} WLC
                  </span>
                </div>
                <div className="safetransfer-modal-row total">
                  <span className="safetransfer-modal-label">총 잠금액:</span>
                  <span className="safetransfer-modal-value">
                    {ethers.formatEther(
                      BigInt(selectedTransfer.amount) + 
                      BigInt(selectedTransfer.senderFee) + 
                      BigInt(selectedTransfer.receiverFee) +
                      BigInt(selectedTransfer.collateral)
                    )} WLC
                  </span>
                </div>
              </div>

              {/* 참여자 정보 */}
              <div className="safetransfer-modal-section">
                <h4>👥 참여자 정보</h4>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">송신자:</span>
                  <span className="safetransfer-modal-value address">
                    {selectedTransfer.sender.slice(0, 10)}...{selectedTransfer.sender.slice(-8)}
                    {selectedTransfer.role === 'sender' && ' (나)'}
                  </span>
                </div>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">수신자:</span>
                  <span className="safetransfer-modal-value address">
                    {selectedTransfer.receiver.slice(0, 10)}...{selectedTransfer.receiver.slice(-8)}
                    {selectedTransfer.role === 'receiver' && ' (나)'}
                  </span>
                </div>
              </div>

              {/* 일정 정보 */}
              <div className="safetransfer-modal-section">
                <h4>📅 거래 일정</h4>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">거래 생성:</span>
                  <span className="safetransfer-modal-value">{formatDate(selectedTransfer.createdAt)}</span>
                </div>
                {selectedTransfer.activatedAt && Number(selectedTransfer.activatedAt) > 0 && (
                  <div className="safetransfer-modal-row">
                    <span className="safetransfer-modal-label">거래 활성화:</span>
                    <span className="safetransfer-modal-value">{formatDate(selectedTransfer.activatedAt)}</span>
                  </div>
                )}
                {(selectedTransfer.status === 4 || selectedTransfer.status === 5) && selectedTransfer.activatedAt && Number(selectedTransfer.activatedAt) > 0 && (
                  <div className="safetransfer-modal-row">
                    <span className="safetransfer-modal-label">
                      {selectedTransfer.status === 4 ? '거래 완료:' : '거래 취소:'}
                    </span>
                    <span className="safetransfer-modal-value highlight">
                      {formatDate(selectedTransfer.activatedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* 보증금 정보 */}
              <div className="safetransfer-modal-section">
                <h4>🛡️ 보증금 상태</h4>
                <div className="safetransfer-modal-row">
                  <span className="safetransfer-modal-label">보증금 예치 여부:</span>
                  <span className={`safetransfer-modal-value ${selectedTransfer.collateralDeposited ? 'success' : 'pending'}`}>
                    {selectedTransfer.collateralDeposited ? '✅ 예치 완료' : '⏳ 예치 대기'}
                  </span>
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="safetransfer-modal-footer">
              <button className="safetransfer-modal-btn-secondary" onClick={handleCloseModal}>
                닫기
              </button>
              <button className="safetransfer-modal-btn-primary" onClick={handleContinueTransfer}>
                거래 계속하기 →
              </button>
            </div>
          </div>
        </div>
      )}

      

      {/* 가이드 모달 */}
      {isGuideModalOpen && (
        <div className="safetransfer-modal-overlay" onClick={() => setIsGuideModalOpen(false)}>
          <div className="safetransfer-safetransfer-modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="safetransfer-modal-header">
              <h3>🛡️ 탈중앙화 안심송금 서비스</h3>
              <button className="safetransfer-modal-close" onClick={() => setIsGuideModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="safetransfer-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* 기존 usage-guide 내용 전체를 여기에 이동 */}
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  padding: '4px'
                }}>
                  
                  {/* 서비스 개요 */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '8px',
                    border: '2px solid #3b82f6'
                  }}>
                    <h4 style={{ 
                      color: '#1e40af', 
                      marginBottom: '12px',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}>
                      📌 서비스 개요
                    </h4>
                    <div style={{ 
                      fontSize: '14px', 
                      lineHeight: '1.8',
                      color: '#1e293b'
                    }}>
                      <strong style={{ color: '#3b82f6' }}>탈중앙화 안심송금</strong>은 블록체인 스마트 컨트랙트를 활용하여 
                      송신자와 수신자 간 안전한 거래를 보장하는 서비스입니다. WLC로 물품/서비스를 매수할 때
                      중개자 없이 자동으로 실행되는 안심결제 시스템으로, 
                      양측 모두의 이익을 보호합니다.
                    </div>
                  </div>

                  {/* 주요 특징 */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#fefce8',
                    borderRadius: '8px',
                    border: '2px solid #eab308'
                  }}>
                    <h4 style={{ 
                      color: '#854d0e', 
                      marginBottom: '12px',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}>
                      ✨ 주요 특징
                    </h4>
                    <ul style={{ 
                      margin: '0',
                      paddingLeft: '20px',
                      fontSize: '14px',
                      lineHeight: '1.8'
                    }}>
                      <li><strong>양방향 보증금:</strong> 송신자와 수신자 모두 보증금 예치. </li>
                      <li><strong>2단계 기간:</strong> 안전기간(사기의심시 송신자가 일방취소 가능) → 확정기간(상호합의 필요)</li>
                      <li><strong>분쟁 해결:</strong> 타협안 제시 및 비율 분할 기능</li>
                      <li><strong>자동 실행:</strong> 스마트 컨트랙트로 투명하고 신뢰성 있는 처리</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="safetransfer-modal-footer">
              <button 
                className="safetransfer-modal-btn-primary" 
                onClick={() => setIsGuideModalOpen(false)}
                style={{ flex: '1' }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 완료된 거래 모달 */}
      {isCompletedModalOpen && (
        <div className="safetransfer-modal-overlay" onClick={() => setIsCompletedModalOpen(false)}>
          <div className="safetransfer-safetransfer-modal-content" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="safetransfer-modal-header">
              <h3>📋 완료된 거래 목록</h3>
              <button className="safetransfer-modal-close" onClick={() => setIsCompletedModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="safetransfer-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px' }}>
              <div className="completed-transfers-list">
                {completedTransfers.map((transfer) => (
                  <div 
                    key={transfer.id} 
                    className="transfer-item-compact"
                    onClick={() => {
                      setIsCompletedModalOpen(false);
                      handleTransferClick(transfer);
                    }}
                    style={{ 
                      cursor: 'pointer',
                      marginBottom: '8px'
                    }}
                  >
                    {/* 왼쪽: ID와 역할 */}
                    <div className="transfer-left">
                      {/* <span className="transfer-id">#{transfer.id}</span> */}
                       <span className="transfer-date" style={{width: '60px', fontSize: '11px', color: '#6b7280' }}>
                        {formatDate(transfer.createdAt)}
                      </span>
                      <span 
                        className={`role-badge ${transfer.role === 'sender' ? 'role-sender' : 'role-receiver'}`}
                      >
                        {transfer.role === 'sender' ? '📤Send' : '📩Recv'}
                      </span> 
                     
                    </div>

                    {/* 중앙: 주요 정보 */}
                    <div className="transfer-center">
                      <span className="transfer-amount">
                        {ethers.formatEther(transfer.amount)} WLC
                      </span>
                      <span className="transfer-counterparty">
                        {transfer.role === 'sender' 
                          ? `${transfer.receiver.slice(0, 4)}...${transfer.receiver.slice(-4)}`
                          : `${transfer.sender.slice(0, 4)}...${transfer.sender.slice(-4)}`
                        }
                      </span>
                      
                    </div>

                    {/* 오른쪽: 상태 */}
                    <div className="transfer-right">
                      <span 
                        className="transfer-status-badge"
                        style={{ 
                          backgroundColor: getStatusColor(transfer.status),
                          color: 'white'
                        }}
                      >
                        {getStatusText(transfer.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="safetransfer-modal-footer">
              <button 
                className="safetransfer-modal-btn-primary" 
                onClick={() => setIsCompletedModalOpen(false)}
                style={{ flex: '1' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 진행중인 거래 모달 */}
      {isActiveModalOpen && (
        <div className="safetransfer-modal-overlay" onClick={() => setIsActiveModalOpen(false)}>
          <div className="safetransfer-safetransfer-modal-content" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="safetransfer-modal-header">
              <h3>📋 진행중인 거래 목록</h3>
              <button className="safetransfer-modal-close" onClick={() => setIsActiveModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="safetransfer-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px' }}>
              <div className="completed-transfers-list">
                {myTransfers.map((transfer) => (
                  <div 
                    key={transfer.id} 
                    className="transfer-item-compact"
                    onClick={() => {
                      setIsActiveModalOpen(false);
                      handleTransferClick(transfer);
                    }}
                    style={{ 
                      cursor: 'pointer',
                      marginBottom: '8px'
                    }}
                  >
                    {/* 왼쪽: ID와 역할 */}
                    <div className="transfer-left">
                      <span className="transfer-date" style={{width: '60px', fontSize: '11px', color: '#6b7280' }}>
                        {formatDate(transfer.createdAt)}
                      </span>
                      <span 
                        className={`role-badge ${transfer.role === 'sender' ? 'role-sender' : 'role-receiver'}`}
                      >
                        {transfer.role === 'sender' ? '📤Send' : '📩Recv'}
                      </span> 
                    </div>

                    {/* 중앙: 주요 정보 */}
                    <div className="transfer-center">
                      <span className="transfer-amount">
                        {ethers.formatEther(transfer.amount)} WLC
                      </span>
                      <span className="transfer-counterparty">
                        {transfer.role === 'sender' 
                          ? `${transfer.receiver.slice(0, 4)}...${transfer.receiver.slice(-4)}`
                          : `${transfer.sender.slice(0, 4)}...${transfer.sender.slice(-4)}`
                        }
                      </span>
                    </div>

                    {/* 오른쪽: 상태 */}
                    <div className="transfer-right">
                      <span 
                        className="transfer-status-badge"
                        style={{ 
                          backgroundColor: getStatusColor(transfer.status),
                          color: 'white'
                        }}
                      >
                        {getStatusText(transfer.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="safetransfer-modal-footer">
              <button 
                className="safetransfer-modal-btn-primary" 
                onClick={() => setIsActiveModalOpen(false)}
                style={{ flex: '1' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div> 
  );
};

export default SafeTransfer;