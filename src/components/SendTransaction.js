// src/components/SendTransaction.js - 다중 토큰 지원 버전 (다국어 적용)
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import{ useTranslation }from'../hooks/useTranslation';
import { Send, AlertCircle, CheckCircle, Loader, Calculator, QrCode } from 'lucide-react';
import { walletService } from '../services/walletService';
import { GAS_PRICES } from '../services/networkConfig';
import QrScanner from './QrScanner';
import './SendTransaction.css';
import '../App.css';

const SendTransaction = ({ walletData, selectedAsset, onSuccess, onBack, network }) => {
  const{ t }=useTranslation();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [gasPrice, setGasPrice] = useState(GAS_PRICES.standard);
  const [customGasPrice, setCustomGasPrice] = useState('');
  const [gasPriceMode, setGasPriceMode] = useState('standard'); // 'slow', 'standard', 'fast', 'custom'
  const [estimatedFee, setEstimatedFee] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);

  // 현재 선택된 자산이 토큰인지 확인
  const isToken = selectedAsset && selectedAsset.type !== 'native';
  const currentBalance = selectedAsset?.balance || '0';

  // 수수료 추정
  useEffect(() => {
    if (recipient && amount && walletService.isValidAddress(recipient)) {
      estimateFee();
    }
  }, [recipient, amount, gasPrice, selectedAsset]);

  // 가스 가격 변경 시
  useEffect(() => {
    if (gasPriceMode === 'custom') {
      setGasPrice(customGasPrice || GAS_PRICES.standard);
    } else {
      setGasPrice(GAS_PRICES[gasPriceMode]);
    }
  }, [gasPriceMode, customGasPrice]);

  const estimateFee = async () => {
    if (!recipient || !amount || !walletService.isValidAddress(recipient)) return;
    
    setIsEstimating(true);
    try {
      let result;
      
      if (isToken) {
        // 토큰 전송 수수료 추정
        result = await walletService.estimateTokenTransactionFee(
          selectedAsset.address, 
          recipient, 
          amount, 
          gasPrice
        );
      } else {
        // 네이티브 토큰 전송 수수료 추정
        result = await walletService.estimateTransactionFee(recipient, amount, gasPrice);
      }
      
      if (result.success) {
        setEstimatedFee(result.fee);
      }
    } catch (error) {
      consoleerror('Fee estimation error:', error);
    } finally {
      setIsEstimating(false);
    }
  };

  const validateInputs = () => {
    if (!recipient.trim()) {
      return t('SendTransaction.enterRecipientAddress');
    }

    if (!walletService.isValidAddress(recipient)) {
      return t('SendTransaction.invalidAddressFormat');
    }

    if (!amount || parseFloat(amount) <= 0) {
      return t('SendTransaction.enterAmountToSend');
    }

    const sendAmount = parseFloat(amount);
    const availableBalance = parseFloat(currentBalance);

    if (sendAmount > availableBalance) {
      return t('SendTransaction.insufficientBalance');
    }

    // 네이티브 토큰의 경우 수수료도 고려
    if (!isToken) {
      const totalNeeded = sendAmount + parseFloat(estimatedFee || '0');
      if (totalNeeded > availableBalance) {
        return t('SendTransaction.feeIncludeRequired');
      }
    }

    if (recipient.toLowerCase() === walletData.address.toLowerCase()) {
      return t('SendTransaction.cannotSendToSelf');
    }

    return null;
  };

  const handleSend = async () => {
    setError('');
    setSuccess('');

    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    const assetName = isToken ? selectedAsset.symbol : 'WLC';
    const confirmMessage = `
      ${t('SendTransaction.asset')}: ${assetName}
      ${t('SendTransaction.recipientAddress')}: ${recipient}
      ${t('SendTransaction.amountToSend')}: ${amount} ${assetName}
      ${t('SendTransaction.estimatedFee')}: ${estimatedFee} ${network.symbol}
      
      ${t('SendTransaction.confirmSend')}
    `;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsLoading(true);
    try {
      let result;
      
      if (isToken) {
        // ERC-20 토큰 전송
        result = await walletService.sendToken(
          walletData.privateKey,
          selectedAsset.address,
          recipient,
          amount,
          gasPrice
        );
      } else {
        // 네이티브 토큰 전송
        result = await walletService.sendTransaction(
          walletData.privateKey,
          recipient,
          amount,
          gasPrice
        );
      }

      if (result.success) {
        setSuccess(`${t('SendTransaction.sendCompleted')}\n${t('SendTransaction.transactionHash')}: ${result.hash}`);
        
        // 폼 초기화
        setRecipient('');
        setAmount('');
        setEstimatedFee('0');
        
        // 부모 컴포넌트에 성공 알림
        setTimeout(() => {
          onSuccess && onSuccess(result);
        }, 2000);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(t('SendTransaction.sendError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxAmount = () => {
    if (isToken) {
      // 토큰의 경우 전체 잔액 사용 가능
      setAmount(currentBalance);
    } else {
      // 네이티브 토큰의 경우 수수료 제외
      const maxAmount = Math.max(0, parseFloat(currentBalance) - parseFloat(estimatedFee || '0.001'));
      setAmount(maxAmount.toFixed(6));
    }
  };

  const handleQrScan = () => {
    // QR 스캐너 모달 열기
    setShowQrScanner(true);
  };

  // QR 코드 스캔 성공 시 처리
  const handleQrScanSuccess = (decodedText) => {
    consolelog('QR 코드 인식:', decodedText);
    
    // 지갑 주소 추출 (ethereum: 프로토콜 제거)
    let address = decodedText;
    if (decodedText.startsWith('ethereum:')) {
      address = decodedText.replace('ethereum:', '').split('?')[0];
    }
    
    // 주소 유효성 검사
    if (walletService.isValidAddress(address)) {
      setRecipient(address);
      setShowQrScanner(false);
      setSuccess(t('SendTransaction.qrScanSuccess') || 'QR 코드 스캔 완료');
      setTimeout(() => setSuccess(''), 2000);
    } else {
      setError(t('SendTransaction.invalidQRCode') || '유효하지 않은 QR 코드입니다');
      setShowQrScanner(false);
      setTimeout(() => setError(''), 3000);
    }
  };

  // QR 스캐너 닫기
  const handleQrScanClose = () => {
    setShowQrScanner(false);
  };

  const formatBalance = (balance) => {
    const num = parseFloat(balance || 0);
    if (num === 0) return '0.0000';
    if (num < 0.0001) return '<0.0001';
    return num.toFixed(4);
  };

  return (
    <div className="send-transaction">
      {/* 선택된 자산 정보 */}
      <div className="selected-asset-info">
        <div className="asset-header" style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
          <div style={{display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center'}}>
            <div className="asset-icon">
              {isToken ? '🪙' : '🏆'}
            </div>
            <div className="asset-details">
              <div className="asset-name" style={{color: 'white'}}>{selectedAsset?.name || 'WorldLand Coin'}</div>
              <div className="asset-symbol" style={{color: 'gold'}}>{selectedAsset?.symbol || 'WLC'}</div>
            </div>
          </div>
          <div className="asset-balance" style={{display: 'flex', flexDirection: 'column' }}>
            <div className="balance-label" style={{color: 'white'}}>{t('SendTransaction.availableBalance')}</div>
            <div className="balance-amount" style={{color: 'white'}} >
              {formatBalance(currentBalance)} {selectedAsset?.symbol || 'WLC'}
            </div>
          </div>
        </div>
        
      </div>

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
          <div style={{ whiteSpace: 'pre-line' }}>{success}</div>
        </div>
      )}

      <div className="send-form">
        {/* 받는 주소 */}
        <div className="form-group">
          <label>{t('SendTransaction.recipientAddress')}</label>
          <div className="address-input-group-send">
            <textarea
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className={recipient && !walletService.isValidAddress(recipient) ? 'invalid' : ''}
              rows={1}
            />
            <button 
              type="button" 
              className="qr-button"
              onClick={handleQrScan}
              title={t('SendTransaction.scanQRCode')}
            >
              <QrCode size={24} />
            </button>
          </div>
          {recipient && !walletService.isValidAddress(recipient) && (
            <div className="field-error">{t('SendTransaction.invalidAddressFormat')}</div>
          )}
        </div>

        {/* 전송 금액 */}
        <div className="form-group">
          <label>{t('SendTransaction.amountToSend')}</label>
          <div className="amount-input-group">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="0.000001"
              min="0"
            />
            <span className="currency">{selectedAsset?.symbol || 'WLC'}</span>
            <button 
              type="button" 
              className="max-button"
              onClick={handleMaxAmount}
            >
              Max
            </button>
          </div>
          {/* <div className="balance-info">
            {isToken ? (
              `Available: ${formatBalance(currentBalance)} ${selectedAsset.symbol}`
            ) : (
              `Available: ${formatBalance(parseFloat(currentBalance) - parseFloat(estimatedFee || '0'))} WLC`
            )}
          </div> */}
        </div>

        

        {/* 수수료 정보 */}
        <div className="fee-info">
          <div className="fee-row">
            <span>{t('SendTransaction.amountToSend')}:</span>
            <span className="fee-amount">
              {amount || '0'} {selectedAsset?.symbol || 'WLC'}
            </span>
          </div>
          <div className="fee-row">
            <span>{t('SendTransaction.estimatedFee')}:</span>
            <span className="fee-amount">
              {isEstimating ? (
                <Loader size={14} className="spin" />
              ) : (
                `${estimatedFee} ${network.symbol}`
              )}
            </span>
          </div>
          {!isToken && (
            <div className="fee-row total">
              <span>{t('SendTransaction.totalRequired')}:</span>
              <span className="fee-amount">
                {(parseFloat(amount || '0') + parseFloat(estimatedFee || '0')).toFixed(6)} ${network.symbol}
              </span>
            </div>
          )}
          {isToken && (
            <div className="fee-warning">
              <AlertCircle size={14} />
              <span>{t('SendTransaction.tokenFeeInWLC')}</span>
            </div>
          )}
        </div>

        {/* 전송 버튼 */}
        <button
          className="send-button"
          onClick={handleSend}
          disabled={isLoading || !recipient || !amount || !!validateInputs()}
        >
          {isLoading ? (
            <>
              <Loader size={16} className="spin" />
              {t('SendTransaction.sending')}
            </>
          ) : (
            <>
              <Send size={16} />
              Send {selectedAsset?.symbol || 'WLC'}
            </>
          )}
        </button>
      </div>

      {/* 가스 가격 설정 */}
      <div className="form-group">
        <label>{t('SendTransaction.transactionSpeed')}</label>
        <div className="gas-price-options"  style={{display: 'flex', flexDirection: 'row'}}>
          {[
            { key: 'slow', label: t('SendTransaction.slow'), price: GAS_PRICES.slow, time: '5min' },
            { key: 'standard', label: t('SendTransaction.normal'), price: GAS_PRICES.standard, time: '2min' },
            { key: 'fast', label: t('SendTransaction.fast'), price: GAS_PRICES.fast, time: '30sec' }
          ].map(({ key, label, price, time }) => (
            <button
              key={key}
              type="button"
              className={`gas-option ${gasPriceMode === key ? 'active' : ''}`}
              onClick={() => setGasPriceMode(key)} 
              style={{width: '80px'}}
            >
              <div className="option-label">{label}</div>
              <div className="option-price">{price} Gwei</div>
              <div className="option-time">{time}</div>
            </button>
          ))}
          <button
            type="button"
            className={`gas-option custom ${gasPriceMode === 'custom' ? 'active' : ''}`}
            onClick={() => setGasPriceMode('custom')}
            style={{width: '80px'}}
          >
            <div className="option-label">Custom</div>
            {gasPriceMode === 'custom' && (
              <input
                type="number"
                value={customGasPrice}
                onChange={(e) => setCustomGasPrice(e.target.value)}
                placeholder="Gwei"
                className="custom-gas-input"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </button>
          
        </div>
      </div>

      {/* QR 스캐너 */}
      {showQrScanner && (
        <QrScanner 
          onScanSuccess={handleQrScanSuccess}
          onClose={handleQrScanClose}
        />
      )}
    </div>
  );
};

export default SendTransaction;