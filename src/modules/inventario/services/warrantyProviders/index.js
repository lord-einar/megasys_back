// Registry de warranty providers
import lenovoProvider from './lenovoProvider.js';
import dellProvider from './dellProvider.js';

const providers = [
  lenovoProvider,
  dellProvider
];

const providerMap = new Map();
for (const provider of providers) {
  providerMap.set(provider.marca.toLowerCase(), provider);
}

export function getProvider(marca) {
  if (!marca) return null;
  return providerMap.get(marca.toLowerCase()) || null;
}
