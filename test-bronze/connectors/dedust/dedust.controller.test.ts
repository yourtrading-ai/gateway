import {
  price,
  trade,
} from '../../../src/connectors/dedust/dedust.controllers';
import {
  AMOUNT_LESS_THAN_MIN_AMOUNT_ERROR_CODE,
  AMOUNT_LESS_THAN_MIN_AMOUNT_ERROR_MESSAGE,
  HttpException, INSUFFICIENT_FUNDS_ERROR_CODE, INSUFFICIENT_FUNDS_ERROR_MESSAGE,
  NETWORK_ERROR_CODE,
  NETWORK_ERROR_MESSAGE, PRICE_FAILED_ERROR_CODE, PRICE_FAILED_ERROR_MESSAGE,
  SWAP_PRICE_EXCEEDS_LIMIT_PRICE_ERROR_CODE,
  SWAP_PRICE_EXCEEDS_LIMIT_PRICE_ERROR_MESSAGE,
  SWAP_PRICE_LOWER_THAN_LIMIT_PRICE_ERROR_CODE,
  SWAP_PRICE_LOWER_THAN_LIMIT_PRICE_ERROR_MESSAGE,
  TRADE_FAILED_ERROR_CODE,
  TRADE_FAILED_ERROR_MESSAGE, UniswapishPriceError
} from '../../../src/services/error-handler';
import { PriceRequest } from '../../../src/amm/amm.requests';

jest.mock('../../../src/chains/ton/ton');
jest.mock('../../../src/connectors/dedust/dedust');
const mockTon = {
  network: 'test-network',
  gasPrice: 100,
  nativeTokenSymbol: 'TON',
  gasLimit: 21000,
  gasCost: 0.01,
  getAccountFromAddress: jest.fn(),
};

const mockDedust = {
  estimateTrade: jest.fn(),
  executeTrade: jest.fn(),
};

