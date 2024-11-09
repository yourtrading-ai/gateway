import { Polkadotish } from '../../services/common-interfaces';
import { PolkadotBase } from './polkadot-base';
import { getPolkadotConfig } from './polkadot.config';
import { logger } from '../../services/logger';
import { PolkadotController } from './polkadot.controllers';

export class Polkadot extends PolkadotBase implements Polkadotish {
  private static _instances: { [name: string]: Polkadot };
  private _gasPrice: number;
  private _nativeTokenSymbol: string;
  private _chain: string;
  private _requestCount: number;
  private _metricsLogInterval: number;
  private _metricTimer;
  public controller;

  private constructor(network: string) {
    const config = getPolkadotConfig('polkadot');
    super(
      'polkadot',
      config.network.wsURL,
      config.network.tokenListSource,
      config.network.tokenListType,
      config.manualGasPrice
    );
    this._chain = network;
    this._nativeTokenSymbol = config.nativeCurrencySymbol;
    this._gasPrice = config.manualGasPrice;
    this._requestCount = 0;
    this._metricsLogInterval = 300000; // 5 minutes
    this._metricTimer = setInterval(
      this.metricLogger.bind(this),
      this.metricsLogInterval
    );
    this.controller = PolkadotController;
  }

  public static getInstance(network: string): Polkadot {
    if (Polkadot._instances === undefined) {
      Polkadot._instances = {};
    }
    if (!(network in Polkadot._instances)) {
      Polkadot._instances[network] = new Polkadot(network);
    }
    return Polkadot._instances[network];
  }

  public static getConnectedInstances(): { [name: string]: Polkadot } {
    return Polkadot._instances;
  }

  public requestCounter(msg: any): void {
    if (msg.action === 'request') this._requestCount += 1;
  }

  public metricLogger(): void {
    logger.info(
      this.requestCount +
        ' request(s) sent in last ' +
        this.metricsLogInterval / 1000 +
        ' seconds.'
    );
    this._requestCount = 0;
  }

  public get gasPrice(): number {
    return this._gasPrice;
  }

  public get chain(): string {
    return this._chain;
  }

  public get nativeTokenSymbol(): string {
    return this._nativeTokenSymbol;
  }

  public get requestCount(): number {
    return this._requestCount;
  }

  public get metricsLogInterval(): number {
    return this._metricsLogInterval;
  }

  async close() {
    clearInterval(this._metricTimer);
    if (this._chain in Polkadot._instances) {
      delete Polkadot._instances[this._chain];
    }
  }
}