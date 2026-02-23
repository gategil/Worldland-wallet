// src/services/walletService.js - 실제 토큰 데이터 조회 지원
import { ethers } from 'ethers';
import { NETWORKS, NETWORK_TOKENS } from './networkConfig';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';

// ERC-20 Token ABI (필수 함수들만)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)"
];

// ERC721 NFT ABI (필요한 함수들만)
const ERC721_ABI = [
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)"
];


// 거래 내역 캐시 클래스
class TransactionCache {
  constructor() {
    this.cacheKey = 'worldland_tx_cache';
    this.cacheDuration = 5 * 60 * 1000; // 5분
  }
  
  getCachedTransactions(address) {
    try {
      const cached = localStorage.getItem(`${this.cacheKey}_${address}`);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      const now = Date.now();
      
      if (now - data.timestamp > this.cacheDuration) {
        localStorage.removeItem(`${this.cacheKey}_${address}`);
        return null;
      }
      
      return data.transactions;
    } catch {
      return null;
    }
  }
  
  setCachedTransactions(address, transactions) {
    try {
      const data = {
        transactions,
        timestamp: Date.now()
      };
      localStorage.setItem(`${this.cacheKey}_${address}`, JSON.stringify(data));
    } catch (error) {
      consolewarn('캐시 저장 실패:', error);
    }
  }
}

// WorldLand Explorer API 클래스 - 실제 토큰 데이터 지원
class WorldLandExplorerAPI {
  constructor(network = 'testnet') {
    this.network = network;
    const networkConfig = NETWORKS[network] || NETWORKS.mainnet;
    // API 호출용 URL 사용 (explorerApi가 있으면 사용, 없으면 explorer 사용)
    this.baseUrl = networkConfig.explorerApi || networkConfig.explorer;
  }

