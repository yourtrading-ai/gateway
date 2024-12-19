import LRUCache from "lru-cache";
import { percentRegexp } from "../../services/config-manager-v2";
import { Ton } from "../../chains/ton/ton";
import { DedustConfig } from "./dedust.config";
import { getTonConfig } from "../../chains/ton/ton.config";
import { TonAsset } from "../../chains/ton/ton.requests";
import { logger } from "../../services/logger";
import { PriceRequest } from "../../amm/amm.requests";
import { HttpException, TOKEN_NOT_SUPPORTED_ERROR_CODE, TOKEN_NOT_SUPPORTED_ERROR_MESSAGE } from "../../services/error-handler";
import { pow } from "mathjs";
import { TonClient4, WalletContractV4, toNano, Address, Sender, SenderArguments } from "@ton/ton";
import { 
    Factory, 
    MAINNET_FACTORY_ADDR,
    Asset,
    PoolType,
    ReadinessStatus,
    VaultJetton,
    JettonRoot
} from "@dedust/sdk";
import { OpenedContract } from '@ton/core';
import { beginCell } from "@ton/core";

export class Dedust {
    private static _instances: LRUCache<string, Dedust>;
    private chain: Ton;
    private _ready: boolean = false;
    private _config: DedustConfig.NetworkConfig;
    private factory: OpenedContract<Factory>;
    private tonClient: TonClient4;

