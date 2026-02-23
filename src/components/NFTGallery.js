// src/components/NFTGallery.js
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import { ArrowLeft, RefreshCw, Image as ImageIcon, AlertCircle, ExternalLink, ChevronLeft } from 'lucide-react';
import './NFTGallery.css';
import './common.css';

const NFT_CONTRACT_ADDRESS = '0xc3d64CBB90CA3A4ec30D4E2Acab9a01899552af8';
const CACHE_DURATION = 5 * 60 * 1000; // 5분
const CACHE_KEY = 'nft_collections_cache';

// 여러 IPFS 게이트웨이 목록
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

// 캐시 관리 함수들
const getCachedCollections = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp, totalSupply } = JSON.parse(cached);
    
    if (Date.now() - timestamp > CACHE_DURATION) {
      consolelog('⏰ 캐시 만료됨');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    consolelog('✅ 유효한 캐시 발견');
    return { data, totalSupply };
  } catch (err) {
    consoleerror('캐시 로드 오류:', err);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
};

const setCachedCollections = (collections, totalSupply) => {
  try {
    const cacheData = {
      data: collections,
      totalSupply: totalSupply,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    consolelog('💾 캐시 저장 완료');
  } catch (err) {
    consoleerror('캐시 저장 오류:', err);
  }
};

const clearCache = () => {
  localStorage.removeItem(CACHE_KEY);
  consolelog('🗑️ 캐시 삭제됨');
};

// CollectionCard 컴포넌트
const CollectionCard = ({ collection, onClick }) => {
  const [thumbnailMetadata, setThumbnailMetadata] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageUrlIndex, setImageUrlIndex] = useState(0);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchMetadataForThumbnail = async (uri) => {
      if (!uri) return;
      
      // 랜덤 지연
      const delay = Math.random() * 2000 + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const metadataUrls = getIPFSUrls(uri);
      
      for (let i = 0; i < metadataUrls.length; i++) {
        if (!isMounted) break;
        
        try {
          const url = metadataUrls[i];
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok && isMounted) {
            const data = await response.json();
            setThumbnailMetadata(data);
            break;
          } else if (response.status === 429) {
            consolewarn('⚠️ Rate limit, 다음 게이트웨이 시도...');
            continue;
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            consolewarn('⏱️ 타임아웃, 다음 게이트웨이 시도...');
          }
          if (i < metadataUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
        }
      }
    };
    
    if (collection.thumbnailURI) {
      fetchMetadataForThumbnail(collection.thumbnailURI);
    }
    
    return () => {
      isMounted = false;
    };
  }, [collection.thumbnailURI]);
  
  // 메타데이터가 로드되면 이미지 URL 설정
  useEffect(() => {
    if (thumbnailMetadata?.image) {
      const imageUrls = getIPFSUrls(thumbnailMetadata.image);
      if (imageUrls.length > 0) {
        setCurrentImageUrl(imageUrls[0]);
        setImageUrlIndex(0);
      }
    }
  }, [thumbnailMetadata]);
  
  // 이미지 로드 실패 시 다음 게이트웨이 시도
  const handleImageError = () => {
    if (!thumbnailMetadata?.image) {
      setImageError(true);
      return;
    }

    const imageUrls = getIPFSUrls(thumbnailMetadata.image);
    const nextIndex = imageUrlIndex + 1;

    if (nextIndex < imageUrls.length) {
      consolelog(`컬렉션 이미지 로드 실패, 다음 게이트웨이 시도 (${nextIndex + 1}/${imageUrls.length})`);
      setCurrentImageUrl(imageUrls[nextIndex]);
      setImageUrlIndex(nextIndex);
    } else {
      setImageError(true);
    }
  };
  
  return (
    <div className="collection-card" onClick={onClick}>
      <div className="collection-thumbnail">
        {currentImageUrl && !imageError ? (
          <img 
            src={currentImageUrl} 
            alt={collection.name}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="collection-placeholder">
            <ImageIcon size={48} />
          </div>
        )}
      </div>
      <div className="collection-info">
        <h3 className="collection-name">{collection.name}</h3>
        <p className="collection-count">{collection.count}개의 NFT</p>
      </div>
    </div>
  );
};

