import { OrderType, Side } from '../../amm/amm.requests';
import { PerpOrderSide, PerpOrderType } from '@blockworks-foundation/mango-v4';

export function translateOrderSide(side: Side) {
  switch (side) {
    case 'BUY':
      return PerpOrderSide.bid;
    case 'SELL':
      return PerpOrderSide.ask;
    default:
      throw new Error('Invalid order side');
  }
}

export function translateOrderType(type: OrderType) {
  switch (type) {
    case 'LIMIT':
      return PerpOrderType.limit;
    case 'MARKET':
      return PerpOrderType.market;
    case 'IOC':
      return PerpOrderType.immediateOrCancel;
    case 'POST_ONLY':
      return PerpOrderType.postOnly;
    default:
      throw new Error('Invalid order type');
  }
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
