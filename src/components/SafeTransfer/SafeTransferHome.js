// src/components/SafeTransfer/SafeTransferHome.js
import React from 'react';
import {ChevronLeft, X } from 'lucide-react';
import SafeTransfer from './SafeTransfer';
import '../common.css';
import './SafeTransferHome.css';
import {WorldlandLogoIcon} from '../../utils/WorldlandLogoIcon.js';


const SafeTransferHome = ({ account, network, walletData, onBack }) => {
  const [showSafeTransfer, setShowSafeTransfer] = React.useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = React.useState(false);

  // SafeTransfer로 이동
  const handleGoToSafeTransfer = () => {
    setShowSafeTransfer(true);
  };

  // SafeTransferHome으로 돌아가기
  const handleBackToHome = () => {
    setShowSafeTransfer(false);
  };

  // SafeTransfer 화면이 활성화되면 SafeTransfer 컴포넌트 렌더링
  if (showSafeTransfer) {
    return (
      <SafeTransfer
        account={account}
        network={network}
        walletData={walletData}
        onBack={handleBackToHome}
      />
    );
  }

  // SafeTransferHome 기본 화면
  return (
    <div className="safetransfer-home-container">
      <div className="common-header">
        {/* <button className="back-button" onClick={onBack}>
          ← 뒤로
        </button> */}
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
        
        <h1> WorldLand Pay</h1>
      </div>

      <div className="safetransfer-home-content">
        <div className="safetransfer-home-banner">
          <h2><WorldlandLogoIcon size={32} /> P2P 안심송금 서비스</h2>
          <p>지연송금과 담보 요구 기반의 탈중앙화 안심송금 시스템</p>
        </div>

        <div className="safetransfer-home-description">
          <h3>WorldLand Pay란?</h3>
          <p>
            WorldLand Pay는 지연송금 시간 설정과 수신자에 보증금 예치를 요구할 수 있는 P2P 안심송금 서비스로, 안전하고 투명한 거래를 지원합니다. 0.1% 수수료가 수신자에게 부담됩니다.
          </p>
           
            
            {/* 이미지 추가 */} 
              <img 
                src="/images/worldlandpay_familyimage2.png" 
                alt="월드랜드 블록체인의 안심결제 서비스를 이용해보세요!"
                onClick={() => setIsGuideModalOpen(true)}
                style={{ 
                  // maxWidth: '300px',
                  width: '100%',
                  height: 'auto',
                  opacity: '1'
                }}
              /> 
 
          </div> 

        <div 
          className="safetransfer-container-card"
          onClick={handleGoToSafeTransfer}
          style={{justifyContent: 'center'}}
        > 
            <h3>🚀 WorldLand Pay 시작하기</h3>  
        </div>

        
      </div>

      {/* 가이드 모달 */}
      {isGuideModalOpen && (
        <div className="safetransfer-modal-overlay" onClick={() => setIsGuideModalOpen(false)}>
          <div className="safetransfer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="safetransfer-modal-header">
              <h3>📖 WorldLand Pay 가이드</h3>
              <button className="safetransfer-modal-close" onClick={() => setIsGuideModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="safetransfer-modal-body">
              <div style={{
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <h4 style={{ 
                  marginTop: '0',
                  marginBottom: '12px',
                  color: '#1f2937',
                  fontSize: '16px'
                }}>
                  💡 WorldLand Pay란?
                </h4>
                <p style={{ 
                  margin: '0',
                  color: '#6b7280',
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  WorldLand Pay는 구매자와 판매자 모두가 보증금을 예치하는 양방향 담보 시스템으로, 
                  안전하고 투명한 거래를 보장합니다. 스마트 컨트랙트를 통해 자동으로 실행되며, 
                  분쟁 발생 시에도 공정한 해결 방안을 제공합니다.
                </p>
                
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ 
                    marginTop: '16px',
                    marginBottom: '8px',
                    color: '#1f2937',
                    fontSize: '14px'
                  }}>
                    ✨ 주요 특징
                  </h4>
                  <ul style={{ 
                    margin: '0',
                    paddingLeft: '20px',
                    fontSize: '14px',
                    lineHeight: '1.8'
                  }}>
                    <li><strong>양방향 보증금:</strong> 송신자와 수신자 모두 보증금 예치</li>
                    <li><strong>2단계 기간:</strong> 안전기간(사기의심시 송신자가 일방취소 가능) → 확정기간(상호합의 필요)</li>
                    <li><strong>분쟁 해결:</strong> 타협안 제시 및 비율 분할 기능</li>
                    <li><strong>자동 실행:</strong> 스마트 컨트랙트로 투명하고 신뢰성 있는 처리</li>
                  </ul>

                  <h4 style={{ 
                    marginTop: '16px',
                    marginBottom: '8px',
                    color: '#1f2937',
                    fontSize: '14px'
                  }}>✨ 거래 프로세스</h4>
                  <ul style={{ 
                    margin: '0',
                    paddingLeft: '20px',
                    fontSize: '14px',
                    lineHeight: '1.8'
                  }}>
                    <li>판매자가 거래 생성 및 보증금 예치</li>
                    <li>구매자가 거래 참여 및 보증금 예치</li>
                    <li>거래 조건 확인 및 안전 기간</li>
                    <li>거래 완료 확인 및 정산</li>
                  </ul> 
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
    </div>
  );
};

export default SafeTransferHome;