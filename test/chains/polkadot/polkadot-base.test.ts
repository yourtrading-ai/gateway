import { PolkadotBase } from '../../../src/chains/polkadot/polkadot-base';
import { ApiPromise } from '@polkadot/api';
import { jest } from '@jest/globals';
import { BigNumber } from 'ethers';

jest.mock('@polkadot/api');

describe('PolkadotBase', () => {
  let polkadotBase: PolkadotBase;

  beforeEach(() => {
    polkadotBase = new PolkadotBase(
      'test-chain',
      'ws://test.url',
      'test-token-source',
      'URL',
      1000
    );
  });

  it('initializes correctly', () => {
    expect(polkadotBase.chainName).toBe('test-chain');
    expect(polkadotBase.wsUrl).toBe('ws://test.url');
    expect(polkadotBase.ready()).toBe(false);
  });

  it('loads tokens correctly', async () => {
    const mockTokens = [
      {
        base: 'test',
        address: '0x123',
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18
      }
    ];

    jest.spyOn(polkadotBase as any, 'getTokenList')
      .mockResolvedValue(mockTokens);

    await polkadotBase.loadTokens('test-source', 'URL');
    expect(polkadotBase.storedTokenList).toEqual(mockTokens);
  });

  it('gets balances correctly', async () => {
    const mockWallet = {
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
    };

    const mockBalance = {
      data: { free: '1000000000000' }
    };

    jest.spyOn(polkadotBase.provider.query.system, 'account')
      .mockResolvedValue(mockBalance);

    const balances = await polkadotBase.getBalances(mockWallet);
    expect(balances['DOT'].value).toEqual(BigNumber.from('1000000000000'));
    expect(balances['DOT'].decimals).toEqual(10);
  });
});