    private constructor(network: string) {
        this._config = DedustConfig.config;
        this.chain = Ton.getInstance(network);
        
        // Initialize TON client and Dedust factory
        this.tonClient = new TonClient4({
            endpoint: "https://mainnet-v4.tonhubapi.com"
        });
            
        this.factory = this.tonClient.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));
    }

    public static getInstance(network: string): Dedust {
        const config = getTonConfig(network);
        if (Dedust._instances === undefined) {
            Dedust._instances = new LRUCache<string, Dedust>({
                max: config.network.maxLRUCacheInstances,
            });
        }

        if (!Dedust._instances.has(network)) {
            if (network !== null) {
                Dedust._instances.set(network, new Dedust(network));
            } else {
                throw new Error(
                    `Dedust.getInstance received an unexpected network: ${network}.`
                );
            }
        }

        return Dedust._instances.get(network) as Dedust;
    }

    public async init() {
        if (!this.chain.ready()) {
            await this.chain.init();
        }
        this._ready = true;
    }

    public ready(): boolean {
        return this._ready;
    }

    getSlippage(): number {
        const allowedSlippage = this._config.allowedSlippage;
        const nd = allowedSlippage.match(percentRegexp);
        let slippage = 0.0;
        if (nd) slippage = Number(nd[1]) / Number(nd[2]);
        return slippage;
    }

    async estimateTrade(req: PriceRequest) {
        const baseToken: TonAsset | null = this.chain.getAssetForSymbol(
            req.base
        );
        const quoteToken: TonAsset | null = this.chain.getAssetForSymbol(
            req.quote
        );

        if (baseToken === null || quoteToken === null)
            throw new HttpException(
                500,
                TOKEN_NOT_SUPPORTED_ERROR_MESSAGE,
                TOKEN_NOT_SUPPORTED_ERROR_CODE
            );

        const amount = Number(req.amount) * <number>pow(10, baseToken.decimals);

        try {
            // Create Asset instances for the tokens
            const fromAsset = baseToken.assetId === 'TON' ? 
                Asset.native() : 
                Asset.jetton(Address.parse(baseToken.assetId));
            
            const toAsset = quoteToken.assetId === 'TON' ? 
                Asset.native() : 
                Asset.jetton(Address.parse(quoteToken.assetId));

            // Get the pool
            const pool = this.tonClient.open(
                await this.factory.getPool(PoolType.VOLATILE, [fromAsset, toAsset])
            );

            // Check if pool exists
            if ((await pool.getReadinessStatus()) !== ReadinessStatus.READY) {
                throw new Error('Pool does not exist.');
            }

            // Get the vault for the input token
            const vault = baseToken.assetId === 'TON' ?
                this.tonClient.open(await this.factory.getNativeVault()) :
                this.tonClient.open(await this.factory.getJettonVault(Address.parse(baseToken.assetId)));

            // Check if vault exists
            if ((await vault.getReadinessStatus()) !== ReadinessStatus.READY) {
                throw new Error('Vault does not exist.');
            }

            // Get estimated swap output
            const swapEstimate = await pool.getEstimatedSwapOut({
                assetIn: fromAsset,
                amountIn: BigInt(amount)
            });

            const expectedAmount = Number(swapEstimate.amountOut) / Math.pow(10, quoteToken.decimals);
            const expectedPrice = expectedAmount / Number(req.amount);

            return {
                trade: {
                    pool,
                    vault,
                    amount: toNano(amount.toString()),
                    fromAsset,
                    toAsset,
                    expectedOut: swapEstimate.amountOut
                },
                expectedAmount,
                expectedPrice
            };
        } catch (error) {
            logger.error(`Failed to get swap quote: ${error}`);
            throw error;
        }
    }

    async executeTrade(
        account: string,
        quote: any,
        isBuy: boolean
    ): Promise<any> {
        const keyPar = await this.chain.getAccountFromAddress(account);
        const wallet = WalletContractV4.create({
            workchain: this.chain.workchain,
            publicKey: Buffer.from(keyPar.publicKey, 'utf8'),
        });

        const walletContract = this.tonClient.open(wallet);
        const sender: Sender = {
            address: walletContract.address,
            async send(args: SenderArguments) {
                return walletContract.sendTransfer({
                    secretKey: Buffer.from(keyPar.secretKey, 'utf8'),
                    messages: [{
                        body: args.body || beginCell().endCell(),
                        info: {
                            type: 'internal',
                            ihrDisabled: true,
                            bounce: true,
                            bounced: false,
                            dest: args.to,
                            value: { coins: args.value },
                            ihrFee: BigInt(0),
                            forwardFee: BigInt(0),
                            createdLt: BigInt(0),
                            createdAt: 0
                        }
                    }],
                    seqno: await walletContract.getSeqno(),
                });
            }
        };

        try {
            let tx;
            const slippage = this.getSlippage();
            const minExpectedOut = BigInt(Math.floor(Number(quote.expectedOut) * (1 - slippage)));
            
            if (quote.fromAsset.type === 'native') {
                // Swapping TON to Jetton
                const swapPayload = VaultJetton.createSwapPayload({
                    poolAddress: quote.pool.address,
                    swapParams: {
                        recipientAddress: sender.address,
                    },
                    limit: minExpectedOut
                });

                tx = await quote.vault.sendSwap(sender, {
                    poolAddress: quote.pool.address,
                    amount: quote.amount,
                    gasAmount: toNano("0.25"),
                    swapPayload
                });
            } else {
                // Swapping Jetton to something else
                const jettonRoot = this.tonClient.open(JettonRoot.createFromAddress(quote.fromAsset.address));
                if (!sender.address) {
                    throw new Error('Sender address is required');
                }
                const walletAddress = await jettonRoot.getWallet(sender.address);
                const jettonWallet = this.tonClient.open(walletAddress);

                tx = await jettonWallet.sendTransfer(sender, toNano("0.3"), {
                    amount: quote.amount,
                    destination: quote.vault.address,
                    responseAddress: sender.address,
                    forwardAmount: toNano("0.25"),
                    forwardPayload: VaultJetton.createSwapPayload({ 
                        poolAddress: quote.pool.address,
                        swapParams: {
                            recipientAddress: sender.address,
                        },
                        limit: minExpectedOut
                    }),
                });
            }

            logger.info(`${isBuy ? 'Buy' : 'Sell'} swap executed with minimum output: ${minExpectedOut}`);
            return {
                txnID: tx.txId
            };
        } catch (error) {
            logger.error(`Failed to execute swap: ${error}`);
            throw error;
        }
    }
} 