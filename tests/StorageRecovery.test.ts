jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPosState, savePosState } from '../src/storage/posStorage';

const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('local persistence recovery', () => {
  beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'warn').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());

  it('retains an explicit recovery error for malformed local data rather than treating it as a fresh shop', async () => {
    mockStorage.getItem.mockResolvedValue('{not json');
    const result = await loadPosState();
    expect(result.state).toBeNull();
    expect(result.recoveryError).toMatch(/could not be read safely/i);
  });

  it('normalizes older valid persisted data with newly optional domains', async () => {
    mockStorage.getItem.mockResolvedValue(JSON.stringify({ version: 1, shop: null, menuItems: [], cart: [], heldOrders: [], sales: [] }));
    const result = await loadPosState();
    expect(result.recoveryError).toBeUndefined();
    expect(result.state?.suppliers).toEqual([]);
    expect(result.state?.kitchenTickets).toEqual([]);
    expect(result.state?.taxRates).toEqual([]);
    expect(result.state?.staff).toEqual([]);
  });

  it('surfaces persistence write failures to its caller', async () => {
    mockStorage.setItem.mockRejectedValue(new Error('No space left'));
    await expect(savePosState({ version: 1, shop: null, menuItems: [], cart: [], heldOrders: [], sales: [] })).rejects.toThrow('No space left');
  });
});
