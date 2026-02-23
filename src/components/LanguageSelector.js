import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import './LanguageSelector.css';

const LanguageSelector = ({ showLabel = true, compact = false }) => {
  const { t, currentLanguage, changeLanguage, supportedLanguages, isLoading } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [localCurrentLanguage, setLocalCurrentLanguage] = useState(currentLanguage);

  // currentLanguage가 변경되면 로컬 상태도 업데이트
  useEffect(() => {
    setLocalCurrentLanguage(currentLanguage);
  }, [currentLanguage]);

  const handleLanguageChange = async (langCode) => {
    setIsOpen(false);
    
    if (langCode === localCurrentLanguage) {
      return; // 같은 언어 선택 시 아무것도 하지 않음
    }

    try {
      // 즉시 UI 업데이트 (낙관적 업데이트)
      setLocalCurrentLanguage(langCode);
      
      // 실제 언어 변경
      const success = await changeLanguage(langCode);
      
      if (!success) {
        // 실패 시 원래 언어로 되돌림
        setLocalCurrentLanguage(currentLanguage);
        consoleerror('언어 변경 실패');
      }
    } catch (error) {
      // 오류 시 원래 언어로 되돌림
      setLocalCurrentLanguage(currentLanguage);
      consoleerror('언어 변경 오류:', error);
    }
  };

  // 현재 표시할 언어 정보
  const displayLanguage = supportedLanguages.find(lang => lang.code === localCurrentLanguage) || 
                         supportedLanguages.find(lang => lang.code === 'en');

  return (
    <div className={`language-selector ${compact ? 'compact' : ''}`}>
      {showLabel && !compact && (
        <label className="language-label">
          <Globe size={16} />
          {t('settings.language')}
        </label>
      )}
      
      <div className="language-dropdown">
        <button 
          className={`language-current ${isLoading ? 'loading' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
        >
          <div className="current-lang">
            {compact ? (
              <>
                <Globe size={16} />
                <span>{displayLanguage.code.toUpperCase()}</span>
              </>
            ) : (
              <>
                <span className="lang-flag">{getFlagEmoji(displayLanguage.code)}</span>
                <span className="lang-name">{displayLanguage.nativeName}</span>
              </>
            )}
          </div>
          <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
        </button>

        {isOpen && (
          <div className="language-options">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                className={`language-option ${localCurrentLanguage === lang.code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={isLoading}
              >
                <span className="option-flag">{getFlagEmoji(lang.code)}</span>
                <div className="option-info">
                  <span className="option-native">{lang.nativeName}</span>
                  <span className="option-english">{lang.name}</span>
                </div>
                {localCurrentLanguage === lang.code && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOpen && <div className="language-overlay" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

// 국가별 이모지 플래그
const getFlagEmoji = (langCode) => {
  const flags = {
    en: '🇺🇸',
    ko: '🇰🇷',
    zh: '🇨🇳',
    ru: '🇷🇺',
    ja: '🇯🇵',
    es: '🇪🇸',
    fr: '🇫🇷',
    ar: '🇸🇦',    // 아랍어 (사우디아라비아)
  };
  return flags[langCode] || '🌐';
};

export default LanguageSelector;