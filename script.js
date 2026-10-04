/* ============================================================
   CONTENT — edit this block to update the site.
   ============================================================ */

const LINKS = {
  join: "https://olincatalyst.notion.site/Onboarding-bdfdcc062d924b619ffc18da4ba08f7d",
  getStarted: "https://chat.whatsapp.com/IGC31NBMDbnJxJU4OeVjmu?mode=gi_t",
  grant: "mailto:lcarlin@olin.edu,cphillips@olin.edu,lcondearaujo@olin.edu",
  support: "https://olin.edu/give-olin-areas-support-student-crowdfunding/catalyst",
  speakers: "https://luma.com/olincatalyst",
};

const CATEGORIES = {
  fuel: { name: "Fuel", color: "var(--flame)" },
  guidance: { name: "Guidance", color: "var(--blue)" },
  learning: { name: "Learning", color: "var(--violet)" },
  network: { name: "Network", color: "var(--green)" },
};

const ELEMENTS = [
  { sym: "Gr", name: "Grants", cat: "fuel",
    text: "Funding of up to $1,000 so a good idea doesn't stall for lack of parts, tools, or a first run.",
    facts: { Amount: "up to $1,000", For: "student projects & ventures" } },
  { sym: "Me", name: "Mentorship", cat: "guidance",
    text: "People who have built things before, paired with people building things now.",
    facts: { Form: "1-on-1 and small group", Good_for: "decisions you're stuck on" } },
  { sym: "Oh", name: "Office hours", cat: "guidance",
    text: "Drop in with a question, a prototype, or a problem. Leave with a next step.",
    facts: { Form: "drop-in", Bring: "whatever you have" } },
  { sym: "Wk", name: "Workshops", cat: "learning",
    text: "Hands-on sessions on validating ideas and talking to users, the unglamorous skills that decide whether a project goes anywhere.",
    facts: { Topics: "idea validation, user interviews", Level: "no experience needed" } },
  { sym: "Sp", name: "Speakers", cat: "learning",
    text: "Founders and investors share what actually happened, including the parts that don't make the pitch deck.",
    facts: { Form: "talk + Q&A", Open_to: "everyone" },
    link: { href: LINKS.speakers, label: "See speaker events →" } },
  { sym: "Wm", name: "Weekly meeting", cat: "network",
    text: "The standing reaction vessel. Speakers, idea sharing, or time to work on existing projects. Open to anyone.",
    facts: { Cadence: "weekly", Open_to: "anyone" } },
  { sym: "Cm", name: "Community", cat: "network",
    text: "Gatherings that pull entrepreneurial people together from across Olin. Co-founders tend to meet here.",
    facts: { Who: "builders across Olin", Vibe: "low-key" } },
  { sym: "Bb", name: "Babson", cat: "network",
    text: "Engineers next door to a business school. We bring Olin and Babson students into the same room on purpose.",
    facts: { Distance: "a short walk", Result: "mixed teams" } },
  { sym: "Bo", name: "Boston", cat: "network",
    text: "Events that connect students with startups and the wider Boston entrepreneurship community.",
    facts: { Scene: "startups & founders", Form: "events through the year" } },
  { sym: "Vc", name: "Venture capital", cat: "fuel",
    text: "Introductions to how venture funding works and to the people who do it, for when a project outgrows a grant.",
    facts: { Stage: "after the prototype", Form: "events & intros" } },
];

/* ============================================================
   Rendering
   ============================================================ */

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-link]").forEach((a) => {
  a.href = LINKS[a.dataset.link];
  if (a.href.startsWith("mailto:")) return;
  a.target = "_blank";
  a.rel = "noopener";
});

addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 10), { passive: true });

/* ----- periodic table ----- */
const ptable = $("#ptable");
const detail = $("#detail");

$("#legend").innerHTML = Object.values(CATEGORIES)
  .map((c) => `<span><i style="--c:${c.color}"></i>${c.name}</span>`)
  .join("");

function selectElement(i) {
  const el = ELEMENTS[i];
  const cat = CATEGORIES[el.cat];
  ptable.querySelectorAll(".el").forEach((b, j) => b.setAttribute("aria-pressed", j === i));
  detail.style.setProperty("--c", cat.color);
  detail.innerHTML = `
    <p class="label">No. ${String(i + 2).padStart(2, "0")} · ${cat.name}</p>
    <div class="detail-sym">${el.sym}</div>
    <h3>${el.name}</h3>
    <p>${el.text}</p>
    <dl>${Object.entries(el.facts)
      .map(([k, v]) => `<dt>${k.replace(/_/g, " ")}</dt><dd>${v}</dd>`)
      .join("")}</dl>
    ${el.link ? `<a class="text-link" href="${el.link.href}" target="_blank" rel="noopener">${el.link.label}</a>` : ""}`;
}

ELEMENTS.forEach((el, i) => {
  const b = document.createElement("button");
  b.className = "el";
  b.type = "button";
  b.style.setProperty("--c", CATEGORIES[el.cat].color);
  b.innerHTML = `<span class="el-num">${String(i + 2).padStart(2, "0")}</span>
    <span class="el-sym">${el.sym}</span><span class="el-name">${el.name}</span>`;
  b.addEventListener("click", () => selectElement(i));
  ptable.append(b);
});
selectElement(0);

/* ----- reveal on scroll ----- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  });
}, { threshold: 0.25 });
document.querySelectorAll(".reveal").forEach((n) => io.observe(n));

/* ----- grant count-up ----- */
const num = document.querySelector("[data-count]");
if (num && !reduceMotion) {
  const target = +num.dataset.count;
  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    const start = performance.now();
    const tick = (now) => {
      const k = Math.min((now - start) / 1200, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      num.textContent = "$" + Math.round(target * eased).toLocaleString("en-US");
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.5 }).observe(num);
}

/* ----- hero particles: molecules that bond when they drift close ----- */
(() => {
  const canvas = $("#particles");
  const ctx = canvas.getContext("2d");
  const BOND = 150;
  let w, h, atoms = [], running = true;
  const mouse = { x: -999, y: -999 };

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(90, (w * h) / 12000));
    atoms = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: 3 + Math.random() * 4.5, hot: i % 6 === 0,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const a of atoms) {
      a.x += a.vx; a.y += a.vy;
      if (a.x < 0 || a.x > w) a.vx *= -1;
      if (a.y < 0 || a.y > h) a.vy *= -1;
    }
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      for (let j = i + 1; j < atoms.length; j++) {
        const b = atoms[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < BOND) {
          const hot = a.hot || b.hot;
          ctx.strokeStyle = hot ? `rgba(255,107,1,${0.85 * (1 - d / BOND)})` : `rgba(20,22,27,${0.35 * (1 - d / BOND)})`;
          ctx.lineWidth = hot ? 3 : 2;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
      if (md < 170) {
        ctx.strokeStyle = `rgba(255,107,1,${0.9 * (1 - md / 170)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    for (const a of atoms) {
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fillStyle = a.hot ? "rgba(255,107,1,.95)" : "rgba(20,22,27,.4)";
      ctx.fill();
    }
    if (running && !reduceMotion) requestAnimationFrame(frame);
  }

  const hero = canvas.parentElement;
  hero.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  hero.addEventListener("pointerleave", () => { mouse.x = mouse.y = -999; });
  addEventListener("resize", resize);
  // Pause when the hero is offscreen
  new IntersectionObserver(([e]) => {
    const was = running;
    running = e.isIntersecting;
    if (running && !was && !reduceMotion) requestAnimationFrame(frame);
  }).observe(canvas);

  resize();
  frame();
})();
