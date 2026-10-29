import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { createBackup } from '../src/utils/backup';

const mockPickBackupText = jest.fn();
const mockExportBackupFile = jest.fn();
const mockLoadLastBackupAt = jest.fn();
const mockSaveLastBackupAt = jest.fn();
jest.mock('../src/utils/backupFiles', () => ({ pickBackupText: (...args: unknown[]) => mockPickBackupText(...args), exportBackupFile: (...args: unknown[]) => mockExportBackupFile(...args) }));
jest.mock('../src/storage/posStorage', () => ({ loadLastBackupAt: (...args: unknown[]) => mockLoadLastBackupAt(...args), saveLastBackupAt: (...args: unknown[]) => mockSaveLastBackupAt(...args) }));

const snapshot = { version: 1 as const, shop: { name: 'Backup Cafe', type: 'Tea Shop' as const, phone: '', address: '', currency: 'INR' as const, setupComplete: true, modules: { stock: true, expenses: true, customers: false, tables: false, kitchen: false, receiptPrinting: false } }, menuItems: [], cart: [], heldOrders: [], sales: [], expenses: [], stockItems: [], purchases: [] };
function pos() { return { shop: snapshot.shop, updateShop: jest.fn(), exportPersistedState: jest.fn(() => snapshot), restorePersistedState: jest.fn().mockResolvedValue(undefined) } as any; }

describe('Settings backup UI', () => {
  beforeEach(() => { mockPickBackupText.mockReset(); mockExportBackupFile.mockReset().mockResolvedValue('file://backup.json'); mockLoadLastBackupAt.mockReset().mockResolvedValue(null); mockSaveLastBackupAt.mockReset().mockResolvedValue(undefined); });

  it('renders backup actions and fresh-state information on phone and tablet', async () => {
    const dimensions = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const phone = render(<SettingsScreen pos={pos()} />);
    expect(phone.getByText('Data & Backup')).toBeTruthy(); expect(phone.getByText('Create Backup')).toBeTruthy(); expect(phone.getByText('Restore Backup')).toBeTruthy(); expect(phone.getByText(/Never/)).toBeTruthy(); phone.unmount();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const tablet = render(<SettingsScreen pos={pos()} />);
    expect(tablet.getByText('Data & Backup')).toBeTruthy(); expect(tablet.getByText('Backups protect your shop data if the device is lost, reset or the app is reinstalled. They are stored locally and are not cloud-synced.')).toBeTruthy();
  });

  it('creates a backup and previews a valid selected backup before confirmation', async () => {
    const state = pos(); const backup = createBackup(snapshot, '0.3.0', '2026-09-16T10:30:00.000Z');
    mockPickBackupText.mockResolvedValue(JSON.stringify(backup));
    const screen = render(<SettingsScreen pos={state} />);
    fireEvent.press(screen.getByTestId('create-backup'));
    await waitFor(() => expect(mockExportBackupFile).toHaveBeenCalled());
    expect(screen.getByText('Backup created. Save or share the JSON file to keep it safe.')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('restore-backup').props.accessibilityState.disabled).toBe(false));
    fireEvent.press(screen.getByTestId('restore-backup'));
    await waitFor(() => expect(mockPickBackupText).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('restore-preview')).toBeTruthy());
    expect(screen.getByText('Restore backup?')).toBeTruthy(); expect(screen.getByTestId('restore-preview')).toBeTruthy();
    fireEvent.press(screen.getByTestId('restore-cancel'));
    await waitFor(() => expect(screen.queryByText('Restore backup?')).toBeNull());
  });

  it('shows an invalid-file error and restores only after explicit confirmation', async () => {
    const state = pos(); const screen = render(<SettingsScreen pos={state} />);
    mockPickBackupText.mockResolvedValue('{bad json'); fireEvent.press(screen.getByTestId('restore-backup'));
    await waitFor(() => expect(screen.getByTestId('backup-message').props.children).toBe('This backup file is not valid JSON.'));
    mockPickBackupText.mockResolvedValue(JSON.stringify(createBackup(snapshot))); fireEvent.press(screen.getByTestId('restore-backup'));
    await waitFor(() => expect(screen.getByText('Restore backup?')).toBeTruthy());
    expect(state.restorePersistedState).not.toHaveBeenCalled(); fireEvent.press(screen.getByTestId('restore-confirm'));
    await waitFor(() => expect(state.restorePersistedState).toHaveBeenCalledWith(expect.objectContaining({ version: 1 })));
  });

  it('renders Devices & Network states on phone and tablet without a fake connection', () => {
    const dimensions = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const state = pos(); state.shop = { ...snapshot.shop, shopId: 'shop-1', deviceId: 'device-1', deviceName: 'Counter POS', deviceMode: 'single' };
    const phone = render(<SettingsScreen pos={state} />);
    expect(phone.getByTestId('device-network-settings')).toBeTruthy();
    expect(phone.getAllByText('Single Device').length).toBeGreaterThan(0);
    expect(phone.getByText('Connection: Disconnected')).toBeTruthy();
    fireEvent.press(phone.getByTestId('device-mode-main-pos'));
    expect(state.updateShop).toHaveBeenCalledWith({ deviceMode: 'main-pos' });
    fireEvent.press(phone.getByTestId('device-mode-staff-device'));
    expect(state.updateShop).toHaveBeenCalledWith({ deviceMode: 'staff-device' });
    phone.unmount();
    const main = render(<SettingsScreen pos={{ ...state, shop: { ...state.shop, deviceMode: 'main-pos' } }} />);
    expect(main.getByText('Status: Stopped')).toBeTruthy(); main.unmount();
    const staff = render(<SettingsScreen pos={{ ...state, shop: { ...state.shop, deviceMode: 'staff-device', staffDeviceRole: 'waiter' } }} />);
    expect(staff.getByTestId('pair-main-pos')).toBeTruthy();
    expect(staff.getByText('Waiter')).toBeTruthy(); staff.unmount();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const tablet = render(<SettingsScreen pos={state} />);
    expect(tablet.getByText('Devices & Network')).toBeTruthy();
    expect(tablet.getByText('Device ID: device-1')).toBeTruthy();
  });
});
