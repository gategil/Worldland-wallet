// src/components/MyNFT.js

import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import { ArrowLeft, RefreshCw, ExternalLink, Image as ImageIcon, AlertCircle, Search, Send, ChevronLeft } from 'lucide-react';
import './MyNFT.css';
import './common.css';
import SendNFT from './SendNFT';
import { ethers } from 'ethers'; 

const NFT_CONTRACT_ADDRESS = '0xc3d64CBB90CA3A4ec30D4E2Acab9a01899552af8';

const FULL_NFT_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getTokenDetails(uint256 tokenId) view returns (address owner, string uri, uint256 mintedAt, address minter)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokensOfOwner(address owner) view returns (uint256[])"
];

// 여러 IPFS 게이트웨이 목록 (순서대로 시도)
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://hardbin.com/ipfs/',
  'https://ipfs.eth.aragon.network/ipfs/'
];

// IPFS URI를 여러 게이트웨이 URL로 변환
const getIPFSUrls = (ipfsUri) => {
  if (!ipfsUri) return [];
  
  if (ipfsUri.startsWith('ipfs://')) {
    const hash = ipfsUri.replace('ipfs://', '');
    return IPFS_GATEWAYS.map(gateway => `${gateway}${hash}`);
  }
  
  return [ipfsUri];
};

