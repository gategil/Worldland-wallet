// src/components/SafeTransfer.js - 역할 선택 화면 및 메인 라우터
import React, { useState, useEffect } from 'react'; 
import { ArrowLeft, Send, DollarSign, Copy } from 'lucide-react'; 
// 분리된 컴포넌트 임포트
import CreateTransferForm from './SafeTransfer/CreateTransferForm'; 
import ReceiveTransferManager from './SafeTransfer/ReceiveTransferManager';
import './SendTransaction.css'; // 공통 스타일

// ✅ 유틸리티: 지갑 주소를 짧게 표시 (앞 6글자 + ... + 뒤 4글자)
const shortenAddress = (addr) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// 💡 새로운 Prop: account, network 추가
const SafeTransfer = ({ account, network, walletData, selectedAsset, onSuccess, onBack }) => {
    const [mode, setMode] = useState('select'); 
    const [copyMessage, setCopyMessage] = useState('');

    // ✅ 지갑 주소 추출: Dapp.js에서 받은 account Prop을 최우선으로 사용
    const senderAddress = account || walletData?.account || '';
    
    // ✅ 네트워크 정보 추출: Dapp.js에서 받은 network Prop을 최우선으로 사용
    const networkName = network?.name 
                        || walletData?.network?.name 
                        || '연결되지 않음';
    
    const chainId = network?.chainId 
                    || walletData?.network?.chainId 
                    || null;

    // 💡 디버깅용 useEffect 유지
    useEffect(() => {
        if (senderAddress) {
            console.log("✅ SafeTransfer.js: 지갑 주소 확인:", senderAddress);
        }
        if (networkName !== '연결되지 않음') {
            console.log("🌐 SafeTransfer.js: 연결된 네트워크 (추출 값):", networkName, `(ID: ${chainId})`);
        } else {
             console.log("SafeTransfer.js: 지갑 데이터(account/network) 미수신 또는 연결되지 않음");
        }
    }, [senderAddress, networkName, chainId]);
    
    // ✅ 핸들러: 주소 복사 기능
    const handleCopy = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopyMessage('주소 복사 완료!');
            setTimeout(() => setCopyMessage(''), 2000);
        }).catch(err => {
            console.error('복사 실패:', err);
            setCopyMessage('복사 실패!');
            setTimeout(() => setCopyMessage(''), 2000);
        });
    };

    const handleBackToServices = () => { onBack(); };
    const handleBackToSelect = () => { setMode('select'); };

    if (mode === 'sender') {
        return (
            <CreateTransferForm 
                // ✅ account와 network를 하위 컴포넌트에 명시적으로 전달
                account={senderAddress} 
                network={network}
                
                walletData={walletData} // 기존 walletData는 필요 시 유지
                selectedAsset={selectedAsset}
                onBack={handleBackToSelect}
                onTransferCreated={handleBackToSelect} 
            />
        );
    }

    if (mode === 'receiver') {
        return (
            <ReceiveTransferManager 
                // ✅ account와 network를 하위 컴포넌트에 명시적으로 전달
                account={senderAddress}
                network={network}
                
                walletData={walletData} // 기존 walletData는 필요 시 유지
                onBack={handleBackToSelect}
            />
        );
    }

    // 역할 선택 화면 (UI 부분은 이전 개선 코드와 동일)
    return (
        <div className="send-transaction">
            <div className="send-header">
                <button onClick={handleBackToServices} className="back-button">
                    <ArrowLeft size={20} /> 서비스 목록으로
                </button>
                <h2>🔒 안전 송금 서비스</h2>
            </div>
            
            {/* ✅ 네트워크 및 지갑 주소 정보 표시 영역 */}
            <div className="wallet-info-display" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                marginBottom: '40px',
                padding: '15px',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--background-color-dark)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                {/* 네트워크 이름 */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="network-badge" style={{ 
                        marginRight: '10px', 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold',
                        background: '#3498db', 
                        color: 'white'
                    }}>
                        {networkName}
                    </span>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-color)' }}>
                        연결된 네트워크 {chainId && `(ID: ${chainId})`} 
                    </strong>
                </div>

                {/* 지갑 주소 및 복사 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                        fontSize: '0.9rem', 
                        color: 'var(--text-color-secondary)',
                        fontFamily: 'monospace'
                    }}>
                        {shortenAddress(senderAddress) || '지갑 주소 불러오는 중...'}
                    </span>
                    {senderAddress && (
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleCopy(senderAddress); }}
                            style={{ 
                                marginLeft: '8px', 
                                cursor: 'pointer', 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--primary-color)',
                                display: 'flex',
                                padding: '0'
                            }}
                            title="지갑 주소 복사"
                        >
                            <Copy size={16} />
                        </button>
                    )}
                </div>
                {copyMessage && (
                    <span style={{ fontSize: '0.8rem', color: '#27ae60', marginTop: '5px' }}>
                        {copyMessage}
                    </span>
                )}
            </div>
            
            {/* ... (나머지 역할 선택 UI) ... */}
            <p className="description-text" style={{ 
                textAlign: 'center', 
                marginBottom: '40px', 
                color: 'var(--text-color-secondary)' 
            }}>
                송금자와 수신자 모두를 보호하는 양방향 담보 기반 에스크로 시스템입니다.
            </p>

            <h3 style={{ marginBottom: '20px' }}>역할 선택</h3>
            <div className="dapp-grid" style={{ 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginTop: '30px'
            }}>
                {/* 송금자 카드 (A의 역할) */}
                <div 
                    className="dapp-card" 
                    onClick={() => setMode('sender')}
                    style={{ background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)', cursor: 'pointer' }}
                >
                    <div className="dapp-card-icon"><Send size={48} color="white" /></div>
                    <div className="dapp-card-content">
                        <h3>송금자 (A) 절차</h3>
                        <p>새로운 안전송금 거래를 생성하고 자금을 예치합니다.</p>
                    </div>
                </div>

                {/* 수신자 카드 (B의 역할) */}
                <div 
                    className="dapp-card" 
                    onClick={() => setMode('receiver')}
                    style={{ background: 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)', cursor: 'pointer' }}
                >
                    <div className="dapp-card-icon"><DollarSign size={48} color="white" /></div>
                    <div className="dapp-card-content">
                        <h3>수신자 (B) 절차</h3>
                        <p>거래를 조회하고, 보증금 입금, 확정, 취소 등의 절차를 진행합니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SafeTransfer;