// src/services/networkConfig.js 
export const NETWORKS = {
  mainnet: {
    name: 'WorldLand Mainnet',
    rpcUrl: 'https://seoul.worldland.foundation',
    chainId: 103,
    chainIdHex: '0x67',
    symbol: 'WLC',
    explorer: 'https://scan.worldland.foundation',     // 웹 브라우저용
    explorerApi: 'https://scan.worldland.foundation',  // API 호출용 (WorldLand는 같음)
    decimals: 18,
    emoji: '🏆'
  },
  testnet: {
    name: 'WorldLand Testnet', 
    rpcUrl: 'https://gwangju.worldland.foundation',
    chainId: 10395,
    chainIdHex: '0x289b',
    symbol: 'WLC',
    explorer: 'https://scan.worldland.foundation',
    explorerApi: 'https://scan.worldland.foundation',  // API 호출용 (WorldLand는 같음)
    decimals: 18,
    decimals: 18,
    emoji: '🪄'
  },
  ethereum: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://ethereum.publicnode.com',
    chainId: 1,
    chainIdHex: '0x1',
    symbol: 'ETH',
    explorer: 'https://etherscan.io',           // 웹 브라우저용 (WalletMain.js에서 사용)
    explorerApi: 'https://api.etherscan.io', // API 호출용 (walletService.js에서 사용)
    decimals: 18,
    emoji: '🥇'
  },
  bsc: {
    name: 'BNB Smart Chain (BEP20)',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    chainId: 56,
    chainIdHex: '0x38',
    symbol: 'BNB',
    explorer: 'https://bscscan.com',            // 웹 브라우저용
    explorerApi: 'https://api.etherscan.io', // API 호출용
    decimals: 18,
    emoji: '📊'
  }
};

export const DEFAULT_NETWORK = 'mainnet';

export const GAS_PRICES = {
  slow: '10',
  standard: '20', 
  fast: '30'
};

