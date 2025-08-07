import { expect, test } from 'vitest';
import { calculateChefTokens, initializeUsage } from './usage';

test('calculateChefTokensGoogle', () => {
  const usage = {
    ...initializeUsage(),
    outputTokens: 100,
    inputTokens: 200,
    totalTokens: 300,
    googleCachedContentTokenCount: 50,
  };

  const { chefTokens, breakdown } = calculateChefTokens(usage, 'Google');

  // Google completion tokens: 100 * 140 = 14000
  // Google uncached prompt tokens: (200 - 50) * 18 = 2700
  // Google cached content tokens: 50 * 5 = 250
  // Total: 14000 + 2700 + 250 = 16950
  expect(chefTokens).toBe(16950);

  expect(breakdown.outputTokens.google).toBe(14000);
  expect(breakdown.inputTokens.google.uncached).toBe(2700);
  expect(breakdown.inputTokens.google.cached).toBe(250);
});

test('calculateChefTokensGoogleNoCachedContent', () => {
  const usage = {
    ...initializeUsage(),
    outputTokens: 100,
    inputTokens: 200,
    totalTokens: 300,
    googleCachedContentTokenCount: 0,
  };

  const { chefTokens, breakdown } = calculateChefTokens(usage, 'Google');

  // Google completion tokens: 100 * 140 = 14000
  // Google uncached prompt tokens: (200 - 0) * 18 = 3600
  // Total: 14000 + 3600 = 17600
  expect(chefTokens).toBe(17600);

  expect(breakdown.outputTokens.google).toBe(14000);
  expect(breakdown.inputTokens.google.uncached).toBe(3600);
  expect(breakdown.inputTokens.google.cached).toBe(0);
});

test('calculateChefTokensGoogleWithThoughtTokens', () => {
  const usage = {
    ...initializeUsage(),
    outputTokens: 100,
    inputTokens: 200,
    totalTokens: 300,
    googleCachedContentTokenCount: 0,
    googleThoughtsTokenCount: 50,
  };

  const { chefTokens, breakdown } = calculateChefTokens(usage, 'Google');

  // Google completion tokens: (100 + 50) * 140 = 21000
  // Google uncached prompt tokens: 200 * 18 = 3600
  // Total: 21000 + 3600 = 24600
  expect(chefTokens).toBe(24600);

  expect(breakdown.outputTokens.google).toBe(14000);
  expect(breakdown.inputTokens.google.uncached).toBe(3600);
  expect(breakdown.inputTokens.google.cached).toBe(0);
});
