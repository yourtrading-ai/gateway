// import {
//   getPythProgramKeyForCluster,
//   PriceStatus,
//   PythHttpClient,
// } from '@pythnetwork/client';
// import { Connection } from '@solana/web3.js';
// import {
//   getPythClusterApiUrl,
//   PythCluster,
// } from '@pythnetwork/client/lib/cluster';
//
// jest.setTimeout(60 * 60 * 1000);
//
// it('Pyth', async () => {
//   const SOLANA_CLUSTER_NAME: PythCluster = 'mainnet-beta';
//   const connection = new Connection(getPythClusterApiUrl(SOLANA_CLUSTER_NAME));
//   const pythPublicKey = getPythProgramKeyForCluster(SOLANA_CLUSTER_NAME);
//
//   const pythClient = new PythHttpClient(connection, pythPublicKey);
//   const data = await pythClient.getData();
//
//   for (const symbol of data.symbols) {
//     const price = data.productPrice.get(symbol)!;
//
//     if (price.price && price.confidence) {
//       // tslint:disable-next-line:no-console
//       console.log(`${symbol}: $${price.price} \xB1$${price.confidence}`);
//     } else {
//       // tslint:disable-next-line:no-console
//       console.log(
//         `${symbol}: price currently unavailable. status is ${
//           PriceStatus[price.status]
//         }`
//       );
//     }
//   }
// });

// import { Connection, Keypair, PublicKey } from '@solana/web3.js';
// import { Coin, Dex, DexMarket } from '@project-serum/serum-dev-tools';
// import bs58 from 'bs58';
// describe('Serum Mainnet Tools', () => {
//   const connection = new Connection(
//     'https://solana-api.projectserum.com/',
//     'confirmed'
//   );
//   const keypair = Keypair.fromSecretKey(
//     bs58.decode(
//       '<private key>'
//     )
//   );
//
//   console.log('[MAINNET] owner publicKey', keypair.publicKey.toBase58());
//   console.log('[MAINNET] owner secretKey', bs58.encode(keypair.secretKey));
//
//   const dexAddress = new PublicKey(
//     'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'
//   );
//
//   const solAddress = new PublicKey(
//     'So11111111111111111111111111111111111111112'
//   );
//
//   const usdcAddress = new PublicKey(
//     'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
//   );
//
//   const dex = new Dex(dexAddress, connection);
//   let dexMarket: DexMarket;
//
//   let baseCoin: Coin;
//   let quoteCoin: Coin;
//
//   it('LOADS A DEX MARKET', async () => {
//     const marketAddress = new PublicKey(
//       '8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6'
//     );
//     baseCoin = await Coin.load(
//       connection,
//       'SOL',
//       solAddress,
//       null as unknown as Keypair,
//       null
//     );
//     quoteCoin = await Coin.load(
//       connection,
//       'USDC',
//       usdcAddress,
//       null as unknown as Keypair,
//       null
//     );
//     dexMarket = await DexMarket.load(
//       connection,
//       dexAddress,
//       marketAddress,
//       baseCoin,
//       quoteCoin
//     );
//     console.log(dexMarket);
//
//     const txSig = await DexMarket.placeOrder(
//       connection,
//       keypair,
//       dexMarket.serumMarket,
//       'buy',
//       'postOnly',
//       1,
//       1,
//       'decrementTake'
//     );
//
//     console.log(txSig);
//   });
//
//   // disable
//   it.skip('INITS A DEX MARKET ON MAINNET', async () => {
//     baseCoin = await Coin.load(
//       connection,
//       'CMPN',
//       solAddress,
//       null as unknown as Keypair,
//       null
//     );
//     quoteCoin = await Coin.load(
//       connection,
//       'USDC',
//       usdcAddress,
//       null as unknown as Keypair,
//       null
//     );
//     dexMarket = await dex.initDexMarket(keypair, baseCoin, quoteCoin, {
//       lotSize: 1,
//       tickSize: 0.00001,
//     });
//
//     console.log('[MAINNET] dexMarket address:', dexMarket.address.toBase58());
//
//     console.log(dexMarket.address.toBase58());
//     console.log(dexMarket.serumMarket.address.toBase58());
//   });
// });
