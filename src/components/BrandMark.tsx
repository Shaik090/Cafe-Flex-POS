import { Image, ImageStyle, StyleProp } from 'react-native';

const brandMark = require('../../assets/branding/cafe-flex-receipt-cup.png');

/** The compact receipt-and-cup mark used across the product shell. */
export function BrandMark({ size = 28, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityIgnoresInvertColors source={brandMark} style={[{ width: size, height: size, resizeMode: 'contain' }, style]} />;
}
