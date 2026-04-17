# Hexmap Editor

Hexmap Editor est une application React/TypeScript pour créer, éditer, sauvegarder et synchroniser des cartes hexagonales. Le projet contient un client Vite/React, un serveur Node/WebSocket, un modèle de carte pur, une couche de protocole partagée, un pipeline de rendu canvas et des outils d'édition interactifs.

Ce README sert de guide d'entrée dans la codebase. Il explique les dossiers, les responsabilités, les flux principaux et les règles d'architecture à respecter.

## Démarrage rapide

Installer les dépendances:

```bash
npm install
```

Lancer le client Vite:

```bash
npm run dev
```

Lancer le serveur HTTP/WebSocket:

```bash
npm run server
```

Commandes utiles:

```bash
npm run typecheck
npm test
npm run build:server
npm run build
```

Le serveur écoute par défaut sur `http://localhost:8787`. Le serveur Vite proxifie `/api` vers ce serveur dans `vite.config.ts`.

## Vue d'ensemble

L'application manipule trois représentations différentes d'une carte. Elles ne doivent pas être mélangées:

- `MapState`: état runtime pur de la carte, utilisé par l'éditeur et le rendu.
- `SavedMapContent`: format JSON persistant, utilisé pour les fichiers et le stockage serveur.
- `MapOperation`: mutation transportable, utilisée pour la synchronisation client/serveur.

Le flux normal est:

```text
Action utilisateur
  -> outil / geste editor
  -> MapEditCommand
  -> MapOperation[]
  -> application locale via MapState reducer
  -> envoi WebSocket
  -> serveur applique sur SavedMapContent
  -> serveur diffuse les operations ordonnees
  -> client applique les operations recues au MapState autoritatif
  -> rendu canvas depuis MapRenderFrame
```

Le principe le plus important: les intentions d'édition, les mutations réseau, l'état runtime, le format disque et la projection de rendu sont des concepts séparés.

## Organisation des dossiers

```text
src/
  app/
    api/          Client HTTP et types API.
    document/     Import/export, codecs JSON, conversion MapState <-> SavedMapContent.
    sync/         Session de synchronisation client et hook WebSocket.
    App.tsx       Orchestration menu/editor côté client.
    EditorScreen.tsx

  core/
    geometry/     Math hexagonale pure et détection d'arêtes.
    map/          Modèle de carte pur, règles, commandes, historique, vues logiques.
    protocol/     Types et validateurs partagés client/serveur pour les operations.

  editor/
    context/      Context React lié à l'éditeur.
    hooks/        Contrôleurs React: caméra, clavier, interactions, sync wiring.
    tools/        Gestes d'édition: terrain, routes, rivières, factions, brouillard.
    presentation/ Libellés et texte d'interaction.

  render/
    Pipeline de rendu canvas: frame, transform, couches terrain/features/routes/etc.

  assets/
    Registres d'assets terrain/features/routes.

  ui/
    Composants React de présentation.

server/
  src/
    Serveur HTTP, WebSocket, stockage disque, sessions et application des operations.

scripts/
  Scripts de smoke test WebSocket/multiclient.
```

## Règles d'architecture

La direction des dépendances est volontaire:

```text
ui/editor/app/render/server -> core
```

`core` ne doit pas importer `app`, `editor`, `render`, `ui` ou `assets`. Cette règle est testée par `src/core/architectureBoundary.test.ts`.

Les responsabilités attendues:

- `core`: logique pure, déterministe, testable sans navigateur.
- `app`: intégration client avec HTTP, WebSocket, fichiers et documents.
- `editor`: état React et interactions utilisateur.
- `render`: projection visuelle et dessin canvas.
- `ui`: composants sans logique métier profonde.
- `server`: persistance disque, sessions, HTTP, WebSocket et diffusion.

Si une fonction a besoin du DOM, d'un canvas, de `window`, de `fetch`, de `WebSocket` ou de React, elle ne doit pas vivre dans `core`.

## Core: géométrie

Chemin principal: `src/core/geometry`.

`hex.ts` contient les primitives mathématiques:

- `Axial`: coordonnées hexagonales `{ q, r }`.
- `HexId`: string brandée pour les clés `"q,r"`.
- `hexKey` et `parseHexKey`: conversion entre coordonnées et identifiants.
- transformations axial/screen.
- voisins, lignes hexagonales, clusters enfants/parents.

