# Local multi-device operational sync

Cafe Flex POS remains local-first. Single Device mode neither starts a LAN server nor requires a network connection.

## Operational authority

Main POS is authoritative for open orders, table occupancy, menu prices, Kitchen tickets, and Kitchen status transitions. It is the sole writer for completed sales, stock and recipe movements, COGS/tax snapshots, receipts, reports, expenses, purchases, and supplier data. Paired staff devices submit idempotent operational commands only; they never create a completed sale or financial side effect.

Implemented commands are `ORDER_CREATE_REQUEST`, `ORDER_UPDATE_REQUEST`, `ORDER_CANCEL_REQUEST`, `ORDER_SEND_TO_KITCHEN_REQUEST`, and `KITCHEN_STATUS_UPDATE_REQUEST`. Main POS broadcasts authoritative `ORDER_*`, `KITCHEN_TICKET_*`, and `ORDER_PAID` events. Mutable orders and tickets carry revisions; stale requests receive a conflict rather than replacing newer Main POS state.

## Staff devices and reconnect

A reconnect receives a compact snapshot: shop operating settings, active order menu data, active tables, open orders, and Kitchen tickets. It intentionally excludes expenses, purchases, supplier data, costing internals, backups, and PIN hashes. Pending commands persist in local AsyncStorage in original order with stable message IDs. Pairing credentials are never placed in that queue; each outbound request obtains the credential from SecureStore.

Waiter devices can create or update unpaid orders, request cancellation, and send Kitchen work. Kitchen devices can advance a ticket from New to Preparing to Ready to Completed. Payment is only completed on Main POS; after payment Main POS broadcasts `ORDER_PAID` and frees the table. The existing Main POS payment path remains responsible for exactly-once stock, COGS, and tax effects.

## Security limitation

Paired connections require the stored per-device credential plus the paired device role and current staff permissions. The local TCP transport is authenticated but is not TLS encrypted. Use a trusted café Wi-Fi router or hotspot; forget a device to invalidate its credential.
