export type TreeType = 'Fraser Fir' | 'Balsam Fir';

export type TreeSize = '3\'' | '5\'' | '6\'' | '7\'' | '8\'' | '9\'' | '10\'' | '11\'' | '12\'' | 'Larger';

export interface ProductLink {
    url: string;
    price: number | null; // null for "Call for pricing"
}

export interface TreeSizeMapping {
    treeType: TreeType;
    size: TreeSize;
    price: number | null; // null for "Call for pricing"
    treeStand: ProductLink | null; // null when no stand available
    installation: ProductLink | null; // null when no installation available
}

export interface TreeSizeMappingRecord {
    [key: string]: {
        [size: string]: {
            price: number | null;
            treeStand: ProductLink | null;
            installation: ProductLink | null;
        }
    }
}