// NFTCard 컴포넌트
const NFTCard = ({ nft, onClick }) => {
  const [imageError, setImageError] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [imageUrlIndex, setImageUrlIndex] = useState(0);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchMetadata = async (uri) => {
      if (!uri) return;
      
      setIsLoadingMetadata(true);
      
      // 랜덤 지연
      const delay = Math.random() * 2000 + 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const metadataUrls = getIPFSUrls(uri);
      
      for (let i = 0; i < metadataUrls.length; i++) {
        if (!isMounted) break;
        
        try {
          const url = metadataUrls[i];
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok && isMounted) {
            const data = await response.json();
            setMetadata(data);
            break;
          } else if (response.status === 429) {
            consolewarn('⚠️ Rate limit, 다음 게이트웨이 시도...');
            continue;
          }
        } catch (err) {
          if (err.name === 'AbortError') {
            consolewarn('⏱️ 타임아웃, 다음 게이트웨이 시도...');
          }
          if (i < metadataUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
        }
      }
      
      if (isMounted) {
        setIsLoadingMetadata(false);
      }
    };
    
    if (nft.tokenURI) {
      fetchMetadata(nft.tokenURI);
    }
    
    return () => {
      isMounted = false;
    };
  }, [nft.tokenURI]);

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
      setImageError(true);
    }
  };

  const name = metadata?.name || nft.name || `Token #${nft.tokenId}`;
  const description = metadata?.description || '';

  return (
    <div className="nft-card" onClick={onClick}>
      <div className="nft-image-container">
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
      <div className="nft-info">
        <h3 className="nft-name" title={name}>{name}</h3>
        {description && (
          <p className="nft-description" title={description}>
            {description.length > 60 ? description.substring(0, 60) + '...' : description}
          </p>
        )}
        {nft.owner && (
          <p className="nft-owner" title={nft.owner}>
            소유자: {nft.owner.substring(0, 6)}...{nft.owner.substring(nft.owner.length - 4)}
          </p>
        )}
        <p className="nft-contract">
          {nft.contractAddress.substring(0, 6)}...{nft.contractAddress.substring(nft.contractAddress.length - 4)}
        </p>
      </div>
    </div>
  );
};

// NFT 상세 정보 모달 컴포넌트
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

            {/* 버튼들 (기존 위치 유지 또는 하단으로 이동) */}
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

