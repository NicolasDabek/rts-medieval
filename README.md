# RTS Médiéval (prototype)
RTS 3D dans le navigateur (PC et mobile) avec Three.js vendored dans `vendor/` — aucun CDN.
Jouer : https://nicolasdabek.github.io/rts-medieval/ — en local : `python3 -m http.server` puis http://localhost:8000.

Objectif : détruire l'hôtel de ville ennemi (IA rouge, coin opposé de la carte).

**PC** : clic gauche / glisser = sélection (Maj = ajouter, double-clic = même type) · clic droit = déplacer / récolter / attaquer / construire / déposer · F puis clic = attaque-déplacement · WASD/ZQSD/flèches/bords = caméra · molette = zoom · H = base · Échap = annuler · minimap : clic = caméra, clic droit = déplacer.

**Mobile** : toucher une unité = sélection (double-toucher = même type) · toucher sol/ressource/ennemi/chantier = ordre · 1 doigt = déplacer la caméra · 2 doigts = pincer pour zoomer · boutons à gauche : ▭ mode cadre, ⚔ attaque-déplacement, 🛡 toute l'armée, 🏰 base, ✖ désélectionner · toucher la minimap = caméra.

Nouveautés : écran de difficulté (Facile/Normal/Difficile), ⏹ Arrêter (X), annulation remboursée des files et chantiers, 🚩 point de ralliement (clic droit avec un bâtiment sélectionné, ou bouton ; sur une ressource = récolte auto), appui long mobile = sélection.

Debug : `?diff=normal` (sans écran de départ), `?speed=10` (accéléré), `?nofog` (sans brouillard).
