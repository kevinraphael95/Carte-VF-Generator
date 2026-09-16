# YGO FR → Card Maker JSON

https://kevinraphael95.github.io/Carte-VF-Generator/

Petit site statique (HTML/CSS/JS, sans build ni dépendances) pour :

1. Chercher une carte Yu-Gi-Oh! par son **nom français**
2. Générer automatiquement le **JSON** au format attendu par l'éditeur
   [ygopro.org/yugioh-card-maker](https://ygopro.org/yugioh-card-maker/) (bouton *LOAD CARD*)
3. Télécharger l'**illustration officielle** de la carte

Les données viennent de l'[API YGOPRODeck](https://ygoprodeck.com/api-guide/),
qui supporte nativement le français (`&language=fr`).

## Utiliser en local

Ouvre simplement `index.html` dans un navigateur. Si ton navigateur bloque les
requêtes `fetch` en `file://`, lance un petit serveur local :

```bash
cd ygo-fr-cardmaker
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

## Déployer sur GitHub Pages

```bash
# 1. Crée un repo (via le site GitHub ou gh CLI)
gh repo create ygo-fr-cardmaker --public --source=. --remote=origin

# 2. Pousse le code
git init
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main

# 3. Active GitHub Pages
# Sur GitHub : Settings > Pages > Source = "Deploy from a branch",
# branche "main", dossier "/ (root)". Le site sera dispo sous
# https://<ton-user>.github.io/ygo-fr-cardmaker/
```

## Comment ça marche

- `script.js` interroge `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=<nom>&language=fr`
  (recherche floue en français), avec repli automatique sur l'anglais si la
  carte n'a pas encore de traduction FR dans leur base.
- Chaque résultat cliqué reconstruit un objet JSON via `buildYgoproJson()`,
  copiable ou téléchargeable.
- L'illustration vient de `card.card_images[0].image_url`
  (`images.ygoprodeck.com` — toujours en anglais, l'illustration ne change pas
  selon la langue).

## ⚠️ Fiabilité du format JSON

Le schéma JSON attendu par l'éditeur ygopro.org n'est pas documenté
publiquement. Il a été **reconstruit par rétro-ingénierie** à partir d'un
export réel obtenu via *SAVE CARD* sur une carte Magie "Normal" :

```json
{
  "version": "1.0.0",
  "name": "Dark Magic Curtain (Nerf)",
  "level": 0,
  "type": "Spell Card",
  "icon": "None",
  "effect": "...",
  "atk": "0",
  "def": "0",
  "serial": "7761747705",
  "copyright": "© 2026 YGOPRO.ORG",
  "attribute": "Spell",
  "id": "",
  "pendulum": { "enabled": false, "effect": "", "blue": "5", "red": "5", "boxSize": "Normal", "boxSizeEnabled": true },
  "variant": "Normal",
  "link": { "topLeft": false, "...": false },
  "layout": "Normal",
  "boxSize": "Small"
}
```

Champs **fiables** (confirmés) : `name`, `effect`, `atk`, `def`, `level`,
`attribute` pour Magie/Piège (`"Spell"` / `"Trap"`), structure générale.

Champs **estimés** (à vérifier/ajuster dans l'éditeur après chargement) :
- `icon` pour les monstres (Normal/Effect/Fusion/Synchro/Xyz/Link/Ritual)
- `attribute` pour les monstres (Title Case type `"Light"`, `"Dark"`...)
- `type` (le texte entre crochets, ex. `"Dragon / Effect"`)
- tout ce qui touche Pendule (`pendulum.*`) et Lien (`link.*`, `layout`)

### Comment améliorer la précision

Si tu obtiens un export réel (*SAVE CARD*) d'un monstre Normal, d'un monstre
à Effet, d'un Pendule ou d'un monstre Lien, envoie/colle le JSON obtenu et
ajuste les fonctions `buildIcon()`, `buildAttribute()`, `buildTypeLine()` et
`buildLinkMarkers()` dans `script.js` en conséquence — le code est commenté
pour indiquer où chaque estimation est faite.

## Limites connues

- L'API YGOPRODeck n'a **pas de champ `serial`** (numéro de série) — le JSON
  généré le laisse vide ; utilise le bouton *RANDOMIZE* dans l'éditeur.
- Les cartes très récentes (leaks japonais non traduits) ne sont disponibles
  qu'en anglais.
- Le téléchargement d'image utilise `fetch` + `blob` (nécessaire car
  `images.ygoprodeck.com` est cross-origin et un simple attribut `download`
  sur un `<a>` cross-origin est ignoré par les navigateurs — il ouvrirait
  l'image dans un nouvel onglet au lieu de la télécharger). Si le CDN venait
  à bloquer le CORS, le site retombe automatiquement sur l'ouverture dans un
  nouvel onglet (clic droit > Enregistrer l'image).
- Merci de ne pas spammer l'API (limite annoncée : 20 requêtes/seconde) — ce
  site ne fait qu'une poignée de requêtes par recherche.
