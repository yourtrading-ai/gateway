import { AvailableNetworks } from '../../services/config-manager-types';
import { ConfigManagerV2 } from '../../services/config-manager-v2';

export namespace MangoConfig {
  export interface NetworkConfig {
    gasLimitEstimate: number;
    tradingTypes: (type: string) => Array<string>;
    chainType: string;
    availableNetworks: Array<AvailableNetworks>;
  }

  export const config: NetworkConfig = {
    gasLimitEstimate: ConfigManagerV2.getInstance().get(
      `solana.gasLimitEstimate`
    ),
    tradingTypes: (type: string) => {
      return type === 'spot' ? ['CLOB_SPOT'] : ['CLOB_PERP'];
    },
    chainType: 'SOLANA',
    availableNetworks: [
      {
        chain: 'solana',
        networks: ['mainnet', 'testnet'],
      },
    ],
  };
}
