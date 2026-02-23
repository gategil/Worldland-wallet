// src/components/TransactionHistory.js - 다중 토큰 지원 + 다국어 지원 버전
import React, { useState, useEffect } from 'react';
import { consolelog, consoleerror, consolewarn } from '../utils/logger.js';
import { History, RefreshCw, ArrowUpRight, ArrowDownLeft, ExternalLink, Copy, Filter, Calendar, Coins } from 'lucide-react';
import { walletService } from '../services/walletService';
import { useTranslation } from '../hooks/useTranslation';
import './TransactionHistory.css';

const TransactionHistory = ({ address, network, selectedAsset }) => {
  const { t, currentLanguage } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'sent', 'received'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'amount'
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const isToken = selectedAsset && selectedAsset.type !== 'native';
  const assetSymbol = selectedAsset?.symbol || 'WLC';
  const assetName = selectedAsset?.name || 'WorldLand Coin';

  // 언어별 로케일 매핑
  const getLocale = () => {
    const localeMap = {
      ko: 'ko-KR',
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      ja: 'ja-JP',
      ru: 'ru-RU',
      zh: 'zh-CN',
      ar: 'ar-SA'    // 아랍어 (사우디아라비아)
    };
    return localeMap[currentLanguage] || 'en-US';
  };

  useEffect(() => {
    loadTransactions(true);
  }, [address, filter, selectedAsset]);

  const loadTransactions = async (reset = false) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const currentPage = reset ? 1 : page;
      
      // 선택된 자산에 따라 거래 내역 조회
      const result = await walletService.getTransactionHistory(
        address, 
        20, 
        true, // useCache
        selectedAsset, // 선택된 자산 정보 전달
        network
      );
      
      if (result.success) {
        let filteredTxs = result.transactions;
        
        // 필터 적용
        if (filter === 'sent') {
          filteredTxs = filteredTxs.filter(tx => 
            tx.from?.toLowerCase() === address.toLowerCase()
          );
        } else if (filter === 'received') {
          filteredTxs = filteredTxs.filter(tx => 
            tx.to?.toLowerCase() === address.toLowerCase()
          );
        }
        
        // 정렬 적용
        filteredTxs = sortTransactions(filteredTxs);
        
        if (reset) {
          setTransactions(filteredTxs);
          setPage(2);
        } else {
          setTransactions(prev => [...prev, ...filteredTxs]);
          setPage(prev => prev + 1);
        }
        
        setHasMore(filteredTxs.length === 20);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(t('TransactionHistory.loadTransactionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const sortTransactions = (txs) => {
    return [...txs].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return (a.timestamp || 0) - (b.timestamp || 0);
        case 'amount':
          return parseFloat(b.value || '0') - parseFloat(a.value || '0');
        case 'newest':
        default:
          return (b.timestamp || 0) - (a.timestamp || 0);
      }
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return t('TransactionHistory.unknown');
    const date = new Date(timestamp * 1000);
    const locale = getLocale();
    
    // 절대적 시간 표시 (년월일 + 시분초)
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' ' + date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // 24시간 형식
    });
  };

  const formatAddress = (addr) => {
    if (!addr) return t('TransactionHistory.unknown');
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getTransactionType = (tx) => {
    if (!tx.from || !tx.to) return 'unknown';
    const isFromMe = tx.from.toLowerCase() === address.toLowerCase();
    const isToMe = tx.to.toLowerCase() === address.toLowerCase();
    
    if (isFromMe && isToMe) return 'self';
    if (isFromMe) return 'sent';
    if (isToMe) return 'received';
    return 'unknown';
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // 실제 앱에서는 토스트 메시지 사용
      alert(t('TransactionHistory.copiedToClipboard'));
    } catch (error) {
      consoleerror(t('TransactionHistory.copyFailed'), error);
    }
  };

  const openInExplorer = (txHash) => {
    const url = `${network.explorer}/tx/${txHash}`;
    window.open(url, '_blank');
  };

  const exportTransactions = () => {
    const csvContent = [
      [
        t('TransactionHistory.csvHeaders.date'), 
        t('TransactionHistory.csvHeaders.type'), 
        t('TransactionHistory.csvHeaders.fromAddress'), 
        t('TransactionHistory.csvHeaders.toAddress'), 
        t('TransactionHistory.csvHeaders.amount', { symbol: assetSymbol }), 
        t('TransactionHistory.csvHeaders.transactionHash'), 
        t('TransactionHistory.csvHeaders.token')
      ],
      ...transactions.map(tx => [
        formatDate(tx.timestamp),
        getTransactionType(tx) === 'sent' ? t('TransactionHistory.sent') : t('TransactionHistory.received'),
        tx.from || '',
        tx.to || '',
        tx.value || '0',
        tx.hash || '',
        tx.token ? `${tx.token.symbol} (${tx.token.name})` : assetSymbol
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `worldland-transactions-${assetSymbol}-${address.slice(0, 8)}.csv`;
    link.click();
  };

  const formatBalance = (balance) => {
    const num = parseFloat(balance || 0);
    if (num === 0) return '0.0000';
    if (num < 0.0001) return '<0.0001';
    return num.toFixed(4);
  };

  return (
    <div className="transaction-history">
      <div className="history-header">
        <div className="header-title">
          <History size={24} />
          <h3>{t('TransactionHistory.assetTransactionHistory', { assetName })}</h3>
        </div>
        
        <div className="header-actions">
          <button 
            className={`refresh-button`}
            onClick={() => loadTransactions(true)}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
          
          <button 
            className="export-button"
            onClick={exportTransactions}
            disabled={transactions.length === 0}
          >
            {t('TransactionHistory.export')}
          </button>
        </div>
      </div>

      {/* 선택된 자산 정보 */}
      {/* <div className="selected-asset-header">
        <div className="selected-asset-info">
          <div className="asset-icon">
            {isToken ? '🪙' : '🏆'}
          </div>
          <div className="asset-details">
            <div className="asset-name">{assetName}</div>
            <div className="asset-symbol">{assetSymbol}</div>
          </div>
        </div>
        <div className="asset-type">
          {isToken ? t('TransactionHistory.erc20Token') : t('TransactionHistory.nativeToken')}
        </div>
      </div> */}

      {/* 필터 및 정렬 */}
      <div className="controls">
        <div className="filters">
          {/* <div className="filter-group">
            <Filter size={16} />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t('TransactionHistory.allTransactions')}</option>
              <option value="sent">{t('TransactionHistory.sentTransactions')}</option>
              <option value="received">{t('TransactionHistory.receivedTransactions')}</option>
            </select>
          </div> */}
          
          {/* <div className="sort-group">
            <Calendar size={16} />
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">{t('TransactionHistory.newest')}</option>
              <option value="oldest">{t('TransactionHistory.oldest')}</option>
              <option value="amount">{t('TransactionHistory.amountSort')}</option>
            </select>
          </div> */}
          {/* 더 보기 버튼 */}
          {hasMore && transactions.length > 0 && (
            <div className="load-more">
              <button 
                className="load-more-button"
                onClick={() => loadTransactions(false)}
                disabled={isLoading}
              >
                {isLoading ? t('TransactionHistory.loading') : t('TransactionHistory.loadMore')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => loadTransactions(true)}>
            {t('TransactionHistory.retryButton')}
          </button>
        </div>
      )}

      {/* 거래 목록 */}
      <div className="transactions-list">
        {transactions.length === 0 && !isLoading ? (
          <div className="empty-state">
            <History size={48} />
            <h3>{t('TransactionHistory.noAssetTransactions', { assetSymbol })}</h3>
            <p>{t('TransactionHistory.startFirstTransaction')} {assetName} {t('TransactionHistory.startTransactionMessage')}</p>
          </div>
        ) : (
          transactions.map((tx, index) => {
            const txType = getTransactionType(tx);
            const isOutgoing = txType === 'sent';
            const isSelf = txType === 'self';
            const isTokenTx = tx.type === 'token_transfer';
            
            return (
              <div key={`${tx.hash}-${index}`} className="transaction-item">
                <div className="tx-details">
                  <div className="tx-main">
                    <div className="tx-type-info">
                      <div className="tx-type">
                        {isSelf ? t('TransactionHistory.selfTransaction') : 
                         isOutgoing ? t('TransactionHistory.sent') : 
                         t('TransactionHistory.received')}
                      </div>
                      {isTokenTx && tx.token && (
                        <div className="token-badge">
                          <Coins size={12} />
                          {tx.token.symbol}
                        </div>
                      )}
                    </div>
                    <div className={`tx-amount ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                      {isOutgoing ? '-' : '+'}{formatBalance(tx.value)} {isTokenTx ? tx.token?.symbol : assetSymbol}
                    </div>
                  </div>
                  
                  <div className="tx-addresses">
                    <div className="address-row" style={{display: 'flex', flexDirection: "row"}}>
                      <span className="label">{t('TransactionHistory.from')}</span>
                      <span 
                        className="address clickable"
                        onClick={() => copyToClipboard(tx.from || '')}
                        title={t('TransactionHistory.clickToCopy')}
                      >
                        {formatAddress(tx.from)}
                      </span>
                    </div>
                    <div className="address-row" style={{display: 'flex', flexDirection: "row"}}>
                      <span className="label">{t('TransactionHistory.to')}</span>
                      <span 
                        className="address clickable"
                        onClick={() => copyToClipboard(tx.to || '')}
                        title={t('TransactionHistory.clickToCopy')}
                      >
                        {formatAddress(tx.to)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="tx-meta" style={{gap: '10px'}}>
                    <div className="tx-time">
                      {formatDate(tx.timestamp)}
                    </div>
                    <div className="tx-block">
                      {t('TransactionHistory.blockNumber')}: { 
                        tx.blockNumber || t('TransactionHistory.confirming')  
                      }
                    </div>
                  </div>
                </div>
                
                <div className="tx-actions">
                  <button 
                    className="action-button"
                    onClick={() => copyToClipboard(tx.hash || '')}
                    title={t('TransactionHistory.copyTransactionHash')}
                  >
                    <Copy size={16} />
                  </button>
                  <button 
                    className="action-button"
                    onClick={() => openInExplorer(tx.hash || '')}
                    title={t('TransactionHistory.viewInExplorer')}
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 거래 통계 (주석처리된 부분도 다국어 적용) */}
      {/* {transactions.length > 0 && (
        <div className="transaction-stats">
          <div className="stats-header">
            <h3>{t('TransactionHistory.transactionStats', { assetSymbol })}</h3>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">{t('TransactionHistory.totalTransactions')}</div>
              <div className="stat-value">{transactions.length}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">{t('TransactionHistory.sentTransactions')}</div>
              <div className="stat-value">
                {transactions.filter(tx => getTransactionType(tx) === 'sent').length}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">{t('TransactionHistory.receivedTransactions')}</div>
              <div className="stat-value">
                {transactions.filter(tx => getTransactionType(tx) === 'received').length}
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-label">{t('TransactionHistory.totalSent')}</div>
              <div className="stat-value">
                {transactions
                  .filter(tx => getTransactionType(tx) === 'sent')
                  .reduce((sum, tx) => sum + parseFloat(tx.value || '0'), 0)
                  .toFixed(4)} {assetSymbol}
              </div>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default TransactionHistory;