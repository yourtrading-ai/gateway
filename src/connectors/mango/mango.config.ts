import { AvailableNetworks } from '../../services/config-manager-types';
import { ConfigManagerV2 } from '../../services/config-manager-v2';

export namespace MangoConfig {
  export const defaultGroup: any =
    ConfigManagerV2.getInstance().get('mango.defaultGroup');

  export const tradeHistoryApiUrl: any = ConfigManagerV2.getInstance().get(
    'mango.tradeHistoryApiUrl'
  );

  export interface NetworkConfig {
    gasLimitEstimate: number;
    prioritizationFee: number;
    tradingTypes: (type: string) => Array<string>;
    chainType: string;
    availableNetworks: Array<AvailableNetworks>;
  }

  export const config: NetworkConfig = {
    gasLimitEstimate: ConfigManagerV2.getInstance().get(
      `solana.gasLimitEstimate`
    ),
    prioritizationFee: ConfigManagerV2.getInstance().get(
      `solana.prioritizationFee`
    ),
    tradingTypes: (type: string) => {
      return type === 'spot' ? ['CLOB_SPOT'] : ['CLOB_PERP'];
    },
    chainType: 'SOLANA',
    availableNetworks: [
      {
        chain: 'solana',
        networks: ['mainnet-beta', 'testnet', 'devnet'],
      },
    ],
  };
}
