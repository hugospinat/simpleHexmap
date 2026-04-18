import { Container, Graphics } from "pixi.js";
import type { Application } from "pixi.js";
import type { PixiStageLayers } from "./pixiTypes";

export function createPixiStage(app: Application): PixiStageLayers {
  const camera = new Container();
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

  app.stage.addChild(background);
  app.stage.addChild(camera);
  camera.addChild(terrain);
  camera.addChild(boundary);
  camera.addChild(river);
  camera.addChild(faction);
  camera.addChild(road);
  camera.addChild(feature);
  camera.addChild(fog);
  camera.addChild(preview);
  camera.addChild(overlay);

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
    terrain
  };
}
