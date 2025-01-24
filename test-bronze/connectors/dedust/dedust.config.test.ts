import { DedustConfig } from '../../../src/connectors/dedust/dedust.config';
import { ConfigManagerV2 } from '../../../src/services/config-manager-v2';

describe('DedustConfig', () => {
    beforeAll(() => {
        jest.spyOn(ConfigManagerV2.getInstance(), 'get').mockImplementation((key: string) => {
            if (key === 'dedust.allowedSlippage') {
                return '2/100';
            }
            return null;
        });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('config', () => {
        it('should have a valid allowedSlippage value', () => {
            expect(DedustConfig.config.allowedSlippage).toBe('2/100');
        });

        it('should have tradingTypes containing only AMM', () => {
            expect(DedustConfig.config.tradingTypes).toEqual(['AMM']);
        });

        it('should have chainType set to TON', () => {
            expect(DedustConfig.config.chainType).toBe('TON');
        });

        it('should have availableNetworks with the correct structure', () => {
            const expectedAvailableNetworks = [
                { chain: 'ton', networks: ['mainnet'] },
            ];
            expect(DedustConfig.config.availableNetworks).toEqual(expectedAvailableNetworks);
        });

        it('should have maxPriceImpact defined and set to 15', () => {
            expect(DedustConfig.config.maxPriceImpact).toBe(15);
        });
    });
});