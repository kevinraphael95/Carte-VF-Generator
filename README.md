# YGO FR → Card Maker JSON

Petit site statique (HTML/CSS/JS, sans build ni dépendances) pour :

1. Chercher une carte Yu-Gi-Oh! par son **nom français**
2. Générer automatiquement le **JSON** au format attendu par l'éditeur
   [ygopro.org/yugioh-card-maker](https://ygopro.org/yugioh-card-maker/) (bouton *LOAD CARD*)
3. Télécharger l'**illustration officielle** de la carte

Les données viennent de l'[API YGOPRODeck](https://ygoprodeck.com/api-guide/),
qui supporte nativement le français (`&language=fr`).

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
publiquement.

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
