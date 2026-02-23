// src/components/Dapp.js
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
import{ useTranslation }from'../hooks/useTranslation';
import NFTGallery from './NFTGallery';
import MyNFT from './MyNFT';
import SafeTransferHome from './SafeTransfer/SafeTransferHome';
import './Dapp.css';
import './common.css';

const Dapp = ({ onBack, network, account, walletData }) => {  // walletData prop 추가
  const{ t }=useTranslation();
  const [selectedService, setSelectedService] = useState(null);
  const [whitelist, setWhitelist] = useState([]); // 👈 이 줄 추가

  // WorldLand Pay 서비스 사용 가능한 화이트리스트 주소
  // const WORLDLAND_PAY_WHITELIST = [
  //   '0xeA523CFF72a3De73E9183e3D6c58717463043867',
  //   '0x53A95469117E2e2041be9711C8BA1AbC7f3b972A',
  //   // '0x5ae0F47AEED01bf634d66D82E2CdA3cc1Bb93020',
  //   '0xb774b42F85e9AaFcd847f9F879606235ce3acd89',
  //   '0xb774b42F85e9AaFcd847f9F879606235ce3acd89',
  //   '0xefCc141fe3Da4a85Faf4502655C6f8DFa7a3425e',
  //   // 필요한 주소를 여기에 추가하세요 (소문자로 통일)
  // ].map(addr => addr.toLowerCase());

  // JSON 파일에서 화이트리스트 로드
  useEffect(() => {
    fetch('/worldland_pay_whitelist.json')
      .then(response => response.json())
      .then(data => {
        const normalizedList = data.whitelist.map(addr => addr.toLowerCase());
        setWhitelist(normalizedList);
        consolelog('✅ 화이트리스트 로드 완료:', normalizedList);
      })
      .catch(error => {
        consoleerror('❌ 화이트리스트 로드 실패:', error);
        setWhitelist([]); // 실패 시 빈 배열
      });
  }, []);

  // 현재 계정이 WorldLand Pay를 사용할 수 있는지 확인
  const canUseWorldLandPay = account && whitelist.includes(account.toLowerCase());
  // const canUseWorldLandPay = true;


  const dappServices = [
    {
      id: 'nft-gallery',
      title: 'NFT Gallery',
      description: 'WorldLand 블록체인의 NFT 컬렉션 조회',
      icon: '🖼️',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
      id: 'my-nft',
      title: 'My NFT',
      description: 'My NFT 조회',
      icon: '🎨',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
      id: 'safe-transfer',
      title: 'WorldLand Pay',
      description: 'WorldLand의 탈중앙 P2P 안심송금서비스입니다. 지연송금과 담보 요구 기능으로 안전한 송금을 지원합니다. RWA/NFT/서비스를 구입하고 대금을 지불하는 용도로 사용할 수 있습니다.',
      icon: '🛡️',
      backgroundImage: '/images/worldlandpay_cardimage0.png',
      gradient: 'linear-gradient(135deg, rgba(39, 218, 29, 0.8) 0%, rgba(56, 27, 220, 0.8) 100%)' // 반투명 그라데이션
    }
  ];

  useEffect(() => {
    if (!account || account.toLowerCase() === '0x0000000000000000000000000000000000000000') {
      consolewarn('⚠️ 유효하지 않은 계정 주소. WalletMain.js로 돌아갑니다.');
      onBack();
      return;
    }

    console.log('network: ', network);

    // 네트워크가 WorldLand가 아닌 경우 체크
    if (network.name !== 'WorldLand Mainnet') {
      alert('⚠️ WorldLand Mainnet으로 전환해주세요.');
      onBack();
    }
  }, [account, network, onBack]);

  // 서비스 선택 핸들러
  const handleSelectService = (serviceId) => {
    // WorldLand Pay 접근 제어
    if (serviceId === 'safe-transfer' && !canUseWorldLandPay) {
      alert('⚠️ WorldLand Pay 서비스는 승인된 지갑 주소만 이용할 수 있습니다.');
      return;
    }
    setSelectedService(serviceId);
  };

  // DApp 내부에서 뒤로가기 (서비스 목록으로)
  const handleBackToServices = () => {
    setSelectedService(null);
  };

  // NFT Gallery 렌더링
  if (selectedService === 'nft-gallery') {
    return (
      <NFTGallery
        account={account}
        network={network}
        onBack={handleBackToServices}
      />
    );
  }

  // My NFT 렌더링
  if (selectedService === 'my-nft') {
    return (
      <MyNFT
        account={account}
        network={network}
        walletData={walletData}  // walletData 전달
        onBack={handleBackToServices}
      />
    );
  }

  //  SafeTransferHome 렌더링 로직  
  if (selectedService === 'safe-transfer') {
    return (
      <SafeTransferHome
        account={account}
        network={network}
        walletData={walletData}  // walletData 전달
        onBack={handleBackToServices}
      />
    );
  }

  // DApp 서비스 목록 (기본 화면)
  return (
    <div className="dapp-container">
      <div className="common-header">
        {/* <ChevronLeft size={24} onClick={onBack} style={{cursor: 'pointer'}} /> */}
        {/* <button className="back-button" onClick={onBack}>
          🏠
        </button> */}
        <button 
            className="action-btn"
            onClick={onBack}
            title={t('WalletList.goHome')}
          >
            {t('WalletList.backHome')}
          </button>

        <h1>DApp Services</h1>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p>WorldLand 블록체인의 다양한 서비스를 이용해보세요</p>
      </div>
      {network && (
        <div className="dapp-network-info">
          <span className="network-badge">{network.name}</span>
        </div>
      )}

      <div className="dapp-grid" style={{ marginTop: '20px', gap: '20px' }}>
        {dappServices.map(service => {
          const isLocked = service.id === 'safe-transfer' && !canUseWorldLandPay;
          return (
            <div
              key={service.id}
              className="dapp-card"
              onClick={() => handleSelectService(service.id)}
              style={{
                background: service.backgroundImage
                  ? `${service.gradient}, url(${service.backgroundImage})`
                  : service.gradient,
                backgroundSize: service.backgroundImage ? 'cover' : 'auto',
                backgroundPosition: service.backgroundImage ? 'center center' : 'initial',
                backgroundRepeat: service.backgroundImage ? 'no-repeat' : 'initial',
                backgroundBlendMode: service.backgroundImage ? 'overlay' : 'normal',
                opacity: isLocked ? 0.6 : 1,
                cursor: isLocked ? 'not-allowed' : 'pointer'
              }}
            >
              {/* <div className="dapp-card-icon">
                <span style={{ fontSize: '48px' }}>{service.icon}</span>
              </div> */}
              <div className="dapp-card-content">
                <h3>
                  {service.icon} {service.title}
                  {isLocked && ' 🔒'}
                </h3>
                <p>{service.description}</p>
                {isLocked && (
                  <p style={{ color: '#ffeb3b', fontSize: '0.9em', marginTop: '8px' }}>
                    ⚠️ 승인된 지갑만 이용 가능
                  </p>
                )}
              </div>
              {/* <div className="dapp-card-arrow">→</div> */}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dapp;