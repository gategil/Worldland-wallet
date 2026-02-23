// src/services/MultiWalletManager.js - 토큰 암호화 저장 기능 적용 (다국어 지원)
import { SecureStorage } from './secureStorage';
import { walletService } from './walletService';
import { i18nService } from './i18nService';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';

export class MultiWalletManager {
  static WALLETS_KEY = 'worldland_multiple_wallets';
  static ACTIVE_WALLET_KEY = 'worldland_active_wallet';
  static WALLET_TOKENS_KEY = 'worldland_wallet_tokens_encrypted';

  // === 보안 강화된 토큰 관리 기능 ===

  // 지갑별 토큰 목록 저장 (암호화 적용)
  static saveWalletTokens(walletId, tokens, password) {
    try {
      // 입력 값 검증
      if (!walletId) {
        consoleerror(i18nService.t('multiwallet.error_wallet_id_invalid'), walletId);
        return { success: false, error: i18nService.t('multiwallet.error_wallet_id_invalid') };
      }

      if (!password) {
        consoleerror(i18nService.t('multiwallet.error_password_required_encrypt'));
        return { success: false, error: i18nService.t('multiwallet.error_password_required_encrypt') };
      }

      if (!Array.isArray(tokens)) {
        consoleerror(i18nService.t('multiwallet.error_token_data_format'), tokens);
        return { success: false, error: i18nService.t('multiwallet.error_token_data_format') };
      }

      // 기존 암호화된 토큰 데이터 로드
      const loadResult = SecureStorage.loadEncryptedTokens(password);
      if (!loadResult.success && !loadResult.error.includes(i18nService.t('multiwallet.error_no_wallets'))) {
        consoleerror(i18nService.t('multiwallet.error_load_existing_tokens'), loadResult.error);
        return { success: false, error: i18nService.t('multiwallet.error_load_existing_tokens') };
      }

      const allTokens = loadResult.data || {};
      
      // 토큰 데이터 정리 (유효하지 않은 데이터 제거)
      const validTokens = tokens.filter(token => {
        return token && 
               typeof token === 'object' && 
               token.address && 
               token.symbol && 
               typeof token.address === 'string' &&
               typeof token.symbol === 'string' &&
               /^0x[a-fA-F0-9]{40}$/.test(token.address);
      });

      // 정리된 토큰 데이터 저장
      allTokens[walletId] = validTokens;
      
      // 암호화하여 저장
      const saveResult = SecureStorage.saveEncryptedTokens(allTokens, password);
      if (!saveResult.success) {
        consoleerror(i18nService.t('multiwallet.error_save_encrypted_tokens'), saveResult.error);
        return saveResult;
      }
      
      consolelog(i18nService.t('multiwallet.success_tokens_saved', { 
        walletId, 
        count: validTokens.length 
      }));
      
      if (validTokens.length !== tokens.length) {
        consolewarn(i18nService.t('multiwallet.warning_invalid_tokens_excluded', { 
          count: tokens.length - validTokens.length 
        }));
      }
      
      return { success: true, savedCount: validTokens.length };
    } catch (error) {
      consoleerror(i18nService.t('multiwallet.error_token_save_failed'), error);
      
      // 구체적인 오류 메시지 제공
      let errorMessage = i18nService.t('multiwallet.error_token_save_failed');
      if (error.name === 'QuotaExceededError') {
        errorMessage = i18nService.t('multiwallet.error_storage_quota');
      } else if (error.message.includes('JSON')) {
        errorMessage = i18nService.t('multiwallet.error_token_format');
      } else if (error.message.includes('password')) {
        errorMessage = i18nService.t('multiwallet.error_password');
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // 특정 지갑의 토큰 목록 조회 (복호화 적용)
  static getWalletTokens(walletId, password) {
  try {
    if (!password) {
      consoleerror(i18nService.t('multiwallet.error_password_required_decrypt'));
      return [];
    }

    const loadResult = SecureStorage.loadEncryptedTokens(password);
    if (!loadResult.success) {
      if (loadResult.error.includes('password')) {
        consoleerror(i18nService.t('multiwallet.error_decrypt_wrong_password'));
      } else {
        consolewarn(i18nService.t('multiwallet.error_token_load_failed'), loadResult.error);
      }
      return [];
    }

    const allTokens = loadResult.data || {};
    const tokens = allTokens[walletId] || [];
    
    // 기존 토큰에 network 속성이 없으면 현재 네트워크로 설정 (마이그레이션)
    const currentNetwork = walletService.getCurrentNetwork();
    const tokensWithNetwork = tokens.map(token => {
      if (!token.network) {
        return {
          ...token,
          network: currentNetwork.name
        };
      }
      return token;
    });
    
    consolelog(i18nService.t('multiwallet.info_tokens_loaded', { 
      walletId, 
      count: tokensWithNetwork.length 
    }));
    return tokensWithNetwork;
  } catch (error) {
    consoleerror(i18nService.t('multiwallet.error_token_load_failed'), error);
    return [];
  }
}

  // 모든 지갑의 토큰 정보 조회 (복호화 적용)
  static getAllWalletTokens(password) {
    try {
      if (!password) {
        consoleerror(i18nService.t('multiwallet.error_password_required_all_tokens'));
        return {};
      }

      const loadResult = SecureStorage.loadEncryptedTokens(password);
      if (!loadResult.success) {
        consolewarn(i18nService.t('multiwallet.error_all_tokens_load_failed'), loadResult.error);
        return {};
      }

      return loadResult.data || {};
    } catch (error) {
      consoleerror(i18nService.t('multiwallet.error_all_tokens_query_failed'), error);
      return {};
    }
  }

  // 특정 지갑에 토큰 추가 (암호화 적용)
  static addTokenToWallet(walletId, token, password) {
    try {
      // 입력 값 검증
      if (!walletId) {
        consoleerror(i18nService.t('multiwallet.error_wallet_id_invalid'));
        return { success: false, error: i18nService.t('multiwallet.error_wallet_id_invalid') };
      }

      if (!password) {
        consoleerror(i18nService.t('multiwallet.error_password_required_encrypt'));
        return { success: false, error: i18nService.t('multiwallet.error_password_required_encrypt') };
      }

      if (!token || typeof token !== 'object') {
        consoleerror(i18nService.t('multiwallet.error_token_invalid'), token);
        return { success: false, error: i18nService.t('multiwallet.error_token_invalid') };
      }

      if (!token.address || !token.symbol) {
        consoleerror(i18nService.t('multiwallet.error_token_required_fields'), token);
        return { success: false, error: i18nService.t('multiwallet.error_token_required_fields') };
      }

      // 주소 형식 검증
      if (!/^0x[a-fA-F0-9]{40}$/.test(token.address)) {
        consoleerror(i18nService.t('multiwallet.error_token_address_format'), token.address);
        return { success: false, error: i18nService.t('multiwallet.error_token_address_format') };
      }

      const tokens = this.getWalletTokens(walletId, password);
      
      // 중복 검사
      const existingToken = tokens.find(t => 
        t.address && token.address &&
        t.address.toLowerCase() === token.address.toLowerCase()
      );
      
      if (existingToken) {
        consolelog(i18nService.t('multiwallet.warning_token_exists', { symbol: token.symbol }));
        return { success: false, error: i18nService.t('multiwallet.error_token_already_exists') };
      }

      // 토큰 데이터 정규화 및 보안 검사 

      const normalizedToken = {
        address: token.address.toLowerCase(),
        name: SecureStorage.sanitizeString(token.name || i18nService.t('multiwallet.label_unknown_token')),
        symbol: SecureStorage.sanitizeString(token.symbol),
        decimals: parseInt(token.decimals) || 18,
        balance: token.balance || '0',
        balanceRaw: token.balanceRaw || '0',
        type: token.type || 'ERC-20',
        verified: Boolean(token.verified),
        homepage: token.homepage ? SecureStorage.sanitizeString(token.homepage) : null,
        description: token.description ? SecureStorage.sanitizeString(token.description) : null,
        network: token.network || 'Unknown Network',
        addedAt: Date.now(),
        lastUpdated: Date.now()
      };

      tokens.push(normalizedToken);
      
      const saveResult = this.saveWalletTokens(walletId, tokens, password);
      if (saveResult.success) {
        consolelog(i18nService.t('multiwallet.success_token_added', { 
          symbol: normalizedToken.symbol, 
          address: normalizedToken.address 
        }));
        return { success: true, token: normalizedToken };
      } else {
        return saveResult;
      }
      
    } catch (error) {
      consoleerror(i18nService.t('multiwallet.error_token_add_failed'), error);
      return { 
        success: false, 
        error: i18nService.t('multiwallet.error_token_add_failed') + ': ' + error.message 
      };
    }
  }

  // 특정 지갑에서 토큰 제거 (암호화 적용)
  static removeTokenFromWallet(walletId, tokenAddress, password) {
    try {
      if (!password) {
        consoleerror(i18nService.t('multiwallet.error_password_required_remove'));
        return { success: false, error: i18nService.t('multiwallet.error_password_required_remove') };
      }

      const tokens = this.getWalletTokens(walletId, password);
      const filteredTokens = tokens.filter(t => 
        t.address.toLowerCase() !== tokenAddress.toLowerCase()
      );
      
      const result = this.saveWalletTokens(walletId, filteredTokens, password);
      if (result.success) {
        consolelog(i18nService.t('multiwallet.success_token_removed', { address: tokenAddress }));
      }
      
      return result;
    } catch (error) {
      consoleerror(i18nService.t('multiwallet.error_token_remove_failed'), error);
      return { success: false, error: i18nService.t('multiwallet.error_token_remove_failed') };
    }
  }

  // 특정 지갑의 토큰 잔액 업데이트 (암호화 적용)
  static updateTokenBalance(walletId, tokenAddress, balance, balanceRaw, password) {
    try {
      if (!password) {
        consoleerror(i18nService.t('multiwallet.error_password_required_balance'));
        return { success: false, error: i18nService.t('multiwallet.error_password_required_balance') };
      }

      const tokens = this.getWalletTokens(walletId, password);
      const tokenIndex = tokens.findIndex(t => 
        t.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      
      if (tokenIndex !== -1) {
        tokens[tokenIndex] = {
          ...tokens[tokenIndex],
          balance,
          balanceRaw,
          lastUpdated: Date.now()
        };
        return this.saveWalletTokens(walletId, tokens, password);
      }
      
      return { success: false, error: i18nService.t('multiwallet.error_token_not_found') };
    } catch (error) {
      consoleerror(i18nService.t('multiwallet.error_balance_update_failed'), error);
      return { success: false, error: i18nService.t('multiwallet.error_balance_update_failed') };
    }
  }

  // 특정 지갑의 모든 토큰 잔액 일괄 업데이트 (암호화 적용)
  static async updateAllTokenBalances(walletId, walletAddress, password) {
    try {
      if (!password) {
        consoleerror(i18nService.t('multiwallet.error_password_required_balance'));
        return { success: false, error: i18nService.t('multiwallet.error_password_required_balance') };
      }

      const tokens = this.getWalletTokens(walletId, password);
      if (tokens.length === 0) {
        return { success: true, updatedCount: 0 };
      }

      let updatedCount = 0;
      const updatedTokens = await Promise.all(
        tokens.map(async (token) => {
          try {
            const balanceResult = await walletService.getTokenBalance(walletAddress, token.address);
            if (balanceResult.success) {
              updatedCount++;
              return {
                ...token,
                balance: balanceResult.token.balance,
                balanceRaw: balanceResult.token.balanceRaw,
                lastUpdated: Date.now()
              };
            }
            return token;
          } catch (error) {
            consolewarn(i18nService.t('multiwallet.warning_token_balance_update_failed', { 
              symbol: token.symbol 
            }), error);
            return token;
          }
        })
      );

      this.saveWalletTokens(walletId, updatedTokens, password);
      consolelog(i18nService.t('multiwallet.info_balance_updated', { 
        updated: updatedCount, 
        total: tokens.length 
      }));

      return { 
        success: true, 
        updatedCount, 
        totalTokens: tokens.length,
        tokens: updatedTokens
      };
    } catch (error) {
      consoleerror(i18nService.t('multiwallet.error_balance_update_failed'), error);
      return { success: false, error: i18nService.t('multiwallet.error_balance_update_failed') };
    }
  }

  // === 기존 지갑 관리 기능들 ===

  // 모든 지갑 목록 조회
  static async getWalletList(password) {
    try {
      const encryptedData = localStorage.getItem(this.WALLETS_KEY);
      if (!encryptedData) {
        return {
          success: true,
          wallets: [],
          message: i18nService.t('multiwallet.error_no_wallets')
        };
      }

      const decryptResult = SecureStorage.decrypt(encryptedData, password);
      if (!decryptResult.success) {
        return decryptResult;
      }

      return {
        success: true,
        wallets: decryptResult.data || []
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_load_wallet_list')
      };
    }
  }

  // 새 지갑 추가
  static async addWallet(walletData, password, alias = '') {
    try {
      // 기존 지갑 목록 불러오기
      const existingWallets = await this.getWalletList(password);
      if (!existingWallets.success && existingWallets.error !== i18nService.t('multiwallet.error_no_wallets')) {
        return existingWallets;
      }

      const walletList = existingWallets.wallets || [];

      // 중복 지갑 검사
      const isDuplicate = walletList.some(w => 
        w.address.toLowerCase() === walletData.address.toLowerCase()
      );

      if (isDuplicate) {
        return {
          success: false,
          error: i18nService.t('multiwallet.error_wallet_already_exists')
        };
      }

      // 새 지갑 정보 생성
      const newWallet = {
        id: this.generateWalletId(),
        address: walletData.address,
        privateKey: walletData.privateKey,
        mnemonic: walletData.mnemonic || null,
        alias: alias || i18nService.t('multiwallet.label_default_wallet', { number: walletList.length + 1 }),
        createdAt: Date.now(),
        isImported: !!walletData.isImported,
        balance: '0.0000'
      };

      walletList.push(newWallet);

      // 암호화하여 저장
      const encryptResult = SecureStorage.encrypt(walletList, password);
      if (!encryptResult.success) {
        return encryptResult;
      }

      localStorage.setItem(this.WALLETS_KEY, encryptResult.encrypted);

      // 첫 번째 지갑이면 활성 지갑으로 설정
      if (walletList.length === 1) {
        this.setActiveWallet(newWallet.id);
      }

      // 새 지갑에 대한 빈 토큰 목록 초기화 (암호화 적용)
      this.saveWalletTokens(newWallet.id, [], password);

      return {
        success: true,
        wallet: newWallet,
        message: i18nService.t('multiwallet.success_wallet_added')
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_wallet_add_failed')
      };
    }
  }

  // 지갑 삭제 (토큰 정보도 함께 삭제)
  static async removeWallet(walletId, password) {
    try {
      const walletsResult = await this.getWalletList(password);
      if (!walletsResult.success) {
        return walletsResult;
      }

      const walletList = walletsResult.wallets.filter(w => w.id !== walletId);

      if (walletList.length === walletsResult.wallets.length) {
        return {
          success: false,
          error: i18nService.t('multiwallet.error_wallet_not_found_remove')
        };
      }

      // 삭제된 지갑이 활성 지갑이었다면 첫 번째 지갑으로 변경
      const activeWalletId = this.getActiveWallet();
      if (activeWalletId === walletId && walletList.length > 0) {
        this.setActiveWallet(walletList[0].id);
      } else if (walletList.length === 0) {
        this.clearActiveWallet();
      }

      // 업데이트된 목록 저장
      const encryptResult = SecureStorage.encrypt(walletList, password);
      if (!encryptResult.success) {
        return encryptResult;
      }

      localStorage.setItem(this.WALLETS_KEY, encryptResult.encrypted);

      // 해당 지갑의 토큰 정보도 삭제 (암호화된 저장소에서)
      const allTokens = this.getAllWalletTokens(password);
      delete allTokens[walletId];
      SecureStorage.saveEncryptedTokens(allTokens, password);

      return {
        success: true,
        message: i18nService.t('multiwallet.success_wallet_removed')
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_wallet_remove_failed')
      };
    }
  }

  // 지갑 별칭 변경
  static async updateWalletAlias(walletId, newAlias, password) {
    try {
      const walletsResult = await this.getWalletList(password);
      if (!walletsResult.success) {
        return walletsResult;
      }

      const walletList = walletsResult.wallets.map(wallet => 
        wallet.id === walletId 
          ? { ...wallet, alias: SecureStorage.sanitizeString(newAlias) }
          : wallet
      );

      const encryptResult = SecureStorage.encrypt(walletList, password);
      if (!encryptResult.success) {
        return encryptResult;
      }

      localStorage.setItem(this.WALLETS_KEY, encryptResult.encrypted);

      return {
        success: true,
        message: i18nService.t('multiwallet.success_alias_updated')
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_alias_update_failed')
      };
    }
  }

  // 특정 지갑 조회
  static async getWallet(walletId, password) {
    try {
      const walletsResult = await this.getWalletList(password);
      if (!walletsResult.success) {
        return walletsResult;
      }

      const wallet = walletsResult.wallets.find(w => w.id === walletId);
      if (!wallet) {
        return {
          success: false,
          error: i18nService.t('multiwallet.error_wallet_not_found')
        };
      }

      return {
        success: true,
        wallet: wallet
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_wallet_info_load_failed')
      };
    }
  }

  // 모든 지갑 잔액 업데이트
  static async updateAllBalances(password) {
    try {
      const walletsResult = await this.getWalletList(password);
      if (!walletsResult.success) {
        return walletsResult;
      }

      const updatedWallets = await Promise.all(
        walletsResult.wallets.map(async (wallet) => {
          try {
            const balanceResult = await walletService.getBalance(wallet.address);
            return {
              ...wallet,
              balance: balanceResult.success ? balanceResult.balance : wallet.balance,
              lastUpdated: Date.now()
            };
          } catch (error) {
            consolewarn(i18nService.t('multiwallet.warning_wallet_balance_update_failed', { 
              address: wallet.address 
            }), error);
            return wallet;
          }
        })
      );

      // 업데이트된 정보 저장
      const encryptResult = SecureStorage.encrypt(updatedWallets, password);
      if (encryptResult.success) {
        localStorage.setItem(this.WALLETS_KEY, encryptResult.encrypted);
      }

      return {
        success: true,
        wallets: updatedWallets
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_balance_update_all_failed')
      };
    }
  }

  // 활성 지갑 설정
  static setActiveWallet(walletId) {
    try {
      localStorage.setItem(this.ACTIVE_WALLET_KEY, walletId);
      return true;
    } catch {
      return false;
    }
  }

  // 활성 지갑 조회
  static getActiveWallet() {
    try {
      return localStorage.getItem(this.ACTIVE_WALLET_KEY);
    } catch {
      return null;
    }
  }

  // 활성 지갑 정보 조회
  static async getActiveWalletData(password) {
    const activeWalletId = this.getActiveWallet();
    if (!activeWalletId) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_no_active_wallet')
      };
    }

    return await this.getWallet(activeWalletId, password);
  }

  // 활성 지갑 초기화
  static clearActiveWallet() {
    try {
      localStorage.removeItem(this.ACTIVE_WALLET_KEY);
      return true;
    } catch {
      return false;
    }
  }

  // 모든 지갑 데이터 삭제 (토큰 정보도 함께 삭제)
  static async clearAllWallets() {
    try {
      localStorage.removeItem(this.WALLETS_KEY);
      localStorage.removeItem(this.ACTIVE_WALLET_KEY);
      
      // 암호화된 토큰 데이터도 안전하게 삭제
      SecureStorage.secureDeleteTokens();
      
      return {
        success: true,
        message: i18nService.t('multiwallet.success_all_wallets_cleared')
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_clear_wallets_failed')
      };
    }
  }

  // 지갑 ID 생성
  static generateWalletId() {
    return 'wallet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 지갑 존재 여부 확인
  static hasWallets() {
    return localStorage.getItem(this.WALLETS_KEY) !== null;
  }

  // 지갑 데이터 내보내기 (토큰 정보 포함)
  static async exportWallets(password) {
    try {
      const walletsResult = await this.getWalletList(password);
      if (!walletsResult.success) {
        return walletsResult;
      }

      const allTokens = this.getAllWalletTokens(password);

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        wallets: walletsResult.wallets.map(wallet => ({
          id: wallet.id,
          address: wallet.address,
          privateKey: wallet.privateKey,
          mnemonic: wallet.mnemonic,
          alias: wallet.alias,
          createdAt: wallet.createdAt,
          isImported: wallet.isImported,
          tokens: allTokens[wallet.id] || []
        }))
      };

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_export_failed')
      };
    }
  }

  // 지갑 데이터 가져오기 (토큰 정보 포함)
  static async importWallets(importData, password) {
    try {
      if (!importData.wallets || !Array.isArray(importData.wallets)) {
        throw new Error(i18nService.t('multiwallet.error_import_format'));
      }

      const existingWallets = await this.getWalletList(password);
      const walletList = existingWallets.success ? existingWallets.wallets : [];

      let importedCount = 0;
      let skippedCount = 0;

      for (const importWallet of importData.wallets) {
        // 중복 검사
        const isDuplicate = walletList.some(w => 
          w.address.toLowerCase() === importWallet.address.toLowerCase()
        );

        if (isDuplicate) {
          skippedCount++;
          continue;
        }

        // 지갑 추가
        const newWallet = {
          id: this.generateWalletId(),
          address: importWallet.address,
          privateKey: importWallet.privateKey,
          mnemonic: importWallet.mnemonic || null,
          alias: SecureStorage.sanitizeString(
            importWallet.alias || i18nService.t('multiwallet.label_imported_wallet', { 
              number: walletList.length + 1 
            })
          ),
          createdAt: importWallet.createdAt || Date.now(),
          isImported: true,
          balance: '0.0000'
        };

        walletList.push(newWallet);

        // 토큰 정보도 함께 가져오기 (암호화 적용)
        if (importWallet.tokens && Array.isArray(importWallet.tokens)) {
          this.saveWalletTokens(newWallet.id, importWallet.tokens, password);
        }

        importedCount++;
      }

      // 저장
      const encryptResult = SecureStorage.encrypt(walletList, password);
      if (!encryptResult.success) {
        return encryptResult;
      }

      localStorage.setItem(this.WALLETS_KEY, encryptResult.encrypted);

      return {
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        message: i18nService.t('multiwallet.success_wallets_imported', { 
          imported: importedCount, 
          skipped: skippedCount 
        })
      };
    } catch (error) {
      return {
        success: false,
        error: i18nService.t('multiwallet.error_import_failed') + ': ' + error.message
      };
    }
  }
}