const CHUTES_API_TOKEN =
  "cpk_251d670fdc8d49b1b852ca99aa4fa980.84af3c1cf49d54038f5aade5f49c1a0a.fi1h0jj3qHYb1ihJdF9iMjjQDbhBjOa8";

const btn             = document.getElementById("scanBtn");
const closeBtn        = document.getElementById("closeBtn");
const status          = document.getElementById("status");
const loadingOverlay  = document.getElementById("loading-overlay");
const loadingLabel    = document.getElementById("loading-label");
const resultCard      = document.getElementById("result-card");
const verdictBanner   = document.getElementById("verdict-banner");
const verdictLabel    = document.getElementById("verdict-label");
const resultText      = document.getElementById("result-text");
const pageFooter      = document.getElementById("page-footer");

const setStatus = (html) => (status.innerHTML = html);

const showLoader = (msg) => {
  loadingLabel.textContent = msg;
  loadingOverlay.classList.add("visible");
};
const hideLoader = () => loadingOverlay.classList.remove("visible");

closeBtn.addEventListener("click", () => window.close());

// ── Verdict styling (Dutch labels) ───────────────────────────────────────────
const VERDICTS = {
  TRUST:      { cls: "trust",      label: "Betrouwbaar" },
  MIXED:      { cls: "mixed",      label: "Goed opletten" },
  SUSPICIOUS: { cls: "suspicious", label: "Niet te vertrouwen" },
  DANGER:     { cls: "danger",     label: "Nepnieuws!" },
};

function applyVerdict(key) {
  const v = VERDICTS[key] ?? VERDICTS.MIXED;
  verdictBanner.className = "verdict-banner " + v.cls;
  verdictLabel.textContent = v.label;
}

