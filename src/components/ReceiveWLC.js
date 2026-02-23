// src/components/ReceiveWLC.js
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import{ useTranslation }from'../hooks/useTranslation';
import { ArrowDownToLine, Copy, QrCode, Share, CheckCircle, Download } from 'lucide-react';
import QRCode from 'qrcode';
import './ReceiveWLC.css';

const ReceiveWLC = ({ address, network }) => {
  const{ t }=useTranslation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [showPaymentRequest, setShowPaymentRequest] = useState(false);
  const [copied, setCopied] = useState('');

  // QR 코드 생성
  useEffect(() => {
    generateQRCode();
  }, [address, paymentAmount, paymentDescription]);

  const generateQRCode = async () => {
    try {
      let qrData = address;
      
      // 결제 요청이 있는 경우 추가 정보 포함
      if (showPaymentRequest && (paymentAmount || paymentDescription)) {
        const paymentData = {
          address: address,
          amount: paymentAmount || undefined,
          description: paymentDescription || undefined,
          network: network.name,
          chainId: network.chainId
        };
        qrData = JSON.stringify(paymentData);
      }

      const qrCodeUrl = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeDataUrl(qrCodeUrl);
    } catch (error) {
      consoleerror(t('ReceiveWLC.generateQRCodeFailed'), error);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
    } catch (error) {
      consoleerror(t('ReceiveWLC.copyFailed'), error);
    }
  };

  const shareAddress = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('ReceiveWLC.worldlandWalletAddress'),
          text: `${t('ReceiveWLC.receiveWLCAddressText')} ${address}`,
          url: `${network.explorer}/address/${address}`
        });
      } catch (error) {
        consoleerror(t('ReceiveWLC.shareFailed'), error);
        copyToClipboard(address, 'address');
      }
    } else {
      copyToClipboard(address, 'address');
    }
  };

  // QR 코드 다운로드 함수
  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    try {
      // 임시 링크 요소 생성
      const link = document.createElement('a');
      link.href = qrCodeDataUrl;
      link.download = `worldland-wallet-${formatAddress(address)}.png`;
      
      // 문서에 추가하고 클릭
      document.body.appendChild(link);
      link.click();
      
      // 정리
      document.body.removeChild(link);
      
      // 성공 피드백
      setCopied('qr-download');
      setTimeout(() => setCopied(''), 2000);
    } catch (error) {
      consoleerror('QR code download failed:', error);
    }
  };

  // QR 코드 클립보드 복사 함수
  const copyQRCodeToClipboard = async () => {
    if (!qrCodeDataUrl) return;
    
    try {
      // base64를 blob으로 변환
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();
      
      // 클립보드에 복사
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      
      // 성공 피드백
      setCopied('qr-copy');
      setTimeout(() => setCopied(''), 2000);
    } catch (error) {
      consoleerror('QR code copy failed:', error);
      // 대체 방법: 주소를 텍스트로 복사
      copyToClipboard(address, 'address');
    }
  };

  const generatePaymentLink = () => {
    const paymentData = {
      to: address,
      amount: paymentAmount,
      description: paymentDescription,
      network: network.chainId
    };
    
    const params = new URLSearchParams();
    Object.entries(paymentData).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    return `worldland://pay?${params.toString()}`;
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="receive-wlc">
      <div className="receive-header">
        <ArrowDownToLine size={24} />
        <h2>{t('ReceiveWLC.receiveWLC')}</h2>
      </div>

      {/* QR 코드 섹션 */}
      <div className="qr-section">
        <div className="qr-container">
          {qrCodeDataUrl ? (
            <img src={qrCodeDataUrl} alt="QR Code" className="qr-code" />
          ) : (
            <div className="qr-placeholder">
              <QrCode size={48} />
              <p>{t('ReceiveWLC.generatingQRCode')}</p>
            </div>
          )}
        </div>
        
        <div className="qr-description">
          {t('ReceiveWLC.scanQRCodeToSend')}
        </div>

        {/* QR 코드 액션 버튼 */}
        {qrCodeDataUrl && (
          <div className="qr-actions">
            <button 
              className={`qr-action-button ${copied === 'qr-download' ? 'copied' : ''}`}
              onClick={downloadQRCode}
            >
              {copied === 'qr-download' ? (
                <>
                  <CheckCircle size={16} />
                  {t('ReceiveWLC.qrCodeDownloaded')}
                </>
              ) : (
                <>
                  <Download size={16} />
                  {t('ReceiveWLC.downloadQRCode')}
                </>
              )}
            </button>
            
            <button 
              className={`qr-action-button ${copied === 'qr-copy' ? 'copied' : ''}`}
              onClick={copyQRCodeToClipboard}
            >
              {copied === 'qr-copy' ? (
                <>
                  <CheckCircle size={16} />
                  {t('ReceiveWLC.qrCodeCopied')}
                </>
              ) : (
                <>
                  <Copy size={16} />
                  {t('ReceiveWLC.copyQRCode')}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 주소 정보 */}
      <div className="address-section">
        <div className="section-header">
          <h3>{t('ReceiveWLC.walletAddress')}</h3>
          <div className="address-actions">
            <button 
              className={`action-button ${copied === 'address' ? 'copied' : ''}`}
              onClick={() => copyToClipboard(address, 'address')}
            >
              {copied === 'address' ? (
                <>
                  <CheckCircle size={16} />
                  {t('ReceiveWLC.copied')}
                </>
              ) : (
                <>
                  <Copy size={16} />
                  {t('ReceiveWLC.copy')}
                </>
              )}
            </button>
            <button 
              className="action-button"
              onClick={shareAddress}
            >
              <Share size={16} />
              {t('ReceiveWLC.share')}
            </button>
          </div>
        </div>
        
        <div className="address-display">
          <div className="address-full">{address}</div>
          <div className="address-short">{formatAddress(address)}</div>
        </div>
      </div>

      

      {/* 결제 요청 섹션 */}
      <div className="payment-request-section">
        <div className="section-header">
          <h3>{t('ReceiveWLC.createPaymentRequest')}</h3>
          <button 
            className="toggle-button"
            onClick={() => setShowPaymentRequest(!showPaymentRequest)}
          >
            {showPaymentRequest ? t('ReceiveWLC.hide') : t('ReceiveWLC.show')}
          </button>
        </div>

        {showPaymentRequest && (
          <div className="payment-request-form">
            <div className="form-group">
              <label>{t('ReceiveWLC.requestAmountOptional')}</label>
              <div className="amount-input">
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  min="0"
                />
                <span className="currency">WLC</span>
              </div>
            </div>

            <div className="form-group">
              <label>{t('ReceiveWLC.descriptionOptional')}</label>
              <input
                type="text"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder={t('ReceiveWLC.enterPaymentPurpose')}
                maxLength={100}
              />
            </div>

            {(paymentAmount || paymentDescription) && (
              <div className="payment-preview">
                <h4>{t('ReceiveWLC.paymentRequestInfo')}</h4>
                {paymentAmount && (
                  <div className="preview-item">
                    <span>{t('ReceiveWLC.amount')}</span>
                    <span>{paymentAmount} WLC</span>
                  </div>
                )}
                {paymentDescription && (
                  <div className="preview-item">
                    <span>{t('ReceiveWLC.description')}</span>
                    <span>{paymentDescription}</span>
                  </div>
                )}
                
                <button 
                  className={`copy-link-button ${copied === 'link' ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(generatePaymentLink(), 'link')}
                >
                  {copied === 'link' ? (
                    <>
                      <CheckCircle size={16} />
                      {t('ReceiveWLC.linkCopied')}
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      {t('ReceiveWLC.copyPaymentLink')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 주의사항 */}
      <div className="warning-section">
        <div className="warning-box">
          <h4>{t('ReceiveWLC.warning')}</h4>
          <ul>
            <li>{t('ReceiveWLC.warningNetworkOnly').replace('{network}', network.name)}</li>
            <li>{t('ReceiveWLC.warningOtherNetwork')}</li>
            <li>{t('ReceiveWLC.warningVerifyAddress')}</li>
            <li>{t('ReceiveWLC.warningTestSmallAmount')}</li>
          </ul>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="quick-actions">
        <button 
          className="quick-action-button"
          onClick={() => window.open(`${network.explorer}/address/${address}`, '_blank')}
        >
          {t('ReceiveWLC.viewOnBlockchainExplorer')}
        </button>
        
        <button 
          className="quick-action-button"
          onClick={() => copyToClipboard(`${network.explorer}/address/${address}`, 'explorer')}
        >
          {copied === 'explorer' ? t('ReceiveWLC.explorerLinkCopied') : t('ReceiveWLC.copyExplorerLink')}
        </button>
      </div>
    </div>
  );
};

export default ReceiveWLC;