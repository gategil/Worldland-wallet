# SafeTransfer.json 업데이트 필수 안내

## ⚠️ 중요: ABI 파일 업데이트 필수!

V3로 업그레이드하면서 **7개의 새로운 함수와 이벤트**가 추가되었습니다.
프론트엔드에서 V3 기능을 사용하려면 반드시 새 ABI 파일로 교체해야 합니다.

## 📋 추가된 ABI 항목

### 1. 함수 (Functions)
1. **initializeV3()** - V2→V3 업그레이드 초기화
2. **getSenderFeePercentage()** - 송신자 수수료율 조회
3. **getReceiverFeePercentage()** - 수신자 수수료율 조회
4. **updateSenderFeePercentage(uint256)** - 송신자 수수료율 변경
5. **updateReceiverFeePercentage(uint256)** - 수신자 수수료율 변경

### 2. 이벤트 (Events)
6. **SenderFeePercentageUpdated** - 송신자 수수료율 변경 이벤트
7. **ReceiverFeePercentageUpdated** - 수신자 수수료율 변경 이벤트

## 🔄 업데이트 방법

### 옵션 1: 제공된 파일 사용 (권장)
```bash
# 업데이트된 SafeTransfer.json 파일을 프론트엔드로 복사
cp SafeTransfer.json /path/to/frontend/src/components/SafeTransfer/
```

### 옵션 2: 직접 컴파일
```bash
# Hardhat 프로젝트에서 컴파일
npx hardhat compile

# 생성된 ABI 파일 복사
cp artifacts/contracts/SafeTransfer.sol/SafeTransfer.json \
   /path/to/frontend/src/components/SafeTransfer/
```

## ✅ 업데이트 확인 방법

### JavaScript에서 확인
```javascript
import SafeTransferArtifact from './SafeTransfer.json';

// V3 함수들이 포함되어 있는지 확인
const hasV3Functions = SafeTransferArtifact.abi.some(
  item => item.name === 'getSenderFeePercentage'
);

console.log('V3 ABI:', hasV3Functions ? '✅' : '❌');
```

### 터미널에서 확인
```bash
# V3 함수가 있는지 확인
grep "getSenderFeePercentage\|getReceiverFeePercentage" SafeTransfer.json

# 결과가 나오면 ✅, 안 나오면 ❌
```

## 📊 ABI 통계

### V2 ABI
- 총 항목: 77개
- 함수: ~50개
- 이벤트: ~20개
- 에러: ~7개

### V3 ABI (업데이트 후)
- 총 항목: **84개** (+7개)
- 함수: ~55개 (+5개)
- 이벤트: ~22개 (+2개)
- 에러: ~7개

## 🚨 업데이트하지 않으면?

### 발생 가능한 문제들

1. **함수 호출 실패**
   ```javascript
   // ❌ V2 ABI 사용 시
   const senderFee = await contract.getSenderFeePercentage();
   // Error: contract.getSenderFeePercentage is not a function
   ```

2. **이벤트 리스닝 실패**
   ```javascript
   // ❌ V2 ABI 사용 시
   contract.on('SenderFeePercentageUpdated', (oldFee, newFee) => {
     console.log('Fee updated');
   });
   // 이벤트를 감지하지 못함
   ```

3. **TypeScript 타입 오류**
   ```typescript
   // ❌ V2 타입 사용 시
   await contract.getSenderFeePercentage();
   // Type error: Property 'getSenderFeePercentage' does not exist
   ```

## 💡 V3 기능 사용 예제

### 수수료율 조회
```javascript
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './contractConfig';

// 컨트랙트 연결
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

// ✅ V3 함수 사용
const senderFee = await contract.getSenderFeePercentage();
const receiverFee = await contract.getReceiverFeePercentage();

console.log('송신자 수수료:', Number(senderFee) / 100, '%');  // 0%
console.log('수신자 수수료:', Number(receiverFee) / 100, '%'); // 0.1%
```

### 수수료율 변경 (Owner만)
```javascript
// Owner만 가능
const tx = await contract.updateSenderFeePercentage(0);    // 0%
await tx.wait();

const tx2 = await contract.updateReceiverFeePercentage(10); // 0.1%
await tx2.wait();
```

### 이벤트 리스닝
```javascript
// 수수료율 변경 감지
contract.on('SenderFeePercentageUpdated', (oldFee, newFee) => {
  console.log(`송신자 수수료 변경: ${oldFee} → ${newFee}`);
});

contract.on('ReceiverFeePercentageUpdated', (oldFee, newFee) => {
  console.log(`수신자 수수료 변경: ${oldFee} → ${newFee}`);
});
```

## 🔍 호환성 검증

### V2 함수들은 여전히 작동
```javascript
// ✅ V2 함수들 (V3에서도 작동)
await contract.getFeePercentage();        // 송신자 수수료율 반환
await contract.getMinFeePerParty();       // 최소 수수료
await contract.createTransfer(...);       // 거래 생성
await contract.getTransferInfo(id);       // 거래 조회
// ... 모든 V2 함수 정상 작동
```

### V3 전용 함수
```javascript
// ✅ V3 신규 함수들
await contract.getSenderFeePercentage();     // 송신자 수수료율
await contract.getReceiverFeePercentage();   // 수신자 수수료율
await contract.updateSenderFeePercentage();  // 송신자 수수료 변경
await contract.updateReceiverFeePercentage(); // 수신자 수수료 변경
await contract.initializeV3();               // V3 초기화
```

## 📝 체크리스트

업데이트 완료 후 다음 항목들을 확인하세요:

- [ ] SafeTransfer.json 파일 교체 완료
- [ ] 프론트엔드 빌드 성공
- [ ] V3 함수 호출 테스트
  - [ ] getSenderFeePercentage()
  - [ ] getReceiverFeePercentage()
- [ ] 기존 V2 함수들 정상 작동 확인
  - [ ] createTransfer()
  - [ ] getTransferInfo()
  - [ ] depositCollateral()
  - [ ] completeTransfer()
- [ ] 콘솔에 에러 없음
- [ ] TypeScript 타입 에러 없음

## 🎯 결론

**SafeTransfer.json 업데이트는 필수입니다!**

V3의 새로운 수수료 구조를 활용하려면:
1. ✅ SafeTransfer.json 업데이트
2. ✅ SafeSend.js 업데이트
3. ✅ SafeReceive.js 업데이트
4. ✅ contractConfig.js 업데이트

모두 완료해야 V3 기능을 정상적으로 사용할 수 있습니다.

---

**생성일**: 2025-10-28
**버전**: V3.0.0
**총 추가 항목**: 7개 (함수 5개 + 이벤트 2개)