`edgeDetection.ts` contient la détection d'arêtes de rivière depuis le pointeur. Elle reste dans `core` parce qu'elle est pure: elle prend des coordonnées, un viewport et un zoom, puis retourne des références d'arêtes. Elle ne manipule ni DOM ni canvas directement.

## Core: modèle de carte

Chemin principal: `src/core/map`.

Types importants:

- `MapState`: état runtime complet de la carte.
- `HexCell`: cellule terrain source.
- `Feature`: ville, village, fort, ruine, marqueur, label, etc.
- `Faction`: faction avec nom et couleur.
- `RiverEdgeRef`: référence à une arête de rivière.
- `RoadEdgeIndex`: index d'arête de route.

Le modèle stocke surtout le niveau source `SOURCE_LEVEL`, actuellement défini dans `mapRules.ts`. Les niveaux plus hauts sont dérivés à la lecture.

Fichiers principaux:

- `worldTypes.ts`: types structurels.
- `worldState.ts`: ajout/suppression de tuiles et propagation terrain.
- `features.ts`: règles des features et dérivation par niveau.
- `factions.ts`: factions et territoires.
- `roads.ts`: réseau routier.
- `rivers.ts`: arêtes de rivière.
- `mapRules.ts`: constantes de niveaux.
- `world.ts`: barrel public de la couche map.

## Core: vues logiques

Chemin principal: `src/core/map/mapLevelView.ts`.

`MapLevelView` est la projection logique d'un `MapState` pour un niveau donné. Elle pré-calcule:

- terrain visible à ce niveau,
- features à ce niveau,
- overlays faction,
- routes dérivées,
- rivières dérivées.

Le rendu et l'UI doivent préférer `MapLevelView` aux appels dispersés comme `getLevelMap`, `getFeaturesForLevel`, `getRoadLevelMap`, etc. Cela rend les règles de dérivation plus lisibles et plus cacheables.

## Core: commandes d'édition

Chemin principal: `src/core/map/commands`.

Une commande représente une intention métier d'édition, pas un message réseau. Exemple:

```ts
{
  type: "paintTerrain",
  level: 3,
  axial: { q: 0, r: 0 },
  terrainType: "forest"
}
```

Entrée publique:

```ts
executeMapEditCommand(mapState, command)
```

Résultat:

```ts
type MapEditCommandResult = {
  changed: boolean;
  mapState: MapState;
  operations: MapOperation[];
  effects?: MapEditCommandEffects;
};
```

Les commandes sont séparées par domaine:

- `terrainCommands.ts`: peinture terrain, effacement terrain, brouillard cellule.
- `featureCommands.ts`: création, suppression, mise à jour, visibilité feature.
- `factionCommands.ts`: création/modification faction et territoires.
- `roadCommands.ts`: connexions routières.
- `riverCommands.ts`: arêtes de rivière.
- `mapEditCommands.ts`: point d'entrée public et dispatch.

Règle: les outils d'édition appellent les commandes. Ils ne fabriquent pas eux-mêmes le format persistant.

## Core: historique undo/redo

Chemin principal: `src/core/map/history/mapOperationHistory.ts`.

L'historique est basé sur les operations, pas sur des snapshots complets. Quand un batch local est envoyé, le client calcule les operations inverses à partir du `MapState` avant l'édition.

Types/fonctions clés:

- `MapOperationHistory`
- `recordOperationHistory`
- `takeUndoOperations`
- `takeRedoOperations`
- `invertOperationBatch`

Undo/redo est server-authoritative: un undo envoie de vraies `MapOperation[]` via le même chemin de synchronisation qu'une édition normale.

## Core: protocole partagé

Chemin principal: `src/core/protocol`.

Cette couche est partagée par le client et le serveur.

Types importants:

- `SavedMapContent`: contenu JSON persistant.
- `MapOperation`: mutation transportable.
- `MapOperationEnvelope`: operation avec metadata de sync (`operationId`, `clientId`, `sequence`).
- `OperationApplier<TState>`: contrat générique pour appliquer une operation.

Fichiers:

- `types.ts`: types DTO du protocole.
- `validation.ts`: validation des operations reçues.
- `contentOperations.ts`: application des operations au `SavedMapContent`.
- `recordHelpers.ts`: helpers pour clés de records, routes, patchs.
- `operationContracts.ts`: interfaces partagées.

Important: `MapOperation.type` est la forme du protocole. Ne pas renommer ces variantes sans migration explicite du wire format et des données existantes.

