import request from 'supertest';
import { gatewayApp } from '../../../src/app';
import { MangoClobPerp } from '../../../src/connectors/mango/mango.perp';
import { Solana } from '../../../src/chains/solana/solana';
import { patch, unpatch } from '../../../test/services/patch';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

let mango: MangoClobPerp;
let solana: Solana;

// const MARKET = 'BTC-PERP';
// const MARKET2 = 'ETH-PERP';

const INVALID_REQUEST = {
  chain: 'unknown',
  network: 'testnet',
};

beforeAll(async () => {
  solana = Solana.getInstance('mainnet-beta');
  await solana.init();
  mango = MangoClobPerp.getInstance('solana', 'mainnet-beta');
  await mango.init();
  patchgetKeypair(
    'Qk6rD8bBVEr95yHEh47UrX1YEKSFiL4horxd1pSP3hPpFCu2fNVkjUuistJYae1cV8kQn4G6frsLBhZfESV5JLB'
  );
});

afterAll(async () => {
  await solana.close();
  unpatch();
});

// patch getKeypair to return a valid keypair
const patchgetKeypair = (privatekey: string) => {
  patch(solana, 'getKeypair', () => {
    return Keypair.fromSecretKey(bs58.decode(privatekey));
  });
};

// describe('GET /clob/perp/markets', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/markets`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(Object.keys(res.body.markets).length).toBeGreaterThan(0);
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/markets`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('GET /clob/perp/orderBook', () => {
//   it(`should return 200 with proper request with orderbook from ${MARKET}`, async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orderBook`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body.buys.length).toBeGreaterThan(0);
//         expect(res.body.sells.length).toBeGreaterThan(0);
//       });
//   });

//   it(`should return 200 with proper request with orderbook from ${MARKET2}`, async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orderBook`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET2,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body.buys.length).toBeGreaterThan(0);
//         expect(res.body.sells.length).toBeGreaterThan(0);
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orderBook`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('GET /clob/perp/ticker', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/ticker`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(Object.keys(res.body.markets).length).toBeGreaterThan(0);
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/ticker`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

//describe('GET /clob/perp/lastTradePrice', () => {
//  it('should return 200 with proper request', async () => {
//    await request(gatewayApp)
//      .get(`/clob/perp/lastTradePrice`)
//      .query({
//        chain: 'solana',
//        network: 'mainnet-beta',
//        connector: 'mango_perpetual',
//        market: MARKET,
//      })
//      .set('Accept', 'application/json')
//      .expect('Content-Type', /json/)
//      .expect(200)
//      .expect((res) => {
//        console.log(
//          '🪧 -> file: mango.routes.perp.test.ts:153 -> .expect -> lastTradePrice:',
//          res.body.lastTradePrice
//        );
//        expect(res.body.lastTradePrice).toBeDefined();
//        expect(parseFloat(res.body.lastTradePrice)).toBeDefined();
//      });
//  });
//
//  it('should return 404 when parameters are invalid', async () => {
//    await request(gatewayApp)
//      .get(`/clob/perp/lastTradePrice`)
//      .query(INVALID_REQUEST)
//      .expect(404);
//  });
//});

// describe('POST /clob/perp/funding/info', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/info`)
//       .send({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/info`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('POST /clob/perp/funding/payments', () => {
//   // @note: We need to patch this._chain.getKeypair(address) in order for testing on CI/CD
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/payments`)
//       .send({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         address: '21cxPEMbCmByKWxDGNRZCa6BWfo6WEq5x4cBZ91mEnid',
//         market: MARKET2,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/payments`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('POST /clob/perp/orders', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/orders`)
//       .send({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//         address: '21cxPEMbCmByKWxDGNRZCa6BWfo6WEq5x4cBZ91mEnid',
//         side: 'BUY',
//         price: '25800',
//         amount: '0.0001',
//         leverage: 1,
//         clientOrderId: 123456,
//         orderType: 'LIMIT',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/orders`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('GET /clob/perps/orders', () => {
//   it('should return 200 and all orders with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orders`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//         address: '21cxPEMbCmByKWxDGNRZCa6BWfo6WEq5x4cBZ91mEnid',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//         expect(res.body.orders).toBeDefined();
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orders`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('DELETE /clob/perp/orders', () => {
//   let orderId: number;

//   it('should return 200 and 1 order with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orders`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//         address: '21cxPEMbCmByKWxDGNRZCa6BWfo6WEq5x4cBZ91mEnid',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//         expect(res.body.orders).toBeDefined();
//         expect(res.body.orders.length).toEqual(1);
//         orderId = res.body.orders[0].orderId;
//       });
//   });

//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .delete(`/clob/perp/orders`)
//       .send({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//         address: '21cxPEMbCmByKWxDGNRZCa6BWfo6WEq5x4cBZ91mEnid',
//         orderId: orderId,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//       });
//   });

//   it('should return 200 and empty order with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orders`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//         address: '21cxPEMbCmByKWxDGNRZCa6BWfo6WEq5x4cBZ91mEnid',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//         expect(res.body.orders).toBeDefined();
//         expect(res.body.orders.length).toEqual(0);
//       });
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .delete(`/clob/perp/orders`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// ABOVE IS GOOD TEST CASES

// describe('GET /clob/perps/orders', () => {
//   it('should return 200 and all orders with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orders`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango_perpetual',
//         market: MARKET,
//         address: '2DMmy7db2HX7SNEaaMjxs96mG9DE55fzgniSya4B29Xh',
//         orderId: '4759278417761137954683314',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         console.log(
//           '🪧 -> file: mango.routes.perp.test.ts:369 -> .expect -> res.body:',
//           res.body
//         );
//         expect(res.body).toBeDefined();
//         expect(res.body.orders).toBeDefined();
//       });
//   });
//
//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orders`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });
//
// describe('POST /clob/perp/order/trades', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/order/trades`)
//       .send({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango_perpetual',
//         address: '2DMmy7db2HX7SNEaaMjxs96mG9DE55fzgniSya4B29Xh',
//         market: MARKET,
//         orderId: '4759278417761137954683314',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .expect((res) => {
//         expect(res.body).toBeDefined();
//       });
//   });
//
//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/order/trades`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });
//
// describe('GET /clob/perp/estimateGas', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/estimateGas`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango_perpetual',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });
//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/estimateGas`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });
//
// describe('POST /clob/perp/positions', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/positions`)
//       .send({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango_perpetual',
//         address: '2DMmy7db2HX7SNEaaMjxs96mG9DE55fzgniSya4B29Xh',
//         markets: [MARKET],
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });
//
//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/positions`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });
//
describe('POST /clob/perp/batchOrders', () => {
  it('should return 200 with proper request', async () => {
    await request(gatewayApp)
      .post(`/clob/perp/batchOrders`)
      .send({
        chain: 'solana',
        network: 'mainnet-beta',
        connector: 'mango_perpetual',
        address: '2DMmy7db2HX7SNEaaMjxs96mG9DE55fzgniSya4B29Xh',
        createOrderParams: [
          {
            price: 100,
            amount: 0.01,
            orderType: 'LIMIT',
            side: 'SELL',
            market: 'SOL-PERP',
            leverage: 5,
            clientOrderId: 1234,
          },
        ],
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        expect(res.body.clientOrderId).toBeDefined();
        res.body.clientOrderId.forEach((order: any) => {
          expect(order).toBeDefined();
          console.log(order);
        });
      });
  });

  it('should return 404 when parameters are invalid', async () => {
    await request(gatewayApp)
      .post(`/clob/perp/batchOrders`)
      .send(INVALID_REQUEST)
      .expect(404);
  });
});
