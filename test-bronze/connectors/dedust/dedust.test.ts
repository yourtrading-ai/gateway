import {
    AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE,
    InitializationError,
    NETWORK_ERROR_MESSAGE,
    SERVICE_UNITIALIZED_ERROR_CODE,
    SERVICE_UNITIALIZED_ERROR_MESSAGE,
    TOKEN_NOT_SUPPORTED_ERROR_MESSAGE
} from '../../../src/services/error-handler';
import { BigNumber } from 'ethers';


enum Side { BUY = 'BUY', SELL = 'SELL', }

jest.mock('../../../src/services/common-interfaces', () => ({
    chain: {
        getAssetForSymbol: jest.fn(),
        tonClient: {
            open: jest.fn(),
        },
    },
}));

jest.mock('../../../src/connectors/dedust/dedust', () => ({
    factory: {
        getPool: jest.fn(),
        getNativeVault: jest.fn(),
        getJettonVault: jest.fn(),
    },
}));

describe('estimateTrade', () => {
    let dedustInstance: {
        _ready: boolean;
        chain: any;
        factory: any;
        executeTrade: jest.Mock<any, any, any>;
        estimateTrade: jest.Mock<any, any, any>;
        _config: {
            maxPriceImpact: number;
            allowedSlippage: string;
            tradingTypes: any[];
            chainType: string;
            availableNetworks: any[]
        };
        init: jest.Mock<Promise<void>, [], any>;
        getSlippage: jest.Mock<any, any, any>
    };

    beforeEach(() => {
        dedustInstance = {
            _ready: true,
            chain: require('../../../src/services/common-interfaces.ts').chain,
            factory: require('../../../src/connectors/dedust/dedust.ts').factory,
            executeTrade: jest.fn(),
            estimateTrade: jest.fn(), // Mock inicial
            _config: {
                maxPriceImpact: 30,
                allowedSlippage: '',
                tradingTypes: [],
                chainType: '',
                availableNetworks: []
            },
            init: jest.fn(() => Promise.resolve()),
            getSlippage: jest.fn().mockReturnValue({ value: BigNumber.from('10000000'), decimals: 6 }),
        };

        dedustInstance.estimateTrade.mockRejectedValue(
          new InitializationError(
            SERVICE_UNITIALIZED_ERROR_MESSAGE('Dedust'),
            SERVICE_UNITIALIZED_ERROR_CODE
          )
        );

        jest.clearAllMocks();
    });

    it('You should launch initializanerror when _Ready is false', async () => {
        dedustInstance._ready = false;

        await expect(
          dedustInstance.estimateTrade({
              chain: 'ton',
              network: 'testnet',
              side: Side.BUY,
              base: 'BASE',
              quote: 'QUOTE',
              amount: '10',
          })
        ).rejects.toThrow(
          new InitializationError(
            SERVICE_UNITIALIZED_ERROR_MESSAGE('Dedust'),
            SERVICE_UNITIALIZED_ERROR_CODE
          )
        );
    });

    it('should throw an error if the base or quote token is not found', async () => {
        dedustInstance.chain.getAssetForSymbol.mockReturnValueOnce(null);

        await expect(
          dedustInstance.estimateTrade({ base: 'INVALID', quote: 'QUOTE', amount: '10' })
        ).rejects.toThrow(`${TOKEN_NOT_SUPPORTED_ERROR_MESSAGE}INVALID or QUOTE`);
    });

    it('must lake an error if the amount is invalid', async () => {
        await expect(
          dedustInstance.estimateTrade({ base: 'BASE', quote: 'QUOTE', amount: '0' })
        ).rejects.toThrow(AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE);

        await expect(
          dedustInstance.estimateTrade({ base: 'BASE', quote: 'QUOTE', amount: '-1' })
        ).rejects.toThrow(AMOUNT_NOT_SUPPORTED_ERROR_MESSAGE);
    });

    it('It must correctly calculate trade, expertadamunt and expericedprice', async () => {
        const mockBaseToken = {
            symbol: 'BASE',
            decimals: 6,
            assetId: { address: 'mock-base-address' },
        };
        const mockQuoteToken = {
            symbol: 'QUOTE',
            decimals: 6,
            assetId: { address: 'mock-quote-address' },
        };

        dedustInstance.estimateTrade({ base: 'BASE', quote: 'QUOTE', amount: '-1' })
          .chain.getAssetForSymbol
          .mockReturnValueOnce(mockBaseToken)
          .mockReturnValueOnce(mockQuoteToken);

        const mockPool = {
            getReadinessStatus: jest.fn().mockResolvedValue('READY'),
            getEstimatedSwapOut: jest.fn().mockResolvedValue({
                amountOut: BigInt(1000000),
                tradeFee: BigInt(100),
            }),
        };
        const mockVault = { getReadinessStatus: jest.fn().mockResolvedValue('READY') };

        dedustInstance.chain.tonClient.open.mockResolvedValueOnce(mockPool).mockResolvedValueOnce(mockVault);
        dedustInstance.factory.getPool.mockResolvedValue({});
        dedustInstance.factory.getNativeVault.mockResolvedValue({});

        const result = await dedustInstance.estimateTrade({
            base: 'BASE',
            quote: 'QUOTE',
            amount: '1',
        });

        expect(result).toHaveProperty('trade');
        expect(result).toHaveProperty('expectedAmount');
        expect(result).toHaveProperty('expectedPrice');

        expect(result.expectedAmount).toBeCloseTo(1);
        expect(result.expectedPrice).toBeCloseTo(1);
    });

    it('should launch uniswapishhpriceerror if the pool is not ready', async () => {
        const mockBaseToken = { symbol: 'BASE', decimals: 6, assetId: { address: 'mock-base-address' } };
        const mockQuoteToken = { symbol: 'QUOTE', decimals: 6, assetId: { address: 'mock-quote-address' } };

        dedustInstance.chain.getAssetForSymbol
          .mockReturnValueOnce(mockBaseToken)
          .mockReturnValueOnce(mockQuoteToken);

        const mockPool = { getReadinessStatus: jest.fn().mockResolvedValue('NOT_READY') };

        dedustInstance.chain.tonClient.open.mockResolvedValueOnce(mockPool);
        dedustInstance.factory.getPool.mockResolvedValue({}); // Simular retorno para pool

        await expect(
          dedustInstance.estimateTrade({ base: 'BASE', quote: 'QUOTE', amount: '1' })
        ).rejects.toThrow('Pool does not exist or is not ready');
    });

    it('should launch uniswapishhpriceerror if the price impact is higher than allowed', async () => {
        const mockBaseToken = {
            symbol: 'BASE',
            decimals: 6,
            assetId: { address: 'mock-base-address' },
        };
        const mockQuoteToken = {
            symbol: 'QUOTE',
            decimals: 6,
            assetId: { address: 'mock-quote-address' },
        };

        dedustInstance.chain.getAssetForSymbol
          .mockReturnValueOnce(mockBaseToken)
          .mockReturnValueOnce(mockQuoteToken);

        const mockPool = {
            getReadinessStatus: jest.fn().mockResolvedValue('READY'),
            getEstimatedSwapOut: jest.fn().mockResolvedValue({
                amountOut: BigInt(500000),
                tradeFee: BigInt(100),
            }),
        };
        const mockVault = { getReadinessStatus: jest.fn().mockResolvedValue('READY') };

        dedustInstance.chain.tonClient.open.mockResolvedValueOnce(mockPool).mockResolvedValueOnce(mockVault);
        dedustInstance.factory.getPool.mockResolvedValue({});
        dedustInstance.factory.getNativeVault.mockResolvedValue({});

        await expect(
          dedustInstance.estimateTrade({ base: 'BASE', quote: 'QUOTE', amount: '1' })
        ).rejects.toThrow(
          `Price impact too high: 50.00% > ${dedustInstance._config.maxPriceImpact}%`
        );
    });

    it('must ever earny message for network problems', async () => {
        dedustInstance.chain.getAssetForSymbol.mockReturnValueOnce({
            symbol: 'BASE',
            decimals: 6,
            assetId: { address: 'mock-base-address' },
        });
        dedustInstance.factory.getPool.mockRejectedValue(new Error('network error'));

        await expect(
          dedustInstance.estimateTrade({ base: 'BASE', quote: 'QUOTE', amount: '1' })
        ).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    });
});