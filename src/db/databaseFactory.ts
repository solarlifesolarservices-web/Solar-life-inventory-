import { Capacitor } from '@capacitor/core';
import { IDatabaseProvider } from './IDatabaseProvider';
import { SqliteDatabaseProvider } from './SqliteDatabaseProvider';
import { WebPersistentProvider } from './WebPersistentProvider';

let singletonProvider: IDatabaseProvider | null = null;

export function getDatabaseProvider(): IDatabaseProvider {
  if (singletonProvider) return singletonProvider;

  if (Capacitor.isNativePlatform()) {
    singletonProvider = new SqliteDatabaseProvider();
  } else {
    singletonProvider = new WebPersistentProvider();
  }

  return singletonProvider;
}
