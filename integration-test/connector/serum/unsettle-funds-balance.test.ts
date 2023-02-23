import 'jest-extended';
import { Serum } from '../../../src/connectors/serum/serum';
import {
  disablePatches,
  default as patchesCreator,
} from '../../../test/chains/solana/serum/fixtures/patches/patches';
import { Solana } from '../../../src/chains/solana/solana';
import { ConfigManagerV2 } from '../../../src/services/config-manager-v2';
import { unpatch } from '../../../test/services/patch';
import 'jest-extended';
import { default as config } from '../../../test/chains/solana/serum/fixtures/config';
import { Account } from '@solana/web3.js';

jest.setTimeout(4 * 60 * 1000);

disablePatches();

let solana: Solana;
let serum: Serum;

let patches: Map<string, any>;

beforeAll(async () => {
  const configManager = ConfigManagerV2.getInstance();
  configManager.set('solana.timeout.all', 30 * 60 * 1000);
  configManager.set('solana.retry.all.maxNumberOfRetries', 5);
  configManager.set('solana.retry.all.delayBetweenRetries', 500);
  configManager.set('solana.parallel.all.batchSize', 100);
  configManager.set('solana.parallel.all.delayBetweenBatches', 500);

  solana = await Solana.getInstance(config.serum.network);

  serum = await Serum.getInstance(config.serum.chain, config.serum.network);

  patches = await patchesCreator(solana, serum);

  patches.get('solana/loadTokens')();

  patches.get('serum/serumGetMarketsInformation')();
  patches.get('serum/market/load')();

  await solana.init();
  await serum.init();
});

afterEach(() => {
  unpatch();
});

const marketNames = ['DUMMY/USDC'];

const getUnsettleFunds = async () => {
  const ownerPublicKey =
    process.env['TEST_SOLANA_WALLET_PUBLIC_KEY'] ||
    config.solana.wallet.owner.publicKey;

  const ownerKeyPair = await solana.getKeypair(ownerPublicKey);
  const owner = new Account(ownerKeyPair.secretKey);

  const marketInfo = await serum.getMarket(marketNames[0]);
  // console.log(marketInfo.programId);

  let unsettledBase: number = 0;
  let unsettledQuote: number = 0;

  const openOrders = await marketInfo.market.findOpenOrdersAccountsForOwner(
    serum.getConnection(),
    owner.publicKey
  );

  for (const item in marketNames) {
    if (item) {
      if (openOrders[item].baseTokenFree.toNumber() > 0) {
        const baseBN = openOrders[item].baseTokenFree;
        unsettledBase = marketInfo.market.baseSplSizeToNumber(baseBN);
      }

      if (openOrders[item].quoteTokenFree.toNumber() > 0) {
        const quoteBN = openOrders[item].quoteTokenFree;
        unsettledQuote = marketInfo.market.quoteSplSizeToNumber(quoteBN);
      }
    }
  }

  return {
    market: marketNames[0],
    base: unsettledBase,
    quote: unsettledQuote,
  };
};

it('Get Unsettle Funds', async () => {
  const result = await getUnsettleFunds();
  console.log(
    'Market: ' +
      result.market +
      ' | ' +
      'Base: ' +
      result.base +
      ' | ' +
      'Quote: ' +
      result.quote
  );
});