## App: API, documents et sync

### API HTTP

Chemin: `src/app/api`.

`mapApi.ts` expose:

- `listMaps`
- `loadMapById`
- `createMap`
- `renameMapById`

Il parse les réponses serveur et valide le contenu avec les codecs document.

`apiBase.ts` construit les URLs HTTP et WebSocket.

### Documents

Chemin: `src/app/document`.

Responsabilités:

- lire/écrire des fichiers `.json`,
- parser le JSON persistant,
- préserver la compatibilité legacy,
- convertir `MapState <-> SavedMapContent`,
- exposer des façades d'application d'operations.

Fichiers clés:

- `savedMapCodec.ts`: parse et normalise le contenu sauvegardé.
- `worldMapCodec.ts`: conversion runtime/persistant.
- `mapFile.ts`: import/export fichier navigateur.
- `savedMapOperations.ts`: application d'operations au contenu sauvegardé.
- `worldMapOperations.ts`: application d'operations au `MapState`.
- `mapOperations.ts`: façade pratique pour les deux appliers.

Compatibilité legacy:

- `tileId` est encore accepté et normalisé vers `terrain`.
- `feature.type` est encore accepté et normalisé vers `kind`.

### Sync client

Chemin: `src/app/sync`.

`MapSyncSession` est un modèle pur de session:

- opérations locales en attente,
- files d'envoi,
- queue de réception ordonnée,
- séquence attendue,
- statut `connecting | saving | saved | error`.

`useMapSocketSync.ts` est l'adapter React/WebSocket:

- ouvre la connexion,
- reçoit le snapshot initial,
- envoie des batches d'operations,
- applique les operations reçues dans l'ordre,
- acquitte les echoes locaux,
- rejoue les operations non confirmées après reconnexion.

Les limites importantes:

- batch maximum: 500 operations.
- les operations locales ne sont pas considérées sauvegardées avant l'ack serveur.
- en cas de snapshot, le preview local est effacé et l'état autoritatif est remplacé.

## Editor: contrôleurs et outils

Chemin principal: `src/editor`.

`useEditorController.ts` est le contrôleur principal de l'écran d'édition. Il compose:

- état de mode outil,
- sélection feature/faction,
- caméra,
- gestures,
- envoi d'operations,
- undo/redo,
- props canvas,
- clavier.

Il est volontairement côté editor parce qu'il mélange React, UI state et orchestration.

### Outils et gestes

Chemin: `src/editor/tools`.

Chaque outil transforme des mouvements utilisateur en commandes:

- `editGesture.ts`: terrain.
- `fogGesture.ts`: brouillard terrain.
- `factionGesture.ts`: territoires.
- `roadGesture.ts`: routes.
- `riverGesture.ts`: rivières.
- `gestureSession.ts`: structure commune des gestures.
- `toolStrategy.ts`: contrat minimal pour brancher de futurs outils.

Le contrat général:

```text
begin gesture
  -> update gesture with cells/edges
  -> collect MapOperation[]
  -> preview MapState
  -> finish gesture
  -> send operations through sync
```

### Interactions pointeur

Chemin: `src/editor/hooks/useMapInteraction.ts`.

Ce hook est l'adapter entre les événements canvas et l'intention editor:

- pointer down/move/up,
- pan,
- conversion écran -> axial,
- hover hex,
- hover arête rivière,
- batching des mouvements par `requestAnimationFrame`.

`mapPointerIntent.ts` contient les petites règles de décodage du pointeur: bouton gauche = paint, milieu = pan, droit = erase.

## Rendu

Chemin principal: `src/render`.

Le rendu suit trois niveaux:

```text
MapState
  -> MapLevelView
  -> MapRenderFrame
  -> couches canvas
```

`MapRenderFrame` ajoute aux données logiques:

- transform écran/carte,
- cellules visibles,
- clés visibles,
- cellules cachées,
- visibilité GM/player,
- hover et highlight.

`mapRenderer.ts` orchestre les couches:

1. fond terrain,
2. frontières,
3. rivières,
4. détails terrain et labels,
5. overlays faction,
6. routes,
7. brouillard GM,
8. hover rivière,
9. features.

Les couches sont spécialisées:

- `terrainRenderer.ts`
- `boundaryRenderer.ts`
- `riverRenderer.ts`
- `roadRenderer.ts`
- `factionRenderer.ts`
- `featureLayer.ts`
- `featurePreview.ts`
- `tileVisuals.ts`

