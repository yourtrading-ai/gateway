import {
  validateTokenSymbols,
  mkValidator,
  mkRequestValidator,
  RequestValidator,
  Validator,
  validateTxHash,
} from '../../services/validators';
import { decodeAddress, encodeAddress } from '@polkadot/keyring';
import { hexToU8a, isHex } from '@polkadot/util';

export const invalidPolkadotAddressError: string =
  'The address param is not a valid Polkadot address (SS58 format)';

export const isValidPolkadotAddress = (address: string): boolean => {
  try {
    encodeAddress(
      isHex(address)
        ? hexToU8a(address)
        : decodeAddress(address)
    );
    return true;
  } catch (error) {
    return false;
  }
};

export const validatePublicKey: Validator = mkValidator(
  'address',
  invalidPolkadotAddressError,
  (val) => typeof val === 'string' && isValidPolkadotAddress(val)
);

export const validatePolkadotBalanceRequest: RequestValidator =
  mkRequestValidator([validatePublicKey, validateTokenSymbols]);

export const validatePolkadotPollRequest: RequestValidator = mkRequestValidator([
  validateTxHash,
]); 