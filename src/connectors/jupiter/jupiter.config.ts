import { AvailableNetworks } from '../../services/config-manager-types';
import { ConfigManagerV2 } from '../../services/config-manager-v2';

export namespace JupiterConfig {
  export interface NetworkConfig {
    allowedSlippage: string;
    tradingTypes: Array<string>;
    chainType: string;
    availableNetworks: Array<AvailableNetworks>;
    gasLimitEstimate: number;
  }

  export const config: NetworkConfig = {
    allowedSlippage: ConfigManagerV2.getInstance().get(
      'jupiter.allowedSlippage',
    ),
    gasLimitEstimate: ConfigManagerV2.getInstance().get(
      'jupiter.gasLimitEstimate',
    ),
    tradingTypes: ['AMM'],
    chainType: 'SOLANA',
    availableNetworks: [{ chain: 'solana', networks: ['mainnet-beta', 'devnet'] }],
  };
}