import { TreeSizeMappingRecord } from '../types/treeSizeMapping';
import { treeSizeMappings } from '../lib/treeSizeMapping';

// Validate base tree size price availability
export const validateTreeSize = (treeType: keyof typeof treeSizeMappings, size: string) => {
  const mapping = treeSizeMappings[treeType]?.[size];
  if (!mapping) {
    return { isValid: false, message: `Invalid tree size "${size}" for ${treeType}` };
  }
  if (mapping.price === null) {
    return {
      isValid: false,
      message: `Please contact us for pricing on ${treeType} ${size}`,
      requiresContactSales: true,
    };
  }
  return { isValid: true };
};

// Validate stand availability (treeStand is ProductLink[] | null)
export const validateStandForTree = (treeType: keyof typeof treeSizeMappings, size: string) => {
  const mapping = treeSizeMappings[treeType]?.[size];
  const stands = mapping?.treeStand || null; // ProductLink[] | null
  if (!mapping || !stands || stands.length === 0) {
    return {
      isValid: false,
      message: `No tree stand available for ${treeType} ${size}. Please contact us for assistance.`,
    };
  }
  const allPricesNull = stands.every((s) => s.price === null);
  if (allPricesNull) {
    return {
      isValid: false,
      message: `Please contact us for tree stand pricing for ${treeType} ${size}`,
      requiresContactSales: true,
    };
  }
  return { isValid: true };
};

// Validate installation availability (installation is ProductLink[] | null)
export const validateInstallationForTree = (treeType: keyof typeof treeSizeMappings, size: string) => {
  const mapping = treeSizeMappings[treeType]?.[size];
  const installs = mapping?.installation || null; // ProductLink[] | null
  if (!mapping || !installs || installs.length === 0) {
    return {
      isValid: false,
      message: `Installation service not available for ${treeType} ${size}. Please contact us for assistance.`,
    };
  }
  return { isValid: true };
};