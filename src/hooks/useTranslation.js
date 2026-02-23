import { useState, useEffect, useCallback } from 'react';
import { i18nService } from '../services/i18nService';

export const useTranslation = () => {
  const [currentLanguage, setCurrentLanguage] = useState(i18nService.getCurrentLanguage());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 언어 변경 리스너
  const handleLanguageChange = useCallback((newLanguage) => {
    console.log('🔄 언어 변경 감지:', currentLanguage, '->', newLanguage);
    setCurrentLanguage(newLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    // 초기화
    const initializeLanguage = async () => {
      if (isInitialized) return;
      
      setIsLoading(true);
      try {
        await i18nService.preloadAllLanguages();
        await i18nService.loadSavedLanguage();
        
        i18nService.addLanguageChangeListener(handleLanguageChange);
        
        const initialLanguage = i18nService.getCurrentLanguage();
        setCurrentLanguage(initialLanguage);
        setIsInitialized(true);
        
        console.log('✅ 언어 시스템 초기화 완료:', initialLanguage);
      } catch (error) {
        console.error('❌ 언어 시스템 초기화 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeLanguage();

    return () => {
      i18nService.removeLanguageChangeListener(handleLanguageChange);
    };
  }, [handleLanguageChange, isInitialized]);

  const changeLanguage = async (languageCode) => {
    if (languageCode === currentLanguage) {
      return true;
    }

    console.log('🌐 언어 변경 시도:', currentLanguage, '->', languageCode);
    setIsLoading(true);
    
    try {
      const success = await i18nService.setLanguage(languageCode);
      if (success) {
        console.log('✅ 언어 변경 성공:', languageCode);
      } else {
        console.error('❌ 언어 변경 실패:', languageCode);
      }
      return success;
    } catch (error) {
      console.error('💥 언어 변경 오류:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const t = useCallback((key, params) => {
    return i18nService.t(key, params);
  }, [currentLanguage]);

  return {
    t,
    currentLanguage,
    changeLanguage,
    isLoading,
    isInitialized,
    supportedLanguages: i18nService.getSupportedLanguages()
  };
};