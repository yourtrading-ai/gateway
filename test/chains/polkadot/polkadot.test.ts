import { Polkadot } from '../../../src/chains/polkadot/polkadot';
import { jest } from '@jest/globals';

jest.mock('@polkadot/api');

describe('Polkadot', () => {
  let polkadot: Polkadot;

  beforeEach(() => {
    polkadot = Polkadot.getInstance('test-network');
  });

  afterEach(async () => {
    await polkadot.close();
  });

  it('getInstance returns singleton instance', () => {
    const instance1 = Polkadot.getInstance('test-network');
    const instance2 = Polkadot.getInstance('test-network');
    expect(instance1).toBe(instance2);
  });

  it('getConnectedInstances returns all instances', () => {
    const instances = Polkadot.getConnectedInstances();
    expect(instances['test-network']).toBeDefined();
  });

  it('requestCounter increments count correctly', () => {
    const initialCount = polkadot.requestCount;
    polkadot.requestCounter({ action: 'request' });
    expect(polkadot.requestCount).toBe(initialCount + 1);
  });

  it('close removes instance and clears timer', async () => {
    await polkadot.close();
    expect(Polkadot.getConnectedInstances()['test-network']).toBeUndefined();
  });
});