// NFTDetailModal 컴포넌트
const NFTDetailModal = ({ nftDetail, onClose, isLoading }) => {
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageUrlIndex, setImageUrlIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (nftDetail?.image) {
      const imageUrls = getIPFSUrls(nftDetail.image);
      if (imageUrls.length > 0) {
        setCurrentImageUrl(imageUrls[0]);
        setImageUrlIndex(0);
        setImageError(false);
      }
    }
  }, [nftDetail?.image]);

  const handleImageError = () => {
    if (!nftDetail?.image) {
      setImageError(true);
      return;
    }

    const imageUrls = getIPFSUrls(nftDetail.image);
    const nextIndex = imageUrlIndex + 1;

    if (nextIndex < imageUrls.length) {
      setCurrentImageUrl(imageUrls[nextIndex]);
      setImageUrlIndex(nextIndex);
    } else {
      setImageError(true);
    }
  };

  if (!nftDetail) return null;

  return (
    <div className="nft-detail-modal-overlay" onClick={onClose}>
      <div className="nft-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>×</button>
        
        {isLoading ? (
          <div className="modal-loading">
            <div className="spinner"></div>
            <p>상세 정보를 불러오는 중...</p>
          </div>
        ) : (
          <div className="modal-content-wrapper">
            {/* 1. 상단: Full Name */}
            <div className="modal-title-section">
              <h2 className="modal-nft-title">{nftDetail.fullName}</h2>
            </div>

            {/* 2. 중단: Image + 정보들 */}
            <div className="modal-middle-grid">
              {/* 왼쪽: 이미지 */}
              <div className="modal-image-section">
                {currentImageUrl && !imageError ? (
                  <img 
                    src={currentImageUrl} 
                    alt={nftDetail.fullName}
                    onError={handleImageError}
                    className="modal-nft-image"
                  />
                ) : (
                  <div className="modal-image-placeholder">
                    <ImageIcon size={80} />
                    <span className="modal-token-id">#{nftDetail.tokenId}</span>
                  </div>
                )}
              </div>

              {/* 오른쪽: 정보 블록들 */}
              <div className="modal-info-section">
                {/* 기본 정보 */}
                <div className="modal-info-block">
                  <h3>기본 정보</h3>
                  <div className="modal-info-row">
                    <span className="info-label">토큰 ID:</span>
                    <span className="info-value">#{nftDetail.tokenId}</span>
                  </div>
                  <div className="modal-info-row">
                    <span className="info-label">컨트랙트:</span>
                    <span className="info-value mono">
                      {nftDetail.contractAddress.substring(0, 10)}...{nftDetail.contractAddress.substring(nftDetail.contractAddress.length - 8)}
                    </span>
                  </div>
                </div>

                {/* 발행 정보 */}
                {nftDetail.mintInfo && (
                  <div className="modal-info-block">
                    <h3>발행 정보</h3>
                    <div className="modal-info-row">
                      <span className="info-label">발행자:</span>
                      <span className="info-value mono">
                        {nftDetail.mintInfo.minter.substring(0, 10)}...{nftDetail.mintInfo.minter.substring(nftDetail.mintInfo.minter.length - 8)}
                      </span>
                    </div>
                    <div className="modal-info-row">
                      <span className="info-label">발행일:</span>
                      <span className="info-value">{nftDetail.mintInfo.mintDate}</span>
                    </div>
                  </div>
                )}

                {/* 소유 정보 */}
                <div className="modal-info-block">
                  <h3>소유 정보</h3>
                  <div className="modal-info-row">
                    <span className="info-label">현재 소유자:</span>
                    <span className="info-value mono">
                      {nftDetail.owner.substring(0, 10)}...{nftDetail.owner.substring(nftDetail.owner.length - 8)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 하단: 설명 */}
            {nftDetail.description && (
              <div className="modal-description-section">
                <h3>설명</h3>
                <p className="modal-description">{nftDetail.description}</p>
              </div>
            )}

            {/* 버튼들 */}
            <div className="modal-actions">
              <button 
                className="modal-action-btn primary"
                onClick={() => window.open(
                  `https://scan.worldland.foundation/token/${nftDetail.contractAddress}?a=${nftDetail.tokenId}`,
                  '_blank'
                )}
              >
                <ExternalLink size={16} />
                Explorer에서 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// NFTCard 컴포넌트
const NFTCard = ({ nft, onClick, onSendClick }) => {
  const [imageError, setImageError] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageUrlIndex, setImageUrlIndex] = useState(0);
  
  useEffect(() => {
    let isMounted = true;
    
    const loadMetadata = async () => {
      if (!nft.tokenURI) return;
      
      setIsLoadingMetadata(true);
      
      // 지연 시간 추가하여 순차 로딩
      const delay = Math.random() * 2000 + 1000; // 1~3초 랜덤 지연
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const metadataUrls = getIPFSUrls(nft.tokenURI);
      
      // 여러 게이트웨이를 순차적으로 시도
      for (let i = 0; i < metadataUrls.length; i++) {
        if (!isMounted) break;
        
        try {
          const url = metadataUrls[i];
          consolelog(`메타데이터 시도 (${i + 1}/${metadataUrls.length}):`, url);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok && isMounted) {
            const data = await response.json();
            consolelog('✅ 메타데이터 로드 성공:', data);
            setMetadata(data);
            break; // 성공하면 반복 종료
          } else if (response.status === 429) {
            consolewarn(`⚠️ Rate limit (${response.status}), 다음 게이트웨이 시도...`);
            // 다음 게이트웨이로 즉시 이동
            continue;
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            consolewarn('⏱️ 타임아웃, 다음 게이트웨이 시도...');
          } else {
            consolewarn('❌ 메타데이터 로드 실패:', err.message);
          }
          // 마지막 시도가 아니면 다음 게이트웨이로
          if (i < metadataUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
            continue;
          }
        }
      }
      
      if (isMounted) {
        setIsLoadingMetadata(false);
      }
    };
    
    loadMetadata();
    
    return () => {
      isMounted = false;
    };
  }, [nft.tokenURI, nft.tokenId]);

  // 메타데이터가 로드되면 이미지 URL 설정
  useEffect(() => {
    if (metadata?.image) {
      const imageUrls = getIPFSUrls(metadata.image);
      if (imageUrls.length > 0) {
        setCurrentImageUrl(imageUrls[0]);
        setImageUrlIndex(0);
      }
    }
  }, [metadata]);

  // 이미지 로드 실패 시 다음 게이트웨이 시도
  const handleImageError = () => {
    if (!metadata?.image) {
      setImageError(true);
      return;
    }

    const imageUrls = getIPFSUrls(metadata.image);
    const nextIndex = imageUrlIndex + 1;

    if (nextIndex < imageUrls.length) {
      consolelog(`이미지 로드 실패, 다음 게이트웨이 시도 (${nextIndex + 1}/${imageUrls.length})`);
      setCurrentImageUrl(imageUrls[nextIndex]);
      setImageUrlIndex(nextIndex);
    } else {
      consolewarn('모든 게이트웨이에서 이미지 로드 실패');
      setImageError(true);
    }
  };

  const name = metadata?.name || nft.tokenName || `Token #${nft.tokenId}`;
  const description = metadata?.description || '';

  const formatDate = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp * 1000); 
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="nft-card">
      <div className="nft-image-container" onClick={() => onClick(nft)}>
        {isLoadingMetadata ? (
          <div className="nft-image-placeholder">
            <div className="spinner-small"></div>
            <span className="loading-text">로딩 중...</span>
          </div>
        ) : currentImageUrl && !imageError ? (
          <img 
            src={currentImageUrl} 
            alt={name}
            onError={handleImageError}
            className="nft-image"
            loading="lazy"
          />
        ) : (
          <div className="nft-image-placeholder">
            <ImageIcon className="placeholder-icon" />
            <span className="token-id">#{nft.tokenId}</span>
          </div>
        )}
      </div>
      <div className="nft-info" onClick={() => onClick(nft)}>
        <h3 className="nft-name" title={name}>{name}</h3>
        {description && (
          <p className="nft-description" title={description}>
            {description.length > 60 ? description.substring(0, 60) + '...' : description}
          </p>
        )}
        
        <div className="nft-detail-row">
          <span className="detail-label">소유자:</span>
          <span className="detail-value" title={nft.owner}>
            {nft.owner.substring(0, 6)}...{nft.owner.substring(nft.owner.length - 4)}
          </span>
        </div>
        
        {nft.minter && (
          <div className="nft-detail-row">
            <span className="detail-label">발행자:</span>
            <span className="detail-value minter" title={nft.minter}>
              {nft.minter.substring(0, 6)}...{nft.minter.substring(nft.minter.length - 4)}
            </span>
          </div>
        )}
        
        {nft.mintedAt && (
          <div className="nft-detail-row">
            <span className="detail-label">발행일:</span>
            <span className="detail-value date">
              {formatDate(nft.mintedAt)}
            </span>
          </div>
        )}
        
        <p className="nft-contract">
          {nft.contractAddress.substring(0, 6)}...{nft.contractAddress.substring(nft.contractAddress.length - 4)}
        </p>
      </div>
      
      <div className="nft-actions">
        <button 
          className="send-nft-btn"
          onClick={(e) => onSendClick(nft, e)}
          title="NFT 전송"
        >
          <Send size={16} />
          전송
        </button>
      </div>
    </div>
  );
};

