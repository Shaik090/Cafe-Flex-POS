import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ReceiptData, receiptFilename, receiptHtml } from './receipts';

export async function printReceipt(receipt: ReceiptData) { await Print.printAsync({ html: receiptHtml(receipt) }); }
export async function shareReceiptPdf(receipt: ReceiptData): Promise<string> {
  const file = await Print.printToFileAsync({ html: receiptHtml(receipt) }); const directory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  const uri = directory ? `${directory}${receiptFilename(receipt)}` : file.uri;
  if (uri !== file.uri) await FileSystem.copyAsync({ from: file.uri, to: uri });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share receipt' });
  return uri;
}
