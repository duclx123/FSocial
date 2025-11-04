/**
 * Vietnamese Text Normalizer
 * Simple utility for normalizing Vietnamese text for search/comparison
 */

/**
 * Normalize Vietnamese text by removing diacritics
 * Used for case-insensitive search and comparison
 * 
 * Examples:
 *   "Cà Chua" → "ca chua"
 *   "Hành Tây" → "hanh tay"
 *   "Tỏi" → "toi"
 */
export function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

/**
 * Compare two Vietnamese strings (case and diacritic insensitive)
 */
export function compareVietnamese(str1: string, str2: string): boolean {
  return normalizeVietnamese(str1) === normalizeVietnamese(str2);
}
