import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';

class I18nService {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = {};
    this.fallbackLanguage = 'en';
    this.storageKey = 'worldland_language';
    this.listeners = []; // 언어 변경 리스너 추가
  }

  // 언어 변경 리스너 등록
  addLanguageChangeListener(listener) {
    this.listeners.push(listener);
  }

  // 언어 변경 리스너 제거
  removeLanguageChangeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // 언어 변경 알림
  notifyLanguageChange() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentLanguage);
      } catch (error) {
        consoleerror('언어 변경 리스너 오류:', error);
      }
    });
  }

  // 언어 설정 (SecureStorage 동기화 추가)
  async setLanguage(languageCode) {
    if (!this.getSupportedLanguages().find(lang => lang.code === languageCode)) {
      consolewarn(`지원하지 않는 언어: ${languageCode}`);
      return false;
    }

    // 언어 리소스가 로드되지 않았으면 로드
    if (!this.translations[languageCode]) {
      const loaded = await this.loadLanguage(languageCode);
      if (!loaded) {
        consoleerror(`언어 로드 실패: ${languageCode}`);
        return false;
      }
    }

    this.currentLanguage = languageCode;
    localStorage.setItem(this.storageKey, languageCode);
    
    // SecureStorage 설정과 동기화 추가
    try {
      const { SecureStorage } = await import('./secureStorage');
      const settings = SecureStorage.loadSettings() || SecureStorage.getDefaultSettings();
      settings.language = languageCode;
      SecureStorage.saveSettings(settings);
      consolelog('✅ 언어 설정이 SecureStorage와 동기화되었습니다:', languageCode);
    } catch (error) {
      consolewarn('⚠️ SecureStorage 동기화 실패:', error);
    }
    
    // HTML lang 속성 업데이트
    document.documentElement.lang = languageCode;
    
    // 언어 변경 알림 (새로고침 대신)
    this.notifyLanguageChange();
    
    return true;
  }

  // 초기화 시 모든 언어 미리 로드
  async preloadAllLanguages() {
    const supportedLanguages = this.getSupportedLanguages();
    const loadPromises = supportedLanguages.map(lang => this.loadLanguage(lang.code));
    
    try {
      await Promise.all(loadPromises);
      consolelog('모든 언어 리소스 로드 완료');
      return true;
    } catch (error) {
      consolewarn('일부 언어 리소스 로드 실패:', error);
      return false;
    }
  }

  // 기존 메서드들 유지...
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    ];
  }

  async loadLanguage(languageCode) {
    try {
      const response = await import(`../locales/${languageCode}.json`);
      this.translations[languageCode] = response.default;
      consolelog(`언어 로드 성공: ${languageCode}`);
      return true;
    } catch (error) {
      consolewarn(`언어 로드 실패: ${languageCode}`, error);
      return false;
    }
  }

  // 저장된 언어 로드 (SecureStorage 우선 확인)
  async loadSavedLanguage() {
    let savedLanguage = null;
    
    // 1. SecureStorage에서 먼저 확인
    try {
      const { SecureStorage } = await import('./secureStorage');
      const settings = SecureStorage.loadSettings();
      if (settings && settings.language) {
        savedLanguage = settings.language;
        consolelog('🔧 SecureStorage에서 언어 설정 로드:', savedLanguage);
      }
    } catch (error) {
      consolewarn('SecureStorage 언어 로드 실패:', error);
    }
    
    // 2. localStorage에서 확인 (폴백)
    if (!savedLanguage) {
      savedLanguage = localStorage.getItem(this.storageKey);
      consolelog('💾 localStorage에서 언어 설정 로드:', savedLanguage);
    }
    
    // 3. 저장된 언어가 있으면 설정, 없으면 브라우저 언어 감지
    if (savedLanguage) {
      await this.setLanguage(savedLanguage);
    } else {
      const browserLang = this.detectBrowserLanguage();
      consolelog('🌍 브라우저 언어 감지 결과:', browserLang);
      await this.setLanguage(browserLang);
    }
  }

  detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.languages[0];
    const langCode = browserLang.split('-')[0];
    
    const supported = this.getSupportedLanguages().find(lang => lang.code === langCode);
    const detectedLang = supported ? langCode : this.fallbackLanguage;
    
    consolelog('🌍 브라우저 언어 감지:', browserLang, '→', detectedLang);
    return detectedLang;
  }

  t(key, params = {}) {
    const translation = this.getTranslation(key);
    
    if (typeof translation !== 'string') {
      consolewarn(`번역을 찾을 수 없음: ${key}`);
      return key;
    }

    return this.interpolate(translation, params);
  }

  getTranslation(key) {
    const keys = key.split('.');
    let current = this.translations[this.currentLanguage];
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        current = this.translations[this.fallbackLanguage];
        for (const fallbackKey of keys) {
          if (current && typeof current === 'object' && fallbackKey in current) {
            current = current[fallbackKey];
          } else {
            return key;
          }
        }
        break;
      }
    }
    
    return current;
  }

  interpolate(text, params) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] || match;
    });
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getLanguageName(code) {
    const lang = this.getSupportedLanguages().find(l => l.code === code);
    return lang ? lang.nativeName : code;
  }
}

export const i18nService = new I18nService();