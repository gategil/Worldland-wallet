// src/components/QrScanner.js
import React, { useState, useEffect, useRef } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
// Html5QrcodeScanner와 추가 설정을 위한 Html5QrcodeScanType을 가져옵니다.
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import './QrScanner.css';

const QrScanner = ({ onScanSuccess, onClose }) => {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [isScanned, setIsScanned] = useState(false);
  const [showCameraSelect, setShowCameraSelect] = useState(false); // 카메라 선택 UI 표시 여부
  
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    
    // 성공 콜백
    const onScanSuccessCallback = (decodedText) => {
      if (!isMounted || isScanned) return;
      
      consolelog('QR 코드 스캔 성공:', decodedText);
      setIsScanned(true);
      
      // 스캐너 중지
      if (html5QrcodeScannerRef.current) {
        // html5QrcodeScanner.clear()는 스캐너를 중지하고 정리합니다.
        html5QrcodeScannerRef.current.clear()
          .then(() => {
            consolelog('스캐너 정리 완료');
            if (isMounted) {
              onScanSuccess(decodedText);
            }
          })
          .catch((err) => {
            consoleerror('스캐너 정리 실패:', err);
            // 정리 실패 시에도 결과는 전달해야 합니다.
            if (isMounted) {
              onScanSuccess(decodedText);
            }
          });
      } else {
        onScanSuccess(decodedText);
      }
    };

    // 에러 콜백
    const onScanErrorCallback = (errorMessage) => {
      if (!isMounted) return;
      
      // 일반적인 스캔 중 에러는 무시
      if (errorMessage.includes('NotFoundException')) {
        return;
      }
      
      // 사용자에게 에러를 보여줍니다 (예: 카메라 접근 권한 거부 시)
      if (errorMessage.includes('NotAllowedError') || errorMessage.includes('PermissionDeniedError')) {
          setError('카메라 접근이 거부되었습니다. 권한을 확인해주세요.');
      }
      
      consolewarn('QR 스캔 에러:', errorMessage);
    };

    // 기존 스캐너 정리
    const cleanupScanner = () => {
      const readerElement = document.getElementById('qr-reader');
      if (readerElement) {
        // html5-qrcode가 생성한 내부 요소를 깔끔하게 제거
        readerElement.innerHTML = ''; 
      }
      
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear()
          .catch((err) => {
            consoleerror('스캐너 정리 실패:', err);
          });
        html5QrcodeScannerRef.current = null;
      }
    };

    // 초기화 전에 기존 스캐너 정리
    cleanupScanner();

    // 약간의 지연 후 스캐너 초기화 (DOM 렌더링을 기다림)
    const timeoutId = setTimeout(() => {
      if (!isMounted) return;

      try {
        // localStorage에서 카메라 권한 상태 확인
        const cameraPermissionGranted = localStorage.getItem('qr_camera_permission') === 'granted';
        const lastUsedCamera = localStorage.getItem('qr_last_camera');
        
        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          {
            fps: 10,
            qrbox: { width: 300, height: 300 },
            aspectRatio: 1.0,
            rememberLastUsedCamera: true, // true로 변경하여 마지막 카메라 기억
            showTorchButtonIfSupported: true,
            defaultCamera: lastUsedCamera || undefined, // 마지막 사용 카메라가 있으면 사용
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            },
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
              Html5QrcodeScanType.SCAN_TYPE_FILE
            ],
            disableFlip: false,
          },
          false  // verbose 모드 (true로 변경하면 더 많은 로그 출력)
        );

        html5QrcodeScannerRef.current = scanner;
        scanner.render(onScanSuccessCallback, onScanErrorCallback);

        // 카메라 권한 승인 시 localStorage에 저장
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(() => {
            localStorage.setItem('qr_camera_permission', 'granted');
            consolelog('카메라 권한 승인됨');
          })
          .catch((err) => {
            consolewarn('카메라 권한 요청 실패:', err);
          });

        // 카메라 선택 변경 감지 및 저장
        setTimeout(() => {
          const cameraSelectElement = document.querySelector('#qr-reader__camera_selection');
          if (cameraSelectElement) {
            cameraSelectElement.addEventListener('change', (e) => {
              localStorage.setItem('qr_last_camera', e.target.value);
              consolelog('선택한 카메라 저장됨:', e.target.value);
            });
          }

          // 카메라 선택 드롭다운 찾기 (여러 selector 시도)
          const cameraSelectDropdown = document.querySelector('#qr-reader__camera_selection') 
                                      || document.querySelector('#qr-reader__dashboard_section_csr select');
          
          if (cameraSelectDropdown) {
            const parentSection = cameraSelectDropdown.closest('#qr-reader__dashboard_section_csr') 
                                || cameraSelectDropdown.parentElement;
            
            if (parentSection && !showCameraSelect) {
              parentSection.style.display = 'none';
            }
          }
        }, 500);
        
        consolelog('QR 스캐너 초기화 완료');
      } catch (err) {
        consoleerror('QR 스캐너 초기화 실패:', err);
        if (isMounted) {
          setError('카메라를 초기화할 수 없습니다. 장치와 권한을 확인하세요.');
        }
      }
    }, 100);

    // cleanup 함수
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      cleanupScanner();
    };
  }, []); // dependency array를 비워서 한 번만 실행

  // showCameraSelect 변경 감지
  useEffect(() => {
    // DOM이 완전히 렌더링될 때까지 여러 번 시도
    const showHideCameraSelect = () => {
      const cameraSelectSection = document.querySelector('#qr-reader__dashboard_section_csr select');
      
      if (cameraSelectSection) {
        const parentSection = cameraSelectSection.closest('#qr-reader__dashboard_section_csr') 
                            || cameraSelectSection.parentElement;
        
        if (parentSection) {
          if (showCameraSelect) {
            parentSection.style.display = 'block';
          } else {
            parentSection.style.display = 'none';
          }
        }
      }
    };

    // 즉시 실행
    showHideCameraSelect();
    
    // 약간의 지연 후 재시도 (DOM이 아직 준비되지 않았을 경우를 대비)
    const timeoutId = setTimeout(showHideCameraSelect, 100);
    
    return () => clearTimeout(timeoutId);
  }, [showCameraSelect]);

  return (
    <div className="qr-scanner-overlay">
      <div className="qr-scanner-modal">
        <div className="scanner-header">
          <h3>{t('SendTransaction.scanQRCode') || 'QR 코드 스캔'}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="scanner-body">
          <div ref={scannerRef} id="qr-reader"></div>
          
          {error && (
            <div className="scanner-error">
              {error}
            </div>
          )}

          <div className="scanner-info">
            <p>{t('SendTransaction.pointyourcamera') || 'QR 코드를 카메라에 비춰주세요'}</p>
            <button 
              className="camera-select-toggle-btn"
              onClick={() => setShowCameraSelect(!showCameraSelect)}
            >
              📷 {showCameraSelect ? '카메라 선택 숨기기' : '카메라 선택'}
            </button>
          </div>
        </div>

        <div className="scanner-actions">
          <button className="cancel-btn" onClick={onClose}>
            {t('SendTransaction.cancel') || '취소'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrScanner;