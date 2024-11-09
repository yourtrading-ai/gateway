import {
    invalidPolkadotAddressError,
    isValidPolkadotAddress,
    validatePublicKey,
  } from '../../../src/chains/polkadot/polkadot.validators';
  import { missingParameter } from '../../../src/services/validators';
  import 'jest-extended';
  
  export const publicKey = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  export const privateKey = '0x1111111111111111111111111111111111111111111111111111111111111111'; // noqa: mock
  
  describe('isValidPolkadotAddress', () => {
    it('pass against a well formed public key', () => {
      expect(isValidPolkadotAddress(publicKey)).toEqual(true);
    });
  
    it('fail against a string that is too short', () => {
      expect(isValidPolkadotAddress(publicKey.substring(2))).toEqual(false);
    });
  
    it('fail against an invalid address format', () => {
      expect(isValidPolkadotAddress('invalid-address')).toEqual(false);
    });
  });
  
  describe('validatePublicKey', () => {
    it('valid when req.address is a valid Polkadot address', () => {
      expect(
        validatePublicKey({
          address: publicKey,
        })
      ).toEqual([]);
    });
  
    it('return error when req.address does not exist', () => {
      expect(
        validatePublicKey({
          hello: 'world',
        })
      ).toEqual([missingParameter('address')]);
    });
  
    it('return error when req.address is invalid', () => {
      expect(
        validatePublicKey({
          address: 'invalid-address',
        })
      ).toEqual([invalidPolkadotAddressError]);
    });
  });