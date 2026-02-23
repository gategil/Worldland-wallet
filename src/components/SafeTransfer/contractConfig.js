// src/components/SafeTransfer/contractConfig.js

// SafeTransfer.json에서 ABI를 직접 import
import SafeTransferArtifact from './SafeTransfer.json';

// 배포된 프록시 주소
export const CONTRACT_ADDRESS = "0x5D5a84FF2Fda50A2328Bae5B8B18677328Ceb17A";

// 전체 ABI 사용
export const CONTRACT_ABI = SafeTransferArtifact.abi;

// WorldLand RPC URL 
export const WORLDLAND_RPC = "https://seoul.worldland.foundation";

// 수수료 설정 (V3 업데이트)
export const FEE_CONFIG = {
  // ✨ V3 새로운 차등 수수료
  senderFeePercentage: 0,       // 송신자 수수료: 0% (무료!)
  receiverFeePercentage: 10,    // 수신자 수수료: 0.1%
  
  // Deprecated (하위 호환성용)
  feePercentage: 0,             // V2 호환성 (더 이상 사용하지 않음)
  
  // 기타 설정
  minFeePerParty: "0.000",       // 최소 수수료 (WLC)
  defaultSafetyPeriod: 24,      // 기본 안전기간 (시간)
  defaultConfirmPeriod: 48,     // 기본 확정기간 (시간)
  mutualCancelTimeout: 24       // 상호취소 응답 기한 (시간)
};

// 네트워크 설정
export const NETWORK_CONFIG = {
  chainId: 103,
  name: "WorldLand",
  rpcUrl: "https://seoul.worldland.foundation",
  explorer: "https://scan.worldland.foundation"
};
 
// 거래 상태 enum 
export const TransferStatus = {
  0: "WAITING_FOR_DEPOSIT",
  1: "ACTIVE",
  2: "MUTUAL_CANCEL_REQUESTED",
  3: "SPLIT_PROPOSED",
  4: "COMPLETED",
  5: "CANCELLED"
};

// 거래 상태를 한글로 변환
export const getStatusText = (status) => {
  const statusMap = {
    0: "Pending",
    1: "Active",
    2: "Cancel?",
    3: "Dispute",
    4: "Done",
    5: "Cancelled"
  };
  return statusMap[status] || "알 수 없음";
};

// 거래 상태에 따른 색상 반환
export const getStatusColor = (status) => {
  const colorMap = {
    0: "#667eea",  // 파란색 - 보증금 대기
    1: "#f59e0b",  // 주황색 - 진행중
    2: "#f59e0b",  // 주황색 - 취소 요청중
    3: "#f59e0b",  // 주황색 - 타협 제안중
    4: "#10b981",  // 초록색 - 완료됨
    5: "#ef4444"   // 빨간색 - 취소됨
  };
  return colorMap[status] || "#6b7280";
};