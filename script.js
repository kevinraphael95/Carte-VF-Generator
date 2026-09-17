// ============================================================================
// YGO FR -> ygopro.org Card Maker JSON generator
// ============================================================================
// API docs: https://ygoprodeck.com/api-guide/
// Format JSON cible vérifié sur le code source réel de l'éditeur (fork de
// lauqerm/ygocarder) : src/model/compatible-card.tsx (schéma) et
// src/util/codec-other-vendor.ts (mapping exact des valeurs).
// ============================================================================

const API_BASE = "https://db.ygoprodeck.com/api/v7/cardinfo.php";
const MIN_QUERY_LENGTH = 2;

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const submitBtn = form.querySelector("button[type=submit]");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const detailEl = document.getElementById("card-detail");
const cardImageEl = document.getElementById("card-image");
const copyImageUrlBtn = document.getElementById("copy-image-url");
const downloadImageEl = document.getElementById("download-image");
const toggleImageBtn = document.getElementById("toggle-image");
const cardTitleEl = document.getElementById("card-title");
const cardMetaEl = document.getElementById("card-meta");
const jsonOutputEl = document.getElementById("json-output");
const copyJsonBtn = document.getElementById("copy-json");
const downloadJsonBtn = document.getElementById("download-json");

const deckInput = document.getElementById("deck-input");
const deckGenerateBtn = document.getElementById("deck-generate");
const deckStatusEl = document.getElementById("deck-status");
const deckResultsEl = document.getElementById("deck-results");
const deckDownloadZipBtn = document.getElementById("deck-download-zip");

// Cache mémoire : évite de re-appeler l'API pour une recherche déjà faite.
const searchCache = new Map();

// Cache des données structurelles (anglaises) par ID de carte — voir getStructuralCard().
const structuralCardCache = new Map();

// Permet d'annuler une recherche encore en vol si l'utilisateur en relance une autre.
let activeController = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (query.length < MIN_QUERY_LENGTH) {
    statusEl.textContent = `Tape au moins ${MIN_QUERY_LENGTH} caractères.`;
    return;
  }
  await search(query);
});

async function search(query) {
  // Annule toute recherche précédente encore en cours.
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;

  resultsEl.innerHTML = "";
  detailEl.classList.add("hidden");
  statusEl.textContent = "Recherche en cours...";
  submitBtn.disabled = true;

  const cacheKey = query.toLowerCase();

  try {
    let cards, usedLanguage;

    if (searchCache.has(cacheKey)) {
      ({ cards, usedLanguage } = searchCache.get(cacheKey));
    } else {
      // 1) Recherche floue en français
      cards = await fetchCards({ fname: query, language: "fr" }, controller.signal);
      usedLanguage = "fr";

      // 2) Repli sur l'anglais si rien trouvé en FR (carte pas encore traduite)
      if (!cards.length) {
        cards = await fetchCards({ fname: query }, controller.signal);
        usedLanguage = "en";
      }

      searchCache.set(cacheKey, { cards, usedLanguage });
    }

    if (!cards.length) {
      statusEl.textContent = "Aucune carte trouvée. Essaie un autre nom.";
      return;
    }

    statusEl.textContent =
      usedLanguage === "en"
        ? `${cards.length} résultat(s) — pas de traduction FR trouvée, noms affichés en anglais.`
        : `${cards.length} résultat(s).`;

    renderResults(cards);
  } catch (err) {
    if (err.name === "AbortError") return; // recherche remplacée par une plus récente
    console.error(err);
    statusEl.textContent =
      "Erreur pendant la recherche. Réessaie dans quelques secondes (l'API limite les requêtes).";
  } finally {
    if (activeController === controller) {
      submitBtn.disabled = false;
      activeController = null;
    }
  }
}

async function fetchCards(params, signal) {
  const url = new URL(API_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    if (res.status === 400) return []; // "no card matching" -> l'API répond 400
    throw new Error(`API error ${res.status}`);
  }
  const data = await res.json();
  return data.data || [];
}

// Récupère les champs structurels (type, race, frameType, typeline, atk, def...)
// en anglais pour une carte, peu importe la langue utilisée pour la recherche.
// Nécessaire car l'API traduit aussi `type`/`race` avec `language=fr`
// (ex: "Carte Magie" au lieu de "Spell Card"), ce qui casse toute la logique
// de buildYgoproJson si on se fie à ces champs tels quels.
async function getStructuralCard(card) {
  if (structuralCardCache.has(card.id)) {
    return structuralCardCache.get(card.id);
  }
  const englishCards = await fetchCards({ id: card.id });
  const structural = englishCards[0] || card;
  structuralCardCache.set(card.id, structural);
  return structural;
}

