export * from './healthApi';
import { HealthApi } from './healthApi';
export * from './v3UserDataApi';
import { V3UserDataApi } from './v3UserDataApi';
export * from './v4MethodsApi';
import { V4MethodsApi } from './v4MethodsApi';
export * from './v4UserDataApi';
import { V4UserDataApi } from './v4UserDataApi';
import * as http from 'http';

export class HttpError extends Error {
  constructor(
    public response: http.IncomingMessage,
    public body: any,
    public statusCode?: number
  ) {
    super('HTTP request failed');
    this.name = 'HttpError';
  }
}

export { RequestFile } from '../model/models';

export const APIS = [HealthApi, V3UserDataApi, V4MethodsApi, V4UserDataApi];
