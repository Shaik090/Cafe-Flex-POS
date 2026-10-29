import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import * as RN from 'react-native';
import { AppShell } from '../src/components/AppShell';
import { MoreScreen } from '../src/screens/MoreScreen';
import { KitchenScreen } from '../src/screens/KitchenScreen';
import { MenuManagementScreen } from '../src/screens/MenuManagementScreen';
import { QuickSaleScreen } from '../src/screens/QuickSaleScreen';

const dimensions = jest.spyOn(RN, 'useWindowDimensions');
const kitchenItem = { id: 'sandwich', name: 'Veg Sandwich', price: 30, category: 'Snacks', available: true, sendToKitchen: true };
const nonKitchenItem = { id: 'water', name: 'Water Bottle', price: 20, category: 'Other', available: true, sendToKitchen: false };
const cartLine = { key: 'sandwich', itemId: 'sandwich', name: 'Veg Sandwich', quantity: 2, unitPrice: 30, modifierNames: [] };
const ticket = { id: 'ticket-1', orderId: 'order-1', serviceMode: 'dine-in', tableName: 'Table 1', items: [{ itemId: 'sandwich', name: 'Veg Sandwich', quantity: 2, modifierNames: [] }], status: 'new', createdAt: '2026-09-15T10:00:00.000Z' };

function quickPos(overrides: Record<string, unknown> = {}) {
  return {
    shop: { enableKitchen: true, serviceModes: { quick: true, dineIn: true, takeaway: true }, enableTokens: true },
    menuItems: [kitchenItem, nonKitchenItem], heldOrders: [], cart: [cartLine], total: 60, itemCount: 2,
    tables: [], openOrders: [{ id: 'order-1', tableId: 'table-1', tableName: 'Table 1', items: [cartLine] }],
    activeOpenOrderId: 'order-1', activeServiceMode: 'dine-in', kitchenDraftOrderId: 'draft-1', kitchenTickets: [],
    lastPayment: null, addItem: jest.fn(), changeQuantity: jest.fn(), holdCurrentSale: jest.fn(), completePayment: jest.fn(), clearLastPayment: jest.fn(),
    resumeHeldOrder: jest.fn(), deleteHeldOrder: jest.fn(), selectServiceMode: jest.fn(), openTableOrder: jest.fn(), cancelOpenOrder: jest.fn(), sendToKitchen: jest.fn(), updateKitchenTicket: jest.fn(),
    ...overrides,
  } as any;
}

describe('Kitchen UI', () => {
  afterEach(() => jest.clearAllMocks());

  it('gates Kitchen in phone More and the tablet sidebar', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const phone = render(<MoreScreen onNavigate={jest.fn()} kitchenEnabled={false} />);
    expect(phone.queryByText('Kitchen')).toBeNull(); phone.unmount();
    const enabledPhone = render(<MoreScreen onNavigate={jest.fn()} kitchenEnabled />);
    expect(enabledPhone.getByText('Kitchen')).toBeTruthy(); enabledPhone.unmount();
    const tablet = render(<AppShell screen="Dashboard" onNavigate={jest.fn()} shopName="Cafe" kitchenEnabled testWidth={1024}><></></AppShell>);
    expect(tablet.getByTestId('kitchen-navigation-item')).toBeTruthy();
  });

  it('toggles Send to Kitchen without changing other item fields', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const updateMenuItem = jest.fn();
    const saveRecipe = jest.fn();
    const pos = { menuItems: [kitchenItem], stockItems: [{ id: 'milk', name: 'Milk', unit: 'litre', isActive: true, trackingMode: 'manual' }], updateMenuItem, saveRecipe, addMenuItem: jest.fn(), deleteMenuItem: jest.fn() } as any;
    const screen = render(<MenuManagementScreen pos={pos} />);
    fireEvent.press(screen.getByText('Veg Sandwich'));
    fireEvent(screen.getByTestId('menu-send-to-kitchen-toggle'), 'valueChange', false);
    expect(updateMenuItem).toHaveBeenCalledWith('sandwich', { sendToKitchen: false });
    fireEvent.press(screen.getAllByText('Milk').at(-1)!); fireEvent.press(screen.getByLabelText('Add recipe ingredient'));
    expect(saveRecipe).toHaveBeenCalledWith('sandwich', [{ stockItemId: 'milk', stockItemName: 'Milk', quantity: 1, unit: 'litre' }]);
  });

  it('shows send only for enabled kitchen items and sends through the existing action', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const sendToKitchen = jest.fn();
    const screen = render(<QuickSaleScreen pos={quickPos({ sendToKitchen })} />);
    fireEvent.press(screen.getByTestId('send-to-kitchen-button')); expect(sendToKitchen).toHaveBeenCalledTimes(1);
    screen.unmount();
    const noKitchenItems = render(<QuickSaleScreen pos={quickPos({ menuItems: [nonKitchenItem], cart: [{ ...cartLine, itemId: 'water' }] })} />);
    expect(noKitchenItems.queryByTestId('send-to-kitchen-button')).toBeNull();
  });

  it('renders the kitchen status progression on phone and tablet', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const updateKitchenTicket = jest.fn();
    const phone = render(<KitchenScreen pos={{ kitchenTickets: [ticket], updateKitchenTicket } as any} />);
    fireEvent.press(phone.getByTestId('kitchen-start-preparing')); expect(updateKitchenTicket).toHaveBeenCalledWith('ticket-1', 'preparing'); phone.unmount();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const tablet = render(<KitchenScreen pos={{ kitchenTickets: [{ ...ticket, status: 'preparing' }], updateKitchenTicket } as any} />);
    fireEvent.press(tablet.getByTestId('kitchen-mark-ready')); expect(updateKitchenTicket).toHaveBeenCalledWith('ticket-1', 'ready');
    tablet.rerender(<KitchenScreen pos={{ kitchenTickets: [{ ...ticket, status: 'ready' }], updateKitchenTicket } as any} />);
    fireEvent.press(tablet.getByTestId('kitchen-complete')); expect(updateKitchenTicket).toHaveBeenCalledWith('ticket-1', 'completed');
  });

  it('shows cancelled tickets as history without a forward action on phone and tablet', () => {
    dimensions.mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
    const cancelled = { ...ticket, status: 'cancelled', cancelledAt: '2026-09-15T11:00:00.000Z' };
    const phone = render(<KitchenScreen pos={{ kitchenTickets: [cancelled], updateKitchenTicket: jest.fn() } as any} />);
    expect(phone.getByText('Cancelled')).toBeTruthy();
    expect(phone.queryByTestId('kitchen-start-preparing')).toBeNull();
    expect(phone.queryByTestId('kitchen-mark-ready')).toBeNull();
    expect(phone.queryByTestId('kitchen-complete')).toBeNull();
    phone.unmount();
    dimensions.mockReturnValue({ width: 1024, height: 800, scale: 1, fontScale: 1 });
    const tablet = render(<KitchenScreen pos={{ kitchenTickets: [cancelled], updateKitchenTicket: jest.fn() } as any} />);
    expect(tablet.getByText('Cancelled')).toBeTruthy();
  });
});
