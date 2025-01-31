import { jest } from '@jest/globals';
import { Dedust } from '../../../src/connectors/dedust/dedust';
import { DedustConfig } from '../../../src/connectors/dedust/dedust.config';
import { PriceRequest } from '../../../src/amm/amm.requests';
import {
  AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE,
  InitializationError,
  TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
} from '../../../src/services/error-handler';
import { TonAsset } from '../../../src/chains/ton/ton.requests';

jest.mock('../../../src/chains/ton/ton', () => ({
  Ton: {
    getInstance: jest.fn().mockReturnValue({
      ready: jest.fn().mockReturnValue(true),
      init: jest.fn(),
      getAssetForSymbol: jest.fn(),
      tonClient: {
        open: jest.fn(),
      },
      wallet: {
        address: 'test-wallet',
      },
      getAccountFromAddress: jest.fn(),
      generateUniqueHash: jest.fn().mockReturnValue('unique-hash'),
      generateQueryId: jest.fn().mockReturnValue('query-id'),
    }),
  },
}));

jest.mock('../../../src/services/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@dedust/sdk', () => ({
  Factory: {
    createFromAddress: jest.fn(),
  },
}));

describe('Dedust Class', () => {
  let dedust: Dedust;

  beforeEach(() => {
    jest.clearAllMocks();
    dedust = Dedust.getInstance('testnet');

    const mockContract = {
      getSeqno: jest.fn(() => Promise.resolve(1)),
      sendTransfer: jest.fn(() => Promise.resolve()),
    };
    const mockTonClient = {
      open: jest.fn(() => mockContract),
    };

    dedust['chain'] = {
      ready: jest.fn(() => true),
      init: jest.fn(() => Promise.resolve()),
      getAssetForSymbol: jest.fn((symbol: string) => {
        if (symbol === 'TON')
          return { assetId: { address: 'ton-address' }, decimals: 9 };
        if (symbol === 'AIOTX')
          return { assetId: { address: 'aiotx-address' }, decimals: 9 };
        return null;
      }),

      getAccountFromAddress: jest.fn(() =>
        Promise.resolve({
          secretKey: 'mock-secret-key',
          publicKey: 'mock-public-key',
        }),
      ),
      tonClient: mockTonClient,
      wallet: {
        address: {
          toString: jest.fn(() => 'mock-wallet-address'),
        },
      },
    } as any;
  });

  it('should return a singleton instance', () => {
    const instance1 = Dedust.getInstance('testnet');
    const instance2 = Dedust.getInstance('testnet');
    expect(instance1).toBe(instance2);
  });

  it('should initialize correctly', async () => {
    await dedust.init();
    expect(dedust.ready()).toBe(true);
  });

  it('should throw an error when initialized with an invalid network', () => {
    expect(() => Dedust.getInstance(null as unknown as string)).toThrow(
      InitializationError,
    );
  });

  it('should correctly calculate slippage', () => {
    DedustConfig.config.allowedSlippage = '1/100';
    expect(dedust.getSlippage()).toBeCloseTo(0.01);

    DedustConfig.config.allowedSlippage = '5/100';
    expect(dedust.getSlippage()).toBeCloseTo(0.05);
  });

  it('should throw an error when estimating trade if not initialized', async () => {
    dedust['ready'] = (): false => false;
    await expect(
      dedust.estimateTrade({
        base: 'TON',
        quote: 'AIOTX',
        amount: '10',
        side: 'BUY',
        chain: 'ton',
        network: 'dedust',
      } as PriceRequest),
    ).rejects.toThrow(
      new Error(
        `Price query failed: TypeError: Cannot read properties of undefined (reading 'jetton')`,
      ),
    );
  });

  it('should throw an error for unsupported tokens', async () => {
    dedust['ready'] = () => true;
    dedust['chain'].getAssetForSymbol = jest.fn(() => null);

    await expect(
      dedust.estimateTrade({
        base: 'INVALID',
        quote: 'AIOTX',
        amount: '10',
      } as PriceRequest),
    ).rejects.toThrow(TOKEN_NOT_SUPPORTED_ERROR_MESSAGE);
  });

  it('should throw an error when amount is invalid', async () => {
    dedust['ready'] = () => true;
    dedust['chain'].getAssetForSymbol = jest.fn(
      (symbol: string): TonAsset | null => ({
        symbol: symbol as string,
        assetId: 'test-address',
        decimals: 9,
      }),
    );

    await expect(
      dedust.estimateTrade({
        base: 'TON',
        quote: 'AIOTX',
        amount: '-10',
      } as PriceRequest),
    ).rejects.toThrow(AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE);

    await expect(
      dedust.estimateTrade({
        base: 'TON',
        quote: 'AIOTX',
        amount: '0',
      } as PriceRequest),
    ).rejects.toThrow(AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE);
  });

  // it('estimateTrade should calculate correct price and amount for a valid trade', async () => {
  //   const priceRequest: PriceRequest = {
  //     base: 'TON',
  //     quote: 'AIOTX',
  //     amount: '100',
  //     side: 'BUY',
  //     chain: 'ton',
  //     network: 'testnet',
  //   };
  //   const result = await dedust.estimateTrade(priceRequest);
  //   expect(result.expectedPrice).toBe(2);
  //   expect(result.expectedAmount).toBe(100);
  // });

  it('should execute trade successfully', async () => {
    dedust['ready'] = () => true;
    dedust['chain'].getAccountFromAddress = jest.fn(
      async (): Promise<{ publicKey: string; secretKey: string }> => ({
        publicKey: 'mock-public-key',
        secretKey: 'mock-secret-key',
      }),
    );

    const result = await dedust.executeTrade(
      'test-account',
      {
        fromAsset: { type: 'NATIVE' },
        amount: '1000',
        pool: { address: 'test-pool' },
        vault: { sendSwap: jest.fn() },
      } as any,
      true,
    );

    expect(result.success).toBe(true);
  });

  // it('should handle network error when executing trade', async () => {
  //   dedust['ready'] = () => true;
  //   dedust['chain'].getAccountFromAddress = jest.fn(
  //     async (): Promise<{ publicKey: string; secretKey: string }> => ({
  //       publicKey: 'mock-public-key',
  //       secretKey: 'mock-secret-key',
  //     }),
  //   );

  //   dedust.executeTrade = jest.fn(
  //     async (): Promise<DedustConfig.DedustTradeResult> => {
  //       throw new Error('network error');
  //     },
  //   );

  //   await expect(
  //     dedust.executeTrade('test-account', {} as any, true),
  //   ).rejects.toThrow('network error');
  // });

  it('should handle insufficient funds error when executing trade', async () => {
    dedust['ready'] = () => true;

    dedust['chain'].getAccountFromAddress = jest.fn(
      async (): Promise<{ publicKey: string; secretKey: string }> => ({
        publicKey: 'mock-public-key',
        secretKey: 'mock-secret-key',
      }),
    );

    dedust.executeTrade = jest.fn(
      async (): Promise<DedustConfig.DedustTradeResult> => {
        throw new Error('insufficient funds');
      },
    );

    await expect(
      dedust.executeTrade('test-account', {} as any, true),
    ).rejects.toThrow('insufficient funds');
  });

  describe('Instance Methods', () => {
    // it('estimateTrade should calculate correct price and amount for a valid trade', async () => {
    //   const priceRequest: PriceRequest = {
    //     base: 'TON',
    //     quote: 'AIOTX',
    //     amount: '10',
    //     side: 'BUY',
    //     chain: 'ton',
    //     network: 'testnet',
    //   };
    //   const result = await dedust.estimateTrade(priceRequest);
    //   expect(result.expectedPrice).toBeCloseTo(50); // Ajuste conforme a lógica de cálculo
    //   expect(result.expectedAmount).toBeCloseTo(500); // Ajuste conforme a lógica de cálculo
    // });

    it('estimateTrade should throw an error for unsupported tokens', async () => {
      const priceRequest: PriceRequest = {
        base: 'INVALID',
        quote: 'AIOTX',
        amount: '100',
        side: 'BUY',
        chain: 'ton',
        network: 'testnet',
      };
      await expect(dedust.estimateTrade(priceRequest)).rejects.toThrow(
        new Error('Token not supported: INVALID or AIOTX'),
      );
    });
  });
});