Le contrat `RenderLayer` existe dans `renderLayer.ts`, mais le rendu reste volontairement simple: pas de graphe de scène ni hiérarchie de classes.

## Assets

Chemin: `src/assets`.

Les assets sont enregistrés dans des catalogues:

- `terrainAssets.ts`
- `featureAssets.ts`
- `allAssets.ts`
- `mapImageAssets.ts`

`AssetCatalog` décrit la forme générale d'un catalogue terrain/features. Le core ne doit jamais importer ces assets. Le rendu et les composants de preview peuvent les consommer.

Le chargement d'images est centralisé par:

- `src/editor/context/MapAssetsContext.tsx`
- `src/editor/hooks/useMapAssetsVersion.ts`
- `src/render/assetImages.ts`

## UI React

Chemin: `src/ui/components`.

Composants principaux:

- `MapMenu`: liste, création, import, export et ouverture des cartes.
- `MapPane`: zone principale de carte.
- `HexCanvas`: canvas et branchement du hook d'interaction.
- `Sidebar`: palettes et outils GM.
- `FeatureInspector`: édition metadata des features.
- `BottomBar`: coordonnées, niveau, zoom.
- `TilePalette`, `FeaturePalette`, `ToolTabs`: contrôles d'édition.

Règle pratique: les composants UI reçoivent des props et déclenchent des callbacks. Ils ne doivent pas contenir les règles métier de carte.

## Serveur

Chemin principal: `server/src`.

Le serveur est un serveur Node HTTP avec WebSocket `ws`.

Fichiers:

- `index.ts`: démarre le serveur.
- `httpRoutes.ts`: endpoints REST `/api/maps`.
- `wsRoutes.ts`: endpoint WebSocket `/api/maps/:id/ws`.
- `mapStorage.ts`: stockage disque dans `data/`.
- `sessionStore.ts`: sessions serveur en mémoire.
- `operationService.ts`: application d'operations et diffusion.
- `mapContent.ts`: validation/application côté contenu.
- `appliedOperationLog.ts`: mémoire des operations déjà appliquées.
- `broadcastService.ts`: diffusion aux clients.
- `persistenceScheduler.ts`: sauvegarde debouncée.
- `types.ts`: types serveur.

Flux WebSocket:

1. client ouvre `/api/maps/:id/ws`,
2. serveur envoie `sync_snapshot`,
3. client envoie `map_operation` ou `map_operation_batch`,
4. serveur valide et applique,
5. serveur assigne une séquence,
6. serveur diffuse `map_operation_applied` ou `map_operation_batch_applied`,
7. client applique uniquement dans l'ordre.

Les doublons sont gérés par `operationId`. Si un client renvoie une operation déjà connue, le serveur renvoie l'ancien payload au client source pour qu'il puisse nettoyer sa file locale.

## Scripts de smoke test WebSocket

Chemin: `scripts`.

- `ws-sequence-smoke.mjs`: vérifie le comportement de séquence.
- `ws-multi-client-check.mjs`: vérifie plusieurs clients.
- `ws-stress.mjs`: stress test sync.

Ces scripts supposent généralement que le serveur est lancé.

## Tests

Le projet utilise Vitest.

Lancer tous les tests:

```bash
npm test
```

Tests importants:

- `src/core/architectureBoundary.test.ts`: règles de dépendances.
- `src/core/map/*test.ts`: règles de domaine.
- `src/core/map/commands/mapEditCommands.test.ts`: commandes d'édition.
- `src/core/map/history/mapOperationHistory.test.ts`: undo/redo par operations.
- `src/app/document/savedMapCodec.test.ts`: format persistant et compat legacy.
- `src/app/document/mapOperations.test.ts`: parité world/saved-map appliers.
- `src/app/sync/*test.ts`: queue, pending ops et session sync.
- `src/render/*test.ts`: rendu, transform et visibilité.
- `server/mapContent.test.ts`: validation/application serveur.

Avant de considérer un changement terminé:

```bash
npm run typecheck
npm test
npm run build:server
npm run build
```

## Comment ajouter une nouvelle opération de carte

Une nouvelle operation touche plusieurs couches. Suivre cet ordre:

