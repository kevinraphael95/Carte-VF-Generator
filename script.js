// ============================================================================
// YGO FR -> ygopro.org Card Maker JSON generator
// ============================================================================
// API docs: https://ygoprodeck.com/api-guide/
// Le format JSON cible a été reverse-engineered depuis un export réel d'une
// carte Magie "Normal" faite avec l'éditeur https://ygopro.org/yugioh-card-maker/
// Certains champs (icon, type-en-crochets, pendule/lien) sont des estimations
// à vérifier/corriger au besoin — voir le bloc <details> dans index.html.
// ============================================================================

const API_BASE = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const detailEl = document.getElementById("card-detail");
const cardImageEl = document.getElementById("card-image");
const downloadImageEl = document.getElementById("download-image");
const toggleImageBtn = document.getElementById("toggle-image");
const cardTitleEl = document.getElementById("card-title");
const cardMetaEl = document.getElementById("card-meta");
const jsonOutputEl = document.getElementById("json-output");
const copyJsonBtn = document.getElementById("copy-json");
const downloadJsonBtn = document.getElementById("download-json");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  await search(query);
});

async function search(query) {
  resultsEl.innerHTML = "";
  detailEl.classList.add("hidden");
  statusEl.textContent = "Recherche en cours...";

  try {
    // 1) Recherche floue en français
    let cards = await fetchCards({ fname: query, language: "fr" });

    // 2) Repli sur l'anglais si rien trouvé en FR (carte pas encore traduite)
    let usedLanguage = "fr";
    if (!cards.length) {
      cards = await fetchCards({ fname: query });
      usedLanguage = "en";
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
    console.error(err);
    statusEl.textContent =
      "Erreur pendant la recherche. Réessaie dans quelques secondes (l'API limite les requêtes).";
  }
}

async function fetchCards(params) {
  const url = new URL(API_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 400) return []; // "no card matching" -> l'API répond 400
    throw new Error(`API error ${res.status}`);
  }
  const data = await res.json();
  return data.data || [];
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

function showCard(card) {
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
    };

    applyImage();
    toggleImageBtn.onclick = () => {
      showingCropped = !showingCropped;
      applyImage();
    };
  }

  const json = buildYgoproJson(card);
  jsonOutputEl.value = JSON.stringify(json, null, 2);

  copyJsonBtn.onclick = () => {
    navigator.clipboard.writeText(jsonOutputEl.value);
    copyJsonBtn.textContent = "✅ Copié !";
    setTimeout(() => (copyJsonBtn.textContent = "📋 Copier le JSON"), 1500);
  };

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
// ----------------------------------------------------------------------------
function buildYgoproJson(card) {
  const isSpell = card.type === "Spell Card";
  const isTrap = card.type === "Trap Card";
  const isMonster = !isSpell && !isTrap;
  const isPendulum = card.type.includes("Pendulum");
  const isLink = card.type === "Link Monster";

  return {
    version: "1.0.0",
    name: card.name,
    level: card.level || card.linkval || 0,
    type: buildTypeLine(card),
    icon: buildIcon(card),
    effect: buildEffectText(card),
    atk: isSpell || isTrap ? "0" : String(card.atk ?? "0"),
    def: isSpell || isTrap || isLink ? "0" : String(card.def ?? "0"),
    serial: "", // pas fourni par l'API — laisse vide ou clique RANDOMIZE dans l'éditeur
    copyright: "© 2026 YGOPRO.ORG",
    attribute: buildAttribute(card),
    id: String(card.id || ""),
    pendulum: {
      enabled: isPendulum,
      effect: isPendulum ? card.pend_desc || "" : "",
      blue: isPendulum ? String(card.scale ?? "0") : "5",
      red: isPendulum ? String(card.scale ?? "0") : "5",
      boxSize: "Normal",
      boxSizeEnabled: true,
    },
    variant: "Normal",
    link: buildLinkMarkers(card),
    layout: isLink ? "Link" : isPendulum ? "Pendulum" : "Normal",
    boxSize: (card.desc || "").length > 300 ? "Normal" : "Small",
  };
}

// Texte entre crochets sous le nom, ex "Dragon / Normal", "Spell Card", "Link/Effect"
function buildTypeLine(card) {
  if (card.type === "Spell Card" || card.type === "Trap Card") {
    return card.type;
  }
  if (card.type === "Link Monster") {
    return `${card.race} / Link/Effect`;
  }

  // Monstres classiques : "Race / Ability [/ Ability2]"
  const abilities = [];
  const t = card.type;
  if (t.includes("Pendulum")) abilities.push("Pendulum");
  if (t.includes("Ritual")) abilities.push("Ritual");
  if (t.includes("Fusion")) abilities.push("Fusion");
  if (t.includes("Synchro")) abilities.push("Synchro");
  if (t.includes("XYZ")) abilities.push("Xyz");
  if (t.includes("Gemini")) abilities.push("Gemini");
  if (t.includes("Spirit")) abilities.push("Spirit");
  if (t.includes("Union")) abilities.push("Union");
  if (t.includes("Toon")) abilities.push("Toon");
  if (t.includes("Flip")) abilities.push("Flip");
  if (t.includes("Tuner")) abilities.push("Tuner");
  if (t.includes("Effect") && !abilities.length) abilities.push("Effect");
  if (t === "Normal Monster") abilities.push("Normal");
  if (!abilities.length) abilities.push("Effect");

  return `${card.race} / ${abilities.join("/")}`;
}

// Icône (estimation) : sous-type Magie/Piège, ou capacité principale du monstre
function buildIcon(card) {
  if (card.type === "Spell Card" || card.type === "Trap Card") {
    // API race pour Magie/Piège = "Normal", "Quick-Play", "Continuous", "Equip", "Field", "Ritual", "Counter"
    return card.race === "Normal" ? "None" : card.race;
  }
  if (card.type === "Link Monster") return "Link";
  if (card.type.includes("XYZ")) return "Xyz";
  if (card.type.includes("Synchro")) return "Synchro";
  if (card.type.includes("Fusion")) return "Fusion";
  if (card.type.includes("Ritual")) return "Ritual";
  if (card.type === "Normal Monster") return "Normal";
  return "Effect";
}

// SYMBOL dropdown : "Spell" / "Trap" / attribut en Title Case (Light, Dark, Water...)
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

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}