// NFTGallery 메인 컴포넌트
const NFTGallery = ({ account, network, onBack }) => {
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [selectedNFTDetail, setSelectedNFTDetail] = useState(null);
  const [nftDetailLoading, setNftDetailLoading] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(20);
  const [totalSupply, setTotalSupply] = useState(0);

  const [viewMode, setViewMode] = useState('collections');
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  
  const [isFromCache, setIsFromCache] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (!network) {
      setError('네트워크 정보를 찾을 수 없습니다.');
      return;
    }
    
    if (viewMode === 'collections' && collections.length === 0) {
      fetchAllNFTsAndGroupByCollection();
    }
    
    if (viewMode === 'nfts' && selectedCollection) {
      const start = currentPage * pageSize;
      const end = start + pageSize;
      const pageNFTs = selectedCollection.nfts.slice(start, end);
      setNfts(pageNFTs);
    }
  }, [currentPage, network, viewMode]);

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

  const fetchTotalSupply = async () => {
    const totalSupplySelector = '0x18160ddd';
    
    const result = await callRpc('eth_call', [{
      to: NFT_CONTRACT_ADDRESS,
      data: totalSupplySelector
    }, 'latest']);

    const supply = parseInt(result, 16);
    consolelog('전체 NFT 발행량:', supply);
    
    return supply;
  };

  const extractCollectionName = (nftName) => {
    if (!nftName) return 'Unknown Collection';
    
    const match = nftName.match(/^(.+?)\s*#\d+$/);
    
    if (match) {
      return match[1].trim();
    }
    
    return nftName.trim();
  };

  const fetchTokenBasicInfo = async (tokenId) => {
    const paddedTokenId = tokenId.toString(16).padStart(64, '0');
    
    let owner = null;
    try {
      const ownerOfSelector = '0x6352211e';
      const ownerResult = await callRpc('eth_call', [{
        to: NFT_CONTRACT_ADDRESS,
        data: ownerOfSelector + paddedTokenId
      }, 'latest']);
      
      owner = '0x' + ownerResult.substring(ownerResult.length - 40);
    } catch (err) {
      consolewarn(`토큰 ${tokenId} 소유자 조회 실패:`, err);
    }
    
    const tokenURISelector = '0xc87b56dd';
    const uriResult = await callRpc('eth_call', [{
      to: NFT_CONTRACT_ADDRESS,
      data: tokenURISelector + paddedTokenId
    }, 'latest']);
    
    let tokenURI = '';
    if (uriResult && uriResult !== '0x') {
      const hex = uriResult.substring(2);
      const dataOffset = parseInt(hex.substring(0, 64), 16) * 2;
      const dataStart = dataOffset + 64;
      
      if (hex.length > dataStart) {
        const length = parseInt(hex.substring(dataOffset, dataOffset + 64), 16) * 2;
        const dataHex = hex.substring(dataStart, dataStart + length);
        
        for (let j = 0; j < dataHex.length; j += 2) {
          const byte = parseInt(dataHex.substring(j, j + 2), 16);
          if (byte >= 32 && byte < 127) {
            tokenURI += String.fromCharCode(byte);
          }
        }
      }
    }
    
    let name = `Token #${tokenId}`;
    try {
      if (tokenURI) {
        const metadata = await fetchMetadataSync(tokenURI);
        if (metadata && metadata.name) {
          name = metadata.name;
        }
      }
    } catch (err) {
      consolewarn(`토큰 ${tokenId} 메타데이터 로드 실패:`, err);
    }
    
    return {
      contractAddress: NFT_CONTRACT_ADDRESS,
      tokenId,
      tokenURI: tokenURI.trim(),
      name,
      owner
    };
  };

  // NFT 상세 정보 조회 (컨트랙트의 getTokenDetails 활용)
  const fetchNFTDetailInfo = async (nft) => {
    setNftDetailLoading(true);
    
    try { 
      consolelog('📋 NFT 상세 정보 조회 시작:', nft.tokenId);

      // 1. 메타데이터 로드
      let metadata = null;
      if (nft.tokenURI) {
        metadata = await fetchMetadataSync(nft.tokenURI);
      }

      // 2. getTokenDetails 함수 호출 (owner, uri, mintedAt, minter 한 번에 조회)
      const getTokenDetailsSelector = '0x5c9a63f6'; // getTokenDetails(uint256)
      const paddedTokenId = nft.tokenId.toString(16).padStart(64, '0');
      
      let owner = null;
      let mintInfo = null;

      try {
        const detailsResult = await callRpc('eth_call', [{
          to: nft.contractAddress,
          data: getTokenDetailsSelector + paddedTokenId
        }, 'latest']);

        if (detailsResult && detailsResult !== '0x') {
          // 결과 파싱
          const hex = detailsResult.substring(2);
          
          // owner (address - 32바이트, 실제로는 20바이트 주소)
          const ownerHex = hex.substring(24, 64);
          owner = '0x' + ownerHex;
          consolelog('✅ 소유자:', owner);

          // uri offset (32바이트) - 건너뛰기
          const uriOffset = parseInt(hex.substring(64, 128), 16);
          
          // mintedAt (uint256 - 32바이트)
          const mintedAtHex = hex.substring(128, 192);
          const mintedAt = parseInt(mintedAtHex, 16);
          consolelog('✅ 발행 시간:', mintedAt);

          // minter (address - 32바이트, 실제로는 20바이트 주소)
          const minterHex = hex.substring(216, 256);
          const minter = '0x' + minterHex;
          consolelog('✅ 발행자:', minter);

          // mintedAt이 0이 아니면 발행 정보 설정
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
              }),
              blockNumber: null, // getTokenDetails에는 블록 번호가 없음
              transactionHash: null // getTokenDetails에는 트랜잭션 해시가 없음
            };
            
            consolelog('✅ 발행 정보:', mintInfo);
          }
        }
      } catch (detailsErr) {
        consolewarn('⚠️ getTokenDetails 호출 실패, 대체 방법 사용:', detailsErr);
        
        // 대체 방법 1: ownerOf 직접 호출
        try {
          const ownerOfSelector = '0x6352211e';
          const ownerResult = await callRpc('eth_call', [{
            to: nft.contractAddress,
            data: ownerOfSelector + paddedTokenId
          }, 'latest']);
          
          owner = '0x' + ownerResult.substring(ownerResult.length - 40);
          consolelog('✅ 소유자 (대체):', owner);
        } catch (ownerErr) {
          consolewarn('⚠️ 소유자 조회 실패:', ownerErr);
          owner = nft.owner || 'Unknown';
        }

        // 대체 방법 2: Transfer 이벤트로 발행 정보 조회
        try {
          const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          const paddedFrom = '0x0000000000000000000000000000000000000000000000000000000000000000';
          const paddedTokenIdForLog = nft.tokenId.toString(16).padStart(64, '0');
          
          const logs = await callRpc('eth_getLogs', [{
            fromBlock: '0x0',
            toBlock: 'latest',
            address: nft.contractAddress,
            topics: [
              transferEventSignature,
              paddedFrom,
              null,
              '0x' + paddedTokenIdForLog
            ]
          }]);

          if (logs && logs.length > 0) {
            const mintLog = logs[0];
            const minter = '0x' + mintLog.topics[2].substring(26);
            const blockNumber = parseInt(mintLog.blockNumber, 16);
            
            // 블록 정보로 타임스탬프 가져오기
            const block = await callRpc('eth_getBlockByNumber', [mintLog.blockNumber, false]);
            const timestamp = parseInt(block.timestamp, 16);
            const mintDate = new Date(timestamp * 1000);
            
            mintInfo = {
              minter,
              blockNumber,
              transactionHash: mintLog.transactionHash,
              mintedAt: timestamp,
              mintDate: mintDate.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })
            };
            
            consolelog('✅ 발행 정보 (이벤트):', mintInfo);
          }
        } catch (eventErr) {
          consolewarn('⚠️ Transfer 이벤트 조회 실패:', eventErr);
        }
      }

      // 3. 상세 정보 설정
      setSelectedNFTDetail({
        ...nft,
        metadata,
        owner: owner || nft.owner || 'Unknown',
        mintInfo,
        fullName: metadata?.name || nft.name || `Token #${nft.tokenId}`,
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

  const fetchAllNFTsFromContract = async () => {
    consolelog('🔍 컨트랙트에서 직접 조회 시작');
    
    const supply = await fetchTotalSupply();
    setTotalSupply(supply);
    
    if (supply === 0) {
      return { collections: [], totalSupply: 0 };
    }
    
    setDebugInfo(`이 ${supply}개의 NFT 발견! 메타데이터 수집 중...`);
    
    const allNFTs = [];
    
    for (let i = 0; i < supply; i++) {
      try {
        const tokenByIndexSelector = '0x4f6ccce7';
        const paddedIndex = i.toString(16).padStart(64, '0');
        
        const tokenIdResult = await callRpc('eth_call', [{
          to: NFT_CONTRACT_ADDRESS,
          data: tokenByIndexSelector + paddedIndex
        }, 'latest']);
        
        const tokenId = parseInt(tokenIdResult, 16);
        
        const tokenData = await fetchTokenBasicInfo(tokenId);
        allNFTs.push(tokenData);
        
        setDebugInfo(`NFT 정보 수집 중... (${i + 1}/${supply})`);
      } catch (err) {
        consolewarn(`인덱스 ${i} 조회 실패:`, err);
      }
    }
    
    const collectionMap = new Map();
    
    for (const nft of allNFTs) {
      const collectionName = extractCollectionName(nft.name);
      
      if (!collectionMap.has(collectionName)) {
        collectionMap.set(collectionName, {
          name: collectionName,
          nfts: [],
          count: 0,
          thumbnailURI: nft.tokenURI
        });
      }
      
      const collection = collectionMap.get(collectionName);
      collection.nfts.push(nft);
      collection.count++;
    }
    
    const collectionsArray = Array.from(collectionMap.values())
      .sort((a, b) => b.count - a.count);
    
    return { collections: collectionsArray, totalSupply: supply };
  };

  const fetchAllNFTsAndGroupByCollection = async (forceRefresh = false) => {
    if (!network || !network.rpcUrl) {
      setError('네트워크 RPC URL이 유효하지 않습니다.');
      return;
    }
    
    consolelog('🚀 스마트 캐싱 시작');
    
    if (forceRefresh) {
      clearCache();
    }
    
    setIsLoading(true);
    setError(null);
    setIsFromCache(false);
    
    try {
      const cached = getCachedCollections();
      if (cached && !forceRefresh) {
        consolelog('💨 캐시에서 즉시 로드');
        setCollections(cached.data);
        setTotalSupply(cached.totalSupply);
        setIsFromCache(true);
        setDebugInfo('캐시에서 로드됨. 백그라운드에서 업데이트 확인 중...');
        setIsLoading(false);
        
        setIsCheckingUpdate(true);
        
        try {
          const latestSupply = await fetchTotalSupply();
          
          if (latestSupply !== cached.totalSupply) {
            consolelog('🆕 새 NFT 발견! 전체 재조회');
            const diff = latestSupply - cached.totalSupply;
            setDebugInfo(`새 NFT ${diff > 0 ? '+' : ''}${diff}개 발견! 업데이트 중...`);
            
            setIsLoading(true);
            
            const { collections: newCollections, totalSupply: newTotal } = await fetchAllNFTsFromContract();
            
            setCollections(newCollections);
            setTotalSupply(newTotal);
            setDebugInfo(`✅ ${newCollections.length}개의 컬렉션 업데이트 완료!`);
            
            setCachedCollections(newCollections, newTotal);
            setIsFromCache(false);
          } else {
            consolelog('✅ 최신 데이터 확인됨');
            setDebugInfo(`✅ ${cached.data.length}개의 컬렉션 (최신 데이터)`);
          }
        } catch (updateErr) {
          consoleerror('업데이트 확인 실패:', updateErr);
          setDebugInfo('⚠️ 업데이트 확인 실패. 캐시 데이터 표시 중');
        } finally {
          setIsCheckingUpdate(false);
          setIsLoading(false);
        }
        
        return;
      }
      
      consolelog('🔍 캐시 없음. 컨트랙트 직접 조회');
      setDebugInfo('전체 NFT 공급량 확인 중...');
      
      const { collections: newCollections, totalSupply: newTotal } = await fetchAllNFTsFromContract();
      
      if (newTotal === 0) {
        setDebugInfo('발행된 NFT가 없습니다.');
        setCollections([]);
        return;
      }
      
      setCollections(newCollections);
      setTotalSupply(newTotal);
      setDebugInfo(`✅ ${newCollections.length}개의 컬렉션 발견!`);
      
      setCachedCollections(newCollections, newTotal);
      setIsFromCache(false);
      
    } catch (err) {
      consoleerror('❌ 컬렉션 조회 오류:', err);
      setError(err.message || 'NFT를 불러오는데 실패했습니다.');
      setDebugInfo(`오류 발생: ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsCheckingUpdate(false);
    }
  };

  const handleCollectionSelect = (collection) => {
    consolelog('컬렉션 선택:', collection.name);
    setSelectedCollection(collection);
    
    const pageNFTs = collection.nfts.slice(0, pageSize);
    setNfts(pageNFTs);
    
    setViewMode('nfts');
    setCurrentPage(0);
  };

  const handleBackToCollections = () => {
    setViewMode('collections');
    setSelectedCollection(null);
    setNfts([]);
    setCurrentPage(0);
  };

  const handlePageChange = (newPage) => {
    if (!selectedCollection) return;
    
    const totalPages = Math.ceil(selectedCollection.count / pageSize);
    if (newPage < 0 || newPage >= totalPages) return;
    
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = selectedCollection 
    ? Math.ceil(selectedCollection.count / pageSize) 
    : 0;

  return (
    <div className="nft-gallery">
      <div className="gallery-header">
        {/* <button 
          onClick={viewMode === 'collections' ? onBack : handleBackToCollections} 
          className="back-btn"
        >
          <ArrowLeft className="icon" /> 
        </button> */}

        {/* <ChevronLeft size={24} 
          onClick={viewMode === 'collections' ? onBack : handleBackToCollections} 
          style={{cursor: 'pointer'}} 
        /> */}

        <div 
            onClick={viewMode === 'collections' ? onBack : handleBackToCollections} 
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

        <h1>
          {viewMode === 'collections' ? 'NFT 컬렉션' : selectedCollection?.name}
        </h1>
        {/* <button 
          onClick={() => viewMode === 'collections' ? fetchAllNFTsAndGroupByCollection(true) : null} 
          disabled={isLoading || isCheckingUpdate} 
          className="nft-refresh-btn"
          title="강제 새로고침 (캐시 무시)"
        >
          <RefreshCw className={`icon ${(isLoading || isCheckingUpdate) ? 'spinning' : ''}`} />
        </button> */}
        <button 
            onClick={() => viewMode === 'collections' ? fetchAllNFTsAndGroupByCollection(true) : null} 
            className={`refresh-button ${(isLoading || isCheckingUpdate) ? 'refreshing' : ''}`}
            disabled={isLoading || isCheckingUpdate} 
          >
            <RefreshCw size={18} />
          </button>
      </div>

      {viewMode === 'collections' && (
        <>
          <div className="gallery-controls">
            <div className="gallery-stats">
              <h3>전체 NFT 컬렉션</h3>
              <p>
                이 {collections.length}개의 컬렉션 ({totalSupply}개의 NFT)
                {isFromCache && !isCheckingUpdate && (
                  <span className="cache-badge">캐시</span>
                )}
                {isCheckingUpdate && (
                  <span className="checking-badge">확인 중...</span>
                )}
              </p>
            </div>
          </div>

          <div className="gallery-info">
            <p className="info-text">
              WorldLand 블록체인의 모든 NFT 컬렉션을 탐색합니다.
            </p>
            {debugInfo && (
              <p className="info-text small" style={{color: '#3498db', marginTop: '8px', fontWeight: '600'}}>
                🔍 {debugInfo}
              </p>
            )}
            {isFromCache && !isCheckingUpdate && (
              <p className="info-text small" style={{color: '#27ae60', marginTop: '8px'}}>
                💾 빠른 로딩을 위해 캐시된 데이터를 표시합니다. 
                <button 
                  onClick={() => fetchAllNFTsAndGroupByCollection(true)}
                  style={{
                    marginLeft: '8px',
                    padding: '4px 8px',
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  최신 데이터 조회
                </button>
              </p>
            )}
          </div>

          {isLoading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>컬렉션을 불러오는 중...</p>
              <p style={{fontSize: '12px', color: '#7f8c8d', marginTop: '10px'}}>
                {debugInfo}
              </p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <AlertCircle className="icon" />
              <p>오류: {error}</p>
              <button onClick={() => fetchAllNFTsAndGroupByCollection(true)} className="retry-btn">
                다시 시도
              </button>
            </div>
          )}

          {!isLoading && !error && collections.length > 0 && (
            <div className="collection-grid">
              {collections.map((collection, index) => (
                <CollectionCard
                  key={`${collection.name}-${index}`}
                  collection={collection}
                  onClick={() => handleCollectionSelect(collection)}
                />
              ))}
            </div>
          )}

          {!isLoading && !error && collections.length === 0 && (
            <div className="empty-state">
              <ImageIcon className="empty-icon" />
              <p>컬렉션이 없습니다.</p>
              <p className="empty-hint">
                아직 발행된 NFT가 없거나 조회에 실패했습니다.
              </p>
            </div>
          )}
        </>
      )}

      {viewMode === 'nfts' && (
        <>
          <div className="gallery-controls">
            <div className="gallery-stats">
              <h3>{selectedCollection?.name}</h3>
              <p>{selectedCollection?.count}개의 NFT</p>
            </div>
            
            {selectedCollection && selectedCollection.count > pageSize && (
              <div className="pagination-controls">
                <button 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 0 || isLoading}
                  className="page-btn"
                >
                  ◀ 이전
                </button>
                
                <span className="page-info">
                  {currentPage + 1} / {totalPages}
                </span>
                
                <button 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1 || isLoading}
                  className="page-btn"
                >
                  다음 ▶
                </button>
              </div>
            )}
          </div>

          <div className="gallery-info">
            <p className="info-text">
              {selectedCollection?.name} 컬렉션의 NFT들입니다.
            </p>
          </div>

          {!isLoading && !error && nfts.length > 0 && (
            <>
              <div className="nft-grid">
                {nfts.map((nft, index) => (
                  <NFTCard 
                    key={`${nft.contractAddress}-${nft.tokenId}-${index}`} 
                    nft={nft} 
                    onClick={() => {
                      consolelog('NFT 클릭:', nft);
                      fetchNFTDetailInfo(nft);
                    }} 
                  />
                ))}
              </div>

              {selectedCollection && selectedCollection.count > pageSize && (
                <div className="pagination-controls bottom">
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0 || isLoading}
                    className="page-btn"
                  >
                    ◀ 이전
                  </button>
                  
                  <span className="page-info">
                    {currentPage + 1} / {totalPages}
                  </span>
                  
                  <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1 || isLoading}
                    className="page-btn"
                  >
                    다음 ▶
                  </button>
                </div>
              )}
            </>
          )}

          {!isLoading && !error && nfts.length === 0 && (
            <div className="empty-state">
              <ImageIcon className="empty-icon" />
              <p>표시할 NFT가 없습니다.</p>
            </div>
          )}
        </>
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

export default NFTGallery;