function renderResults(cards) {
  resultsEl.innerHTML = "";
  cards.slice(0, 25).forEach((card) => {
    const li = document.createElement("li");

    const name = document.createElement("span");
    name.className = "r-name";
    name.textContent = card.name;

    const type = document.createElement("span");
    type.className = "r-type";
    type.textContent = card.type;

    li.appendChild(name);
    li.appendChild(type);
    li.addEventListener("click", () => showCard(card));
    resultsEl.appendChild(li);
  });
}

async function showCard(card) {
  detailEl.classList.remove("hidden");
  cardTitleEl.textContent = card.name;
  cardMetaEl.textContent = `${card.type} — ID ${card.id}`;

  const img = card.card_images && card.card_images[0];
  if (img) {
    let showingCropped = true;

    const applyImage = () => {
      const url = showingCropped ? img.image_url_cropped : img.image_url;
      const suffix = showingCropped ? "" : "-carte-complete";
      cardImageEl.src = url;
      downloadImageEl.href = url;
      downloadImageEl.setAttribute("download", `${sanitizeFilename(card.name)}${suffix}.jpg`);
      downloadImageEl.textContent = showingCropped
        ? "⬇️ Télécharger l'illustration"
        : "⬇️ Télécharger la carte complète";
      toggleImageBtn.textContent = showingCropped
        ? "Voir la carte complète"
        : "Voir juste le dessin";
      copyImageUrlBtn.onclick = () => copyTextToClipboard(url, copyImageUrlBtn, "🔗 Copier l'URL de l'image");
    };

    applyImage();
    toggleImageBtn.onclick = () => {
      showingCropped = !showingCropped;
      applyImage();
    };
  }

  jsonOutputEl.value = "Génération du JSON...";
  copyJsonBtn.onclick = null;
  downloadJsonBtn.onclick = null;

  let json;
  try {
    // Champs structurels toujours en anglais + nom/effet dans la langue affichée.
    const structural = await getStructuralCard(card);
    const merged = {
      ...structural,
      name: card.name,
      desc: card.desc,
      pend_desc: card.pend_desc,
      monster_desc: card.monster_desc,
      // Race d'origine (française si la recherche était en FR) pour l'affichage
      // du type sous le nom — voir buildTypeLine.
      displayRace: card.race,
    };
    json = buildYgoproJson(merged);
  } catch (err) {
    console.error(err);
    // Repli : on construit avec les champs tels quels (peut être faux si la
    // recherche était en français), mieux que de ne rien afficher.
    json = buildYgoproJson(card);
  }

  jsonOutputEl.value = JSON.stringify(json, null, 2);

  copyJsonBtn.onclick = () => copyTextToClipboard(jsonOutputEl.value, copyJsonBtn, "📋 Copier le JSON");

  downloadJsonBtn.onclick = () => {
    const blob = new Blob([jsonOutputEl.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(card.name)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ----------------------------------------------------------------------------
// Construction du JSON au format ygopro.org card maker
// Référence : src/model/compatible-card.tsx + src/util/codec-other-vendor.ts
// du repo ygocarder (https://github.com/maYayoh/ygo-cardmaker).
// ----------------------------------------------------------------------------
function buildYgoproJson(card) {
  const isSpell = card.type === "Spell Card";
  const isTrap = card.type === "Trap Card";

  // frameType de l'API ("effect", "xyz_pendulum", "link", "spell"...) donne
  // directement le frame de base + l'info Pendule, sans avoir à parser `type`.
  const [baseFrame, pendulumSuffix] = (card.frameType || "").split("_");
  const isPendulum = pendulumSuffix === "pendulum";
  const isLink = baseFrame === "link";

  return {
    version: "1.0.0",
    name: card.name,
    level: String(card.level || card.linkval || 0),
    type: buildTypeLine(card),
    icon: buildIcon(card),
    effect: buildEffectText(card),
    // Chaîne VIDE, pas "0" : le moteur de rendu fait `if (atk)`, et "0" est une
    // chaîne non vide donc "vraie" en JS -> il l'afficherait quand même.
    atk: isSpell || isTrap ? "" : String(card.atk ?? "0"),
    def: isSpell || isTrap || isLink ? "" : String(card.def ?? "0"),
    serial: "", // pas fourni par l'API — laisse vide ou clique RANDOMIZE dans l'éditeur
    copyright: "© 2026 YGOPRO.ORG",
    attribute: buildAttribute(card),
    id: String(card.id || ""),
    rarity: "common", // évite le mode "Partial export" côté éditeur (champ obligatoire)

    pendulum: {
      enabled: isPendulum,
      effect: isPendulum ? card.pend_desc || "" : "",
      blue: isPendulum ? String(card.scale ?? "0") : "0",
      red: isPendulum ? String(card.scale ?? "0") : "0",
      boxSize: "Normal",
      boxSizeEnabled: true,
    },
    variant: "Normal",
    link: buildLinkMarkers(card),
    layout: buildLayout(baseFrame),
    boxSize: (card.desc || "").length > 300 ? "Small" : "Normal",
  };
}

// Frame de base -> valeur "layout" attendue par l'éditeur.
// Table exacte tirée de frameMap dans codec-other-vendor.ts.
const FRAME_TO_LAYOUT = {
  normal: "Normal",
  effect: "Effect",
  ritual: "Ritual",
  fusion: "Fusion",
  synchro: "Synchro",
  xyz: "Xyz",
  link: "Link",
  token: "Token",
  spell: "Spell",
  trap: "Trap",
  skill: "Skill",
};

function buildLayout(baseFrame) {
  return FRAME_TO_LAYOUT[baseFrame] || "Effect";
}

// Texte entre crochets sous le nom, ex "Spellcaster/Effect", "Spell Card", "Fiend/Link".
// L'API renvoie déjà ce tableau dans `typeline` (sans le mot "Pendulum" ni "Normal"
// séparé) — on l'utilise tel quel, avec repli si absent (vieilles réponses d'API).
// Traduction des races de monstre — l'API ne traduit JAMAIS ce champ, même
// avec language=fr (vérifié : "Sea Serpent" reste "Sea Serpent"). Il faut donc
// une table manuelle, avec les termes officiels du jeu en français.
const RACE_FR = {
  Aqua: "Aqua",
  Beast: "Bête",
  "Beast-Warrior": "Bête-Guerrier",
  "Creator God": "Dieu Créateur",
  Cyberse: "Cyberse",
  Dinosaur: "Dinosaure",
  "Divine-Beast": "Bête Divine",
  Dragon: "Dragon",
  Fairy: "Fée",
  Fiend: "Démon",
  Fish: "Poisson",
  Illusion: "Illusion",
  Insect: "Insecte",
  Machine: "Machine",
  Plant: "Plante",
  Psychic: "Psychique",
  Pyro: "Pyro",
  Reptile: "Reptile",
  Rock: "Rocher",
  "Sea Serpent": "Serpent de Mer",
  Spellcaster: "Magicien",
  Thunder: "Tonnerre",
  Warrior: "Guerrier",
  "Winged Beast": "Bête Ailée",
  Wyrm: "Wyrm",
  Zombie: "Zombie",
};

function translateRace(race) {
  return RACE_FR[race] || race;
}
const ABILITY_FR = {
  Effect: "Effet",
  Normal: "Normal",
  Fusion: "Fusion",
  Synchro: "Synchro",
  Xyz: "Xyz",
  Ritual: "Rituel",
  Link: "Lien",
  Tuner: "Syntoniseur",
  Flip: "Retournement",
  Spirit: "Esprit",
  Union: "Union",
  Toon: "Toon",
  Gemini: "Gémeau",
  Pendulum: "Pendule",
};

function translateAbilities(entries) {
  return entries.map((entry) => ABILITY_FR[entry] || entry);
}

function buildTypeLine(card) {
  if (card.type === "Spell Card") return "Carte Magie";
  if (card.type === "Trap Card") return "Carte Piège";

  // La race n'est jamais traduite par l'API (même en language=fr) -> table
  // de traduction manuelle (RACE_FR) obligatoire.
  const displayRace = translateRace(card.race);

  if (Array.isArray(card.typeline) && card.typeline.length) {
    return [displayRace, ...translateAbilities(card.typeline.slice(1))].join("/");
  }

  // Repli si `typeline` n'est pas fourni par l'API.
  const abilities = [];
  const t = card.type;
  if (t.includes("Ritual")) abilities.push("Ritual");
  if (t.includes("Fusion")) abilities.push("Fusion");
  if (t.includes("Synchro")) abilities.push("Synchro");
  if (t.includes("XYZ")) abilities.push("Xyz");
  if (t.includes("Link")) abilities.push("Link");
  if (t.includes("Gemini")) abilities.push("Gemini");
  if (t.includes("Spirit")) abilities.push("Spirit");
  if (t.includes("Union")) abilities.push("Union");
  if (t.includes("Toon")) abilities.push("Toon");
  if (t.includes("Flip")) abilities.push("Flip");
  if (t.includes("Tuner")) abilities.push("Tuner");
  if (t.includes("Effect") && !abilities.length) abilities.push("Effect");
  if (t === "Normal Monster") abilities.push("Normal");
  if (!abilities.length) abilities.push("Effect");

  return `${displayRace}/${translateAbilities(abilities).join("/")}`;
}

// Icône Magie/Piège (Continuous/Counter/Equip/Field/Quick-play/Ritual/None).
// Pour un monstre, ce champ ne sert à rien dans l'éditeur : c'est toujours "None"
// (voir NO_ICON dans src/model/index.tsx — un monstre n'a pas de sous-icône).
// Mapping exact tiré de cardIconMap dans codec-other-vendor.ts — attention à la
// casse ("Quick-play" avec un p minuscule, pas "Quick-Play" comme le renvoie l'API).
const RACE_TO_ICON = {
  Continuous: "Continuous",
  Counter: "Counter",
  Equip: "Equip",
  Field: "Field",
  "Quick-Play": "Quick-play",
  Ritual: "Ritual",
  Normal: "None",
};

function buildIcon(card) {
  if (card.type === "Spell Card" || card.type === "Trap Card") {
    return RACE_TO_ICON[card.race] || "None";
  }
  return "None";
}

// SYMBOL dropdown : "Spell" / "Trap" / attribut en Title Case (Light, Dark, Divine...)
function buildAttribute(card) {
  if (card.type === "Spell Card") return "Spell";
  if (card.type === "Trap Card") return "Trap";
  if (!card.attribute) return "Light";
  return card.attribute.charAt(0) + card.attribute.slice(1).toLowerCase();
}

// Texte d'effet — pour les Pendules, l'éditeur sépare effet pendule / effet monstre,
// ici on met l'effet "monstre" dans le champ principal.
function buildEffectText(card) {
  if (card.type.includes("Pendulum") && card.monster_desc) {
    return card.monster_desc;
  }
  return card.desc || "";
}

// Marqueurs de lien : mapping des noms YGOPRODeck vers les clés de l'éditeur
// (vérifié identique à `link` dans codec-other-vendor.ts).
function buildLinkMarkers(card) {
  const base = {
    topLeft: false,
    topCenter: false,
    topRight: false,
    middleLeft: false,
    middleRight: false,
    bottomLeft: false,
    bottomCenter: false,
    bottomRight: false,
  };

  if (!card.linkmarkers) return base;

  const map = {
    "Top-Left": "topLeft",
    Top: "topCenter",
    "Top-Right": "topRight",
    Left: "middleLeft",
    Right: "middleRight",
    "Bottom-Left": "bottomLeft",
    Bottom: "bottomCenter",
    "Bottom-Right": "bottomRight",
  };

  card.linkmarkers.forEach((marker) => {
    const key = map[marker];
    if (key) base[key] = true;
  });

  return base;
}

// Copie du texte dans le presse-papier, avec repli si navigator.clipboard est
// bloqué (ex: page ouverte en file:// plutôt que via un serveur http).
function copyTextToClipboard(text, buttonEl, resetLabel) {
  const showResult = (ok) => {
    buttonEl.textContent = ok ? "✅ Copié !" : "❌ Échec de la copie";
    setTimeout(() => (buttonEl.textContent = resetLabel), 1500);
  };

  const fallback = () => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(textarea);
    showResult(ok);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showResult(true),
      () => fallback()
    );
  } else {
    fallback();
  }
}

// ----------------------------------------------------------------------------
// Import d'une decklist (Main/Extra/Side Deck) -> génère un JSON par carte.
// ----------------------------------------------------------------------------

// Une ligne de decklist ressemble à "1 Dark Magician" ou "3x Pot de Cupidité".
// On ignore les en-têtes de section ("Main Deck:", etc.) et les lignes vides.
const DECK_LINE_RE = /^(\d+)\s*x?\s+(.+)$/i;

function parseDecklist(text) {
  const names = [];
  text.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if (/^(main|extra|side)\s*deck\s*:?$/i.test(line)) return;

    const match = line.match(DECK_LINE_RE);
    const name = match ? match[2].trim() : line;
    const count = match ? parseInt(match[1], 10) : 1;

    for (let i = 0; i < count; i++) names.push(name);
  });
  return names;
}

