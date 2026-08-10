/**
 * Treemap layout utilities for the Gloomberb market-impact dashboard.
 *
 * Implements a squarified treemap with iterative tile-size pruning so that tiny
 * rectangles are suppressed for readability.
 */

/** A single treemap item with weight and optional textual overlays. */
export interface MetricTreemapItem<T = unknown> {
  id: string;
  label: string;
  weight: number | null | undefined;
  colorValue?: number | null;
  primaryText?: string | null;
  secondaryText?: string | null;
  tertiaryText?: string | null;
  data: T;
}

/** A rendered treemap tile with floating-point coordinates. */
export interface FloatMetricTreemapTile<T = unknown> {
  item: MetricTreemapItem<T>;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Layout options for `buildMetricTreemapRects`. */
export interface MetricTreemapLayoutOptions {
  maxItems?: number;
  minTileWidth?: number;
  minTileHeight?: number;
}

interface WeightedTreemapItem<T> {
  item: MetricTreemapItem<T>;
  weight: number;
  area: number;
}

interface TreemapGroup<T> {
  items: WeightedTreemapItem<T>[];
  weight: number;
}

interface FloatRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_TREEMAP_ITEMS = 160;
const DEFAULT_MIN_TILE_WIDTH = 3;
const DEFAULT_MIN_TILE_HEIGHT = 1.8;

function itemWeight(item: MetricTreemapItem): number {
  return Math.max(item.weight ?? 0, 0);
}

function worstAspectRatio<T>(items: WeightedTreemapItem<T>[], sideLength: number): number {
  if (items.length === 0 || sideLength <= 0) return Number.POSITIVE_INFINITY;
  const areaSum = items.reduce((sum, item) => sum + item.area, 0);
  const minArea = Math.min(...items.map((item) => item.area));
  const maxArea = Math.max(...items.map((item) => item.area));
  if (areaSum <= 0 || minArea <= 0) return Number.POSITIVE_INFINITY;

  const sideSquared = sideLength * sideLength;
  return Math.max(
    (sideSquared * maxArea) / (areaSum * areaSum),
    (areaSum * areaSum) / (sideSquared * minArea),
  );
}

function layoutFloatGroup<T>(items: WeightedTreemapItem<T>[], rect: FloatRect): FloatRect {
  const areaSum = items.reduce((sum, item) => sum + item.area, 0);
  if (areaSum <= 0 || rect.width <= 0 || rect.height <= 0) return rect;

  if (rect.width >= rect.height) {
    const columnWidth = Math.min(rect.width, areaSum / rect.height);
    return {
      x: rect.x + columnWidth,
      y: rect.y,
      width: Math.max(0, rect.width - columnWidth),
      height: rect.height,
    };
  }

  const rowHeight = Math.min(rect.height, areaSum / rect.width);
  return {
    x: rect.x,
    y: rect.y + rowHeight,
    width: rect.width,
    height: Math.max(0, rect.height - rowHeight),
  };
}

function buildSquarifiedGroups<T>(items: WeightedTreemapItem<T>[], width: number, height: number): TreemapGroup<T>[] {
  const groups: TreemapGroup<T>[] = [];
  let rect: FloatRect = { x: 0, y: 0, width, height };
  let index = 0;

  while (index < items.length && rect.width > 0 && rect.height > 0) {
    const group: WeightedTreemapItem<T>[] = [];
    let currentWorst = Number.POSITIVE_INFINITY;
    const sideLength = Math.min(rect.width, rect.height);

    while (index < items.length) {
      const candidate = items[index]!;
      const nextGroup = [...group, candidate];
      const nextWorst = worstAspectRatio(nextGroup, sideLength);
      if (group.length > 0 && nextWorst > currentWorst) break;
      group.push(candidate);
      currentWorst = nextWorst;
      index += 1;
    }

    groups.push({
      items: group,
      weight: group.reduce((sum, item) => sum + item.weight, 0),
    });
    rect = layoutFloatGroup(group, rect);
  }

  return groups;
}

function normalizeWeightedItems<T>(
  items: MetricTreemapItem<T>[],
  width: number,
  height: number,
  cellAspect: number,
  maxItems: number,
): WeightedTreemapItem<T>[] {
  const weightedItems = items
    .map((item) => ({ item, weight: itemWeight(item) }))
    .filter((item) => item.weight > 0)
    .slice(0, maxItems);
  const totalWeight = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return [];

  const normalizedHeight = height * cellAspect;
  const totalArea = width * normalizedHeight;
  return weightedItems.map((item) => ({
    ...item,
    area: item.weight / totalWeight * totalArea,
  }));
}

function maxItemsForLayout(width: number, height: number, options?: MetricTreemapLayoutOptions): number {
  const requested = options?.maxItems ?? width * height;
  return Math.max(1, Math.min(MAX_TREEMAP_ITEMS, Math.floor(requested)));
}

function isTooSmall(
  tile: { width: number; height: number },
  options: MetricTreemapLayoutOptions | undefined,
  defaultMinTileWidth: number,
  defaultMinTileHeight: number,
): boolean {
  const minTileWidth = options?.minTileWidth ?? defaultMinTileWidth;
  const minTileHeight = options?.minTileHeight ?? defaultMinTileHeight;
  return tile.width < minTileWidth || tile.height < minTileHeight;
}

function buildMetricTreemapRectsForLimit<T>(
  items: MetricTreemapItem<T>[],
  width: number,
  height: number,
  cellAspect = 1,
  maxItems = maxItemsForLayout(width, height),
): FloatMetricTreemapTile<T>[] {
  if (width <= 0 || height <= 0) return [];
  const normalizedCellAspect = Math.max(0.25, cellAspect);
  const weightedItems = normalizeWeightedItems(items, width, height, normalizedCellAspect, maxItems);
  if (weightedItems.length === 0) return [];

  const normalizedHeight = height * normalizedCellAspect;
  const groups = buildSquarifiedGroups(weightedItems, width, normalizedHeight);
  const tiles: FloatMetricTreemapTile<T>[] = [];
  let rect: FloatRect = { x: 0, y: 0, width, height: normalizedHeight };

  for (const group of groups) {
    const areaSum = group.items.reduce((sum, item) => sum + item.area, 0);
    if (areaSum <= 0 || rect.width <= 0 || rect.height <= 0) break;

    if (rect.width >= rect.height) {
      const columnWidth = Math.min(rect.width, areaSum / rect.height);
      let itemY = rect.y;
      for (const item of group.items) {
        const itemHeight = Math.min(rect.y + rect.height - itemY, item.area / columnWidth);
        tiles.push({
          item: item.item,
          x: rect.x,
          y: itemY / normalizedCellAspect,
          width: columnWidth,
          height: itemHeight / normalizedCellAspect,
        });
        itemY += itemHeight;
      }
      rect = {
        x: rect.x + columnWidth,
        y: rect.y,
        width: Math.max(0, rect.width - columnWidth),
        height: rect.height,
      };
    } else {
      const rowHeight = Math.min(rect.height, areaSum / rect.width);
      let itemX = rect.x;
      for (const item of group.items) {
        const itemWidth = Math.min(rect.x + rect.width - itemX, item.area / rowHeight);
        tiles.push({
          item: item.item,
          x: itemX,
          y: rect.y / normalizedCellAspect,
          width: itemWidth,
          height: rowHeight / normalizedCellAspect,
        });
        itemX += itemWidth;
      }
      rect = {
        x: rect.x,
        y: rect.y + rowHeight,
        width: rect.width,
        height: Math.max(0, rect.height - rowHeight),
      };
    }
  }

  return tiles.filter((tile) => tile.width > 0 && tile.height > 0);
}

/** Build squarified treemap rectangles for a set of weighted items, pruning tiles that fall below the minimum size. */
export function buildMetricTreemapRects<T>(
  items: MetricTreemapItem<T>[],
  width: number,
  height: number,
  cellAspect = 1,
  options?: MetricTreemapLayoutOptions,
): FloatMetricTreemapTile<T>[] {
  let limit = maxItemsForLayout(width, height, options);
  let lastTiles: FloatMetricTreemapTile<T>[] = [];

  while (limit > 0) {
    const tiles = buildMetricTreemapRectsForLimit(items, width, height, cellAspect, limit);
    lastTiles = tiles;
    const firstSmallIndex = tiles.findIndex((tile) => isTooSmall(tile, options, DEFAULT_MIN_TILE_WIDTH, DEFAULT_MIN_TILE_HEIGHT));
    if (firstSmallIndex < 0) return tiles;
    limit = Math.min(limit - 1, firstSmallIndex);
  }

  return lastTiles.filter((tile) => !isTooSmall(tile, options, DEFAULT_MIN_TILE_WIDTH, DEFAULT_MIN_TILE_HEIGHT));
}
