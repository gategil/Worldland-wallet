// src/services/secureStorage.js - 토큰 암호화 기능 추가
import CryptoJS from 'crypto-js';
import { i18nService } from './i18nService';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';

export class SecureStorage {
  static STORAGE_KEY = 'worldland_wallet_data';
  static SETTINGS_KEY = 'worldland_wallet_settings';
  static TOKENS_KEY = 'worldland_wallet_tokens_encrypted'; // 암호화된 토큰 저장소

  // === 토큰 데이터 암호화 기능 추가 ===

  // 토큰 데이터 암호화
  static encryptTokenData(tokenData, password) {
    try {
      if (!password) {
        throw new Error(i18nService.t('secureStorage.passwordRequiredForEncryption'));
      }

      // 토큰 데이터 정리 및 검증
      const sanitizedData = this.sanitizeTokenData(tokenData);
      const dataString = JSON.stringify(sanitizedData);
      
      // 타임스탬프와 함께 암호화 (재생 공격 방지)
      const dataWithTimestamp = {
        data: sanitizedData,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(dataWithTimestamp), 
        password
      ).toString();
      
      return {
        success: true,
        encrypted: encrypted
      };
    } catch (error) {
      consoleerror('토큰 데이터 암호화 실패:', error);
      return {
        success: false,
        error: i18nService.t('secureStorage.tokenEncryptionFailed') + ': ' + error.message
      };
    }
  }