// Petite pause entre deux appels API pour ne pas la spammer sur une grosse liste.
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findCardByName(name) {
  let cards = await fetchCards({ fname: name, language: "fr" });
  if (!cards.length) cards = await fetchCards({ fname: name });
  if (!cards.length) return null;

  // Préfère une correspondance exacte de nom (insensible à la casse) si possible,
  // sinon le premier résultat de la recherche floue.
  const exact = cards.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return exact || cards[0];
}

function setDeckItemStatus(li, statusClass, text) {
  li.querySelector(".r-type").textContent = text;
  li.querySelector(".r-type").className = `r-type ${statusClass}`;
}

deckGenerateBtn.addEventListener("click", async () => {
  const names = parseDecklist(deckInput.value);

  if (!names.length) {
    deckStatusEl.textContent = "Colle d'abord une decklist.";
    return;
  }

  deckGenerateBtn.disabled = true;
  deckResultsEl.innerHTML = "";
  deckDownloadZipBtn.classList.add("hidden");
  deckStatusEl.textContent = `Génération 0 / ${names.length}...`;

  const generatedFiles = []; // { filename, json }
  const itemEls = names.map((name) => {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.className = "r-name";
    nameSpan.textContent = name;
    const statusSpan = document.createElement("span");
    statusSpan.className = "r-type deck-status-pending";
    statusSpan.textContent = "En attente...";
    li.appendChild(nameSpan);
    li.appendChild(statusSpan);
    deckResultsEl.appendChild(li);
    return li;
  });

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const li = itemEls[i];
    setDeckItemStatus(li, "deck-status-pending", "Recherche...");

    try {
      const found = await findCardByName(name);
      if (!found) {
        setDeckItemStatus(li, "deck-status-fail", "❌ Introuvable");
      } else {
        const structural = await getStructuralCard(found);
        const merged = {
          ...structural,
          name: found.name,
          desc: found.desc,
          pend_desc: found.pend_desc,
          monster_desc: found.monster_desc,
          displayRace: found.race,
        };
        const json = buildYgoproJson(merged);
        generatedFiles.push({
          filename: `${sanitizeFilename(found.name)}.json`,
          json: JSON.stringify(json, null, 2),
        });
        setDeckItemStatus(li, "deck-status-ok", "✅ OK");
      }
    } catch (err) {
      console.error(err);
      setDeckItemStatus(li, "deck-status-fail", "❌ Erreur API");
    }

    deckStatusEl.textContent = `Génération ${i + 1} / ${names.length}...`;
    await wait(150); // ménage l'API entre deux cartes
  }

  deckGenerateBtn.disabled = false;
  deckStatusEl.textContent = `Terminé : ${generatedFiles.length} / ${names.length} carte(s) générée(s).`;

  if (generatedFiles.length) {
    deckDownloadZipBtn.classList.remove("hidden");
    deckDownloadZipBtn.onclick = () => downloadAsZip(generatedFiles);
  }
});

async function downloadAsZip(files) {
  if (typeof JSZip === "undefined") {
    alert("JSZip n'a pas pu être chargé (vérifie ta connexion). Impossible de créer le .zip.");
    return;
  }
  const zip = new JSZip();
  const usedNames = new Map();

  files.forEach(({ filename, json }) => {
    // Évite d'écraser deux fichiers de même nom (ex: doublons dans le deck).
    let finalName = filename;
    if (usedNames.has(filename)) {
      const n = usedNames.get(filename) + 1;
      usedNames.set(filename, n);
      finalName = filename.replace(/\.json$/, `-${n}.json`);
    } else {
      usedNames.set(filename, 1);
    }
    zip.file(finalName, json);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cartes-ygopro.zip";
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}
