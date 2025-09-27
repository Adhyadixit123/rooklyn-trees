import { TreeSizeMappingRecord } from '../types/treeSizeMapping';
import { treeSizeMappings } from '../lib/treeSizeMapping';

export const validateTreeSize = (treeType: keyof typeof treeSizeMappings, size: string) => {
  const mapping = treeSizeMappings[treeType]?.[size];
  if (!mapping) {
    return { isValid: false, message: `Invalid tree size "${size}" for ${treeType}` };
  }

  // Check for "Call for pricing" scenario
  if (mapping.price === null) {
    return { 
      isValid: false, 
      message: `Please contact us for pricing on ${treeType} ${size}`,
      requiresContactSales: true 
    };
  }

  return { isValid: true };
};

export const validateStandForTree = (treeType: keyof typeof treeSizeMappings, size: string) => {
  const mapping = treeSizeMappings[treeType]?.[size];
  if (!mapping || !mapping.treeStand) {
    return { 
      isValid: false, 
      message: `No tree stand available for ${treeType} ${size}. Please contact us for assistance.` 
    };
  }

  // Check for "Call for pricing" on stand
  if (mapping.treeStand.price === null) {
    return { 
      isValid: false, 
      message: `Please contact us for tree stand pricing for ${treeType} ${size}`,
      requiresContactSales: true 
    };
  }

  return { isValid: true };
};

export const validateInstallationForTree = (treeType: keyof typeof treeSizeMappings, size: string) => {
  const mapping = treeSizeMappings[treeType]?.[size];
  if (!mapping || !mapping.installation) {
    return { 
      isValid: false, 
      message: `Installation service not available for ${treeType} ${size}. Please contact us for assistance.` 
    };
  }

  return { isValid: true };
};