// 네트워크별 기본 토큰 목록
export const NETWORK_TOKENS = {
  mainnet: [
    {
            address: '0xc93f06d582fd6fD7FfEd928ffB57896474abC855',
            name: 'SAPSALDOG',
            symbol: 'Dokdo',
            decimals: 18,
            verified: true,
            description: 'SAPSALDOG 토큰',
            homepage: 'https://sapsaldog.com'  
        },
        {
            address: '0xDBEDbeB2CD8493AE2d746b7eeD597946F6E7910A',
            name: 'WorldLand Cafe',
            symbol: 'CAFE',
            decimals: 18,
            verified: true,
            description: 'WorldLand Cafe 토큰',
            homepage: 'https://cafe.doldari.com'  
        },
        {
            address: '0x6f57a06f1eA3c6EB16F742249CBdCB672458337C',
            name: 'WorldLand-Pay',
            symbol: 'WLP',
            decimals: 18,
            verified: true,
            description: 'WorldLand Pay 토큰',
            homepage: 'https://wlp.doldari.com'  
        },
        {
            address: '0xC0AD918E5CC5930B8D31cc229770f232Dd82187a',
            name: 'Doldari',
            symbol: 'DOL',
            decimals: 18,
            verified: true,
            description: 'Doldari 토큰',
            homepage: 'https://www.doldari.com'  
        },
        {
            address: '0x12183c232B94a6FB80711037b8A407a03Dd24983',
            name: 'World Vision',
            symbol: 'VISION',
            decimals: 18,
            verified: true,
            description: 'World Vision 토큰',
            homepage: 'https://vision.doldari.com'  
        },
        {
            address: '0xAEdb0ef87Dad9DAd8f4E8e1a157268bA5F40c6A5',
            name: 'YouronlyJen',
            symbol: 'YOURONLYJEN',
            decimals: 18,
            verified: true,
            description: 'YouronlyJen 토큰',
            homepage: 'https://youronlyjen.doldari.com'  
        },
        {
            address: '0x0817394Dc95342cd1F9eAF4Eae0d03F4202Bc4e4',
            name: 'YOGO Pay',
            symbol: 'YOGO',
            decimals: 18,
            verified: true,
            description: 'YOGO Pay 토큰',
            homepage: 'https://yogo.kr'  
        }
  ],
  testnet: [
    {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      name: 'Test USD',
      symbol: 'TUSD',
      decimals: 6,
      verified: true,
      description: 'WorldLand Testnet 테스트 스테이블코인'
    },
    {
      address: '0xbcdef1234567890abcdef1234567890abcdef123',
      name: 'Test Token',
      symbol: 'TT',
      decimals: 18,
      verified: true,
      description: 'WorldLand Testnet 테스트 토큰'
    }
  ],
  ethereum: [
    // Stablecoins
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      verified: true,
      description: 'USD 페깅 스테이블코인'
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      verified: true,
      description: 'Circle의 USD 스테이블코인'
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      verified: true,
      description: 'MakerDAO의 탈중앙화 스테이블코인'
    },
    {
      address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
      name: 'Binance USD',
      symbol: 'BUSD',
      decimals: 18,
      verified: true,
      description: 'Binance의 USD 스테이블코인'
    },
    {
      address: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
      name: 'Frax',
      symbol: 'FRAX',
      decimals: 18,
      verified: true,
      description: '부분적 알고리즘 스테이블코인'
    },

    // Wrapped Tokens
    {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      verified: true,
      description: 'ERC-20 래핑된 이더리움'
    },
    {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      name: 'Wrapped BTC',
      symbol: 'WBTC',
      decimals: 8,
      verified: true,
      description: 'ERC-20 래핑된 비트코인'
    },
    {
      address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      name: 'Wrapped stETH',
      symbol: 'wstETH',
      decimals: 18,
      verified: true,
      description: 'Lido의 스테이킹된 ETH'
    },

    // DeFi Tokens
    {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      name: 'Uniswap',
      symbol: 'UNI',
      decimals: 18,
      verified: true,
      description: 'Uniswap DEX 거버넌스 토큰'
    },
    {
      address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      name: 'Aave Token',
      symbol: 'AAVE',
      decimals: 18,
      verified: true,
      description: 'Aave 프로토콜 거버넌스 토큰'
    },
    {
      address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
      name: 'Maker',
      symbol: 'MKR',
      decimals: 18,
      verified: true,
      description: 'MakerDAO 거버넌스 토큰'
    },
    {
      address: '0x57e114B691Db790C35207b2e685D4A43181e6061',
      name: 'Ethena',
      symbol: 'ENA',
      decimals: 18,
      verified: true,
      description: 'Ethena governance token on Ethereum blockchain'
    },
    {
      address: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72',
      name: 'Ethereum Name Service',
      symbol: 'ENS',
      decimals: 18,
      verified: true,
      description: 'ENS 거버넌스 토큰'
    },
    {
      address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
      name: 'SushiToken',
      symbol: 'SUSHI',
      decimals: 18,
      verified: true,
      description: 'SushiSwap DEX 토큰'
    },
    {
      address: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
      name: 'Compound',
      symbol: 'COMP',
      decimals: 18,
      verified: true,
      description: 'Compound 프로토콜 거버넌스 토큰'
    },
    {
      address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
      name: 'yearn.finance',
      symbol: 'YFI',
      decimals: 18,
      verified: true,
      description: 'Yearn Finance 거버넌스 토큰'
    },
    {
      address: '0xba100000625a3754423978a60c9317c58a424e3D',
      name: 'Balancer',
      symbol: 'BAL',
      decimals: 18,
      verified: true,
      description: 'Balancer 프로토콜 거버넌스 토큰'
    },
    {
      address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
      name: 'Curve DAO Token',
      symbol: 'CRV',
      decimals: 18,
      verified: true,
      description: 'Curve Finance 거버넌스 토큰'
    },
    {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      name: 'ChainLink Token',
      symbol: 'LINK',
      decimals: 18,
      verified: true,
      description: '탈중앙화 오라클 네트워크 토큰'
    },

    // Layer 2 & Scaling
    {
      address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
      name: 'Matic Token',
      symbol: 'MATIC',
      decimals: 18,
      verified: true,
      description: 'Polygon 네트워크 토큰'
    },
    {
      address: '0x4200000000000000000000000000000000000042',
      name: 'Optimism',
      symbol: 'OP',
      decimals: 18,
      verified: true,
      description: 'Optimism L2 거버넌스 토큰'
    },
    {
      address: '0x3845badAde8e6dFF049820680d1F14bD3903a5d0',
      name: 'The Sandbox',
      symbol: 'SAND',
      decimals: 18,
      verified: true,
      description: '메타버스 플랫폼 토큰'
    },

    // Exchange Tokens
    {
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      name: 'SHIBA INU',
      symbol: 'SHIB',
      decimals: 18,
      verified: true,
      description: '밈 코인'
    },
    {
      address: '0x4d224452801ACEd8B2F0aebE155379bb5D594381',
      name: 'ApeCoin',
      symbol: 'APE',
      decimals: 18,
      verified: true,
      description: 'Bored Ape Yacht Club 생태계 토큰'
    },
    {
      address: '0x50D1c9771902476076eCFc8B2A83Ad6b9355a4c9',
      name: 'FTX Token',
      symbol: 'FTT',
      decimals: 18,
      verified: true,
      description: 'FTX 거래소 토큰 (주의: FTX 파산)'
    },

    // Other Major Tokens
    {
      address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
      name: 'Lido Staked Ether',
      symbol: 'stETH',
      decimals: 18,
      verified: true,
      description: 'Lido 스테이킹 ETH'
    },
    {
      address: '0x6810e776880C02933D47DB1b9fc05908e5386b96',
      name: 'Gnosis Token',
      symbol: 'GNO',
      decimals: 18,
      verified: true,
      description: 'Gnosis 예측 시장 플랫폼 토큰'
    },
    {
      address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
      name: 'Basic Attention Token',
      symbol: 'BAT',
      decimals: 18,
      verified: true,
      description: 'Brave 브라우저 광고 토큰'
    },
    {
      address: '0xE41d2489571d322189246DaFA5ebDe1F4699F498',
      name: '0x Protocol Token',
      symbol: 'ZRX',
      decimals: 18,
      verified: true,
      description: '0x 프로토콜 거버넌스 토큰'
    },
    {
      address: '0x111111111117dC0aa78b770fA6A738034120C302',
      name: '1inch Token',
      symbol: '1INCH',
      decimals: 18,
      verified: true,
      description: '1inch DEX 애그리게이터 토큰'
    },
    {
      address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',
      name: 'Graph Token',
      symbol: 'GRT',
      decimals: 18,
      verified: true,
      description: 'The Graph 인덱싱 프로토콜 토큰'
    },
    {
      address: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942',
      name: 'Decentraland',
      symbol: 'MANA',
      decimals: 18,
      verified: true,
      description: '가상 세계 플랫폼 토큰'
    }
  ],
  bsc: [
    {
      address: '0x55d398326f99059fF775485246999027B3197955',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 18,
      verified: true,
      description: 'BSC 스테이블코인'
    },
    {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 18,
      verified: true,
      description: 'BSC 스테이블코인'
    },
    {
      address: '0xe9e7CEA3DedcA5984780BfFADe587242c208E53d',
      name: 'Binance USD',
      symbol: 'BUSD',
      decimals: 18,
      verified: true,
      description: 'BSC 기반 BUSD'
    },
    {
      address: '0x2170Ed0880ac9A755fd29B268895FaaD15aD7dC2',
      name: 'Ethereum Token',
      symbol: 'ETH',
      decimals: 18,
      verified: true,
      description: 'Wrapped Ethereum on BSC'
    },
    // 💡 Binance Smart Chain의 주요 토큰들 (Defi, Dex, Infra)
    {
      address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      name: 'PancakeSwap Token',
      symbol: 'CAKE',
      decimals: 18,
      verified: true,
      description: 'PancakeSwap 거버넌스 토큰'
    },
    {
      address: '0xc748673057861a797275CD8A068AbB95A902e8de',
      name: 'BabyDoge coin',
      symbol: 'BabyDoge',
      decimals: 18,
      verified: true,
      description: 'BabyDoge coin'
    },
    {
      address: '0x840eF7e5f896Be71D46Df234C60898216feFCBe3',
      name: 'BYTE coin',
      symbol: 'BYTE',
      decimals: 18,
      verified: true,
      description: 'BYTE coin'
    },
    {
      address: '0xf87332f170E4b3Ea373D4c414434255160E04E5B',
      name: 'Wrapped BNB',
      symbol: 'WBNB',
      decimals: 18,
      verified: true,
      description: 'DeFi 사용을 위한 Wrapped BNB'
    },
    {
      address: '0xf8A02f231e33A44990924976450A0B59a43a0491',
      name: 'Chainlink Token',
      symbol: 'LINK',
      decimals: 18,
      verified: true,
      description: '오라클 네트워크'
    },
    { // 👈 [추가] DOT
      address: '0x7083609fCE4d1d8Dc0C979AAb8c88d1d866a15B7',
      name: 'Polkadot',
      symbol: 'DOT',
      decimals: 18,
      verified: true,
      description: 'Polkadot on BSC'
    },
    { // 👈 [추가] ADA
      address: '0x3ee2200efb3400fAbB9EceB4a690868fBce2fE85',
      name: 'Cardano',
      symbol: 'ADA',
      decimals: 18,
      verified: true,
      description: 'Cardano on BSC'
    },
    { // 👈 [추가] DOGE
      address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43',
      name: 'DogeCoin',
      symbol: 'DOGE',
      decimals: 8,
      verified: true,
      description: 'DogeCoin on BSC (Wrapped)'
    },
    { // 👈 [추가] SOL
      address: '0x57008711C91F0d02bA080922C0263c9bF5041447',
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
      verified: true,
      description: 'Solana on BSC (Wrapped)'
    }
  ]
};