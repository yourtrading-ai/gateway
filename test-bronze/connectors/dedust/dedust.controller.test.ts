import { price, trade, estimateGas } from '../../../src/connectors/dedust/dedust.controllers';
import { HttpException } from '../../../src/services/error-handler';
import { Dedust } from '../../../src/connectors/dedust/dedust';
import { Ton } from '../../../src/chains/ton/ton';
import { latency } from '../../../src/services/base';


enum Side { BUY = 'BUY', SELL = 'SELL', }

jest.mock('../../../src/services/base');
jest.mock('../../../src/connectors/dedust/dedust');
jest.mock('../../../src/chains/ton/ton');


const startTimestamp: number = Date.now();

describe('Dedust Controller', () => {
    let mockTon: jest.Mocked<Ton>;
    let mockDedust: jest.Mocked<Dedust>;

    beforeEach(() => {
        mockTon = {
            ready: jest.fn(),
            network: 'testnet',
            gasPrice: '0.01',
            gasLimit: '100000',
            gasCost: '1',
            nativeTokenSymbol: 'TON',
        } as unknown as jest.Mocked<Ton>;

        mockDedust = {
            ready: jest.fn(),
            estimateTrade: jest.fn(),
            executeTrade: jest.fn(),
        } as unknown as jest.Mocked<Dedust>;
    });

    describe('price', () => {
        it('should return a valid PriceResponse on success', async () => {
            mockTon.ready.mockReturnValue(true);
            mockDedust.ready.mockReturnValue(true);

            mockDedust.estimateTrade.mockResolvedValue({
                expectedAmount: 100,
                expectedPrice: 10,
                // @ts-ignore
                trade: 'mockTrade',
            });
            const req = { base: 'TON', quote: 'USDT', amount: '10', side: Side.SELL, chain: 'ton', network: 'mainnet' };

            const response = await price(mockTon, mockDedust, req);

            expect(response).toEqual({
                network: 'testnet',
                timestamp: expect.any(Number),
                latency: latency(startTimestamp, Date.now()),
                base: 'TON',
                quote: 'USDT',
                amount: '10',
                rawAmount: '10',
                expectedAmount: '100',
                price: '10',
                gasPrice: '0.01',
                gasPriceToken: 'TON',
                gasLimit: '100000',
                gasCost: '1',
            });
        });

        it('should return a valid PriceResponse on success', async () => {

            jest.spyOn(Date, 'now')
              .mockImplementationOnce(() => 1000)
              .mockImplementationOnce(() => 1100);

            mockTon.ready.mockReturnValue(true);
            mockDedust.ready.mockReturnValue(true);

            mockDedust.estimateTrade.mockResolvedValue({
                expectedAmount: 100,
                expectedPrice: 10,
                // @ts-ignore
                trade: 'mockTrade',
            });

            const req = { base: 'TON', quote: 'USDT', amount: '10', side: Side.BUY, chain: 'ton', network: 'mainnet' };
            const response = await price(mockTon, mockDedust, req);

            expect(response).toEqual({
                network: 'testnet',
                timestamp: expect.any(Number),
                latency: latency(startTimestamp, Date.now()),
                base: 'TON',
                quote: 'USDT',
                amount: '10',
                rawAmount: '10',
                expectedAmount: '100',
                price: '10',
                gasPrice: '0.01',
                gasPriceToken: 'TON',
                gasLimit: '100000',
                gasCost: '1',
            });
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should throw HttpException when Ton or Dedust is not ready', async () => {
            mockTon.ready.mockReturnValue(false);
            mockDedust.ready.mockReturnValue(false);

            const req = { base: 'TON', quote: 'USDT', amount: '10', side: Side.BUY, chain: 'testnet', network: 'mainnet'
            };

            await expect(price(mockTon, mockDedust, req)).rejects.toThrow(HttpException);
            await expect(price(mockTon, mockDedust, req)).rejects.toThrow(
              "TON or Dedust was called before being initialized."
            );
        });
    });

    describe('trade', () => {
        it('should return a valid TradeResponse on successful trade execution', async () => {
            mockTon.ready.mockReturnValue(true);
            mockDedust.ready.mockReturnValue(true);
            mockDedust.estimateTrade.mockResolvedValue({
                expectedAmount: 100,
                expectedPrice: 10,
                // @ts-ignore
                trade: 'mockTrade',
            });
            mockDedust.executeTrade.mockResolvedValue({
                success: true,
                txId: 'mockTxHash',
            });

            const req = {
                address: 'mockAddress',
                base: 'TON',
                quote: 'USDT',
                amount: '10',
                limitPrice: '10',
                side: Side.SELL,
                chain: 'ton',
                network: 'mainnet',
            };
            const response = await trade(mockTon, mockDedust, req);

            expect(response).toEqual({
                network: 'testnet',
                timestamp: expect.any(Number),
                latency: latency(startTimestamp, Date.now()),
                base: 'TON',
                quote: 'USDT',
                amount: '10',
                rawAmount: '10',
                expectedIn: '100',
                price: '10',
                gasPrice: '0.01',
                gasPriceToken: 'TON',
                gasLimit: '100000',
                gasCost: '1',
                txHash: 'mockTxHash',
            });
        });

        it('should throw HttpException if limit price is exceeded for a BUY order', async () => {

            jest.mock('asyncHandler', () => ({
                executeTrade: jest.fn().mockResolvedValue({
                    success: false,
                    message: 'Mock trade error',
                }),
            }));

            mockTon.ready.mockReturnValue(true);
            mockDedust.ready.mockReturnValue(true);
            mockDedust.estimateTrade.mockResolvedValue({
                expectedAmount: 100,
                expectedPrice: 12,
                // @ts-ignore
                trade: 'mockTrade',
            });

            const req = {
                address: 'mockAddress',
                base: 'TON',
                quote: 'USDT',
                amount: '10',
                limitPrice: '12',
                side: Side.BUY,
                chain: 'ton',
                network: 'mainnet',
            };

            await expect(trade(mockTon, mockDedust, req)).rejects.toThrow(HttpException);
            // @ts-ignore
            // await expect(trade(mockTon, mockDedust, req)).rejects.toThrow(
            //   "Swap price 15 exceeds limitPrice 12."
            // );
        });
    });

    describe('estimateGas', () => {
        it('should return a valid EstimateGasResponse when Ton and Dedust are ready', async () => {
            mockTon.ready.mockReturnValue(true);
            mockDedust.ready.mockReturnValue(true);

            const response = await estimateGas(mockTon, mockDedust);

            expect(response).toEqual({
                network: 'testnet',
                timestamp: expect.any(Number),
                gasPrice: '0.01',
                gasPriceToken: 'TON',
                gasLimit: '100000',
                gasCost: '1',
            });
        });

        it('should throw HttpException when Ton or Dedust is not ready', async () => {
            mockTon.ready.mockReturnValue(false);

            await expect(estimateGas(mockTon, mockDedust)).rejects.toThrow(HttpException);
            await expect(estimateGas(mockTon, mockDedust)).rejects.toThrow(
              'Service uninitialized: TON or Dedust'
            );
        });
    });
});