describe('Dedust Controllers - Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('price', () => {
    it('should throw HttpException when UniswapishPriceError occurs', async () => {
      const req: PriceRequest = {
        base: 'TON',
        quote: 'AIOTX',
        amount: '100',
        chain: 'ton',
        network: 'testnet',
        side: 'BUY',
      };

      const error = new UniswapishPriceError('Price estimation failed');
      mockDedust.estimateTrade.mockRejectedValue(error);

      await expect(price(mockTon as any, mockDedust as any, req)).rejects.toThrow(HttpException);
      await expect(price(mockTon as any, mockDedust as any, req)).rejects.toThrow(
          expect.objectContaining({
            message: 'Price estimation failed',
            status: 500,
            errorCode: PRICE_FAILED_ERROR_CODE,
          })
      );
    });

    it('should throw HttpException when insufficient funds error occurs', async () => {
      mockDedust.estimateTrade.mockRejectedValue(new Error('insufficient funds'));

      await expect(
          price(mockTon as any, mockDedust as any, {
            base: 'TON',
            quote: 'AIOTX',
            amount: '100',
            chain: 'ton',
            network: 'testnet',
            side: 'BUY',
          })
      ).rejects.toThrow(
          expect.objectContaining({
            message: INSUFFICIENT_FUNDS_ERROR_MESSAGE,
            status: 400,
            errorCode: INSUFFICIENT_FUNDS_ERROR_CODE,
          })
      );
    });

    it('should throw HttpException when network error occurs', async () => {
      mockDedust.estimateTrade.mockRejectedValue(new Error('network error'));

      await expect(
          price(mockTon as any, mockDedust as any, {
            base: 'TON',
            quote: 'AIOTX',
            amount: '100',
            chain: 'ton',
            network: 'testnet',
            side: 'BUY',
          })
      ).rejects.toThrow(
          expect.objectContaining({
            message: NETWORK_ERROR_MESSAGE,
            status: 503,
            errorCode: NETWORK_ERROR_CODE,
          })
      );
    });

    it('should throw HttpException when amount is below the minimum', async () => {
      mockDedust.estimateTrade.mockRejectedValue(new Error('min amount'));

      await expect(
          price(mockTon as any, mockDedust as any, {
            base: 'TON',
            quote: 'AIOTX',
            amount: '10',
            chain: 'ton',
            network: 'testnet',
            side: 'BUY',
          })
      ).rejects.toThrow(
          expect.objectContaining({
            message: AMOUNT_LESS_THAN_MIN_AMOUNT_ERROR_MESSAGE,
            status: 400,
            errorCode: AMOUNT_LESS_THAN_MIN_AMOUNT_ERROR_CODE,
          })
      );
    });

      it('should throw generic HttpException for unknown errors', async () => {
          mockDedust.estimateTrade.mockRejectedValue(new Error('unexpected error'));

          await expect(price(mockTon as any, mockDedust as any, {
              base: 'TON',
              quote: 'AIOTX',
              amount: '100',
              chain: 'ton',
              network: 'testnet',
              side: 'BUY',
          })).rejects.toThrow(
              expect.objectContaining({
                  message: expect.stringContaining(PRICE_FAILED_ERROR_MESSAGE),
                  status: 500,
                  errorCode: PRICE_FAILED_ERROR_CODE,
              })
          );
      });

      it('should return a valid PriceResponse when trade estimation is successful', async () => {
          mockDedust.estimateTrade.mockResolvedValue({
              expectedAmount: 2000,
              expectedPrice: 1.5,
          });

          const req: PriceRequest = {
              base: 'TON',
              quote: 'AIOTX',
              amount: '100',
              chain: 'ton',
              network: 'testnet',
              side: 'BUY',
          };

          const response = await price(mockTon as any, mockDedust as any, req);

          expect(response).toEqual(
              expect.objectContaining({
                  network: 'test-network',
                  base: 'TON',
                  quote: 'AIOTX',
                  amount: '100',
                  expectedAmount: '2000',
                  price: '1.5',
                  gasPrice: 100,
                  gasPriceToken: 'TON',
                  gasLimit: 21000,
                  gasCost: '0.01',
              }),
          );
      });
  });

  describe('trade', () => {
    it('should throw HttpException when swap price exceeds limit price for BUY', async () => {
      mockDedust.estimateTrade.mockResolvedValue({
        expectedAmount: '150',
        expectedPrice: '1.5',
      });

      await expect(
          trade(mockTon as any, mockDedust as any, {
            address: 'mock-address',
            base: 'TON',
            quote: 'AIOTX',
            amount: '100',
            side: 'BUY',
            limitPrice: '1.2',
            chain: 'ton',
            network: 'testnet',
          })
      ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining(SWAP_PRICE_EXCEEDS_LIMIT_PRICE_ERROR_MESSAGE('1.5', '1.2')),
            status: 400,
            errorCode: SWAP_PRICE_EXCEEDS_LIMIT_PRICE_ERROR_CODE,
          })
      );
    });

    it('should throw HttpException when swap price is lower than limit price for SELL', async () => {
      mockDedust.estimateTrade.mockResolvedValue({
        expectedAmount: '150',
        expectedPrice: '1.5',
      });

      await expect(
          trade(mockTon as any, mockDedust as any, {
            address: 'mock-address',
            base: 'TON',
            quote: 'AIOTX',
            amount: '100',
            side: 'SELL',
            limitPrice: '2.0',
            chain: 'ton',
            network: 'testnet',
          })
      ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining(SWAP_PRICE_LOWER_THAN_LIMIT_PRICE_ERROR_MESSAGE('1.5', '2.0')),
            status: 400,
            errorCode: SWAP_PRICE_LOWER_THAN_LIMIT_PRICE_ERROR_CODE,
          })
      );
    });

    it('should throw HttpException when executing trade fails', async () => {
      mockDedust.estimateTrade.mockResolvedValue({
        expectedAmount: '150',
        expectedPrice: '1.5',
        trade: 'mock-trade-data',
      });

      mockDedust.executeTrade.mockRejectedValue(new Error('transaction failed'));

      await expect(
          trade(mockTon as any, mockDedust as any, {
            address: 'mock-address',
            base: 'TON',
            quote: 'AIOTX',
            amount: '100',
            side: 'BUY',
            limitPrice: '1.5',
            chain: 'ton',
            network: 'testnet',
          })
      ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringContaining(TRADE_FAILED_ERROR_MESSAGE),
            status: 500,
            errorCode: TRADE_FAILED_ERROR_CODE,
          })
      );
    });

    it('should throw HttpException when network error occurs during trade', async () => {
      mockDedust.executeTrade.mockRejectedValue(new Error('network error'));

      await expect(
          trade(mockTon as any, mockDedust as any, {
            address: 'mock-address',
            base: 'TON',
            quote: 'AIOTX',
            amount: '100',
            side: 'BUY',
            limitPrice: '1.5',
            chain: 'ton',
            network: 'testnet',
          })
      ).rejects.toThrow(
          expect.objectContaining({
            message: NETWORK_ERROR_MESSAGE,
            status: 503,
            errorCode: NETWORK_ERROR_CODE,
          })
      );
    });
  });

      it('should throw HttpException when a network error occurs during execution', async () => {
          mockDedust.estimateTrade.mockResolvedValue({
              expectedAmount: '150',
              expectedPrice: '1.5',
              trade: 'mock-trade-data',
          });

          mockDedust.executeTrade.mockRejectedValue(new Error('network error'));

          await expect(
              trade(mockTon as any, mockDedust as any, {
                  address: 'mock-address',
                  base: 'TON',
                  quote: 'AIOTX',
                  amount: '100',
                  side: 'BUY',
                  limitPrice: '1.5',
                  chain: 'ton',
                  network: 'testnet',
              }),
          ).rejects.toThrow(
              expect.objectContaining({
                  message: NETWORK_ERROR_MESSAGE,
                  status: 503,
                  errorCode: NETWORK_ERROR_CODE,
              }),
          );
      });
  });

