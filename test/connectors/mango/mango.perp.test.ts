import request from 'supertest';
import { gatewayApp } from '../../../src/app';
import { MangoClobPerp } from '../../../src/connectors/mango/mango.perp';
import { Solana } from '../../../src/chains/solana/solana';

let mango: MangoClobPerp;
let solana: Solana;

const MARKET = 'BTC-PERP';
const MARKET2 = 'ETH-PERP';

const INVALID_REQUEST = {
  chain: 'unknown',
  network: 'testnet',
};

beforeAll(async () => {
  solana = Solana.getInstance('mainnet-beta');
  await solana.init();
  mango = MangoClobPerp.getInstance('solana', 'mainnet-beta');
  await mango.init();
});

afterAll(async () => {
  solana.close();
});

describe('GET /clob/perp/markets', () => {
  it('should return 200 with proper request', async () => {
    await request(gatewayApp)
      .get(`/clob/perp/markets`)
      .query({
        chain: 'solana',
        network: 'mainnet-beta',
        connector: 'mango',
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        expect(Object.keys(res.body.markets).length).toBeGreaterThan(0);
      });
  });

  it('should return 404 when parameters are invalid', async () => {
    await request(gatewayApp)
      .get(`/clob/perp/markets`)
      .query(INVALID_REQUEST)
      .expect(404);
  });
});

describe('GET /clob/perp/orderBook', () => {
  it(`should return 200 with proper request with orderbook from ${MARKET}`, async () => {
    await request(gatewayApp)
      .get(`/clob/perp/orderBook`)
      .query({
        chain: 'solana',
        network: 'mainnet-beta',
        connector: 'mango',
        market: MARKET,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        expect(res.body.buys.length).toBeGreaterThan(0);
        expect(res.body.sells.length).toBeGreaterThan(0);
      });
  });

  it(`should return 200 with proper request with orderbook from ${MARKET2}`, async () => {
    await request(gatewayApp)
      .get(`/clob/perp/orderBook`)
      .query({
        chain: 'solana',
        network: 'mainnet-beta',
        connector: 'mango',
        market: MARKET2,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        expect(res.body.buys.length).toBeGreaterThan(0);
        expect(res.body.sells.length).toBeGreaterThan(0);
      });
  });

  it('should return 404 when parameters are invalid', async () => {
    await request(gatewayApp)
      .get(`/clob/perp/orderBook`)
      .query(INVALID_REQUEST)
      .expect(404);
  });
});

describe('GET /clob/perp/ticker', () => {
  it('should return 200 with proper request', async () => {
    await request(gatewayApp)
      .get(`/clob/perp/ticker`)
      .query({
        chain: 'solana',
        network: 'mainnet-beta',
        connector: 'mango',
        market: MARKET,
      })
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        console.log(
          '🪧 -> file: mango.perp.test.ts:116 -> .expect -> res.body:',
          res.body
        );
        expect(Object.keys(res.body.markets).length).toBeGreaterThan(0);
      });
  });

  it('should return 404 when parameters are invalid', async () => {
    await request(gatewayApp)
      .get(`/clob/perp/ticker`)
      .query(INVALID_REQUEST)
      .expect(404);
  });
});

// describe('GET /clob/perps/orders', () => {
//   it('should return 200 with proper request', async () => {
//     // failed for now, finish when endpoint is ready.
//     expect(false).toBeTruthy();
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/orders`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('POST /clob/perp/orders', () => {
//   it('should return 200 with proper request', async () => {
//     // failed for now, finish when endpoint is ready.
//     expect(false).toBeTruthy();
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/orders`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('DELETE /clob/perp/orders', () => {
//   it('should return 200 with proper request', async () => {
//     // failed for now, finish when endpoint is ready.
//     expect(false).toBeTruthy();
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .delete(`/clob/perp/orders`)
//       .send(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('GET /clob/perp/estimateGas', () => {
//   it('should return 200 with proper request', async () => {
//     await request(gatewayApp)
//       .get(`/clob/estimateGas`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
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

// describe('POST /clob/perp/funding/info', () => {
//   it('should return 200 with proper request', async () => {
//     //TODO: finish this when funding/info is ready
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/info`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/info`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('POST /clob/perp/funding/payments', () => {
//   it('should return 200 with proper request', async () => {
//     //TODO: finish this when funding/payments is ready
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/payments`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         address: '0x000000',
//         market: MARKET,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/funding/payments`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('POST /clob/perp/positions', () => {
//   it('should return 200 with proper request', async () => {
//     //TODO: finish this when positions is ready
//     await request(gatewayApp)
//       .post(`/clob/perp/positions`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         address: '0x000000',
//         markets: [MARKET],
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/positions`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('POST /clob/perp/order/trades', () => {
//   it('should return 200 with proper request', async () => {
//     //TODO: finish this when order/trades is ready
//     await request(gatewayApp)
//       .post(`/clob/perp/order/trades`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         address: '0x000000',
//         market: MARKET,
//         orderId: '123',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/order/trades`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('GET /clob/perp/lastTradePrice', () => {
//   it('should return 200 with proper request', async () => {
//     //TODO: finish this when lastTradePrice is ready
//     await request(gatewayApp)
//       .get(`/clob/perp/lastTradePrice`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         market: MARKET,
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .get(`/clob/perp/lastTradePrice`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });

// describe('POST /clob/perp/batchOrders', () => {
//   it('should return 200 with proper request', async () => {
//     //TODO: finish this when batchOrders is ready
//     await request(gatewayApp)
//       .post(`/clob/perp/batchOrders`)
//       .query({
//         chain: 'solana',
//         network: 'mainnet-beta',
//         connector: 'mango',
//         address: '0x000000',
//         createOrderParams: '',
//         cancelOrderParams: '',
//       })
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(200);
//   });

//   it('should return 404 when parameters are invalid', async () => {
//     await request(gatewayApp)
//       .post(`/clob/perp/batchOrders`)
//       .query(INVALID_REQUEST)
//       .expect(404);
//   });
// });
