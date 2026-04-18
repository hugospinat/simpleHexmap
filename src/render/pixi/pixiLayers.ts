import { Sprite, Text } from "pixi.js";
import type { Container } from "pixi.js";
import {
  axialToWorldPixel,
  HEX_BASE_SIZE,
  getLevelRotation,
  getLevelScale,
  type Axial,
  type Pixel
} from "@/core/geometry/hex";
import type { SpritePool, TextPool } from "./pixiTypes";

export type Segment = [Pixel, Pixel];

export function createSpritePool(): SpritePool {
  const active = new Map<string, Sprite>();
  const idle: Sprite[] = [];

  return {
    acquire: (key, parent) => {
      const existing = active.get(key);

      if (existing) {
        if (existing.parent !== parent) {
          parent.addChild(existing);
        }
        existing.visible = true;
        return existing;
      }

      const sprite = idle.pop() ?? new Sprite();
      active.set(key, sprite);
      parent.addChild(sprite);
      sprite.visible = true;
      return sprite;
    },
    destroy: () => {
      for (const sprite of active.values()) {
        sprite.destroy();
      }
      for (const sprite of idle) {
        sprite.destroy();
      }
      active.clear();
      idle.length = 0;
    },
    releaseUnused: (visibleKeys) => {
      for (const [key, sprite] of active.entries()) {
        if (visibleKeys.has(key)) {
          continue;
        }

        sprite.removeFromParent();
        sprite.visible = false;
        active.delete(key);
        idle.push(sprite);
      }
    },
    size: () => active.size
  };
}

export function createTextPool(): TextPool {
  const active = new Map<string, Text>();
  const idle: Text[] = [];

  return {
    acquire: (key, parent) => {
      const existing = active.get(key);

      if (existing) {
        if (existing.parent !== parent) {
          parent.addChild(existing);
        }
        existing.visible = true;
        return existing;
      }

      const text = idle.pop() ?? new Text();
      active.set(key, text);
      parent.addChild(text);
      text.visible = true;
      return text;
    },
    destroy: () => {
      for (const text of active.values()) {
        text.destroy();
      }
      for (const text of idle) {
        text.destroy();
      }
      active.clear();
      idle.length = 0;
    },
    releaseUnused: (visibleKeys) => {
      for (const [key, text] of active.entries()) {
        if (visibleKeys.has(key)) {
          continue;
        }

        text.removeFromParent();
        text.visible = false;
        active.delete(key);
        idle.push(text);
      }
    },
    size: () => active.size
  };
}

export function pathPolygon(graphics: { moveTo: (x: number, y: number) => unknown; lineTo: (x: number, y: number) => unknown }, points: Pixel[]): void {
  if (points.length === 0) {
    return;
  }

  graphics.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    graphics.lineTo(points[index].x, points[index].y);
  }

  graphics.lineTo(points[0].x, points[0].y);
}

export function getVisibleCellHash(cells: Array<{ center: Pixel; key: string }>): string {
  if (cells.length === 0) {
    return "empty";
  }

  const first = cells[0];
  const last = cells[cells.length - 1];

  return [
    cells.length,
    first.key,
    Math.round(first.center.x * 10),
    Math.round(first.center.y * 10),
    last.key,
    Math.round(last.center.x * 10),
    Math.round(last.center.y * 10)
  ].join("|");
}

export function getWorldVisibleCellHash(cells: Array<{ key: string; worldCenter: Pixel }>): string {
  if (cells.length === 0) {
    return "empty";
  }

  const first = cells[0];
  const last = cells[cells.length - 1];

  return [
    cells.length,
    first.key,
    Math.round(first.worldCenter.x * 10),
    Math.round(first.worldCenter.y * 10),
    last.key,
    Math.round(last.worldCenter.x * 10),
    Math.round(last.worldCenter.y * 10)
  ].join("|");
}

export function scaleWorldLength(frame: { transform: { scaleMapLength: (length: number) => number; zoom: number } }, length: number): number {
  return frame.transform.scaleMapLength(length) / Math.max(0.0001, frame.transform.zoom);
}

export function getWorldHexCorners(axial: Axial, level: number): Pixel[] {
  const center = axialToWorldPixel(axial, level);
  const radius = HEX_BASE_SIZE * getLevelScale(level);
  const rotation = getLevelRotation(level);

  return Array.from({ length: 6 }, (_, index) => {
    const angle = rotation + Math.PI / 6 + (Math.PI / 3) * index;

    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    };
  });
}

export function parseCssColor(color: string): number {
  if (color.startsWith("#")) {
    return Number.parseInt(color.slice(1), 16);
  }

  return 0xffffff;
}
