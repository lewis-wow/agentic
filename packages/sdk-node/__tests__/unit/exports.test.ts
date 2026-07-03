import { describe, expect, it } from 'vitest';

import {
  ClientNotConnected,
  ConnectFailed,
  SdkClient,
  createClient,
} from '../../src/index';

describe('sdk-node re-exports', () => {
  it('exports createClient as a function', () => {
    expect(typeof createClient).toBe('function');
  });

  it('exports SdkClient as a class', () => {
    expect(typeof SdkClient).toBe('function');
  });

  it('exports ClientNotConnected as a class extending Error', () => {
    const err = new ClientNotConnected();
    expect(err).toBeInstanceOf(ClientNotConnected);
    expect(err).toBeInstanceOf(Error);
  });

  it('exports ConnectFailed as a class extending Error', () => {
    const err = new ConnectFailed();
    expect(err).toBeInstanceOf(ConnectFailed);
    expect(err).toBeInstanceOf(Error);
  });

  it('createClient returns an SdkClient instance', () => {
    const client = createClient({ apiUrl: 'http://api', apiKey: 'key' });
    expect(client).toBeInstanceOf(SdkClient);
  });
});