// ── AI call ───────────────────────────────────────────────────────────────────
async function scanWithAI(posts, pageUrl, pageTitle) {
  // Build readable excerpt, capped at ~3000 chars
  const excerpt = posts
    .map((p) => {
      let chunk = `Post: ${p.postText}`;
      if (p.titleText) chunk += `\nArticle title: ${p.titleText}`;
      if (p.comments.length)
        chunk += `\nComments: ${p.comments.slice(0, 3).join(" | ")}`;
      return chunk;
    })
    .join("\n\n---\n\n")
    .slice(0, 3000);

  const response = await fetch("https://llm.chutes.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CHUTES_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-V3-0324",
      messages: [
        {
          role: "system",
          content: `Je bent De Scanner — een scherpe, licht sarcastische nepnieuws-detector ingebouwd in een browserextensie. Je helpt gebruikers beoordelen of een Facebook-pagina te vertrouwen is. Reageer altijd in het Nederlands.

Jouw taak:
1. IDENTIFICEER DE BRON. Kijk naar de URL en paginatitel. Is dit een betrouwbaar medium (NOS, RTL Nieuws, BBC, een overheidssite)? Een roddelblad? Een beroemdheid die bekendstaat om complottheorieën? Een anonieme activistenpagina? Noem de bron bij naam en laat dit zwaar wegen in je oordeel.
2. ANALYSEER DE INHOUD. Let op rode vlaggen: sensationele of emotionele taal, vage claims als "dit willen ze niet dat je weet", niet-verifieerbare beweringen, gebrek aan bronvermelding, complotretoriek, of inhoud die woede/angst wil aanwakkeren in plaats van informeren.
3. BEKIJK DE REACTIES. Zijn mensen aan het fact-checken, of versterken ze de verontwaardiging?
4. GEEF EEN OORDEEL — precies één van deze vier labels, in hoofdletters, als allereerste woord van je antwoord:
   TRUST — betrouwbare, feitelijke bron zonder grote rode vlaggen
   MIXED — deels betrouwbaar, maar ook sensationeel of bevooroordeeld
   SUSPICIOUS — serieuze rode vlaggen; wees kritisch
   DANGER — bekende complotbron, bewuste desinformatie of volledig onverifieerbare claims

Schrijf na het oordeel 2–3 bondige zinnen met je redenering. Noem de bron bij naam. Een droge opmerking is welkom, maar blijf eerlijk en onderbouwd. Geen opsommingen, geen koppen, geen markdown.`,
        },
        {
          role: "user",
          content: `Page URL: ${pageUrl}
Page title: ${pageTitle}

Content:
${excerpt}`,
        },
      ],
      stream: false,
      max_tokens: 180,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  let raw = data.choices[0].message.content.trim();
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Parse verdict keyword from the first word
  const firstWord = raw.split(/[\s\n]/)[0].toUpperCase().replace(/[^A-Z]/g, "");
  const verdictKey = ["TRUST", "MIXED", "SUSPICIOUS", "DANGER"].includes(firstWord)
    ? firstWord
    : "MIXED";

  // Strip the verdict keyword from the display text
  const bodyText = raw.replace(/^(TRUST|MIXED|SUSPICIOUS|DANGER)[^\w]*/i, "").trim();

  return { verdictKey, bodyText };
}

// ── Main handler ──────────────────────────────────────────────────────────────
btn.addEventListener("click", async () => {
  btn.disabled = true;
  resultCard.style.display = "none";
  pageFooter.style.display = "none";
  closeBtn.style.display = "none";
  setStatus("");
  showLoader("Berichten uitklappen…");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    hideLoader();
    setStatus("Geen actief tabblad gevonden.");
    btn.disabled = false;
    return;
  }

  // Step 1 – expand "Meer weergeven" / "See more" buttons
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const targets = new Set(["meer weergeven", "see more", "lees meer"]);
      const candidates = document.querySelectorAll(
        '[role="button"], [tabindex="0"], [tabindex="-1"]'
      );
      for (const el of candidates) {
        const text = el.innerText?.trim().toLowerCase() ?? "";
        if (targets.has(text) && text.length < 30) {
          el.click();
          await sleep(300);
        }
      }
      await sleep(600);
    },
  });

  showLoader("Laatste 10 berichten verzamelen…");

  // Step 2 – scroll + collect the last 10 posts, return to popup
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const seenKeys = new Set();
      const posts = [];
      const MAX_POSTS = 10;

      const findPostRoot = (el) => {
        let node = el;
        while (node.parentElement && node.parentElement !== document.body) {
          const parent = node.parentElement;
          if (parent.querySelectorAll('[data-ad-comet-preview="message"]').length > 1)
            return node;
          node = parent;
        }
        return node;
      };

      const collectPosts = () => {
        for (const body of document.querySelectorAll('[data-ad-comet-preview="message"]')) {
          const postText = (body.innerText || "").trim();
          if (!postText) continue;
          const key = postText.slice(0, 80);
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const root = findPostRoot(body);
          const titleEl = root.querySelector('[data-ad-rendering-role="title"]');
          const commentEls = root.querySelectorAll('div[role="article"]');

          posts.push({
            postText,
            titleText: (titleEl?.innerText || "").trim(),
            comments: Array.from(commentEls)
              .map((el) => (el.innerText || "").trim())
              .filter(Boolean),
          });
        }
      };

      let lastScrollY = -1;
      for (let i = 0; i < 12; i++) {
        collectPosts();
        window.scrollBy(0, Math.floor(window.innerHeight * 0.9));
        await sleep(1400);
        if (window.scrollY === lastScrollY) break;
        lastScrollY = window.scrollY;
      }
      collectPosts();

      // Keep only the last 10 unique posts collected
      const lastTen = posts.slice(-MAX_POSTS);

      console.log(`[Scanner] ${posts.length} posts collected, using last ${lastTen.length}`);
      lastTen.forEach((p, i) => {
        console.group(`[Scanner] Post ${i + 1}`);
        console.log("Text:", p.postText);
        if (p.titleText) console.log("Article:", p.titleText);
        if (p.comments.length) console.log("Comments:", p.comments);
        console.groupEnd();
      });

      return lastTen;
    },
  });

  const posts = results[0]?.result ?? [];

  if (!posts.length) {
    hideLoader();
    setStatus("Geen berichten gevonden op deze pagina.");
    btn.disabled = false;
    return;
  }

  showLoader(`${posts.length} berichten analyseren met AI…`);

  try {
    const { verdictKey, bodyText } = await scanWithAI(
      posts,
      tab.url,
      tab.title
    );
    applyVerdict(verdictKey);
    resultText.textContent = bodyText;
    hideLoader();
    resultCard.style.display = "block";
    pageFooter.style.display = "block";
    closeBtn.style.display = "block";
    setStatus(`${posts.length} van de laatste berichten gescand.`);
  } catch (err) {
    hideLoader();
    setStatus(`Fout: ${err.message}`);
  }

  btn.disabled = false;
});