  // 네트워크의 모든 토큰 목록 조회
  async getTokenList(page = 1, limit = 50) {
    try {
      const endpoint = `${this.baseUrl}/api/v2/tokens`;
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      const url = `${endpoint}?${params}`;
      consolelog('토큰 목록 API 요청:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`토큰 목록 API 요청 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        tokens: this.formatTokenList(data.items || []),
        pagination: {
          hasMore: data.next_page_params !== null,
          nextPageParams: data.next_page_params
        },
        source: 'blockscout-token-list'
      };

    } catch (error) {
      consolewarn('토큰 목록 조회 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 인기 토큰 목록 조회 (홀더가 많은 순서)
  async getPopularTokens(limit = 20) {
    try {
      // BlockScout API에서 토큰을 홀더 수 기준으로 정렬하여 조회
      const endpoint = `${this.baseUrl}/api/v2/tokens`;
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        sort: 'holder_count', // 홀더 수 기준 정렬
        order: 'desc'
      });

      const url = `${endpoint}?${params}`;
      consolelog('인기 토큰 API 요청:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`인기 토큰 API 요청 실패: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        tokens: this.formatTokenList(data.items || []),
        source: 'popular-tokens'
      };

    } catch (error) {
      consolewarn('인기 토큰 조회 실패:', error.message);
      // 실패 시 기본 토큰 목록 반환
      return this.getDefaultTokenList();
    }
  }

  // 토큰 검색
  async searchTokens(query, limit = 20) {
    try {
      const endpoint = `${this.baseUrl}/api/v2/search`;
      
      const params = new URLSearchParams({
        q: query,
        filter: 'token', // 토큰만 검색
        limit: limit.toString()
      });

      const url = `${endpoint}?${params}`;
      consolelog('토큰 검색 API 요청:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`토큰 검색 API 요청 실패: ${response.status}`);
      }

      const data = await response.json();
      
      // 검색 결과에서 토큰만 필터링
      const tokenResults = (data.items || []).filter(item => 
        item.type === 'token' || item.token
      );
      
      return {
        success: true,
        tokens: this.formatSearchResults(tokenResults),
        source: 'search-results'
      };

    } catch (error) {
      consolewarn('토큰 검색 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 계정의 모든 토큰 잔액 조회 (개선된 버전)
  async getAccountTokenBalances(address) {
    try {
      const endpoint = `${this.baseUrl}/api/v2/addresses/${address}/token-balances`;
      
      consolelog('토큰 잔액 조회 API 요청:', endpoint);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`토큰 잔액 API 요청 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 잔액이 0이 아닌 토큰만 필터링
      const nonZeroTokens = (data || []).filter(token => {
        const balance = token.value || token.balance || '0';
        return balance !== '0' && parseFloat(balance) > 0;
      });
      
      return {
        success: true,
        tokens: this.formatTokenBalances(nonZeroTokens),
        source: 'blockscout-balances'
      };

    } catch (error) {
      consolewarn('토큰 잔액 조회 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 외부 토큰 설정 로드
  async loadTokenConfig() {
    try {
      consolelog('📋 외부 토큰 설정 로드 중...');
      
      // iframe을 사용하여 token-config.html 로드
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = '/token-config.html';
      
      return new Promise((resolve, reject) => {
        iframe.onload = () => {
          try {
            // const tokens = iframe.contentWindow.WORLDLAND_DEFAULT_TOKENS;

            const currentNetwork = this.network; 
            const tokens = NETWORK_TOKENS[currentNetwork]; 

            document.body.removeChild(iframe);
            
            if (tokens && Array.isArray(tokens)) {
              consolelog(`✅ 외부 토큰 설정 로드 성공: ${tokens.length}개`);
              resolve(tokens);
            } else {
              consolewarn('⚠️ 외부 토큰 설정이 올바르지 않음, 기본값 사용');
              resolve(this.getFallbackTokenList());
            }
          } catch (error) {
            consolewarn('⚠️ 외부 토큰 설정 파싱 실패, 기본값 사용:', error);
            document.body.removeChild(iframe);
            resolve(this.getFallbackTokenList());
          }
        };
        
        iframe.onerror = () => {
          consolewarn('⚠️ 외부 토큰 설정 로드 실패, 기본값 사용');
          document.body.removeChild(iframe);
          resolve(this.getFallbackTokenList());
        };
        
        document.body.appendChild(iframe);
        
        // 5초 타임아웃
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
            consolewarn('⚠️ 외부 토큰 설정 로드 타임아웃, 기본값 사용');
            resolve(this.getFallbackTokenList());
          }
        }, 5000);
      });
    } catch (error) {
      consolewarn('⚠️ 토큰 설정 로드 실패, 기본값 사용:', error);
      return this.getFallbackTokenList();
    }
  }

  // 폴백 토큰 목록  
  getFallbackTokenList() {
    const currentNetworkKey = this.network || 'mainnet';
    const networkTokens = NETWORK_TOKENS[currentNetworkKey] || NETWORK_TOKENS.mainnet;
    
    consolelog(`📋 네트워크 [${currentNetworkKey}] 기본 토큰 목록 반환: ${networkTokens.length}개`);
    
    return networkTokens;
  }

  // 기본 토큰 목록 (API 실패 시 사용) - 수정됨
  async getDefaultTokenList() {
    try {
      const configTokens = await this.loadTokenConfig();
      
      // 외부 설정을 내부 포맷으로 변환
      const formattedTokens = configTokens.map(token => ({
        address: token.address,
        name: token.name || 'Unknown Token',
        symbol: token.symbol || 'UNK',
        decimals: parseInt(token.decimals || '18'),
        type: 'ERC-20',
        totalSupply: '0',
        holderCount: 0,
        description: token.description || '',
        verified: token.verified || false,
        homepage: token.homepage || null, // 홈페이지 URL 추가
        balance: '0',
        balanceRaw: '0',
        network: NETWORKS[this.network]?.name || 'Unknown Network'
      }));

      return {
        success: true,
        tokens: formattedTokens,
        source: 'external-config'
      };
    } catch (error) {
      consoleerror('❌ 외부 토큰 설정 로드 실패:', error);
      
      // 완전 실패 시 하드코딩된 기본값 사용
      const fallbackTokens = this.getFallbackTokenList().map(token => ({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        type: 'ERC-20',
        totalSupply: '0',
        holderCount: 0,
        description: '',
        verified: token.verified,
        homepage: token.homepage || null, // 홈페이지 URL 추가
        balance: '0',
        balanceRaw: '0'
      }));

      return {
        success: true,
        tokens: fallbackTokens,
        source: 'fallback-hardcoded'
      };
    }
  }

  // 토큰 목록 데이터 포맷팅
  formatTokenList(tokens) {
    return tokens.map(token => ({
      address: token.address,
      name: token.name || 'Unknown Token',
      symbol: token.symbol || 'UNK',
      decimals: parseInt(token.decimals || '18'),
      type: token.type || 'ERC-20',
      totalSupply: token.total_supply || '0',
      holderCount: token.holders_count || 0,
      description: token.description || '',
      verified: token.is_verified || false,
      homepage: token.homepage || null, // 홈페이지 URL 추가
      balance: '0', // 기본값, 실제 잔액은 별도 조회
      balanceRaw: '0'
    }));
  }

  // 검색 결과 포맷팅
  formatSearchResults(results) {
    return results.map(result => {
      const token = result.token || result;
      return {
        address: token.address,
        name: token.name || 'Unknown Token',
        symbol: token.symbol || 'UNK',
        decimals: parseInt(token.decimals || '18'),
        type: token.type || 'ERC-20',
        totalSupply: token.total_supply || '0',
        holderCount: token.holders_count || 0,
        description: token.description || '',
        verified: token.is_verified || false,
        balance: '0',
        balanceRaw: '0'
      };
    });
  }

  // 토큰 잔액 데이터 포맷팅  
  formatTokenBalances(tokens) {
    
    return tokens.map(token => ({
      address: token.token?.address || token.address,
      name: token.token?.name || token.name || 'Unknown Token',
      symbol: token.token?.symbol || token.symbol || 'UNK',
      decimals: parseInt(token.token?.decimals || token.decimals || '18'),
      balance: this.formatTokenAmount(
        token.value || token.balance || '0', 
        parseInt(token.token?.decimals || token.decimals || '18')
      ),
      balanceRaw: token.value || token.balance || '0',
      type: token.token?.type || 'ERC-20',
      verified: token.token?.is_verified || false,
      network: NETWORKS[this.network]?.name || 'Unknown Network'
    }));
  }

  // 기존 메서드들 유지...
  async getTokenBalance(address, tokenAddress) {
    try {
      const endpoint = `${this.baseUrl}/api/v2/addresses/${address}/tokens/${tokenAddress}`;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`특정 토큰 잔액 조회 실패: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        token: this.formatSingleToken(data)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatSingleToken(token) {
    return {
      address: token.address,
      name: token.name || 'Unknown Token',
      symbol: token.symbol || 'UNK',
      decimals: parseInt(token.decimals || '18'),
      balance: this.formatTokenAmount(token.balance || '0', parseInt(token.decimals || '18')),
      balanceRaw: token.balance || '0',
      type: token.type || 'ERC-20',
      verified: token.is_verified || false,
      network: NETWORKS[this.network]?.name || 'Unknown Network'
    };
  }

  // async getTokenTransfers(address, options = {}) {
  //   try {
  //     const {
  //       page = 1,
  //       limit = 20,
  //       tokenAddress = null,
  //       sort = 'desc'
  //     } = options;

  //     let endpoint = `${this.baseUrl}/api/v2/addresses/${address}/token-transfers`;
      
  //     const params = new URLSearchParams({
  //       page: page.toString(),
  //       limit: limit.toString(),
  //       sort: sort
  //     });

  //     if (tokenAddress) {
  //       params.append('token', tokenAddress);
  //     }

  //     const url = `${endpoint}?${params}`;
  //     consolelog('토큰 거래내역 API 요청:', url);

  //     const response = await fetch(url, {
  //       method: 'GET',
  //       headers: {
  //         'Accept': 'application/json'
  //       },
  //       signal: AbortSignal.timeout(10000)
  //     });

  //     if (!response.ok) {
  //       throw new Error(`토큰 거래내역 API 요청 실패: ${response.status}`);
  //     }

  //     const data = await response.json();
      
  //     return {
  //       success: true,
  //       transfers: this.formatTokenTransfers(data.items || []),
  //       pagination: {
  //         hasMore: data.next_page_params !== null,
  //         nextPageParams: data.next_page_params
  //       }
  //     };

  //   } catch (error) {
  //     consolewarn('토큰 거래내역 조회 실패:', error.message);
  //     return {
  //       success: false,
  //       error: error.message
  //     };
  //   }
  // }

  async getAllTransactions(address, options = {}) {
    try {
      const { limit = 20, tokenAddress = null } = options;
      
      consolelog('🔄 통합 거래내역 조회 시작:', { address, limit, tokenAddress });

      // 특정 토큰만 조회하는 경우
      if (tokenAddress) {
        consolelog('🪙 특정 토큰 전송내역만 조회:', tokenAddress);
        const tokenResult = await this.getTokenTransfers(address, { 
          offset: limit, 
          contractaddress: tokenAddress 
        });
        
        return {
          success: tokenResult.success,
          transactions: tokenResult.transfers || [],
          source: 'token-only'
        };
      }

      // 네이티브 거래와 토큰 전송을 병렬로 조회
      const [nativeResult, tokenResult] = await Promise.all([
        this.getAccountTransactions(address, { offset: Math.ceil(limit / 2) }),
        this.getTokenTransfers(address, { offset: Math.ceil(limit / 2) })
      ]);

      const allTransactions = [];

      // 네이티브 거래 추가
      if (nativeResult.success && nativeResult.transactions) {
        allTransactions.push(...nativeResult.transactions);
        consolelog(`📈 네이티브 거래 ${nativeResult.transactions.length}개 추가`);
      }

      // 토큰 전송 추가
      if (tokenResult.success && tokenResult.transfers) {
        allTransactions.push(...tokenResult.transfers);
        consolelog(`🪙 토큰 전송 ${tokenResult.transfers.length}개 추가`);
      }

      // 타임스탬프 기준으로 정렬 (최신순)
      allTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      consolelog(`🎯 통합 거래내역 조회 완료: 총 ${allTransactions.length}개`);

      return {
        success: true,
        transactions: allTransactions.slice(0, limit),
        source: 'combined',
        nativeCount: nativeResult.success ? nativeResult.transactions?.length || 0 : 0,
        tokenCount: tokenResult.success ? tokenResult.transfers?.length || 0 : 0
      };

    } catch (error) {
      consoleerror('❌ 통합 거래내역 조회 실패:', error);
      return {
        success: false,
        error: `통합 거래내역 조회 실패: ${error.message}`
      };
    }
  }
 
  async getAccountTransactions(address, options = {}) {
    try {
      const {
        page = 1,
        offset = 20,
        sort = 'desc',
        startblock = 0,
        endblock = 99999999
      } = options;

      // WorldLand API 엔드포인트 (실제 작동하는 형식)
      const params = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: startblock.toString(),
        endblock: endblock.toString(),
        page: page.toString(),
        offset: offset.toString(),
        sort: sort
      });

      // Etherscan API인 경우 chainid와 apikey 추가
      if (this.baseUrl.includes('etherscan.io')) {
        const networkConfig = NETWORKS[this.network];
        params.append('chainid', networkConfig.chainId.toString());
        params.append('apikey', process.env.REACT_APP_ETHERSCAN_API_KEY || '');
      }

      const url = `${this.baseUrl}/api?${params}`;
      consolelog('🌐 WorldLand API 요청:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      consolelog('📊 API 응답:', data);

      // Etherscan API 응답: {"status":"1","message":"OK","result":[...]}
      // WorldLand API 응답: {"message":"OK","result":[...]}
      const isSuccess = this.baseUrl.includes('etherscan.io') 
        ? (data.status === '1' && Array.isArray(data.result))
        : (data.message === 'OK' && Array.isArray(data.result));

      if (isSuccess) {
        const transactions = this.formatWorldLandTransactions(data.result);
        consolelog(`✅ 거래내역 ${transactions.length}개 조회 성공`);
        
        const source = this.baseUrl.includes('etherscan.io') 
          ? `etherscan-${this.network}` 
          : 'worldland-api';
        
        return {
          success: true,
          transactions: transactions,
          totalCount: data.result.length,
          source: source
        };
      } else {
        consolewarn('⚠️ 예상과 다른 API 응답 형식:', data);
        return {
          success: false,
          error: '거래내역을 찾을 수 없습니다.'
        };
      }

    } catch (error) {
      consoleerror('❌ WorldLand API 거래내역 조회 실패:', error);
      return {
        success: false,
        error: `거래내역 조회 실패: ${error.message}`
      };
    }
  }

  // formatWorldLandTransactions 메서드 추가
  formatWorldLandTransactions(transactions) {
    return transactions.map(tx => {
      // 토큰 전송인지 확인 (input이 있고 value가 0인 경우)
      const isTokenTransfer = tx.input && tx.input !== '0x' && tx.value === '0';
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: this.weiToEther(tx.value || '0'),
        valueRaw: tx.value || '0',
        blockNumber: parseInt(tx.blockNumber || 0),
        timestamp: parseInt(tx.timeStamp || 0),
        gasUsed: tx.gasUsed || '0',
        gasPrice: tx.gasPrice || '0',
        status: this.parseTransactionStatus(tx.txreceipt_status, tx.isError),
        type: isTokenTransfer ? 'contract_call' : 'transaction',
        nonce: parseInt(tx.nonce || 0),
        input: tx.input || '0x',
        confirmations: parseInt(tx.confirmations || 0),
        cumulativeGasUsed: tx.cumulativeGasUsed || '0',
        transactionIndex: parseInt(tx.transactionIndex || 0)
      };
    });
  }

  // getTokenTransfers 메서드 추가
  async getTokenTransfers(address, options = {}) {
    try {
      const {
        page = 1,
        offset = 20,
        sort = 'desc',
        contractaddress = null,
        startblock = 0,
        endblock = 99999999
      } = options;

      const params = new URLSearchParams({
        module: 'account',
        action: 'tokentx',
        address: address,
        startblock: startblock.toString(),
        endblock: endblock.toString(),
        page: page.toString(),
        offset: offset.toString(),
        sort: sort
      });

      // 특정 토큰만 조회하는 경우
      if (contractaddress) {
        params.append('contractaddress', contractaddress);
      }

      // Etherscan API인 경우 chainid와 apikey 추가
      if (this.baseUrl.includes('etherscan.io')) {
        const networkConfig = NETWORKS[this.network];
        params.append('chainid', networkConfig.chainId.toString());
        params.append('apikey', process.env.REACT_APP_ETHERSCAN_API_KEY || '');
      }

      const url = `${this.baseUrl}/api?${params}`;
      consolelog('🪙 토큰 전송내역 API 요청:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`토큰 전송내역 API 요청 실패: ${response.status}`);
      }

      const data = await response.json();

      // Etherscan API 응답: {"status":"1","message":"OK","result":[...]}
      // WorldLand API 응답: {"message":"OK","result":[...]}
      const isSuccess = this.baseUrl.includes('etherscan.io') 
        ? (data.status === '1' && Array.isArray(data.result))
        : (data.message === 'OK' && Array.isArray(data.result));

      if (isSuccess) {
        const transfers = this.formatWorldLandTokenTransfers(data.result);
        consolelog(`✅ 토큰 전송내역 ${transfers.length}개 조회 성공`);
        
        const source = this.baseUrl.includes('etherscan.io') 
          ? `etherscan-token-${this.network}` 
          : 'worldland-token-api';
        
        return {
          success: true,
          transfers: transfers,
          totalCount: data.result.length,
          source: source
        };
      } else {
        const source = this.baseUrl.includes('etherscan.io') 
          ? `etherscan-token-${this.network}` 
          : 'worldland-token-api';
          
        return {
          success: true,
          transfers: [],
          totalCount: 0,
          source: source
        };
      }

    } catch (error) {
      consoleerror('❌ 토큰 전송내역 조회 실패:', error);
      return {
        success: false,
        error: `토큰 전송내역 조회 실패: ${error.message}`
      };
    }
  }

  // formatWorldLandTokenTransfers 메서드 추가
  formatWorldLandTokenTransfers(transfers) {
    return transfers.map(transfer => {
      return {
        hash: transfer.hash,
        from: transfer.from,
        to: transfer.to,
        value: this.formatTokenAmount(transfer.value || '0', parseInt(transfer.tokenDecimal || 18)),
        valueRaw: transfer.value || '0',
        blockNumber: parseInt(transfer.blockNumber || 0),
        timestamp: parseInt(transfer.timeStamp || 0),
        gasUsed: transfer.gasUsed || '0',
        gasPrice: transfer.gasPrice || '0',
        status: this.parseTransactionStatus(transfer.txreceipt_status, transfer.isError),
        type: 'token_transfer',
        token: {
          address: transfer.contractAddress,
          name: transfer.tokenName || 'Unknown Token',
          symbol: transfer.tokenSymbol || 'UNK',
          decimals: parseInt(transfer.tokenDecimal || 18)
        },
        nonce: parseInt(transfer.nonce || 0),
        confirmations: parseInt(transfer.confirmations || 0),
        cumulativeGasUsed: transfer.cumulativeGasUsed || '0',
        transactionIndex: parseInt(transfer.transactionIndex || 0)
      };
    });
  }

  // parseTransactionStatus 메서드 추가
  parseTransactionStatus(txreceipt_status, isError) {
    // isError가 "1"이면 실패
    if (isError === '1' || isError === 1) {
      return 'failed';
    }
    
    // txreceipt_status가 "1"이면 성공
    if (txreceipt_status === '1' || txreceipt_status === 1) {
      return 'success';
    }
    
    // txreceipt_status가 "0"이면 실패
    if (txreceipt_status === '0' || txreceipt_status === 0) {
      return 'failed';
    }
    
    // 알 수 없는 경우 대기 중으로 처리
    return 'pending';
  }

  async getAccountBalance(address) {
    try {
      const endpoint = `${this.baseUrl}/api/v2/addresses/${address}`;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`잔액 조회 실패: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        balance: this.weiToEther(data.coin_balance || '0'),
        address: data.hash
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatTokenTransfers(transfers) {
    return transfers.map(transfer => ({
      hash: transfer.tx_hash,
      from: transfer.from?.hash || transfer.from,
      to: transfer.to?.hash || transfer.to,
      value: this.formatTokenAmount(
        transfer.total?.value || transfer.value || '0',
        parseInt(transfer.total?.decimals || transfer.token?.decimals || '18')
      ),
      valueRaw: transfer.total?.value || transfer.value || '0',
      blockNumber: transfer.block_number || 0,
      timestamp: transfer.timestamp ? new Date(transfer.timestamp).getTime() / 1000 : Date.now() / 1000,
      token: {
        address: transfer.token?.address,
        name: transfer.token?.name || 'Unknown Token',
        symbol: transfer.token?.symbol || 'UNK',
        decimals: parseInt(transfer.token?.decimals || '18')
      },
      type: 'token_transfer',
      status: 'success'
    }));
  }

  formatBlockScoutTransactions(transactions) {
    return transactions.map(tx => ({
      hash: tx.hash,
      from: tx.from?.hash || tx.from,
      to: tx.to?.hash || tx.to,
      value: tx.value ? this.weiToEther(tx.value) : '0',
      blockNumber: tx.block_number || 0,
      timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() / 1000 : Date.now() / 1000,
      gasUsed: tx.gas_used || '0',
      gasPrice: tx.gas_price || '0',
      status: tx.status === 'ok' ? 'success' : 'failed',
      type: 'transaction'
    }));
  }

  formatTokenAmount(amount, decimals) {
    try {
      if (!amount || amount === '0') return '0';
      return ethers.formatUnits(amount, decimals);
    } catch {
      return '0';
    }
  }

  weiToEther(weiValue) {
    try {
      if (!weiValue || weiValue === '0') return '0';
      return ethers.formatEther(weiValue);
    } catch {
      return '0';
    }
  }
}

export class WalletService {
  constructor(network = 'mainnet') {
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(
      NETWORKS[network].rpcUrl
    );
    this.explorer = new WorldLandExplorerAPI(network);
    this.cache = new TransactionCache();
  }

  // === 토큰 목록 관리 기능 추가 ===

  // 네트워크의 모든 토큰 목록 조회
  async getAvailableTokens(page = 1, limit = 50) {
    return await this.explorer.getTokenList(page, limit);
  }

  // 인기 토큰 목록 조회
  async getPopularTokens(limit = 20) {
    return await this.explorer.getPopularTokens(limit);
  }

  // 토큰 검색
  async searchTokens(query, limit = 20) {
    if (!query || query.trim().length < 2) {
      return {
        success: false,
        error: '검색어는 2글자 이상 입력해주세요.'
      };
    }
    
    return await this.explorer.searchTokens(query.trim(), limit);
  }

  // === 기존 기능들 유지 ===

  createWallet() {
    try {
      const wallet = ethers.Wallet.createRandom();
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  importWallet(privateKey) {
    try {
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      
      const wallet = new ethers.Wallet(privateKey);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: null,   
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: '잘못된 개인키 형식입니다.'
      };
    }
  }

  // importFromMnemonic(mnemonic) {
  //   try {
  //     const wallet = ethers.Wallet.fromPhrase(mnemonic);
  //     return {
  //       address: wallet.address,
  //       privateKey: wallet.privateKey,
  //       mnemonic: mnemonic,
  //       success: true
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       error: '잘못된 니모닉 구문입니다.'
  //     };
  //   }
  // }

  isValidAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  // async getAllBalances(address) {
  //   try {
  //     consolelog(`모든 잔액 조회 시작: ${address}`);

  //     const results = {
  //       native: null,
  //       tokens: [],
  //       success: true,
  //       errors: []
  //     };

  //     try {
  //       const nativeResult = await this.getBalance(address);
  //       if (nativeResult.success) {
  //         results.native = {
  //           symbol: 'WLC',
  //           name: 'WorldLand Coin',
  //           balance: nativeResult.balance,
  //           type: 'native',
  //           decimals: 18
  //         };
  //       }
  //     } catch (error) {
  //       results.errors.push('네이티브 토큰 조회 실패: ' + error.message);
  //     }

  //     try {
  //       const tokenResult = await this.explorer.getAccountTokenBalances(address);
  //       if (tokenResult.success) {
  //         results.tokens = tokenResult.tokens;
  //         consolelog(`발견된 토큰: ${results.tokens.length}개`);
  //       }
  //     } catch (error) {
  //       results.errors.push('토큰 조회 실패: ' + error.message);
  //     }

  //     return results;
  //   } catch (error) {
  //     return {
  //       success: false,
  //       error: '전체 잔액 조회에 실패했습니다: ' + error.message
  //     };
  //   }
  // }

  // walletService.js의 getAllBalances 메서드 개선
  async getAllBalances(address) {
    try {
      consolelog(`🔍 getAllBalances 시작: ${address}`);

      const results = {
        native: null,
        tokens: [],
        success: true,
        errors: []
      };

      // 1단계: 네이티브 토큰 조회
      try {
        consolelog('1️⃣ 네이티브 잔액 조회...');
        const nativeResult = await this.getBalance(address);
        if (nativeResult.success) {
          results.native = {
            symbol: 'WLC',
            name: 'WorldLand Coin',
            balance: nativeResult.balance,
            type: 'native',
            decimals: 18
          };
          consolelog('✅ 네이티브 잔액 조회 성공:', nativeResult.balance);
        } else {
          consolewarn('⚠️ 네이티브 잔액 조회 실패:', nativeResult.error);
          results.errors.push('네이티브 토큰 조회 실패: ' + nativeResult.error);
        }
      } catch (error) {
        consoleerror('❌ 네이티브 잔액 조회 예외:', error);
        results.errors.push('네이티브 토큰 조회 예외: ' + error.message);
      }

      // 2단계: 토큰 잔액 조회 (여러 방법 시도)
      consolelog('2️⃣ 토큰 잔액 조회 시작...');
      const tokenResult = await this.discoverTokenBalances(address);
      
      if (tokenResult.success && tokenResult.tokens.length > 0) {
        results.tokens = tokenResult.tokens;
        consolelog(`✅ 토큰 발견 성공: ${results.tokens.length}개`);
      } else {
        consolelog('💡 토큰을 찾을 수 없거나 조회 실패:', tokenResult.error);
        results.errors.push('토큰 조회 실패: ' + (tokenResult.error || '알 수 없음'));
      }

      consolelog('📊 getAllBalances 최종 결과:', {
        native: !!results.native,
        tokenCount: results.tokens.length,
        errors: results.errors.length
      });

      return results;
    } catch (error) {
      consoleerror('❌ getAllBalances 전체 실패:', error);
      return {
        success: false,
        error: '전체 잔액 조회에 실패했습니다: ' + error.message
      };
    }
  }

  // 토큰 발견을 위한 새로운 메서드
  async discoverTokenBalances(address) {
    consolelog(`🪙 토큰 발견 시작: ${address}`);
    
    // 방법 1: BlockScout API 직접 호출
    try {
      consolelog('📡 방법 1: BlockScout token-balances API 시도...');
      const explorerResult = await this.explorer.getAccountTokenBalances(address);
      
      if (explorerResult.success && explorerResult.tokens.length > 0) {
        consolelog(`✅ BlockScout에서 ${explorerResult.tokens.length}개 토큰 발견`);
        return {
          success: true,
          tokens: explorerResult.tokens,
          source: 'blockscout-balances'
        };
      } else {
        consolelog('⚪ BlockScout token-balances에서 토큰 없음');
      }
    } catch (error) {
      consolewarn('⚠️ BlockScout token-balances 실패:', error.message);
    }

    // 방법 2: BlockScout 주소 정보에서 토큰 추출
    try {
      consolelog('📡 방법 2: BlockScout 주소 정보에서 토큰 추출 시도...');
      const addressResult = await this.getAddressTokensFromInfo(address);
      
      if (addressResult.success && addressResult.tokens.length > 0) {
        consolelog(`✅ 주소 정보에서 ${addressResult.tokens.length}개 토큰 발견`);
        return addressResult;
      } else {
        consolelog('⚪ 주소 정보에서도 토큰 없음');
      }
    } catch (error) {
      consolewarn('⚠️ 주소 정보 추출 실패:', error.message);
    }

    // 방법 3: 알려진 토큰들에 대해 개별 잔액 조회
    try {
      consolelog('📡 방법 3: 알려진 토큰 개별 조회 시도...');
      const knownTokensResult = await this.checkKnownTokens(address);
      
      if (knownTokensResult.success && knownTokensResult.tokens.length > 0) {
        consolelog(`✅ 알려진 토큰에서 ${knownTokensResult.tokens.length}개 발견`);
        return knownTokensResult;
      } else {
        consolelog('⚪ 알려진 토큰에서도 잔액 없음');
      }
    } catch (error) {
      consolewarn('⚠️ 알려진 토큰 조회 실패:', error.message);
    }

    consolelog('💡 모든 방법으로 토큰을 찾을 수 없습니다');
    return {
      success: false,
      tokens: [],
      error: '모든 토큰 발견 방법이 실패했습니다'
    };
  }

  // BlockScout 주소 정보에서 토큰 추출
  async getAddressTokensFromInfo(address) {
    try {
      const endpoint = `${this.explorer.baseUrl}/api/v2/addresses/${address}`;
      consolelog('🌐 주소 정보 API 호출:', endpoint);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`주소 정보 API 요청 실패: ${response.status}`);
      }

      const data = await response.json();
      consolelog('📄 주소 정보 응답:', data);

      // 주소 정보에서 토큰 관련 데이터 추출 시도
      const tokens = [];
      
      // token_transfers나 다른 필드에서 토큰 정보 추출
      if (data.token && data.token.length > 0) {
        tokens.push(...data.token);
      }

      return {
        success: true,
        tokens: this.explorer.formatTokenBalances(tokens),
        source: 'address-info'
      };
    } catch (error) {
      consoleerror('주소 정보 추출 실패:', error);
      return {
        success: false,
        tokens: [],
        error: error.message
      };
    }
  }

  // 알려진 토큰들에 대해 개별 잔액 조회
  async checkKnownTokens(address) {
    try {
      consolelog('🔍 알려진 토큰 개별 조회 시작...');
      
      // 1차: 인기 토큰 목록 시도
      let knownTokens = [];
      const popularResult = await this.getPopularTokens(10); 
      
      if (popularResult.success && popularResult.tokens.length > 0) {
        knownTokens = popularResult.tokens;
        consolelog(`📋 인기 토큰 ${knownTokens.length}개 로드됨`);
      } else {
        // 2차: 외부 설정 토큰 목록 시도
        consolelog('📋 인기 토큰 실패, 설정 토큰 목록 시도...');
        const defaultResult = await this.getDefaultTokenList();
        
        if (defaultResult.success && defaultResult.tokens.length > 0) {
          knownTokens = defaultResult.tokens;
          consolelog(`📋 설정 토큰 ${knownTokens.length}개 로드됨`);
        } else {
          consolelog('⚪ 모든 토큰 목록을 가져올 수 없음');
          return { success: false, tokens: [], error: '토큰 목록 조회 실패' };
        }
      }

      consolelog(`📋 ${knownTokens.length}개 토큰에 대해 잔액 조회...`);
      const tokensWithBalance = [];

      // 각 토큰에 대해 잔액 조회 (최대 8개까지 체크)
      for (const token of knownTokens.slice(0, 8)) {
        try {
          consolelog(`🔍 ${token.symbol} 잔액 조회...`);
          const balanceResult = await this.getTokenBalance(address, token.address);
          
          if (balanceResult.success) {
            const balance = parseFloat(balanceResult.token.balance || '0');
            if (balance > 0) {
              consolelog(`💰 ${token.symbol}: ${balance} 발견!`);
              tokensWithBalance.push(balanceResult.token);
            } else {
              consolelog(`⚪ ${token.symbol}: 잔액 0`);
            }
          } else {
            consolelog(`❌ ${token.symbol}: 조회 실패 - ${balanceResult.error}`);
          }
        } catch (tokenError) {
          consolewarn(`⚠️ ${token.symbol} 개별 조회 예외:`, tokenError);
        }
      }

      consolelog(`🎯 개별 조회 완료: ${tokensWithBalance.length}개 토큰에서 잔액 발견`);

      return {
        success: true,
        tokens: tokensWithBalance,
        source: 'individual-check'
      };
    } catch (error) {
      consoleerror('알려진 토큰 조회 실패:', error);
      return {
        success: false,
        tokens: [],
        error: error.message
      };
    }
  }

  async getBalance(address) {
    try {
      const explorerResult = await this.explorer.getAccountBalance(address);
      if (explorerResult.success) {
        return explorerResult;
      }

      const balance = await this.provider.getBalance(address);
      return {
        balance: ethers.formatEther(balance),
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: '잔액 조회에 실패했습니다: ' + error.message
      };
    }
  }

  async getTokenBalance(address, tokenAddress) {
    try {
      const explorerResult = await this.explorer.getTokenBalance(address, tokenAddress);
      if (explorerResult.success) {
        return explorerResult;
      }

      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals().catch(() => 18),
        contract.symbol().catch(() => 'UNK'),
        contract.name().catch(() => 'Unknown Token')
      ]);

      return {
        success: true,
        token: {
          address: tokenAddress,
          name,
          symbol,
          decimals,
          balance: ethers.formatUnits(balance, decimals),
          balanceRaw: balance.toString(),
          type: 'ERC-20',
          verified: false,
          network: NETWORKS[this.network]?.name || 'Unknown Network'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: '토큰 잔액 조회에 실패했습니다: ' + error.message
      };
    }
  }

  async getTransactionHistory(address, limit = 20, useCache = true, selectedAsset = null, network = null) {
    try {
      // network 파라미터가 전달되면 해당 네트워크로 전환
      if (network && network.name && this.network !== network.name) {
        consolelog(`🔄 거래내역 조회를 위한 네트워크 전환: ${this.network} → ${network.name}`);
        // 네트워크 이름을 키로 변환 (예: 'Ethereum Mainnet' → 'ethereum')
        const networkKey = Object.keys(NETWORKS).find(key => 
          NETWORKS[key].name === network.name
        );
        if (networkKey) {
          this.switchNetwork(networkKey);
        }
      }

       console.log(`통합 거래내역 조회 시작: ${address} (네트워크: ${this.network})`);

      if (useCache) {
        const cached = this.cache.getCachedTransactions(address);
        if (cached && cached.length > 0) {
          consolelog('캐시에서 거래내역 반환');
          let filtered = cached;
          
          if (selectedAsset) {
            if (selectedAsset.type === 'native') {
              filtered = cached.filter(tx => tx.type === 'transaction');
            } else {
              filtered = cached.filter(tx => 
                tx.type === 'token_transfer' && 
                tx.token?.address?.toLowerCase() === selectedAsset.address?.toLowerCase()
              );
            }
          }
          
          return {
            success: true,
            transactions: filtered.slice(0, limit),
            fromCache: true
          };
        }
      }

      let allTransactionsResult;
      
      if (selectedAsset && selectedAsset.type !== 'native') {
        allTransactionsResult = await this.explorer.getAllTransactions(address, { 
          limit, 
          tokenAddress: selectedAsset.address 
        });
      } else {
        allTransactionsResult = await this.explorer.getAllTransactions(address, { limit });
      }

      if (allTransactionsResult.success && allTransactionsResult.transactions.length > 0) {
        consolelog(`통합 API 성공: ${allTransactionsResult.transactions.length}개 거래`);
        this.cache.setCachedTransactions(address, allTransactionsResult.transactions);
        return {
          ...allTransactionsResult,
          source: 'integrated'
        };
      }

      consolelog('네이티브 거래만 조회 중...');
      const nativeResult = await this.explorer.getAccountTransactions(address, { limit });

      if (nativeResult.success && nativeResult.transactions.length > 0) {
        consolelog(`네이티브 거래 성공: ${nativeResult.transactions.length}개 거래`);
        this.cache.setCachedTransactions(address, nativeResult.transactions);
        return {
          ...nativeResult,
          source: 'native-only'
        };
      }

      consolelog('실제 API 실패, 데모 데이터 사용');
      return await this.getDemoTransactions(address, limit);

    } catch (error) {
      consoleerror('통합 거래 내역 조회 실패:', error);
      return {
        success: false,
        error: '거래 내역 조회에 실패했습니다.'
      };
    }
  }

  async sendToken(privateKey, tokenAddress, to, amount, gasPrice = '20') {
    try {
      if (!this.isValidAddress(to)) {
        throw new Error('잘못된 받는 주소입니다.');
      }

      if (!this.isValidAddress(tokenAddress)) {
        throw new Error('잘못된 토큰 주소입니다.');
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('전송량은 0보다 커야 합니다.');
      }

      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

      const [decimals, symbol] = await Promise.all([
        contract.decimals(),
        contract.symbol()
      ]);

      const balance = await contract.balanceOf(wallet.address);
      const sendAmount = ethers.parseUnits(amount, decimals);
      
      if (balance < sendAmount) {
        throw new Error('토큰 잔액이 부족합니다.');
      }

      const tx = await contract.transfer(to, sendAmount, {
        gasPrice: ethers.parseUnits(gasPrice, 'gwei')
      });

      const receipt = await tx.wait();
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: to,
        value: amount,
        token: {
          address: tokenAddress,
          symbol: symbol,
          decimals: decimals
        },
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async estimateTokenTransactionFee(tokenAddress, to, amount, gasPrice) {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const decimals = await contract.decimals();
      const sendAmount = ethers.parseUnits(amount, decimals);
      
      const gasLimit = await contract.transfer.estimateGas(to, sendAmount);
      const fee = gasLimit * ethers.parseUnits(gasPrice, 'gwei');
      
      return {
        gasLimit: gasLimit.toString(),
        fee: ethers.formatEther(fee),
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: '토큰 수수료 추정에 실패했습니다.'
      };
    }
  }

  async estimateGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      return {
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'),
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: '가스 가격 조회에 실패했습니다.'
      };
    }
  }

  async estimateTransactionFee(to, amount, gasPrice) {
    try {
      const tx = {
        to: to,
        value: ethers.parseEther(amount),
        gasPrice: ethers.parseUnits(gasPrice, 'gwei')
      };
      
      const gasLimit = await this.provider.estimateGas(tx);
      const fee = gasLimit * ethers.parseUnits(gasPrice, 'gwei');
      
      return {
        gasLimit: gasLimit.toString(),
        fee: ethers.formatEther(fee),
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: '수수료 추정에 실패했습니다.'
      };
    }
  }

  async sendTransaction(privateKey, to, amount, gasPrice = '20') {
    try {
      if (!this.isValidAddress(to)) {
        throw new Error('잘못된 받는 주소입니다.');
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('전송량은 0보다 커야 합니다.');
      }

      const wallet = new ethers.Wallet(privateKey, this.provider);
      
      const balance = await wallet.provider.getBalance(wallet.address);
      const sendAmount = ethers.parseEther(amount);
      
      if (balance < sendAmount) {
        throw new Error('잔액이 부족합니다.');
      }

      const tx = await wallet.sendTransaction({
        to: to,
        value: sendAmount,
        gasPrice: ethers.parseUnits(gasPrice, 'gwei')
      });

      const receipt = await tx.wait();
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTransactionStatus(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      return {
        transaction: tx,
        receipt: receipt,
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: '거래 상태 조회에 실패했습니다.'
      };
    }
  }

  switchNetwork(network) {
    if (!NETWORKS[network]) {
      throw new Error('지원하지 않는 네트워크입니다.');
    }
    
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(
      NETWORKS[network].rpcUrl
    );
    this.explorer = new WorldLandExplorerAPI(network);
  }

  getCurrentNetwork() {
    return NETWORKS[this.network];
  }

  async testConnection() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return {
        connected: true,
        blockNumber: blockNumber,
        network: this.getCurrentNetwork(),
        success: true
      };
    } catch (error) {
      return {
        connected: false,
        success: false,
        error: '네트워크 연결에 실패했습니다.'
      };
    }
  }

  async getDemoTransactions(address, limit) {
    const now = Math.floor(Date.now() / 1000);
    const oneHour = 3600;
    
    const demoTransactions = [
      {
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        from: '0x742d35Cc6634C0532925a3b8D0Ea4c07146896F4',
        to: address,
        value: '10.5',
        blockNumber: 12345,
        timestamp: now - oneHour,
        gasUsed: '21000',
        gasPrice: '20000000000',
        status: 'success',
        type: 'transaction'
      },
      {
        hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        from: address,
        to: '0x8ba1f109551bD432803012645Hac136c12345678',
        value: '100.0000',
        token: {
          address: '0x1234567890123456789012345678901234567890',
          name: 'WorldLand USD',
          symbol: 'WUSD',
          decimals: 6
        },
        blockNumber: 12340,
        timestamp: now - (2 * oneHour),
        gasUsed: '65000',
        gasPrice: '20000000000',
        status: 'success',
        type: 'token_transfer'
      },
      {
        hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        from: '0x1234567890123456789012345678901234567890',
        to: address,
        value: '2.8',
        blockNumber: 12335,
        timestamp: now - (3 * oneHour),
        gasUsed: '21000',
        gasPrice: '18000000000',
        status: 'success',
        type: 'transaction'
      }
    ];
    
    return {
      success: true,
      transactions: demoTransactions.slice(0, limit),
      isDemo: true,
      source: 'demo'
    };
  }

  // walletService.js에 추가할 메서드들

  // 니모닉에서 여러 계정 발견
  async discoverAccountsFromMnemonic(mnemonic, maxAccounts = 10) {
    try {
      consolelog('🔍 니모닉에서 계정 발견 시작...', { maxAccounts });
      
      const accounts = [];
      let emptyAccountCount = 0;
      const maxEmptyAccounts = 3; // 연속으로 비어있는 계정이 3개면 중단
      
      for (let i = 0; i < maxAccounts; i++) {
        try {
          // BIP44 경로로 지갑 생성
          const derivationPath = `m/44'/60'/0'/0/${i}`;
          const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
          
          consolelog(`📍 계정 ${i} 확인 중: ${hdWallet.address}`);
          
          // 계정의 활동 여부 확인 (잔액 + 거래내역)
          const hasActivity = await this.checkAccountActivity(hdWallet.address);
          
          const account = {
            index: i,
            address: hdWallet.address,
            privateKey: hdWallet.privateKey,
            derivationPath: derivationPath,
            hasActivity: hasActivity.hasActivity,
            balance: hasActivity.balance,
            transactionCount: hasActivity.transactionCount
          };
          
          accounts.push(account);
          
          if (!hasActivity.hasActivity) {
            emptyAccountCount++;
            consolelog(`⚪ 계정 ${i}: 활동 없음 (연속 ${emptyAccountCount}개)`);
            
            // 연속으로 비어있는 계정이 maxEmptyAccounts개면 중단
            if (emptyAccountCount >= maxEmptyAccounts) {
              consolelog(`🛑 연속 비어있는 계정 ${maxEmptyAccounts}개 발견, 검색 중단`);
              break;
            }
          } else {
            emptyAccountCount = 0; // 활동이 있으면 카운트 리셋
            consolelog(`💰 계정 ${i}: 활동 발견 (잔액: ${hasActivity.balance})`);
          }
          
        } catch (error) {
          consolewarn(`⚠️ 계정 ${i} 확인 실패:`, error);
          break;
        }
      }
      
      const activeAccounts = accounts.filter(acc => acc.hasActivity);
      
      consolelog(`✅ 계정 발견 완료: 총 ${accounts.length}개 확인, ${activeAccounts.length}개 활성`);
      
      return {
        success: true,
        accounts: accounts,
        activeAccounts: activeAccounts,
        totalChecked: accounts.length
      };
      
    } catch (error) {
      consoleerror('❌ 계정 발견 실패:', error);
      return {
        success: false,
        error: '계정 발견에 실패했습니다: ' + error.message
      };
    }
  }

  // 계정의 활동 여부 확인
  async checkAccountActivity(address) {
    try {
      consolelog(`🔍 ${address} 활동 확인 중...`);
      
      // 1. 잔액 확인
      const balanceResult = await this.getBalance(address);
      const balance = balanceResult.success ? parseFloat(balanceResult.balance) : 0;
      
      // 2. 거래 내역 확인 (간단한 확인)
      let transactionCount = 0;
      try {
        const txResult = await this.explorer.getAccountTransactions(address, { offset: 1 });
        transactionCount = txResult.success ? (txResult.transactions?.length || 0) : 0;
      } catch (error) {
        consolewarn('거래내역 확인 실패:', error);
      }
      
      // 3. 토큰 잔액 확인
      let hasTokens = false;
      try {
        const tokenResult = await this.explorer.getAccountTokenBalances(address);
        hasTokens = tokenResult.success && (tokenResult.tokens?.length || 0) > 0;
      } catch (error) {
        consolewarn('토큰 확인 실패:', error);
      }
      
      const hasActivity = balance > 0 || transactionCount > 0 || hasTokens;
      
      consolelog(`📊 ${address}: 잔액 ${balance}, 거래 ${transactionCount}개, 토큰 ${hasTokens ? 'O' : 'X'}, 활동 ${hasActivity ? 'O' : 'X'}`);
      
      return {
        hasActivity: hasActivity,
        balance: balance.toString(),
        transactionCount: transactionCount,
        hasTokens: hasTokens
      };
      
    } catch (error) {
      consoleerror('계정 활동 확인 실패:', error);
      return {
        hasActivity: false,
        balance: '0',
        transactionCount: 0,
        hasTokens: false
      };
    }
  }

  // 기존 importFromMnemonic 메서드 수정
  importFromMnemonic(mnemonic, accountIndex = 0) {
    try {
      const derivationPath = `m/44'/60'/0'/0/${accountIndex}`;
      const hdWallet = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
      
      return {
        address: hdWallet.address,
        privateKey: hdWallet.privateKey,
        mnemonic: mnemonic,
        derivationPath: derivationPath,
        accountIndex: accountIndex,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: '잘못된 니모닉 구문입니다.'
      };
    }
  }

  async sendNFT(privateKey, contractAddress, tokenId, fromAddress, toAddress, gasPrice = '20') {
    try {
      if (!this.isValidAddress(toAddress)) {
        throw new Error('잘못된 받는 주소입니다.');
      }

      if (!this.isValidAddress(contractAddress)) {
        throw new Error('잘못된 NFT 컨트랙트 주소입니다.');
      }

      const wallet = new ethers.Wallet(privateKey, this.provider);
      const nftContract = new ethers.Contract(contractAddress, ERC721_ABI, wallet);

      const owner = await nftContract.ownerOf(tokenId);
      if (owner.toLowerCase() !== fromAddress.toLowerCase()) {
        throw new Error('이 NFT의 소유자가 아닙니다.');
      }

      consolelog(`NFT 전송 시작: Token ID ${tokenId} → ${toAddress}`);

      const tx = await nftContract.safeTransferFrom(
        fromAddress, 
        toAddress, 
        tokenId,
        {
          gasPrice: ethers.parseUnits(gasPrice, 'gwei')
        }
      );

      consolelog('트랜잭션 전송됨:', tx.hash);
      const receipt = await tx.wait();
      consolelog('NFT 전송 완료:', receipt);

      return {
        hash: tx.hash,
        from: fromAddress,
        to: toAddress,
        tokenId: tokenId.toString(),
        contractAddress: contractAddress,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        success: true
      };
    } catch (error) {
      consoleerror('NFT 전송 실패:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async estimateNFTTransferFee(contractAddress, tokenId, fromAddress, toAddress, gasPrice) {
    try {
      const contract = new ethers.Contract(contractAddress, ERC721_ABI, this.provider);
      
      const gasLimit = await contract.safeTransferFrom.estimateGas(
        fromAddress,
        toAddress, 
        tokenId
      );
      
      const fee = gasLimit * ethers.parseUnits(gasPrice, 'gwei');
      
      return {
        gasLimit: gasLimit.toString(),
        fee: ethers.formatEther(fee),
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: 'NFT 전송 수수료 추정에 실패했습니다.'
      };
    }
  }
}



// 싱글톤 인스턴스
export const walletService = new WalletService();