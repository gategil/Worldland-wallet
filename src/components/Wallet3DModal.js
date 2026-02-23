// src/components/Wallet3DModal.js
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { X } from 'lucide-react';
import './Wallet3DModal.css';

const Wallet3DModal = ({ isOpen, onClose, wallet }) => {
  const containerRef = useRef(null);
  const requestRef = useRef();
  const rendererRef = useRef();
  const cameraRef = useRef();

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // 컨테이너 크기 가져오기
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // --- 1. Scene Setup ---
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4.8; // 카드 전체가 잘 보이도록 거리 미세 조정
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0); // 배경 투명

    containerRef.current.innerHTML = ''; 
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- 2. Texture Generation (디자인 적용) ---
    const createCardTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');

      // A. 배경 (HTML 파일의 Blue Gradient 스타일 적용)
      const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
      gradient.addColorStop(0, '#0f2027');   // Deep Navy
      gradient.addColorStop(0.5, '#203a43'); // Teal Dark
      gradient.addColorStop(1, '#2c5364');   // Blue Grey
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1024, 640);

      // B. 노이즈 패턴 (플라스틱 질감)
      for(let i=0; i<5000; i++) {
          ctx.fillStyle = `rgba(255,255,255, ${Math.random() * 0.05})`;
          ctx.beginPath();
          ctx.arc(Math.random()*1024, Math.random()*640, Math.random()*2, 0, Math.PI*2);
          ctx.fill();
      }

      // C. IC 칩 (HTML 파일의 디테일 적용 - 둥근 사각형 및 회로선)
      ctx.fillStyle = '#d4af37'; // Gold
      ctx.beginPath();
      // roundRect 호환성 처리
      if (ctx.roundRect) {
        ctx.roundRect(120, 200, 130, 100, 15);
      } else {
        ctx.rect(120, 200, 130, 100);
      }
      ctx.fill();
      
      // IC 칩 회로선
      ctx.strokeStyle = '#b8860b'; // Dark Gold
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(120, 250); ctx.lineTo(250, 250); // 가로선
      ctx.moveTo(185, 200); ctx.lineTo(185, 300); // 세로선
      ctx.moveTo(150, 230); ctx.lineTo(150, 270); // 내부 회로
      ctx.moveTo(220, 230); ctx.lineTo(220, 270);
      ctx.stroke();

      // D. 비접촉 결제 심볼 (와이파이 모양) - HTML 디자인 적용
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 4;
      for(let i=1; i<=4; i++) {
          ctx.beginPath();
          // 우측 상단 배치 (좌표 조정: 920, 300 -> 900, 250)
          ctx.arc(900, 250, i*10, -Math.PI/4, Math.PI/4, true); 
          ctx.stroke();
      }

      // E. 텍스트: "WorldLand" (VISA 위치)
      ctx.fillStyle = 'white';
      ctx.font = 'italic bold 70px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10;
      ctx.fillText('WorldLand', 950, 120);
      ctx.shadowBlur = 0;
      
      // 로고 하단 장식 선
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(820, 130, 130, 4);

      // F. 카드 번호 (양각 효과 - Embossing)
      const address = wallet?.address || '0x0000000000000000';
      // 주소가 길어서 두 줄로 나눔
      const row1 = address.substring(0, 21);
      const row2 = address.substring(21, 42);

      ctx.font = '500 42px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.letterSpacing = "4px"; // 자간 추가

      // 그림자 (Shadow)
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(row1, 83, 403);
      ctx.fillText(row2, 83, 463);
      
      // 본체 (Highlight)
      ctx.fillStyle = '#e0e0e0';
      ctx.fillText(row1, 80, 400);
      ctx.fillText(row2, 80, 460);

      // G. 유효기간 (VALID THRU) & 이름
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#cccccc';
      ctx.fillText('VALID THRU', 500, 505);
      
      ctx.font = '32px "Courier New", monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText('12/99', 620, 510);
      
      ctx.font = '30px "Courier New", monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#eeeeee';
      ctx.fillText((wallet?.alias || 'WORLDLAND USER').toUpperCase(), 80, 560);

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    };

    // --- 3. 3D Objects ---
    // HTML 파일과 동일한 비율(1.58) 유지: 3.16 x 2.0
    const cardGeometry = new THREE.BoxGeometry(3.16, 2.0, 0.05); // 두께 약간 증가 (0.02 -> 0.05)
    
    const cardTexture = createCardTexture();
    
    // 앞면 재질 (플라스틱 광택)
    const frontMaterial = new THREE.MeshPhysicalMaterial({
      map: cardTexture,
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0
    });

    // 옆면/뒷면 재질 (어둡게)
    const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    // 재질 배열 (우, 좌, 상, 하, 앞, 뒤)
    const materials = [
      sideMaterial, sideMaterial, sideMaterial, sideMaterial,
      frontMaterial,
      sideMaterial
    ];

    const card = new THREE.Mesh(cardGeometry, materials);
    card.castShadow = true;
    card.receiveShadow = true;
    scene.add(card);

    // 3-1. WorldLand Logo (3D Layer - 기존 기능 유지)
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('/worldland-logo-512x512.png', (logoTexture) => {
      const logoGeometry = new THREE.PlaneGeometry(0.7, 0.7);
      const logoMaterial = new THREE.MeshBasicMaterial({ 
        map: logoTexture,
        transparent: true,
        opacity: 0.95
      });
      const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);
      // 텍스트 "WorldLand" 옆에 배치하거나 겹치지 않게 조정 (여기서는 카드 위에 살짝 띄움)
      logoMesh.position.set(1.1, 0.1, 0.04); 
      card.add(logoMesh);
    });

    // --- 4. Lights (HTML 디자인의 조명 효과 적용) ---
    // 은은한 기본 조명
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // 메인 스포트라이트 (위에서 아래로)
    const spotLight = new THREE.SpotLight(0xffffff, 1.0);
    spotLight.position.set(0, 5, 5);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 1;
    spotLight.castShadow = true;
    scene.add(spotLight);

    // 마우스 따라다니는 포인트 조명 (Cyan - 홀로그램 느낌)
    const movingLight = new THREE.PointLight(0x00ffff, 2, 10);
    movingLight.position.set(0, 0, 3);
    scene.add(movingLight);

    // 반대편 따뜻한 보조 조명 (Orange)
    const warmLight = new THREE.PointLight(0xffaa00, 1.5, 10);
    warmLight.position.set(-3, -3, 3);
    scene.add(warmLight);

    // --- 5. Interaction & Animation ---
    let mouseX = 0;
    let mouseY = 0;
    
    const handleMouseMove = (event) => {
        // 캔버스 컨테이너 기준 상대 좌표 계산이 더 정확할 수 있으나, 
        // 전체 화면 제스처를 위해 window 기준 사용 (기존 유지)
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;
        
        // -1 ~ 1 정규화
        mouseX = (event.clientX - windowHalfX) / windowHalfX;
        mouseY = (event.clientY - windowHalfY) / windowHalfY;
    };

    document.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      if (!rendererRef.current) return;
      requestRef.current = requestAnimationFrame(animate);
      const time = Date.now() * 0.001;

      // 1. 카드 기본 부유 모션 (Floating)
      card.position.y = Math.sin(time) * 0.05;

      // 2. 마우스 틸트 (Tilt) - 부드러운 보간
      const targetRotX = mouseY * 0.4;
      const targetRotY = mouseX * 0.4;
      
      card.rotation.x += (targetRotX - card.rotation.x) * 0.1;
      card.rotation.y += (targetRotY - card.rotation.y) * 0.1;

      // 3. 조명 애니메이션
      // 마우스 위치에 따라 Cyan 조명 이동 (반사광 효과)
      movingLight.position.x = mouseX * 3;
      movingLight.position.y = -mouseY * 3;
      
      // 조명 색상 사이클링 (홀로그램 느낌)
      movingLight.color.setHSL((time * 0.1) % 1, 0.8, 0.5);

      renderer.render(scene, camera);
    };

    animate();

    // --- 6. Resize Handler ---
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      cardGeometry.dispose();
      cardMaterial.dispose();
      renderer.dispose();
    };
  }, [isOpen, wallet]);

  if (!isOpen) return null;

  return (
    <div className="wallet-3d-modal-overlay">
      <button 
        onClick={onClose}
        className="wallet-3d-close-btn"
      >
        <X size={48} />
      </button>
      
      <div ref={containerRef} className="wallet-3d-canvas-container" />
      
      <div className="wallet-3d-auth-text">
        AUTHENTICATING WORLDLAND ACCESS...
      </div>
    </div>
  );
};

export default Wallet3DModal;