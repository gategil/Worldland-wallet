// src/utils/logger.js

// 로깅을 활성화할지 여부를 결정하는 변수.
// 일반적으로는 process.env.NODE_ENV === 'development' 와 같이
// 실제 애플리케이션 환경 변수를 사용합니다.
const isLoggingEnabled = true; // 테스트를 위해 일단 true로 설정

/**
 * 조건부로 console.log를 실행하는 함수.
 * @param {...any} args - console.log에 전달할 인수들
 */
export const log = (...args) => {
  if (isLoggingEnabled) {
    console.log(...args);
  }
};

/**
 * 다른 레벨의 로그도 추가할 수 있습니다 (예: console.error)
 * @param {...any} args - console.error에 전달할 인수들
 */
export const error = (...args) => {
  if (isLoggingEnabled) {
    console.error('ERROR:', ...args);
  }
};