1. Ajouter le type dans `src/core/protocol/types.ts`.
2. Ajouter la validation dans `src/core/protocol/validation.ts`.
3. Ajouter l'application sur `SavedMapContent` dans `contentOperations.ts`.
4. Ajouter l'application sur `MapState` dans `worldOperationApplier.ts`.
5. Ajouter la commande métier dans `src/core/map/commands` si l'operation est déclenchée par l'éditeur.
6. Ajouter ou adapter un outil/gesture dans `src/editor/tools` si nécessaire.
7. Ajouter les tests de protocole, commande, applier et sync.

Ne pas faire produire directement des records persistants par un composant UI.

## Comment ajouter un nouvel outil d'édition

1. Définir l'intention métier comme `MapEditCommand`.
2. Implémenter la commande dans `src/core/map/commands`.
3. Créer un gesture dans `src/editor/tools`.
4. Brancher le mode dans `EditorMode`.
5. Adapter `useEditorController` pour lancer le gesture.
6. Ajouter les entrées UI dans `ToolTabs` ou la sidebar.
7. Ajouter des tests de commande et de gesture.

L'outil doit produire des `MapOperation[]`; il ne doit pas modifier directement le serveur, le stockage ou le format JSON.

## Comment ajouter un nouveau terrain ou type de feature

Terrain:

1. Ajouter le type dans `terrainTypes.ts`.
2. Ajouter le label et/ou le fallback visuel côté rendu.
3. Ajouter l'asset dans `src/assets/terrain`.
4. Mettre à jour `terrainAssets.ts`.
5. Vérifier import/export via `SavedMapContent`.

Feature:

1. Ajouter le kind dans `features.ts`.
2. Ajouter le label et les règles d'override terrain si besoin.
3. Ajouter l'asset dans `src/assets/features`.
4. Mettre à jour `featureAssets.ts`.
5. Vérifier le rendu dans `featureLayer.ts` et `featurePreview.ts`.

## Conventions importantes

- Utiliser `hexKey` et `parseHexKey` au lieu de construire `"q,r"` à la main.
- Garder `core` pur et sans dépendance navigateur.
- Préférer `MapEditCommand` pour les intentions utilisateur.
- Préférer `MapOperation` pour la synchronisation et les mutations partagées.
- Préférer `MapLevelView` pour lire une projection de niveau.
- Préférer `MapRenderFrame` pour dessiner.
- Ne pas mélanger `MapState` et `SavedMapContent`.
- Ne pas renommer les variantes `MapOperation.type` sans migration.
- Garder les hooks React dans `editor` ou `app`, jamais dans `core`.
- Garder les composants `ui` aussi déclaratifs que possible.

## Debug sync

En développement, les logs détaillés de sync peuvent être activés dans le navigateur:

```js
localStorage.setItem("hexmap:sync-debug", "1")
```

Puis recharger la page. Les logs `[MapSync]` détaillent:

- creation d'operations,
- envoi,
- réception,
- gaps de séquence,
- application locale,
- temps d'application.

Pour désactiver:

```js
localStorage.removeItem("hexmap:sync-debug")
```

## Glossaire

`MapState`: état runtime utilisé dans l'éditeur.

`SavedMapContent`: format JSON sauvegardé et servi par le serveur.

`MapOperation`: mutation transportable entre client et serveur.

`MapOperationEnvelope`: operation avec metadata de transport.

`MapEditCommand`: intention métier produite par un outil d'édition.

`GestureSession`: état temporaire d'un drag/clic utilisateur.

`MapLevelView`: projection logique d'une carte pour un niveau.

`MapRenderFrame`: projection prête à dessiner dans un frame canvas.

`SOURCE_LEVEL`: niveau source éditable directement.

`ViewerRole`: rôle `gm` ou `player`, utilisé pour limiter l'édition et filtrer la visibilité.

## Où commencer pour comprendre le code

Lecture recommandée:

1. `src/app/App.tsx`: cycle menu, création, import, ouverture.
2. `src/app/EditorScreen.tsx`: composition de l'écran d'éditeur.
3. `src/editor/hooks/useEditorController.ts`: orchestration de l'éditeur.
4. `src/core/map/commands/mapEditCommands.ts`: point d'entrée des commandes.
5. `src/app/sync/useMapSocketSync.ts`: synchronisation client.
6. `src/render/mapRenderer.ts`: pipeline de rendu.
7. `server/src/wsRoutes.ts` puis `server/src/operationService.ts`: sync serveur.
8. `src/core/protocol/types.ts`: contrat partagé.

Cette séquence donne une vue complète: UI, édition, operations, sync, rendu, serveur et format de données.