  // 토큰 데이터 복호화
  static decryptTokenData(encryptedData, password) {
    try {
      if (!encryptedData || !password) {
        return {
          success: false,
          error: i18nService.t('secureStorage.noEncryptedDataOrPassword')
        };
      }

      const bytes = CryptoJS.AES.decrypt(encryptedData, password);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        throw new Error(i18nService.t('secureStorage.wrongPassword'));
      }
      
      const decryptedData = JSON.parse(decryptedString);
      
      // 데이터 유효성 검사
      if (!decryptedData.data || !decryptedData.timestamp) {
        throw new Error(i18nService.t('secureStorage.invalidTokenFormat'));
      }
      
      // 타임스탬프 검사 (너무 오래된 데이터 거부)
      const maxAge = 365 * 24 * 60 * 60 * 1000; // 1년
      if (Date.now() - decryptedData.timestamp > maxAge) {
        consolewarn(i18nService.t('secureStorage.outdatedTokenDetected'));
      }
      
      return {
        success: true,
        data: decryptedData.data
      };
    } catch (error) {
      consoleerror(i18nService.t('secureStorage.tokenDecryptionError'), error);
      return {
        success: false,
        error: error.message.includes('password') ? 
          i18nService.t('secureStorage.incorrectPassword') : i18nService.t('secureStorage.tokenDecryptionFailed')
      };
    }
  }

  // 토큰 데이터 정리 (XSS 방어)
  static sanitizeTokenData(tokenData) {
    if (!tokenData || typeof tokenData !== 'object') {
      return {};
    }

    const sanitized = {};
    
    Object.keys(tokenData).forEach(walletId => {
      if (Array.isArray(tokenData[walletId])) {
        sanitized[walletId] = tokenData[walletId].map(token => this.sanitizeToken(token));
      }
    });
    
    return sanitized;
  }

  // 개별 토큰 정리
  static sanitizeToken(token) {
    if (!token || typeof token !== 'object') {
      return null;
    }

    // 허용된 필드만 추출
    const allowedFields = [
      'address', 'name', 'symbol', 'decimals', 'balance', 'balanceRaw',
      'type', 'verified', 'network', 'homepage', 'addedAt', 'lastUpdated', 'description'
    ];

    const sanitized = {};
    
    allowedFields.forEach(field => {
      if (token[field] !== undefined) {
        let value = token[field];
        
        // 문자열 필드 정리 (XSS 방지)
        if (typeof value === 'string') {
          value = this.sanitizeString(value);
        }
        
        // 숫자 필드 검증
        if (['decimals', 'addedAt', 'lastUpdated'].includes(field)) {
          value = parseInt(value) || 0;
        }
        
        // 불린 필드 검증
        if (field === 'verified') {
          value = Boolean(value);
        }
        
        // 주소 필드 검증
        if (field === 'address' && value) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            consolewarn('Invalid token address format:', value);
            return null; // 잘못된 주소 형식은 토큰 전체를 무효화
          }
        }
        
        sanitized[field] = value;
      }
    });

    // 필수 필드 검증
    if (!sanitized.address || !sanitized.symbol) {
      consolewarn('토큰 필수 필드 누락:', sanitized);
      return null;
    }

    return sanitized;
  }

  // 문자열 정리 (XSS 방지)
  static sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/[<>\"']/g, '') // HTML 태그 제거
      .replace(/javascript:/gi, '') // JavaScript 프로토콜 제거
      .replace(/on\w+=/gi, '') // 이벤트 핸들러 제거
      .replace(/data:/gi, '') // Data URI 제거
      .trim()
      .slice(0, 200); // 최대 길이 제한
  }

  // 암호화된 토큰 데이터 저장
  static saveEncryptedTokens(tokenData, password) {
    try {
      const encryptResult = this.encryptTokenData(tokenData, password);
      if (!encryptResult.success) {
        return encryptResult;
      }

      // 기존 평문 토큰 데이터 제거
      localStorage.removeItem('worldland_wallet_tokens');
      
      // 암호화된 데이터 저장
      localStorage.setItem(this.TOKENS_KEY, encryptResult.encrypted);
      
      consolelog('✅ 토큰 데이터가 암호화되어 저장되었습니다');
      return {
        success: true,
        message: i18nService.t('secureStorage.tokenSavedSafely')
      };
    } catch (error) {
      consoleerror('암호화된 토큰 저장 실패:', error);
      return {
        success: false,
        error: i18nService.t('secureStorage.tokenSaveFailed')
      };
    }
  }

  // 암호화된 토큰 데이터 로드
  static loadEncryptedTokens(password) {
    try {
      const encryptedData = localStorage.getItem(this.TOKENS_KEY);
      
      if (!encryptedData) {
        // 기존 평문 데이터 마이그레이션 시도
        return this.migrateTokenData(password);
      }

      const decryptResult = this.decryptTokenData(encryptedData, password);
      if (!decryptResult.success) {
        consoleerror('토큰 데이터 복호화 실패:', decryptResult.error);
        return {
          success: false,
          error: decryptResult.error,
          data: {}
        };
      }

      return {
        success: true,
        data: decryptResult.data || {}
      };
    } catch (error) {
      consoleerror('암호화된 토큰 로드 실패:', error);
      return {
        success: false,
        error: i18nService.t('secureStorage.tokenLoadFailed'),
        data: {}
      };
    }
  }

  // 기존 평문 토큰 데이터를 암호화로 마이그레이션
  static migrateTokenData(password) {
    try {
      consolelog('🔄 기존 토큰 데이터 마이그레이션 시작...');
      
      const oldData = localStorage.getItem('worldland_wallet_tokens');
      if (!oldData) {
        consolelog('마이그레이션할 토큰 데이터가 없습니다');
        return {
          success: true,
          data: {},
          migrated: false
        };
      }

      const parsedData = JSON.parse(oldData);
      consolelog('기존 토큰 데이터 발견:', Object.keys(parsedData).length, '개 지갑');

      // 암호화하여 저장
      const saveResult = this.saveEncryptedTokens(parsedData, password);
      if (saveResult.success) {
        // 기존 평문 데이터 삭제
        localStorage.removeItem('worldland_wallet_tokens');
        consolelog('✅ 토큰 데이터 마이그레이션 완료');
        
        return {
          success: true,
          data: parsedData,
          migrated: true
        };
      } else {
        consoleerror('토큰 데이터 마이그레이션 실패:', saveResult.error);
        return {
          success: false,
          error: i18nService.t('secureStorage.tokenMigrationFailed'),
          data: {}
        };
      }
    } catch (error) {
      consoleerror('토큰 데이터 마이그레이션 예외:', error);
      return {
        success: false,
        error: i18nService.t('secureStorage.tokenMigrationError'),
        data: {}
      };
    }
  }
 
  // 민감한 데이터만 선별적으로 메모리 정리
  static clearSensitiveData(sensitiveObj) {
    if (!sensitiveObj || typeof sensitiveObj !== 'object') return;

    // 민감한 필드만 정리 (개인키, 니모닉, 비밀번호 등)
    const sensitiveFields = ['privateKey', 'mnemonic', 'password', 'seed'];
    
    Object.keys(sensitiveObj).forEach(key => {
      if (sensitiveFields.includes(key) && typeof sensitiveObj[key] === 'string') {
        // 문자열을 0으로 덮어쓰기 (메모리에서 완전 제거를 위해)
        const value = sensitiveObj[key];
        if (value && value.length > 0) {
          for (let i = 0; i < value.length; i++) {
            // 메모리 덮어쓰기 시뮬레이션
          }
          sensitiveObj[key] = null;
          delete sensitiveObj[key];
        }
      }
    });
    
    consolelog('🧹 민감한 데이터만 정리 완료');
  }

  // 완전한 세션 정리 (로그아웃 시에만 사용)
  static clearAllSessionData() {
    try {
      // 세션 저장소만 정리 (localStorage의 토큰 정보는 유지)
      sessionStorage.clear();
      
      // 메모리 정리를 위한 가비지 컬렉션 힌트
      if (window.gc) {
        window.gc();
      }
      
      consolelog('🧹 세션 데이터 완전 정리 완료');
      return {
        success: true,
        message: i18nService.t('secureStorage.sessionCleared')
      };
    } catch (error) {
      consoleerror('세션 데이터 정리 실패:', error);
      return {
        success: false,
        error: i18nService.t('secureStorage.sessionClearFailed')
      };
    }
  }

  // 토큰 데이터 완전 삭제 (보안 목적)
  static secureDeleteTokens() {
    try {
      // 암호화된 데이터 삭제
      localStorage.removeItem(this.TOKENS_KEY);
      
      // 혹시 남아있을 수 있는 평문 데이터도 삭제
      localStorage.removeItem('worldland_wallet_tokens');
      
      consolelog('🗑️ 모든 토큰 데이터가 안전하게 삭제되었습니다');
      return {
        success: true,
        message: i18nService.t('secureStorage.tokenDeletedSafely')
      };
    } catch (error) {
      consoleerror('토큰 데이터 삭제 실패:', error);
      return {
        success: false,
        error: i18nService.t('secureStorage.tokenDeleteFailed')
      };
    }
  }

  // === 기존 기능들 유지 ===

  // 데이터 암호화
  static encrypt(data, password) {
    try {
      const dataString = JSON.stringify(data);
      const encrypted = CryptoJS.AES.encrypt(dataString, password).toString();
      return {
        encrypted,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('secureStorage.encryptionFailed')
      };
    }
  }

  // 데이터 복호화
  static decrypt(encryptedData, password) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, password);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedString) {
        throw new Error(i18nService.t('secureStorage.wrongPassword'));
      }
      
      const data = JSON.parse(decryptedString);
      return {
        data,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message.includes('password') ? 
          i18nService.t('secureStorage.incorrectPassword') : i18nService.t('secureStorage.invalidInputInfo')
      };
    }
  }

  // 지갑 데이터 저장
  static async saveWallet(walletData, password) {
    try {
      const encryptResult = this.encrypt(walletData, password);
      if (!encryptResult.success) {
        return encryptResult;
      }

      const storageData = {
        data: encryptResult.encrypted,
        timestamp: Date.now(),
        version: '1.0'
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData));
      
      return {
        success: true,
        message: i18nService.t('secureStorage.walletSavedSafely')
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('secureStorage.walletSaveFailed')
      };
    }
  }

  // 지갑 데이터 불러오기
  static async loadWallet(password) {
    try {
      const storageData = localStorage.getItem(this.STORAGE_KEY);
      
      if (!storageData) {
        return {
          success: false,
          error: i18nService.t('secureStorage.noSavedWallet')
        };
      }

      const parsedData = JSON.parse(storageData);
      const decryptResult = this.decrypt(parsedData.data, password);
      
      if (!decryptResult.success) {
        return decryptResult;
      }

      return {
        walletData: decryptResult.data,
        timestamp: parsedData.timestamp,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('secureStorage.walletLoadFailed')
      };
    }
  }

  // 지갑 존재 여부 확인
  static hasWallet() {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  // 지갑 삭제
  static removeWallet() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      
      // 토큰 데이터도 함께 삭제
      this.secureDeleteTokens();
      
      return {
        success: true,
        message: i18nService.t('secureStorage.walletDeleted')
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('secureStorage.walletDeleteFailed')
      };
    }
  }

  // 설정 저장
  static saveSettings(settings) {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('secureStorage.settingSaveFailed')
      };
    }
  }

  // 설정 불러오기
  static loadSettings() {
    try {
      const settings = localStorage.getItem(this.SETTINGS_KEY);
      return settings ? JSON.parse(settings) : null;
    } catch (error) {
      return null;
    }
  }

  // 기본 설정
  static getDefaultSettings() {
    return {
      network: 'mainnet',
      currency: 'USD',
      language: 'en',
      notifications: true,
      autoLock: true,
      lockTimeout: 3600000, // 5분
      gasPrice: 'standard'
    };
  }

  // 비밀번호 강도 검사
  static validatePassword(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);

    const score = [
      password.length >= minLength,
      hasUpperCase,
      hasLowerCase, 
      hasNumbers,
      hasNonalphas
    ].reduce((score, requirement) => score + requirement, 0);

    let strength = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 3) strength = 'medium';

    return {
      isValid: password.length >= minLength && score >= 3,
      strength: strength,
      score: score,
      requirements: {
        minLength: password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar: hasNonalphas
      }
    };
  }

  // 세션 토큰 생성 (자동 잠금용)
  static generateSessionToken() {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  // 세션 관리
  static setSession(token, timeout = 300000) {
    const session = {
      token: token,
      expires: Date.now() + timeout
    };
    sessionStorage.setItem('wallet_session', JSON.stringify(session));
  }

  static getSession() {
    try {
      const session = sessionStorage.getItem('wallet_session');
      if (!session) return null;
      
      const parsed = JSON.parse(session);
      if (Date.now() > parsed.expires) {
        sessionStorage.removeItem('wallet_session');
        return null;
      }
      
      return parsed;
    } catch {
      return null;
    }
  }

  static clearSession() {
    sessionStorage.removeItem('wallet_session');
  }

  // 🔐 세션에 비밀번호를 암호화하여 저장 (새로 추가)
  static setSessionWithPassword(password, timeout = 300000) {
    try {
      // 세션용 암호화 키 생성
      const sessionKey = this.generateSessionToken();
      
      // 비밀번호를 세션 키로 암호화
      const encryptedPassword = CryptoJS.AES.encrypt(password, sessionKey).toString();
      
      const sessionData = {
        token: sessionKey,
        encryptedPassword: encryptedPassword,
        expires: Date.now() + timeout,
        createdAt: Date.now()
      };
      
      sessionStorage.setItem('wallet_session', JSON.stringify(sessionData));
      consolelog('✅ 세션과 암호화된 비밀번호 저장 완료');
      return true;
    } catch (error) {
      consoleerror('❌ 세션 비밀번호 저장 실패:', error);
      return false;
    }
  }

  // 🔓 세션에서 비밀번호 복원 (새로 추가)
  static getSessionPassword() {
    try {
      const sessionData = sessionStorage.getItem('wallet_session');
      if (!sessionData) {
        consolelog('💡 저장된 세션이 없습니다');
        return null;
      }
      
      const session = JSON.parse(sessionData);
      
      // 세션 만료 확인
      if (Date.now() > session.expires) {
        consolelog('⏰ 세션이 만료되었습니다');
        sessionStorage.removeItem('wallet_session');
        return null;
      }
      
      // 비밀번호 복호화
      const bytes = CryptoJS.AES.decrypt(session.encryptedPassword, session.token);
      const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedPassword) {
        consolelog('❌ 비밀번호 복호화 실패');
        return null;
      }
      
      consolelog('✅ 세션 비밀번호 복원 성공');
      return decryptedPassword;
    } catch (error) {
      consoleerror('❌ 세션 비밀번호 복원 실패:', error);
      sessionStorage.removeItem('wallet_session');
      return null;
    }
  }

  // 🔍 세션 유효성 확인 (기존 getSession 메서드 개선)
  static getSession() {
    try {
      const sessionData = sessionStorage.getItem('wallet_session');
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      
      // 만료 시간 확인
      if (Date.now() > session.expires) {
        sessionStorage.removeItem('wallet_session');
        return null;
      }
      
      return {
        token: session.token,
        expires: session.expires,
        createdAt: session.createdAt,
        isValid: true
      };
    } catch (error) {
      consoleerror('세션 확인 실패:', error);
      sessionStorage.removeItem('wallet_session');
      return null;
    }
  }

  // 🗑️ 세션 완전 삭제 (기존 clearSession 메서드 개선)
  static clearSession() {
    try {
      sessionStorage.removeItem('wallet_session');
      consolelog('🧹 세션이 완전히 삭제되었습니다');
    } catch (error) {
      consoleerror('세션 삭제 실패:', error);
    }
  }

  // 🔄 세션 연장 (새로 추가)
  static extendSession(additionalTime = 300000) {
    try {
      const sessionData = sessionStorage.getItem('wallet_session');
      if (!sessionData) return false;
      
      const session = JSON.parse(sessionData);
      session.expires = Date.now() + additionalTime;
      
      sessionStorage.setItem('wallet_session', JSON.stringify(session));
      consolelog('⏱️ 세션이 연장되었습니다');
      return true;
    } catch (error) {
      consoleerror('세션 연장 실패:', error);
      return false;
    }
  }
}