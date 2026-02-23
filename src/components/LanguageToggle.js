import React, { useState } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import ReactDOM from 'react-dom';
import { useTranslation } from '../hooks/useTranslation';
import { Globe, Check, Languages  } from 'lucide-react';
import './LanguageToggle.css';

const LanguageToggle = () => {
  const { currentLanguage, changeLanguage, supportedLanguages } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const languageChars = {
    ar: 'أ',
    en: 'A',
    es: 'E',
    fr: 'F',
    ja: 'あ',
    ko: '가',
    ru: 'А',
    zh: '中'
  };

  const handleLanguageChange = async (langCode) => {
  if (langCode !== currentLanguage) {
    setIsModalOpen(false);
    
    try {
      const success = await changeLanguage(langCode);
      
      if (success) {
        // 언어 변경 성공 후 페이지 새로고침
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        consoleerror('언어 변경 실패');
      }
    } catch (error) {
      consoleerror('언어 변경 오류:', error);
    }
  } else {
    setIsModalOpen(false);
  }
};

  // 모달 컨텐츠
  const modalContent = isModalOpen ? (
    <div className="language-modal-overlay" onClick={() => setIsModalOpen(false)}>
      <div className="language-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="language-modal-header">
          <div className="modal-title">
            <Globe size={24} />
            <h3>Select Language</h3>
          </div>
          <button 
            className="modal-close-btn"
            onClick={() => setIsModalOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="language-modal-body">
          <div className="language-grid">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                className={`language-option-card ${currentLanguage === lang.code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <div className="lang-char-large">
                  {languageChars[lang.code]}
                </div>
                <div className="lang-info">
                  <div className="lang-native">{lang.nativeName}</div>
                  <div className="lang-english">{lang.name}</div>
                </div>
                {currentLanguage === lang.code && (
                  <div className="lang-check">
                    <Check size={20} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button 
        className="language-toggle-btn"
        onClick={() => setIsModalOpen(true)}
        title="Change Language"
      >
        {/* {languageChars[currentLanguage] || 'A'} */}
        {/* <Languages size={24} />  */}
        {<img src='/images/languages.png' width='30px' height='30px'></img> || 'languageChars[currentLanguage]'}
      </button>

      {/* Portal을 사용하여 body에 직접 렌더링 */}
      {modalContent && ReactDOM.createPortal(
        modalContent,
        document.body
      )}
    </>
  );
};

export default LanguageToggle;