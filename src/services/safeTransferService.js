// src/services/safeTransferService.js
import { ethers } from 'ethers';
import { consolelog, consoleerror } from '../utils/logger.js';

// WorldLand Mainnet에 배포된 SafeTransfer Proxy 컨트랙트 주소
const SAFE_TRANSFER_PROXY_ADDRESS = '0xB04f93C8A4e864B0204159Be749615a8531D5A8B';
const WLC_DECIMALS = 18;

// SafeTransfer 컨트랙트 ABI
const SAFE_TRANSFER_ABI = [
  // View Functions
  "function getFeePercentage() view returns (uint256)",
  "function getMinFeePerParty() view returns (uint256)",
  "function getDefaultSafetyPeriod() view returns (uint256)",
  "function getDefaultConfirmPeriod() view returns (uint256)",
  "function getMutualCancelTimeout() view returns (uint256)",
  "function getTransfer(uint256 transferId) view returns (tuple(uint256 id, address sender, address receiver, uint256 amount, uint256 collateralAmount, uint256 feePerParty, uint256 safetyPeriodEnd, uint256 confirmPeriodEnd, uint8 status, bool senderProposesMutualCancel, bool receiverProposesMutualCancel, uint256 mutualCancelProposedAt))",
  
  // Transaction Functions
  "function createTransfer(address receiver, uint256 amount, uint256 collateralAmount, uint256 safetyPeriod, uint256 confirmPeriod) payable",
  "function depositCollateral(uint256 transferId) payable",
  "function completeTransfer(uint256 transferId)",
  "function cancelTransfer(uint256 transferId)",
  "function proposeMutualCancel(uint256 transferId)",
  "function acceptMutualCancel(uint256 transferId)",
  "function executePenaltyForNoResponse(uint256 transferId)"
];

// ============================================================
// 유틸리티 함수
// ============================================================

// Wei를 WLC로 변환
const formatWeiToWLC = (weiAmount) => {
  if (!weiAmount) return '0.0';
  try {
    return ethers.formatUnits(weiAmount, WLC_DECIMALS);
  } catch (e) {
    consoleerror('formatWeiToWLC error:', e);
    return '0.0';
  }
};

// WLC를 Wei로 변환
const WLCtoWei = (wlcAmount) => {
  if (!wlcAmount || parseFloat(wlcAmount) === 0) return 0n;
  try {
    return ethers.parseUnits(String(wlcAmount), WLC_DECIMALS);
  } catch (e) {
    throw new Error(`Invalid WLC amount format: ${e.message}`);
  }
};

// ============================================================
// Provider & Signer 생성
// ============================================================

// RPC Provider 생성 (읽기 전용)
const getProvider = (rpcUrl) => {
  if (!rpcUrl) throw new Error('RPC URL is required');
  return new ethers.JsonRpcProvider(rpcUrl);
};

// Browser Signer 생성 (트랜잭션용)
const getSigner = async (account) => {
  if (!window.ethereum) {
    throw new Error('지갑이 연결되지 않았습니다. MetaMask 등의 지갑을 설치해주세요.');
  }
  
  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner(account);
    return signer;
  } catch (error) {
    throw new Error(`Signer 생성 실패: ${error.message}`);
  }
};

// ============================================================
// View 함수 (읽기 전용)
// ============================================================

// 컨트랙트 설정값 조회
const getContractConfig = async (rpcUrl) => { 
    
  try {
    const provider = getProvider(rpcUrl);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      provider
    ); 
    
    const [feePercentage, minFeePerParty, defaultSafetyPeriod, defaultConfirmPeriod, mutualCancelTimeout] = 
      await Promise.all([
        contract.getFeePercentage(),
        contract.getMinFeePerParty(),
        contract.getDefaultSafetyPeriod(),
        contract.getDefaultConfirmPeriod(),
        contract.getMutualCancelTimeout()
      ]); 

    return {
      feePercentage: Number(feePercentage),
      minFeePerPartyWLC: parseFloat(formatWeiToWLC(minFeePerParty)),
      defaultSafetyPeriod: Number(defaultSafetyPeriod),
      defaultConfirmPeriod: Number(defaultConfirmPeriod),
      mutualCancelTimeout: Number(mutualCancelTimeout)
    };
  } catch (error) {
    consoleerror('getContractConfig error:', error);
    throw new Error(`컨트랙트 설정 조회 실패: ${error.message}`);
  }
};

// 거래 정보 조회
const getTransfer = async (transferId, rpcUrl) => {
  try {
    const provider = getProvider(rpcUrl);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      provider
    );

    const transfer = await contract.getTransfer(transferId);

    return {
      id: Number(transfer.id),
      sender: transfer.sender,
      receiver: transfer.receiver,
      amount: formatWeiToWLC(transfer.amount),
      collateralAmount: formatWeiToWLC(transfer.collateralAmount),
      feePerParty: formatWeiToWLC(transfer.feePerParty),
      safetyPeriodEnd: Number(transfer.safetyPeriodEnd) * 1000, // 초 → 밀리초
      confirmPeriodEnd: Number(transfer.confirmPeriodEnd) * 1000,
      status: Number(transfer.status),
      senderProposesMutualCancel: transfer.senderProposesMutualCancel,
      receiverProposesMutualCancel: transfer.receiverProposesMutualCancel,
      mutualCancelProposedAt: Number(transfer.mutualCancelProposedAt) * 1000,
      raw: transfer
    };
  } catch (error) {
    consoleerror('getTransfer error:', error);
    throw new Error(`거래 조회 실패: ${error.message}`);
  }
};

