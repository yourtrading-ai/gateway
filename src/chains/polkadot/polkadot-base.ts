import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { KeyringPair } from '@polkadot/keyring/types';
import { TokenListType, TokenValue, walletPath } from '../../services/base';
import NodeCache from 'node-cache';
import fse from 'fs-extra';
import { ConfigManagerCertPassphrase } from '../../services/config-manager-cert-passphrase';
import { BigNumber } from 'ethers';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import axios from 'axios';
import fs from 'fs/promises';

export interface Token {
  base: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface PolkadotWallet {
  address: string;
  publicKey: Uint8Array;
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export interface KeyAlgorithm {
  name: string;
  salt: Uint8Array;
  iterations: number;
  hash: string;
}

export interface CipherAlgorithm {
  name: string;
  iv: Uint8Array;
}

export interface EncryptedPrivateKey {
  keyAlgorithm: KeyAlgorithm;
  cipherAlgorithm: CipherAlgorithm;
  ciphertext: Uint8Array;
}

export class PolkadotBase {
  private _provider: ApiPromise;
  protected tokenList: Token[] = [];
  private _tokenMap: Record<string, Token> = {};
  private _ready: boolean = false;
  private _initializing: boolean = false;
  private _initPromise: Promise<void> = Promise.resolve();
  private keyring: Keyring;

  public chainName: string;
  public wsUrl: string;
  public gasPriceConstant: number;
  public tokenListSource: string;
  public tokenListType: TokenListType;
  public cache: NodeCache;

  constructor(
    chainName: string,
    wsUrl: string,
    tokenListSource: string,
    tokenListType: TokenListType,
    gasPriceConstant: number
  ) {
    const wsProvider = new WsProvider(wsUrl);
    this._provider = new ApiPromise({ provider: wsProvider });
    this.chainName = chainName;
    this.wsUrl = wsUrl;
    this.gasPriceConstant = gasPriceConstant;
    this.tokenListSource = tokenListSource;
    this.tokenListType = tokenListType;
    this.cache = new NodeCache({ stdTTL: 3600 });
    this.keyring = new Keyring({ type: 'sr25519' });
  }

  ready(): boolean {
    return this._ready;
  }

  public get provider() {
    return this._provider;
  }

  async init(): Promise<void> {
    if (!this.ready() && !this._initializing) {
      this._initializing = true;
      await cryptoWaitReady();
      await this._provider.isReady;
      this._initPromise = this.loadTokens(
        this.tokenListSource,
        this.tokenListType
      ).then(() => {
        this._ready = true;
        this._initializing = false;
      });
    }
    return this._initPromise;
  }

  async loadTokens(
    tokenListSource: string,
    tokenListType: TokenListType
  ): Promise<void> {
    this.tokenList = await this.getTokenList(tokenListSource, tokenListType);

    if (this.tokenList) {
      this.tokenList.forEach(
        (token: Token) => (this._tokenMap[token.symbol] = token)
      );
    }
  }

  async getTokenList(
    tokenListSource: string,
    tokenListType: TokenListType
  ): Promise<Token[]> {
    let tokens;
    if (tokenListType === 'URL') {
      ({ data: tokens } = await axios.get(tokenListSource));
    } else {
      ({ tokens } = JSON.parse(await fs.readFile(tokenListSource, 'utf8')));
    }
    return tokens;
  }

  public get storedTokenList(): Token[] {
    return this.tokenList;
  }

  getTokenForSymbol(symbol: string): Token | null {
    return this._tokenMap[symbol] ? this._tokenMap[symbol] : null;
  }

  async getWalletFromPrivateKey(
    privateKey: string
  ): Promise<KeyringPair> {
    return this.keyring.addFromUri(privateKey);
  }

  async getWallet(address: string): Promise<KeyringPair> {
    const path = `${walletPath}/${this.chainName}`;
    
    const encryptedPrivateKey: EncryptedPrivateKey = JSON.parse(
      await fse.readFile(`${path}/${address}.json`, 'utf8'),
      (key, value) => {
        switch (key) {
          case 'ciphertext':
          case 'salt':
          case 'iv':
            return hexToU8a(value);
          default:
            return value;
        }
      }
    );

    const passphrase = ConfigManagerCertPassphrase.readPassphrase();
    if (!passphrase) {
      throw new Error('missing passphrase');
    }

    const privateKey = await this.decrypt(encryptedPrivateKey, passphrase);
    return this.getWalletFromPrivateKey(privateKey);
  }

  private static async getKeyMaterial(password: string) {
    const enc = new TextEncoder();
    return await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
  }

  private static async getKey(
    keyAlgorithm: KeyAlgorithm,
    keyMaterial: CryptoKey
  ) {
    return await crypto.subtle.deriveKey(
      keyAlgorithm,
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(privateKey: string, password: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await PolkadotBase.getKeyMaterial(password);
    const keyAlgorithm = {
      name: 'PBKDF2',
      salt: salt,
      iterations: 500000,
      hash: 'SHA-256',
    };
    const key = await PolkadotBase.getKey(keyAlgorithm, keyMaterial);
    const cipherAlgorithm = {
      name: 'AES-GCM',
      iv: iv,
    };
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      cipherAlgorithm,
      key,
      enc.encode(privateKey)
    );

    return JSON.stringify(
      {
        keyAlgorithm,
        cipherAlgorithm,
        ciphertext: new Uint8Array(ciphertext),
      },
      (key, value) => {
        switch (key) {
          case 'ciphertext':
          case 'salt':
          case 'iv':
            return u8aToHex(Uint8Array.from(Object.values(value)));
          default:
            return value;
        }
      }
    );
  }

  async decrypt(
    encryptedPrivateKey: EncryptedPrivateKey,
    password: string
  ): Promise<string> {
    const keyMaterial = await PolkadotBase.getKeyMaterial(password);
    const key = await PolkadotBase.getKey(
      encryptedPrivateKey.keyAlgorithm,
      keyMaterial
    );
    const decrypted = await crypto.subtle.decrypt(
      encryptedPrivateKey.cipherAlgorithm,
      key,
      encryptedPrivateKey.ciphertext
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  async getBalances(wallet: KeyringPair): Promise<Record<string, TokenValue>> {
    const balances: Record<string, TokenValue> = {};
    const { data: { free: balance } } = await this._provider.query.system.account(wallet.address);
    
    // Native token balance
    balances[this.getTokenForSymbol('DOT')?.symbol || 'DOT'] = {
      value: BigNumber.from(balance.toString()),
      decimals: 10, // DOT has 10 decimals
    };

    // For other tokens, query respective pallets
    const tokens = this.storedTokenList.filter(token => token.symbol !== 'DOT');
    await Promise.all(
      tokens.map(async (token) => {
        try {
          const tokenBalance = await this._provider.query.tokens.accounts(
            wallet.address,
            token.address
          );
          balances[token.symbol] = {
            value: BigNumber.from(tokenBalance.free.toString()),
            decimals: token.decimals,
          };
        } catch (e) {
          // Token might not exist on chain
          balances[token.symbol] = {
            value: BigNumber.from(0),
            decimals: token.decimals,
          };
        }
      })
    );

    return balances;
  }

  async getTransaction(hash: string): Promise<any> {
    const provider = this._provider;
    const blockHash = await provider.rpc.chain.getBlockHash(hash);
    if (!blockHash) {
      throw new Error('Transaction not found');
    }
    
    const signedBlock = await provider.rpc.chain.getBlock(blockHash);
    const events = await provider.query.system.events.at(blockHash);
    
    return {
      block: signedBlock,
      events: events,
      hash: hash,
    };
  }

  async getCurrentBlockNumber(): Promise<number> {
    const header = await this._provider.rpc.chain.getHeader();
    return header.number.toNumber();
  }
}