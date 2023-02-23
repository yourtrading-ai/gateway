import 'jest-extended';
import {
  getMultipleAccounts,
  MangoClient,
} from '@blockworks-foundation/mango-client';
import {
  Commitment,
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import configFile from '@blockworks-foundation/mango-client/lib/src/ids.json';
import {
  Cluster,
  Config,
} from '@blockworks-foundation/mango-client/lib/src/config';
import BN from 'bn.js';
import {
  decodeEventQueue,
  DexInstructions,
  Market,
} from '@project-serum/serum';
import { default as configs } from '../../../test/chains/solana/serum/fixtures/config';
import { Solana } from '../../../src/chains/solana/solana';
import { Serum } from '../../../src/connectors/serum/serum';
import { ConfigManagerV2 } from '../../../src/services/config-manager-v2';
import { default as patchesCreator } from '../../../test/chains/solana/serum/fixtures/patches/patches';

jest.setTimeout(30 * 60 * 1000);

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
  solana = await Solana.getInstance(configs.serum.network);
  serum = await Serum.getInstance(configs.serum.chain, configs.serum.network);
  patches = await patchesCreator(solana, serum);
  patches.get('solana/loadTokens')();
  patches.get('serum/serumGetMarketsInformation')();
  patches.get('serum/market/load')();
  await solana.init();
  await serum.init();
});

const maxUniqueAccounts = parseInt(process.env.MAX_UNIQUE_ACCOUNTS || '10');
const consumeEventsLimit = new BN(process.env.CONSUME_EVENTS_LIMIT || '10');
const config = new Config(configFile);
const cluster = (process.env.CLUSTER || 'mainnet') as Cluster;
const groupName = process.env.GROUP || 'mainnet.1';
const groupIds = config.getGroup(cluster, groupName);
if (!groupIds) {
  throw new Error(`Group ${groupName} not found`);
}
const mangoProgramId = groupIds.mangoProgramId;
const mangoGroupKey = groupIds.publicKey;

const connection = new Connection(
  process.env.ENDPOINT_URL || config.cluster_urls[cluster],
  'processed' as Commitment
);
const client = new MangoClient(connection, mangoProgramId);

async function crank() {
  if (!groupIds) {
    throw new Error(`Group ${groupName} not found`);
  }

  const payerPublicKey =
    process.env['TEST_SOLANA_WALLET_PUBLIC_KEY'] ||
    configs.solana.wallet.owner.publicKey;

  const payerKeyPair = await solana.getKeypair(payerPublicKey);

  const mangoGroup = await client.getMangoGroup(mangoGroupKey);

  const spotMarkets = await Promise.all(
    groupIds.spotMarkets.map((m) => {
      return Market.load(
        connection,
        m.publicKey,
        {
          skipPreflight: true,
          commitment: 'processed' as Commitment,
        },
        mangoGroup.dexProgramId
      );
    })
  );

  const eventQueuePks = spotMarkets.map((market) => market.decoded.eventQueue);

  const eventQueueAccts = await getMultipleAccounts(connection, eventQueuePks);

  const accountInfo = eventQueueAccts[3].accountInfo;
  const events = decodeEventQueue(accountInfo.data);

  const accounts: Set<string> = new Set();
  for (const event of events) {
    accounts.add(event.openOrders.toBase58());

    // Limit unique accounts to first 10
    if (accounts.size >= maxUniqueAccounts) {
      break;
    }
  }

  const openOrdersAccounts = [...accounts]
    .map((s) => new PublicKey(s))
    .sort((a, b) => a.toBuffer().swap64().compare(b.toBuffer().swap64()));

  const instructionBody = DexInstructions.consumeEvents({
    market: spotMarkets[3].publicKey,
    eventQueue: spotMarkets[3].decoded.eventQueue,
    coinFee: spotMarkets[3].decoded.eventQueue,
    pcFee: spotMarkets[3].decoded.eventQueue,
    openOrdersAccounts,
    limit: consumeEventsLimit,
    programId: mangoGroup.dexProgramId,
  });

  const transaction = new Transaction();
  transaction.add(instructionBody);

  console.log('Sending transaction...');
  await client.sendTransaction(transaction, payerKeyPair, []);
}

it('Crank Market', async () => {
  await crank();
});