// ============================================================
// Transaction 함수 (쓰기)
// ============================================================

// 송금 생성 (A가 호출)
const createTransfer = async ({
  receiver,
  amountWLC,
  collateralWLC,
  safetyPeriodSeconds,
  confirmPeriodSeconds,
  totalSendWLC,
  account
}) => {
  try {
    const signer = await getSigner(account);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      signer
    );

    const amountWei = WLCtoWei(amountWLC);
    const collateralWei = WLCtoWei(collateralWLC);
    const totalSendWei = WLCtoWei(totalSendWLC);

    const tx = await contract.createTransfer(
      receiver,
      amountWei,
      collateralWei,
      safetyPeriodSeconds,
      confirmPeriodSeconds,
      { value: totalSendWei }
    );

    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('트랜잭션이 실패했습니다.');
    }

    return receipt;
  } catch (error) {
    consoleerror('createTransfer error:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.');
    }
    throw new Error(`송금 생성 실패: ${error.message}`);
  }
};

// 보증금 입금 (B가 호출)
const depositCollateral = async (transferId, depositAmountWLC, account) => {
  try {
    const signer = await getSigner(account);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      signer
    );

    const depositAmountWei = WLCtoWei(depositAmountWLC);

    const tx = await contract.depositCollateral(
      transferId,
      { value: depositAmountWei }
    );

    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('트랜잭션이 실패했습니다.');
    }

    return receipt;
  } catch (error) {
    consoleerror('depositCollateral error:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.');
    }
    throw new Error(`보증금 입금 실패: ${error.message}`);
  }
};

// 거래 완료 (B가 호출)
const completeTransfer = async (transferId, account) => {
  try {
    const signer = await getSigner(account);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      signer
    );

    const tx = await contract.completeTransfer(transferId);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('트랜잭션이 실패했습니다.');
    }

    return receipt;
  } catch (error) {
    consoleerror('completeTransfer error:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.');
    }
    throw new Error(`거래 완료 실패: ${error.message}`);
  }
};

// 거래 취소 (A가 안전기간 내에 호출)
const cancelTransfer = async (transferId, account) => {
  try {
    const signer = await getSigner(account);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      signer
    );

    const tx = await contract.cancelTransfer(transferId);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('트랜잭션이 실패했습니다.');
    }

    return receipt;
  } catch (error) {
    consoleerror('cancelTransfer error:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.');
    }
    throw new Error(`거래 취소 실패: ${error.message}`);
  }
};

// 상호 취소 제안
const proposeMutualCancel = async (transferId, account) => {
  try {
    const signer = await getSigner(account);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      signer
    );

    const tx = await contract.proposeMutualCancel(transferId);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('트랜잭션이 실패했습니다.');
    }

    return receipt;
  } catch (error) {
    consoleerror('proposeMutualCancel error:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.');
    }
    throw new Error(`상호 취소 제안 실패: ${error.message}`);
  }
};

// 상호 취소 수락
const acceptMutualCancel = async (transferId, account) => {
  try {
    const signer = await getSigner(account);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      signer
    );

    const tx = await contract.acceptMutualCancel(transferId);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('트랜잭션이 실패했습니다.');
    }

    return receipt;
  } catch (error) {
    consoleerror('acceptMutualCancel error:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.');
    }
    throw new Error(`상호 취소 수락 실패: ${error.message}`);
  }
};

// 패널티 실행 (B 무응답 시 A가 호출)
const executePenaltyForNoResponse = async (transferId, account) => {
  try {
    const signer = await getSigner(account);
    const contract = new ethers.Contract(
      SAFE_TRANSFER_PROXY_ADDRESS,
      SAFE_TRANSFER_ABI,
      signer
    );

    const tx = await contract.executePenaltyForNoResponse(transferId);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('트랜잭션이 실패했습니다.');
    }

    return receipt;
  } catch (error) {
    consoleerror('executePenaltyForNoResponse error:', error);
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('사용자가 트랜잭션을 거부했습니다.');
    }
    throw new Error(`패널티 실행 실패: ${error.message}`);
  }
};

// ============================================================
// Export
// ============================================================

export const safeTransferService = {
  // 상수
  SAFE_TRANSFER_PROXY_ADDRESS,
  WLC_DECIMALS,
  
  // 유틸리티
  formatWeiToWLC,
  WLCtoWei,
  
  // View 함수
  getContractConfig,
  getTransfer,
  
  // Transaction 함수
  createTransfer,
  depositCollateral,
  completeTransfer,
  cancelTransfer,
  proposeMutualCancel,
  acceptMutualCancel,
  executePenaltyForNoResponse
};