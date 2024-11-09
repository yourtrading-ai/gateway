import { PolkadotController } from '../../../src/chains/polkadot/polkadot.controllers';
import { Polkadot } from '../../../src/chains/polkadot/polkadot';
import { jest } from '@jest/globals';

describe('PolkadotController', () => {
  let polkadot: Polkadot;

  beforeEach(() => {
    polkadot = Polkadot.getInstance('test-network');
  });

  afterEach(async () => {
    await polkadot.close();
  });

  describe('balances', () => {
    it('returns correct balance format', async () => {
      const mockRequest = {
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        tokenSymbols: ['DOT']
      };

      const mockBalances = {
        DOT: { value: '1000000000000', decimals: 10 }
      };

      jest.spyOn(polkadot, 'getBalances').mockResolvedValue(mockBalances);

      const response = await PolkadotController.balances(polkadot, mockRequest);
      expect(response).toHaveProperty('balances');
      expect(response.balances).toHaveProperty('DOT');
    });

    it('throws error for unsupported token', async () => {
      const mockRequest = {
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        tokenSymbols: ['INVALID']
      };

      await expect(
        PolkadotController.balances(polkadot, mockRequest)
      ).rejects.toThrow();
    });
  });
});