// src/components/SendNFT.js
import React, { useState } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import { X, Send, AlertCircle, Loader } from 'lucide-react';
import { walletService } from '../services/walletService';
import { GAS_PRICES } from '../services/networkConfig';
import './SendNFT.css';

const SendNFT = ({ nft, walletData, onClose, onSuccess }) => {
  const [toAddress, setToAddress] = useState('');
  const [gasPrice, setGasPrice] = useState(GAS_PRICES.standard);
  const [estimatedFee, setEstimatedFee] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  // 수수료 추정
  const handleEstimateFee = async () => {
    if (!toAddress || !walletService.isValidAddress(toAddress)) {
      setError('유효한 주소를 입력해주세요.');
      return;
    }

    setIsEstimating(true);
    setError('');

    try {
      const result = await walletService.estimateNFTTransferFee(
        nft.contractAddress,
        nft.tokenId,
        walletData.address,
        toAddress,
        gasPrice
      );

      if (result.success) {
        setEstimatedFee(result);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('수수료 추정에 실패했습니다.');
    } finally {
      setIsEstimating(false);
    }
  };

  // NFT 전송
  const handleSend = async () => {
    if (!toAddress || !walletService.isValidAddress(toAddress)) {
      setError('유효한 주소를 입력해주세요.');
      return;
    }

    if (toAddress.toLowerCase() === walletData.address.toLowerCase()) {
      setError('자신에게는 전송할 수 없습니다.');
      return;
    }

    if (!window.confirm(`정말로 이 NFT를 전송하시겠습니까?\n\nToken ID: ${nft.tokenId}\n받는 주소: ${toAddress}`)) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const result = await walletService.sendNFT(
        walletData.privateKey,
        nft.contractAddress,
        nft.tokenId,
        walletData.address,
        toAddress,
        gasPrice
      );

      if (result.success) {
        alert(`NFT 전송 완료!\n\n트랜잭션 해시: ${result.hash}`);
        onSuccess(result);
        onClose();
      } else {
        setError(result.error || 'NFT 전송에 실패했습니다.');
      }
    } catch (err) {
      setError('NFT 전송 중 오류가 발생했습니다.');
      consoleerror(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content send-nft-modal">
        <div className="modal-header">
          <h3>Send NFT</h3>
          <button onClick={onClose} disabled={isSending}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {/* NFT 정보 */}
          <div className="nft-info-section">
            <h4>NFT to Send</h4>
            <div className="nft-details">
              <p><strong>Token ID:</strong> {nft.tokenId}</p>
              <p><strong>컨트랙트:</strong> {nft.contractAddress.substring(0, 10)}...{nft.contractAddress.substring(nft.contractAddress.length - 8)}</p>
              <p><strong>현재 소유자:</strong> {walletData.address.substring(0, 10)}...{walletData.address.substring(walletData.address.length - 8)}</p>
            </div>
          </div>

          {/* 받는 주소 입력 */}
          <div className="form-group">
            <label>받는 주소 *</label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => {
                setToAddress(e.target.value);
                setEstimatedFee(null);
              }}
              placeholder="0x..."
              disabled={isSending}
            />
          </div>

          {/* 가스 가격 선택 */}
          <div className="form-group">
            <label>가스 가격</label>
            <select 
              value={gasPrice} 
              onChange={(e) => {
                setGasPrice(e.target.value);
                setEstimatedFee(null);
              }}
              disabled={isSending}
            >
              <option value={GAS_PRICES.slow}>느림 ({GAS_PRICES.slow} Gwei)</option>
              <option value={GAS_PRICES.standard}>보통 ({GAS_PRICES.standard} Gwei)</option>
              <option value={GAS_PRICES.fast}>빠름 ({GAS_PRICES.fast} Gwei)</option>
            </select>
          </div>

          {/* 수수료 추정 버튼 */}
          <button 
            className="estimate-btn"
            onClick={handleEstimateFee}
            disabled={!toAddress || isEstimating || isSending}
          >
            {isEstimating ? (
              <>
                <Loader className="spin" size={16} />
                수수료 계산 중...
              </>
            ) : (
              '수수료 확인'
            )}
          </button>

          {/* 예상 수수료 표시 */}
          {estimatedFee && (
            <div className="fee-info">
              <p><strong>예상 가스:</strong> {estimatedFee.gasLimit}</p>
              <p><strong>예상 수수료:</strong> {parseFloat(estimatedFee.fee).toFixed(6)} WLC</p>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="sendnft-modal-actions">
          <button 
            className="sendnft-cancel-btn" 
            onClick={onClose}
            disabled={isSending}
          >
            취소
          </button>
          <button 
            className="send-btn-nft"
            onClick={handleSend}
            disabled={!toAddress || isSending}
          >
            {isSending ? (
              <>
                <Loader className="spin" size={16} />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} />
                Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendNFT;