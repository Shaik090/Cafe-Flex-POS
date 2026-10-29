# Café Flex POS v0.3

Local-first React Native + Expo + TypeScript POS starter for Indian tea shops, snack shops and cafés. Every operational flow can run on either a phone or tablet; larger screens only change layout density.

## Added in v0.3

- First-run shop setup
- Shop type selection without forcing a large-café workflow
- Kitchen, tables, stock, customers and receipt printing remain optional
- Optional starter Indian tea-shop menu or completely blank menu
- AsyncStorage persistence for:
  - shop profile and module settings
  - menu items
  - active cart
  - held sales
  - completed / voided sales
- Fake sample sales removed from operational state
- Menu Management now edits the same menu used by Quick Sale
- Menu editing works on both phone and tablet
- Held sales can be resumed or deleted
- Shop Settings screen
- Shop name flows into app navigation

## Run

Requires Node.js 20.19+ for Expo SDK 54.

```bash
npm install
npx expo install @react-native-async-storage/async-storage
npm run start
```

Android:

```bash
npm run android
```

Type-check:

```bash
npm run typecheck
```

## Important local-first behavior

This phase stores business data locally on the device. It is suitable for validating the single-device POS workflow and offline behavior, but it is **not yet multi-device synchronization or cloud backup**.

## Next development phase

1. Expenses module
2. Basic stock + low-stock alerts
3. Item variants / sizes editor persistence
4. Sales date filters and receipt actions
5. Local backup/export
6. Authentication and staff permissions
7. Backend synchronization and multi-device conflict handling
