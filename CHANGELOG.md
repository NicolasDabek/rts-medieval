# Journal des modifications

Toutes les versions de RTS Médiéval. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [1.0.0] — 2026-11-11

Première version stable, jouable sur PC et mobile : https://nicolasdabek.github.io/rts-medieval/

### Ajouté
- Numéro de version affiché dans le menu de départ (« v1.0.0 ») et icône d'onglet intégrée (plus de requête `favicon.ico` en 404).
- `tools/ic95.mjs` (`npm run ic95`) : mesure appariée épéiste contre tirailleur (ou toute paire), graines jouées des deux côtés, IC95 par bootstrap.
- `test/version.test.mjs` : version identique dans `package.json`, le menu et ce journal ; aucune ressource externe dans la page.
- Test IA « par bâtiment » : chaque bâtiment de l'IA (caserne, camp de tir, écurie) choisit avec ses seules options, comme en jeu.

### Modifié
- **Facile nettement plus facile** : l'IA ne contre plus que la moitié du temps (le reste au hasard) et ses vagues ne sont plus groupées. Mesuré par bâtiment : 54–55 % contre une armée mono-unité, contre 98–100 % en Normal. Normal et Difficile inchangés.
- IA : un bâtiment qui ne peut pas former le contre voulu attend s'il est formé ailleurs (une caserne ne dilue plus la cavalerie contre des tirailleurs) ; la part non contrée ne choisit plus l'unité adverse elle-même. Contre des tirailleurs, par bâtiment : 74 → 90 % (600) et 81 → 100 % (1200).
- Menu : délais de première vague corrigés (Facile ~10 min, Normal ~7 min).
- README : comment jouer, commandes PC et mobile, tests.

## Passes précédentes (avant la numérotation)

### Passe GD 13 — 2026-11-09
- IA : tirailleurs contrés par des cavaliers seuls, plus de hasard pur, attaques en vagues groupées (`wave.js`, partagé par le jeu et l'outil de duel).
- Tests : contre des tirailleurs 86/96 %, global 96/99 %, miroir 51 %, doubles contres 100 % ; paires serrées à 1200 et IC95 épéiste–tirailleur affichés.

### Passes GD 10 à 12 — 2026-11-03 au 2026-11-06
- Balistique et Chimie réservées aux tours et à l'hôtel de ville (archer amélioré 59–60 % → 57 %), coûts réduits.
- IA qui contre chaque type d'unité du joueur d'après la matrice des duels (`aipick.js`), tours qui ignorent les béliers, héros qui régénère 2 PV/s.
- Tests : moyennes 42–58 % pour tous les presets, test IA, héros seul contre 600 de lanciers ≤ 15 %.

### Passes GD 6 à 9 — 2026-11-01 au 2026-11-03
- Duels avec améliorations (presets aucune / âge 3 / max), descriptions « Bat / Craint » alignées sur la matrice et testées.
- Réglages lancier, cavalier, épéiste, héros ; contres ≥ 85 %, écart 600/1200 ≤ 10 points, scénario héros + escorte.
- Affichage des PV max arrondi.

### Passes UI 5 à 9 — 2026-10-27 au 2026-11-03
- Menu en dialogue modal accessible (focus, piège Tab), `prefers-reduced-motion`, anneau de focus visible.
- Boutons de difficulté sur une ligne sur mobile, « Normal · recommandé », un seul titre h1, tutoriel non bloquant.

### Passes GD 2 à 5 et UI 2 à 4 — 2026-10-17 au 2026-10-27
- `rules.js` partagé, outil de duel et `npm test` contre les unités dominantes, contres francs à budget égal.
- Code découpé en modules ES ; boutons 44 px, aide PC/mobile, tutoriel, minicarte lisible, boutons verrouillés lisibles.

### Fondations — 2026-10-13 au 2026-10-16
- Prototype Three.js (vendored, sans CDN), mobile, combat, IA à vagues, construction, minicarte, brouillard de guerre.
- Âges, économie complète, unités à contres, tours, murs et portes, sons WebAudio, sauvegarde (auto toutes les 60 s), groupes de contrôle.
