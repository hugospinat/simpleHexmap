import { Container, Graphics } from "pixi.js";
import type { Application } from "pixi.js";
import type { PixiStageLayers } from "./pixiTypes";

export function createPixiStage(app: Application): PixiStageLayers {
  const camera = new Container();
  camera.sortableChildren = true;
  const background = new Graphics();
  const terrain = new Container();
  const boundary = new Graphics();
  const river = new Graphics();
  const faction = new Graphics();
  const road = new Container();
  const feature = new Container();
  const fog = new Graphics();
  const preview = new Container();
  const overlay = new Graphics();
  const token = new Graphics();

  terrain.zIndex = 10;
  fog.zIndex = 20;
  boundary.zIndex = 30;
  river.zIndex = 40;
  road.zIndex = 45;
  faction.zIndex = 50;
  feature.zIndex = 60;
  preview.zIndex = 70;
  overlay.zIndex = 80;
  token.zIndex = 90;

  app.stage.addChild(background);
  app.stage.addChild(camera);
  camera.addChild(terrain);
  camera.addChild(fog);
  camera.addChild(boundary);
  camera.addChild(river);
  camera.addChild(road);
  camera.addChild(faction);
  camera.addChild(feature);
  camera.addChild(preview);
  camera.addChild(overlay);
  camera.addChild(token);

  return {
    background,
    boundary,
    camera,
    faction,
    feature,
    fog,
    overlay,
    preview,
    river,
    road,
    terrain,
    token
  };
}