// MyNFT 컴포넌트
const MyNFT = ({ account, network, onBack, walletData }) => {
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [currentAddress, setCurrentAddress] = useState(account);
  const [debugInfo, setDebugInfo] = useState('');
  
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedNFTForSend, setSelectedNFTForSend] = useState(null);

  // 상세 정보 모달용 상태
  const [selectedNFTDetail, setSelectedNFTDetail] = useState(null);
  const [nftDetailLoading, setNftDetailLoading] = useState(false);

  useEffect(() => {
    if (!network) {
      setError('네트워크 정보를 찾을 수 없습니다.');
      return;
    }
    
    fetchNFTs(account);
  }, [account, network]);

  // RPC 호출 함수
  const callRpc = async (method, params) => {
    if (!network || !network.rpcUrl) {
      throw new Error('네트워크 RPC URL을 찾을 수 없습니다.');
    }

    const rpcUrl = network.rpcUrl;
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
      })
    });
    
    if (!response.ok) {
      throw new Error(`RPC 응답 오류: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      consoleerror('RPC Error:', data.error);
      throw new Error(`RPC 호출 오류: ${data.error.message || 'Unknown RPC error'}`);
    }
    
    return data.result;
  };

  // 메타데이터 동기 로드 함수
  const fetchMetadataSync = async (uri) => {
    if (!uri) return null;
    
    const metadataUrls = getIPFSUrls(uri);
    
    for (let i = 0; i < metadataUrls.length; i++) {
      try {
        const url = metadataUrls[i];
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          return data;
        } else if (response.status === 429) {
          consolewarn('⚠️ Rate limit, 다음 게이트웨이 시도...');
          continue;
        }
      } catch (err) {
        if (i < metadataUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
      }
    }
    
    return null;
  };

  // NFT 상세 정보 조회
  const fetchNFTDetailInfo = async (nft) => {
    setNftDetailLoading(true);
    
    try {
      consolelog('📋 NFT 상세 정보 조회 시작:', nft.tokenId);

      // 1. 메타데이터 로드
      let metadata = null;
      if (nft.tokenURI) {
        metadata = await fetchMetadataSync(nft.tokenURI);
      }

      // 2. getTokenDetails 함수 호출
      const getTokenDetailsSelector = '0x5c9a63f6';
      const paddedTokenId = nft.tokenId.toString(16).padStart(64, '0');
      
      let owner = nft.owner;
      let mintInfo = null;

      try {
        const detailsResult = await callRpc('eth_call', [{
          to: nft.contractAddress,
          data: getTokenDetailsSelector + paddedTokenId
        }, 'latest']);

        if (detailsResult && detailsResult !== '0x') {
          const hex = detailsResult.substring(2);
          
          // owner
          const ownerHex = hex.substring(24, 64);
          owner = '0x' + ownerHex;
          consolelog('✅ 소유자:', owner);

          // mintedAt
          const mintedAtHex = hex.substring(128, 192);
          const mintedAt = parseInt(mintedAtHex, 16);
          consolelog('✅ 발행 시간:', mintedAt);

          // minter
          const minterHex = hex.substring(216, 256);
          const minter = '0x' + minterHex;
          consolelog('✅ 발행자:', minter);

          if (mintedAt > 0) {
            const mintDate = new Date(mintedAt * 1000);
            
            mintInfo = {
              minter,
              mintedAt,
              mintDate: mintDate.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
            };
            
            consolelog('✅ 발행 정보:', mintInfo);
          }
        }
      } catch (detailsErr) {
        consolewarn('⚠️ getTokenDetails 호출 실패:', detailsErr);
      }

      // 3. 상세 정보 설정
      setSelectedNFTDetail({
        ...nft,
        metadata,
        owner: owner || nft.owner,
        mintInfo: mintInfo || (nft.mintedAt ? {
          minter: nft.minter,
          mintedAt: nft.mintedAt,
          mintDate: new Date(nft.mintedAt * 1000).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        } : null),
        fullName: metadata?.name || nft.tokenName || `Token #${nft.tokenId}`,
        description: metadata?.description || '',
        image: metadata?.image || null,
        attributes: metadata?.attributes || []
      });

      consolelog('✅ NFT 상세 정보 조회 완료');

    } catch (err) {
      consoleerror('❌ NFT 상세 정보 조회 실패:', err);
      alert('NFT 상세 정보를 불러오는데 실패했습니다: ' + err.message);
    } finally {
      setNftDetailLoading(false);
    }
  };

  const fetchNFTs = async (targetAddress = currentAddress) => {
    if (!targetAddress) {
      setError('주소가 설정되지 않았습니다.');
      return;
    }
    
    if (!network || !network.rpcUrl) {
      setError('네트워크 RPC URL이 유효하지 않습니다.');
      return;
    }
    
    consolelog('🚀 내 NFT 조회 시작');
    consolelog('조회 대상 주소:', targetAddress);
    
    setIsLoading(true);
    setError(null);
    setDebugInfo('NFT를 조회하고 있습니다...');
    setNfts([]);
    
    try {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, FULL_NFT_ABI, provider);

      const balance = await nftContract.balanceOf(targetAddress);
      const balanceNumber = Number(balance);
      
      consolelog(`✅ NFT 잔액: ${balanceNumber}개`);
      
      if (balanceNumber === 0) {
        setDebugInfo('이 주소는 NFT를 보유하고 있지 않습니다.');
        setNfts([]);
        return;
      }

      setDebugInfo(`NFT ${balanceNumber}개 발견. 상세 정보 조회 중...`);
      
      const tokenIdsBN = await nftContract.tokensOfOwner(targetAddress);
      const tokenIds = tokenIdsBN.map(id => Number(id)); 

      consolelog(`토큰 배열 길이: ${tokenIds.length}`);
      
      const allNFTs = [];
      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        setDebugInfo(`토큰 정보 조회 중... (${i + 1}/${tokenIds.length})`);

        let ownerAddress = '0xUnknown';
        let minterAddress = null;
        let mintedAt = null;
        let tokenURI = '';

        try {
            ownerAddress = await nftContract.ownerOf(tokenId);
        } catch (err) {
            consolewarn(`토큰 ${tokenId} ownerOf 조회 실패:`, err.message);
        }

        try {
          const details = await nftContract.getTokenDetails(tokenId);
          mintedAt = Number(details[2]);
          minterAddress = details[3];
          
          consolelog(`Token ${tokenId} - Minter: ${minterAddress}, MintedAt: ${new Date(mintedAt * 1000).toLocaleString()}`);
        } catch (detailsErr) {
          consolewarn(`토큰 ${tokenId} 상세 정보 조회 실패:`, detailsErr.message);
        }
        
        try {
          tokenURI = await nftContract.tokenURI(tokenId);
        } catch (uriErr) {
          consolewarn(`토큰 ${tokenId} URI 조회 실패:`, uriErr.message);
        }
 
        allNFTs.push({
          contractAddress: NFT_CONTRACT_ADDRESS,
          tokenId,
          tokenURI: tokenURI.trim(),
          owner: ownerAddress,
          minter: minterAddress,
          mintedAt: mintedAt,
          balance: balanceNumber
        });
      }

      consolelog(`✅ 총 ${allNFTs.length}개 NFT 조회 완료`);
      setDebugInfo(`✅ ${allNFTs.length}개의 NFT를 찾았습니다.`);
      setNfts(allNFTs);
      
    } catch (err) {
      consoleerror('❌ NFT 조회 오류:', err);
      setError(err.message || 'NFT를 불러오는데 실패했습니다.');
      setDebugInfo(`오류 발생: ${err.message}`);
      setNfts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchAddress = () => {
    const trimmedAddress = searchAddress.trim();
    
    if (!trimmedAddress) {
      setCurrentAddress(account);
      fetchNFTs(account);
      return;
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
      alert('유효한 주소 형식이 아닙니다.');
      return;
    }
    
    setCurrentAddress(trimmedAddress);
    fetchNFTs(trimmedAddress);
  };

  const handleResetToMyWallet = () => {
    setSearchAddress('');
    setCurrentAddress(account);
    fetchNFTs(account);
  };

  const handleNFTSendSuccess = (result) => {
    setShowSendModal(false);
    setSelectedNFTForSend(null);
    fetchNFTs(currentAddress);
    alert(`NFT가 성공적으로 전송되었습니다!\n트랜잭션: ${result.hash}`);
  };

  const handleSendClick = (nft, e) => {
    e.stopPropagation();
    
    if (!walletData || !walletData.privateKey) {
      alert('NFT를 전송하려면 지갑 정보가 필요합니다.');
      return;
    }
    
    setSelectedNFTForSend(nft);
    setShowSendModal(true);
  };

  return (
    <div className="nft-gallery">
      <div className="gallery-header">
        {/* <button onClick={onBack} className="back-btn">
          <ArrowLeft className="icon" /> 
        </button>  */}

        {/* <ChevronLeft size={24} onClick={onBack} style={{cursor: 'pointer'}} /> */}

        <div 
          onClick={onBack} style={{cursor: 'pointer'}}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#f0f0f0',  // 배경색
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <ChevronLeft size={24} />
        </div>
        

        <h1>My NFT</h1>
        {/* <button 
        onClick={() => fetchNFTs(currentAddress)} 
        disabled={isLoading} 
        className="refresh-btn">
          <RefreshCw className={`icon ${isLoading ? 'spinning' : ''}`} />
        </button> */}
        <button 
          onClick={() => fetchNFTs(currentAddress)} 
          className={`refresh-button ${isLoading ? 'refreshing' : ''}`}
          disabled={isLoading} 
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="address-search-section">
        <h3 className="search-title">NFT 조회할 지갑 주소</h3>
        <div className="address-search-container">
          <input
            type="text"
            className="address-input"
            placeholder="지갑 주소 입력 (0x...)"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearchAddress();
              }
            }}
          />
          <button 
            onClick={handleSearchAddress}
            className="search-btn"
            disabled={isLoading}
          >
            <Search className="icon" />
            조회
          </button>
          {currentAddress !== account && (
            <button 
              onClick={handleResetToMyWallet}
              className="reset-btn"
              disabled={isLoading}
            >
              <RefreshCw className="icon" />
              내 지갑
            </button>
          )}
        </div>
        
        <div className="current-address-display">
          조회 중인 주소: {currentAddress}
          {currentAddress === account && (
            <span className="my-wallet-badge">내 지갑</span>
          )}
        </div>
      </div>

      <div className="gallery-info">
        <p className="info-text">
          특정 주소가 소유한 NFT를 조회합니다.
        </p>
        {debugInfo && (
          <p className="info-text small" style={{color: '#3498db', marginTop: '8px', fontWeight: '600'}}>
            🔍 {debugInfo}
          </p>
        )}
      </div>

      {isLoading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>NFT를 불러오는 중...</p>
        </div>
      )}
      
      {error && (
        <div className="error-state">
          <AlertCircle className="icon" />
          <p>오류: {error}</p>
          <button onClick={() => fetchNFTs(currentAddress)} className="retry-btn">
            다시 시도
          </button>
        </div>
      )}
      
      {!isLoading && !error && (
        <>
          {nfts.length > 0 ? (
            <div className="nft-grid">
              {nfts.map((nft, index) => (
                <NFTCard 
                  key={`${nft.contractAddress}-${nft.tokenId}-${index}`} 
                  nft={nft} 
                  onClick={(clickedNft) => {
                    consolelog('NFT 클릭:', clickedNft);
                    fetchNFTDetailInfo(clickedNft);
                  }}
                  onSendClick={handleSendClick}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ImageIcon className="empty-icon" />
              <p>보유한 NFT가 없습니다.</p>
            </div>
          )}
        </>
      )}

      {showSendModal && selectedNFTForSend && walletData && (
        <SendNFT
          nft={selectedNFTForSend}
          walletData={walletData}
          onClose={() => {
            setShowSendModal(false);
            setSelectedNFTForSend(null);
          }}
          onSuccess={handleNFTSendSuccess}
        />
      )}

      {selectedNFTDetail && (
        <NFTDetailModal 
          nftDetail={selectedNFTDetail}
          onClose={() => setSelectedNFTDetail(null)}
          isLoading={nftDetailLoading}
        />
      )}
    </div>
  );
};

export default MyNFT;