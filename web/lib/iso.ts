// @ts-nocheck
// Isometric drawings for the homepage, ported from the design canvas (design/mock/project/IsoScroll + Radar boards).
// Everything is worked out on the server into plain SVG paths; nothing here runs in the browser.

/** The scroll scene's four layers, painted bottom (policies) to top (the online store). */
export function sceneLayers() {
    const s = 0.85, ox = 1000, c = 0.866, n = 0.5, f1 = (v) => v.toFixed(1);
    const mkLayer = (i, oy, plate, meta, draw) => {
      const P = (x, y, z) => [ox + (x - y) * c * s, oy + (x + y) * n * s - z * s];
      const path = (pts) => "M" + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" L") + " Z";
      const open = (pts) => "M" + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" L");
      const shapes = [], texts = [];
      const add = (d, f, st, sw, o, extra) => shapes.push(Object.assign({ d, f, st: st || "none", sw: sw || 0, o: o == null ? 1 : o, dash: "none", c: "", style: "" }, extra || {}));
      const flat = (x, y, z, w, d) => path([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)]);
      const R = (xc, y1, z1, y2, z2) => path([P(xc, y1, z2), P(xc, y2, z2), P(xc, y2, z1), P(xc, y1, z1)]);
      const Lf = (yc, x1, z1, x2, z2) => path([P(x1, yc, z2), P(x2, yc, z2), P(x2, yc, z1), P(x1, yc, z1)]);
      const box = (x, y, z, w, d, h, top, left, rgt, st) => {
        add(path([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)]), left, st, 1);
        add(path([P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)]), rgt, st, 1);
        add(flat(x, y, z + h, w, d), top, st, 1);
        if (w > 10 && d > 10) add(open([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y, z + h)]), "none", "#FFFFFF", 0.8, 0.75);
      };
      const ring = (fn, k) => { const pts = []; for (let a = 0; a < (k || 28); a++) pts.push(fn((a / (k || 28)) * Math.PI * 2)); return pts; };
      const disc = (xc, yc, z, r) => ring((t) => P(xc + r * Math.cos(t), yc + r * Math.sin(t), z));
      const discL = (xc, yc, zc, r) => ring((t) => P(xc + r * Math.cos(t), yc, zc + r * Math.sin(t)));
      const cyl = (xc, yc, z, r, h, top, side, st) => {
        const front = []; for (let a = -45; a <= 135; a += 10) front.push((a * Math.PI) / 180);
        const bot = front.map((t) => P(xc + r * Math.cos(t), yc + r * Math.sin(t), z));
        const tp = front.slice().reverse().map((t) => P(xc + r * Math.cos(t), yc + r * Math.sin(t), z + h));
        add(path(bot.concat(tp)), side, st, 1);
        add(path(disc(xc, yc, z + h, r)), top, st, 1);
      };
      const mTop = (x, y, z) => { const p = P(x, y, z); return `matrix(${f1(c * s * 10) / 10},${f1(n * s * 10) / 10},${f1(-c * s * 10) / 10},${f1(n * s * 10) / 10},${f1(p[0])},${f1(p[1])})`; };
      const mRight = (x, y, z) => { const p = P(x, y, z); return `matrix(${(c * s).toFixed(3)},${(-n * s).toFixed(3)},0,${s.toFixed(3)},${f1(p[0])},${f1(p[1])})`; };
      const mLeft = (x, y, z) => { const p = P(x, y, z); return `matrix(${(c * s).toFixed(3)},${(n * s).toFixed(3)},0,${s.toFixed(3)},${f1(p[0])},${f1(p[1])})`; };
      const txt = (m, str, size, fill) => texts.push({ m, s: str, size, f: fill });
      // the plate
      box(0, 0, 0, 320, 320, 14, plate[0], plate[1], plate[2], plate[3]);
      for (let g = 40; g < 320; g += 40) { add(open([P(g, 0, 14), P(g, 320, 14)]), "none", plate[4], 1); add(open([P(0, g, 14), P(320, g, 14)]), "none", plate[4], 1); }
      for (let g = 20; g < 320; g += 40) { add(open([P(g, 0, 14), P(g, 320, 14)]), "none", plate[4], 0.5, 0.55); add(open([P(0, g, 14), P(320, g, 14)]), "none", plate[4], 0.5, 0.55); }
      add(flat(8, 8, 14.05, 304, 304), "none", plate[3], 0.6, 0.45);
      for (let g = 40; g < 320; g += 40) { add(open([P(g, 320, 14), P(g, 320, 10)]), "none", plate[3], 0.6, 0.8); add(open([P(320, g, 14), P(320, g, 10)]), "none", plate[3], 0.6, 0.8); }
      draw({ P, path, open, add, flat, R, Lf, box, ring, disc, discL, cyl, txt, mTop, mRight, mLeft });
      const anchor = P(0, 320, 7), cardX = 150, cardY = anchor[1] - 42;
      return Object.assign({ cls: "lay l" + i, shapes, texts,
        cx: cardX, cy: cardY, tx: cardX + 18, ty1: cardY + 24, ty2: cardY + 52, ty3: cardY + 72,
        leader: `M${cardX + 280},${f1(cardY + 42)} L${f1(anchor[0])},${f1(anchor[1])}`, dotx: f1(anchor[0]), doty: f1(anchor[1]) }, meta);
    };
    const gap = 150, base = 1000, layers = [];

    // 4. Policies
    layers.push(mkLayer(3, 560, ["#F8FAFF", "#DBEAFE", "#BFDBFE", "#93C5FD", "#E0ECFF"],
      { name: "4 · Policies", stat: "30-day returns", sub: "the most common window", color: "#1D4ED8" }, (g) => {
      for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; g.add(g.open([g.P(90 + 28 * Math.cos(t), 236 + 28 * Math.sin(t), 14.2), g.P(90 + 33 * Math.cos(t), 236 + 33 * Math.sin(t), 14.2)]), "none", "#93C5FD", 1); }
      g.add(g.flat(46, 46, 14.1, 70, 60), "#0F172A", null, 0, 0.07);
      g.box(40, 40, 14, 70, 60, 46, "#F0D9B5", "#D9B27C", "#C99A5B");
      g.add(g.flat(71, 40, 60.1, 8, 60), "#E7C9A0", "#C99A5B", 0.5);
      const arc = []; for (let a = 200; a <= 470; a += 10) { const t = (a * Math.PI) / 180; arc.push(g.P(75 + 20 * Math.cos(t), 70 + 20 * Math.sin(t), 60.4)); }
      g.add(g.open(arc), "none", "#0E7C6B", 3.2);
      const e = arc[arc.length - 1], b = arc[arc.length - 3];
      g.add(g.path([[e[0] + 6, e[1] + 2], [e[0] - 3, e[1] - 6], [e[0] - 3, e[1] + 6]]), "#0E7C6B");
      g.add(g.flat(196, 66, 14.1, 6, 50), "#0F172A", null, 0, 0.08);
      g.box(190, 60, 14, 6, 50, 66, "#2563EB", "#1D4ED8", "#2563EB");
      g.add(g.path([g.P(196.2, 70, 72), g.P(196.2, 100, 72), g.P(196.2, 100, 50), g.P(196.2, 85, 32), g.P(196.2, 70, 50)]), "#FFFFFF");
      g.add(g.open([g.P(196.4, 76, 54), g.P(196.4, 82, 48), g.P(196.4, 94, 62)]), "none", "#0E7C6B", 3);
      for (let k = 0; k < 3; k++) g.add(g.flat(160 + k * 4, 184 - k * 4, 14.5 + k * 2, 72, 92), "#FFFFFF", "#CBD5E1", 1);
      for (let k = 0; k < 6; k++) g.add(g.flat(176, 192 + k * 12, 19.2, k === 0 ? 40 : 50, 3), k === 0 ? "#1D4ED8" : "#CBD5E1");
      g.cyl(90, 236, 14, 22, 8, "#0E7C6B", "#0B6457", "#0B6457");
      g.add(g.open([g.P(80, 236, 22.3), g.P(88, 244, 22.3), g.P(101, 228, 22.3)]), "none", "#FFFFFF", 3);
      g.add(g.Lf(100.2, 71, 14, 79, 60), "#E7C9A0");
      g.add(g.open([g.P(180, 264, 19.3), g.P(186, 259, 19.3), g.P(192, 265, 19.3), g.P(198, 259, 19.3), g.P(208, 263, 19.3)]), "none", "#1D4ED8", 1);
      g.add(g.open([g.P(176, 252, 19.3), g.P(222, 252, 19.3)]), "none", "#94A3B8", 0.6);
      g.add(g.flat(212, 184, 19.25, 14, 14), "none", "#1D4ED8", 0.8);
      g.add(g.open([g.P(196.4, 62, 120), g.P(196.4, 108, 120)]), "none", "#93C5FD", 0.6);
    }));

    // 3. Payment options
    layers.push(mkLayer(2, 410, ["#FFFFFF", "#D5EFEA", "#B5E0D7", "#A7D8CE", "#E3F3EF"],
      { name: "3 · Payment options", stat: "53% offer BNPL", sub: "Afterpay leads, at 463 stores", color: "#0E7C6B" }, (g) => {
      g.add(g.open([g.P(30, 266, 14.2), g.P(202, 266, 14.2)]), "none", "#0E7C6B", 0.8, 1, { dash: "3 4" });
      g.add(g.flat(36, 46, 14.1, 70, 90), "#0F172A", null, 0, 0.06);
      g.box(30, 40, 14, 70, 90, 22, "#475569", "#334155", "#1E293B");
      g.add(g.flat(40, 50, 36.2, 50, 28), "#5EEAD4");
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) g.add(g.flat(42 + k * 16, 88 + r * 12, 36.2, 11, 8), r === 2 && k === 2 ? "#0E7C6B" : "#94A3B8");
      g.add(g.path([g.P(56, 40, 36), g.P(78, 40, 36), g.P(78, 40, 62), g.P(56, 40, 62)]), "#FFFFFF", "#CBD5E1", 1);
      g.add(g.flat(136, 48, 14.1, 100, 63), "#0F172A", null, 0, 0.07);
      g.box(130, 40, 14, 100, 63, 3, "url(#card)", "#1E40AF", "#1E3A8A");
      g.add(g.flat(144, 50, 17.2, 16, 12), "#FBBF24", "#D97706", 0.6);
      for (let k = 0; k < 4; k++) g.add(g.flat(144 + k * 20, 84, 17.2, 15, 3), "#FFFFFF", null, 0, 0.75);
      [30, 76, 122, 168].forEach((x, k) => {
        g.box(x, 222, 14, 34, 34, 8, "#FFFFFF", "#E2E8F0", "#CBD5E1", "#CBD5E1");
        g.add(g.flat(x, 222, 22.1, 34, 34), "#0E7C6B", null, 0, 1, { c: "s-step", style: "animation-delay:" + (k * 0.7).toFixed(1) + "s" });
        g.txt(g.mTop(x + 17, 243, 22.3), String(k + 1), 15, "#0F172A");
      });
      g.add(g.flat(256, 176, 14.1, 18, 80), "#0F172A", null, 0, 0.08);
      g.box(250, 170, 14, 12, 72, 128, "#1E293B", "#0F172A", "#1E293B");
      g.add(g.R(262.2, 176, 24, 236, 136), "url(#screen)");
      g.add(g.R(262.4, 184, 96, 228, 122), "url(#card)");
      g.add(g.path(g.ring((t) => g.P(262.5, 206 + 11 * Math.cos(t), 64 + 11 * Math.sin(t)), 24)), "#0E7C6B");
      g.add(g.open([g.P(262.6, 200, 64), g.P(262.6, 204, 59), g.P(262.6, 213, 69)]), "none", "#FFFFFF", 2.4);
      g.add(g.R(262.4, 190, 38, 222, 44), "#0E7C6B", null, 0, 0.85);
      [56, 51, 46].forEach((z, k) => g.add(g.open([g.P(60, 40.2, z), g.P(k === 2 ? 70 : 74, 40.2, z)]), "none", "#CBD5E1", 0.8));
      g.add(g.open([g.P(144, 56, 17.3), g.P(160, 56, 17.3)]), "none", "#B45309", 0.5);
      g.add(g.open([g.P(152, 50, 17.3), g.P(152, 62, 17.3)]), "none", "#B45309", 0.5);
      [5, 9, 13].forEach((r) => { const pts = []; for (let a = -40; a <= 40; a += 10) { const t = (a * Math.PI) / 180; pts.push(g.P(212 + r * Math.cos(t), 56 + r * Math.sin(t), 17.3)); } g.add(g.open(pts), "none", "#FFFFFF", 0.9, 0.85); });
      g.add(g.open([g.P(144, 96, 17.3), g.P(176, 96, 17.3)]), "none", "#FFFFFF", 0.6, 0.6);
      g.add(g.R(262.3, 200, 129, 212, 131), "#475569");
      g.add(g.open([g.P(30, 130.3, 30), g.P(100, 130.3, 30)]), "none", "#475569", 0.6);
    }));

    // 2. Promotions
    layers.push(mkLayer(1, 260, ["#FFFBEB", "#FDE68A", "#FCD34D", "#F59E0B", "#FEF3C7"],
      { name: "2 · Promotions", stat: "67% on sale", sub: "running an offer right now", color: "#B45309" }, (g) => {
      g.add(g.flat(196, 256, 14.15, 96, 40), "#FFFFFF", "#F59E0B", 1, 1, { dash: "4 3" });
      g.txt(g.mTop(244, 280, 14.3), "CODE: SAVE15", 10, "#B45309");
      [[150, 118, "#F59E0B"], [272, 132, "#3B82F6"], [292, 214, "#0E7C6B"], [28, 140, "#F59E0B"], [130, 262, "#3B82F6"], [146, 160, "#0E7C6B"]].forEach(([x, y, col]) => g.add(g.flat(x, y, 14.2, 6, 6), col, null, 0, 0.8));
      g.add(g.flat(46, 46, 14.1, 90, 54), "#0F172A", null, 0, 0.07);
      g.box(40, 40, 14, 90, 54, 6, "#F59E0B", "#D97706", "#B45309");
      g.add(g.path(g.disc(54, 67, 20.2, 5)), "#FFFBEB");
      g.txt(g.mTop(92, 60, 20.3), "SALE", 18, "#FFFFFF");
      g.txt(g.mTop(92, 80, 20.3), "up to 40% off", 11, "#FFFBEB");
      g.cyl(215, 72, 14, 30, 14, "#FBBF24", "#D97706", "#D97706");
      g.txt(g.mTop(215, 79, 28.3), "%", 26, "#FFFFFF");
      g.box(170, 160, 14, 96, 84, 10, "#FFFFFF", "#F1F5F9", "#E2E8F0", "#CBD5E1");
      g.add(g.flat(170, 160, 24.1, 96, 18), "#D97706");
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) g.add(g.flat(178 + k * 22, 184 + r * 19, 24.2, 16, 13), r === 1 && k === 2 ? "#F59E0B" : "#F1F5F9", "#E2E8F0", 0.6);
      g.add(g.flat(64, 196, 14.1, 50, 50), "#0F172A", null, 0, 0.07);
      g.box(58, 190, 14, 50, 50, 40, "#3B82F6", "#2563EB", "#1D4ED8");
      g.add(g.flat(79, 190, 54.1, 8, 50), "#FBBF24");
      g.add(g.flat(58, 211, 54.1, 50, 8), "#FBBF24");
      g.add(g.Lf(240.2, 79, 14, 87, 54), "#FBBF24");
      g.add(g.R(108.2, 211, 14, 219, 54), "#F59E0B");
      g.add(g.path(g.disc(76, 207, 55, 7)), "#F59E0B", "#D97706", 1);
      g.add(g.path(g.disc(90, 222, 55, 7)), "#F59E0B", "#D97706", 1);
      g.add(g.open([g.P(54, 67, 20.3), g.P(40, 58, 18), g.P(30, 60, 14.3)]), "none", "#92400E", 0.8);
      [196, 240].forEach((x) => g.add(g.open([g.P(x, 166, 24.3), g.P(x, 166, 31)]), "none", "#334155", 1.6));
      g.add(g.open([g.P(48, 94.2, 20), g.P(126, 94.2, 20)]), "none", "#FFFFFF", 0.6, 0.6);
      g.add(g.path(g.disc(215, 72, 14.2, 34)), "none", "#D97706", 0.6, 0.5);
    }));

    // top: the online store (the phone screen lands on this plate)
    layers.push(mkLayer(0, 110, ["#FFFFFF", "#E2E8F0", "#CBD5E1", "#CBD5E1", "#EEF2F6"], {}, (g) => {
      g.add(g.flat(92, 18, 14.1, 152, 300), "#0F172A", null, 0, 0.08);
      g.box(84, 10, 14, 152, 300, 10, "#1E293B", "#0F172A", "#334155");
      g.add(g.flat(22, 46, 14.1, 40, 40), "#0F172A", null, 0, 0.07);
      g.box(16, 40, 14, 40, 40, 30, "#0E7C6B", "#0B6457", "#095247");
      g.add(g.flat(32, 40, 44.15, 4, 40), "#0B6457");
      g.box(20, 100, 14, 34, 34, 44, "#3B82F6", "#2563EB", "#1D4ED8");
      g.add(g.open([g.P(24, 134.3, 50), g.P(48, 134.3, 50)]), "none", "#FFFFFF", 0.8, 0.8);
      g.box(18, 154, 14, 38, 38, 22, "#FBBF24", "#F59E0B", "#D97706");
      g.add(g.flat(254, 196, 14.1, 56, 40), "#0F172A", null, 0, 0.07);
      g.box(250, 190, 28, 56, 40, 24, "#F1F5F9", "#FFFFFF", "#E2E8F0", "#94A3B8");
      for (let k = 1; k < 5; k++) g.add(g.open([g.P(250 + k * 11, 230, 28), g.P(250 + k * 11, 230, 52)]), "none", "#CBD5E1", 1);
      g.box(258, 196, 52, 16, 16, 10, "#0E7C6B", "#0B6457", "#095247");
      g.box(278, 202, 52, 14, 14, 13, "#F59E0B", "#D97706", "#B45309");
      g.add(g.open([g.P(306, 192, 52), g.P(314, 188, 66), g.P(320, 188, 66)]), "none", "#334155", 2.4);
      g.add(g.open([g.P(254, 230, 28), g.P(254, 230, 20)]), "none", "#334155", 2);
      g.add(g.open([g.P(302, 230, 28), g.P(302, 230, 20)]), "none", "#334155", 2);
      g.add(g.path(g.discL(258, 230.2, 19, 5)), "#1E293B");
      g.add(g.path(g.discL(298, 230.2, 19, 5)), "#1E293B");
      g.add(g.open([g.P(278, 238, 14.2), g.P(278, 256, 14.2)]), "none", "#94A3B8", 0.8, 1, { dash: "3 4" });
      g.box(246, 258, 14, 68, 44, 6, "#0E7C6B", "#0B6457", "#095247");
      g.txt(g.mTop(280, 281, 20.3), "Checkout", 11, "#FFFFFF");
    }));

    const slot = [3, 2, 1, 0];
    return layers.map((L, i) => ({ shapes: L.shapes, texts: L.texts, inc: "s-in" + (slot[i] === 0 ? "T" : slot[i]), fo: "s-fo s-fo" + slot[i] }));
}

/** Nine plates in a 3 x 3 grid, one per industry, each a list of paths, painted back to front. */
export function industryPlates(counts: Record<string, number>) {
    const s = 0.8, c = 0.866, n = 0.5, ox = 720, oy = 70, f1 = (v) => v.toFixed(1);
    let shapes = [], texts = [];
    let TX = 0, TY = 0;
    const P = (x, y, z) => [ox + (x + TX - (y + TY)) * c * s, oy + (x + TX + y + TY) * n * s - z * s];
    const path = (pts) => "M" + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" L") + " Z";
    const open = (pts) => "M" + pts.map((p) => f1(p[0]) + "," + f1(p[1])).join(" L");
    const add = (d, f, st, sw, o) => shapes.push({ d, f, st: st || "none", sw: sw || 0, o: o == null ? 1 : o });
    const flat = (x, y, z, w, d) => path([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)]);
    const Lf = (yc, x1, z1, x2, z2) => path([P(x1, yc, z2), P(x2, yc, z2), P(x2, yc, z1), P(x1, yc, z1)]);
    const Rf = (xc, y1, z1, y2, z2) => path([P(xc, y1, z2), P(xc, y2, z2), P(xc, y2, z1), P(xc, y1, z1)]);
    const box = (x, y, z, w, d, h, top, left, rgt, st) => {
      add(path([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)]), left, st, 0.8);
      add(path([P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)]), rgt, st, 0.8);
      add(flat(x, y, z + h, w, d), top, st, 0.8);
      if (w > 8 && d > 8) add(open([P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y, z + h)]), "none", "#FFFFFF", 0.7, 0.7);
    };
    const ring = (fn, k) => { const pts = []; for (let a = 0; a < k; a++) pts.push(fn((a / k) * Math.PI * 2)); return pts; };
    const disc = (x, y, z, r) => ring((t) => P(x + r * Math.cos(t), y + r * Math.sin(t), z), 32);
    const discL = (x, y, z, r) => ring((t) => P(x + r * Math.cos(t), y, z + r * Math.sin(t)), 32);
    const cyl = (x, y, z, r, h, top, side, st) => {
      const fr = []; for (let a = -45; a <= 135; a += 9) fr.push((a * Math.PI) / 180);
      add(path(fr.map((t) => P(x + r * Math.cos(t), y + r * Math.sin(t), z)).concat(fr.slice().reverse().map((t) => P(x + r * Math.cos(t), y + r * Math.sin(t), z + h)))), side, st, 0.8);
      add(path(disc(x, y, z + h, r)), top, st, 0.8);
      add(open(fr.slice(0, 12).map((t) => P(x + r * 0.96 * Math.cos(t), y + r * 0.96 * Math.sin(t), z + h))), "none", "#FFFFFF", 0.7, 0.6);
    };
    const shadow = (x, y, w, d) => add(flat(x + 4, y + 4, 10.05, w, d), "#0F172A", null, 0, 0.07);
    const mTop = (x, y, z) => { const p = P(x, y, z); return `matrix(${(c * s).toFixed(3)},${(n * s).toFixed(3)},${(-c * s).toFixed(3)},${(n * s).toFixed(3)},${f1(p[0])},${f1(p[1])})`; };
    const mRight = (x, y, z) => { const p = P(x, y, z); return `matrix(${(c * s).toFixed(3)},${(-n * s).toFixed(3)},0,${s.toFixed(3)},${f1(p[0])},${f1(p[1])})`; };
    const txt = (m, str, size, fill, w) => texts.push({ m, s: str, size, f: fill, w: w || 800 });

    const draw = {
      Fashion: () => {
        shadow(20, 30, 50, 40);
        box(20, 30, 10, 50, 40, 6, "#FEF3C7", "#FDE68A", "#FCD34D", "#F59E0B");
        box(22, 31, 16, 48, 38, 6, "#FDBA74", "#FB923C", "#F97316", "#EA580C");
        box(20, 30, 22, 50, 40, 6, "#B45309", "#92400E", "#78350F");
        add(open([P(20, 70, 25), P(70, 70, 25)]), "none", "#FDE68A", 0.6);
        shadow(84, 28, 32, 22);
        box(84, 28, 10, 32, 22, 42, "#FFFFFF", "#F8FAFC", "#E2E8F0", "#CBD5E1");
        add(Lf(50.2, 84, 34, 116, 40), "#B45309");
        add(open(ring((t) => P(100 + 8 * Math.cos(t), 50.3, 52 + 8 * Math.sin(t)), 24).slice(0, 13)), "none", "#334155", 1.8);
      },
      Homewares: () => {
        shadow(24, 28, 28, 28);
        cyl(38, 42, 10, 11, 4, "#334155", "#1E293B");
        add(open([P(38, 42, 14), P(38, 42, 44)]), "none", "#334155", 2.2);
        cyl(38, 42, 44, 19, 16, "#FEF3C7", "#FCD34D", "#F59E0B");
        shadow(90, 26, 20, 20);
        cyl(100, 36, 10, 10, 28, "#1D4ED8", "#1E40AF");
        cyl(100, 36, 38, 5, 6, "#3B82F6", "#1D4ED8");
        add(open([P(100, 36, 44), P(96, 32, 60), P(92, 30, 66)]), "none", "#15803D", 1.6);
        add(open([P(100, 36, 44), P(106, 34, 62)]), "none", "#15803D", 1.6);
        shadow(58, 62, 38, 26);
        box(58, 62, 10, 38, 26, 9, "#DBEAFE", "#BFDBFE", "#93C5FD", "#93C5FD");
        add(open([P(62, 75, 19.2), P(92, 75, 19.2)]), "none", "#93C5FD", 0.6);
      },
      Beauty: () => {
        shadow(26, 36, 18, 18);
        cyl(35, 45, 10, 8, 18, "#1E293B", "#0F172A");
        cyl(35, 45, 28, 6, 8, "#E5E7EB", "#9CA3AF");
        cyl(35, 45, 36, 5, 10, "#DB2777", "#BE185D");
        shadow(58, 28, 26, 26);
        cyl(70, 40, 10, 14, 13, "#FCE7F3", "#F9A8D4", "#F472B6");
        cyl(70, 40, 23, 14.5, 5, "#DB2777", "#BE185D");
        shadow(96, 30, 22, 16);
        box(96, 30, 10, 22, 16, 36, "#FFFFFF", "#FDF2F8", "#FBCFE8", "#F9A8D4");
        add(Lf(46.2, 100, 20, 114, 36), "#FCE7F3", "#F9A8D4", 0.6);
        cyl(107, 38, 46, 4, 9, "#1E293B", "#0F172A");
      },
      "Baby & kids": () => {
        shadow(24, 36, 54, 28);
        box(24, 36, 10, 26, 26, 26, "#DDD6FE", "#A78BFA", "#8B5CF6", "#7C3AED");
        txt(mRight(50.3, 49, 31), "A", 17, "#FFFFFF");
        box(54, 38, 10, 26, 26, 26, "#FEF3C7", "#FBBF24", "#F59E0B", "#D97706");
        txt(mRight(80.3, 51, 31), "B", 17, "#FFFFFF");
        box(38, 36, 36, 26, 26, 26, "#CCFBF1", "#2DD4BF", "#14B8A6", "#0D9488");
        txt(mRight(64.3, 49, 57), "C", 17, "#FFFFFF");
        shadow(96, 40, 22, 22);
        const b = P(106, 50, 19), r = 10 * s;
        add(path(ring((t) => [b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)], 32)), "#EF4444");
        add(path(ring((t) => [b[0] + r * 0.98 * Math.cos(t), b[1] + r * 0.35 * Math.sin(t)], 32)), "#FFFFFF", null, 0, 0.9);
        add(path(ring((t) => [b[0] - 3 + 2.2 * Math.cos(t), b[1] - 4 + 2.2 * Math.sin(t)], 16)), "#FFFFFF", null, 0, 0.7);
      },
      "Sports & outdoors": () => {
        add(flat(20, 26, 10.05, 66, 56), "#0F172A", null, 0, 0.07);
        add(path([P(20, 78, 10), P(80, 78, 10), P(80, 52, 46), P(20, 52, 46)]), "#22C55E", "#15803D", 0.8);
        add(path([P(80, 26, 10), P(80, 78, 10), P(80, 52, 46)]), "#15803D", "#166534", 0.8);
        add(path([P(80.2, 44, 10), P(80.2, 60, 10), P(80.2, 52, 30)]), "#14532D");
        add(open([P(20, 52, 46), P(80, 52, 46)]), "none", "#BBF7D0", 1);
        add(open([P(80, 52, 46), P(86, 52, 54)]), "none", "#334155", 1.4);
        add(open([P(30, 78, 10), P(30, 78, 30)]), "none", "#BBF7D0", 0.6, 0.7);
        add(open([P(50, 78, 10), P(50, 78, 33)]), "none", "#BBF7D0", 0.6, 0.7);
        shadow(102, 34, 20, 20);
        const b = P(112, 44, 19), r = 10 * s;
        add(path(ring((t) => [b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)], 32)), "#F59E0B", "#D97706", 0.8);
        add(open([[b[0] - r, b[1]], [b[0] + r, b[1]]]), "none", "#92400E", 0.8);
        add(open(ring((t) => [b[0] + r * 0.45 * Math.cos(t), b[1] + r * Math.sin(t)], 24).slice(6, 19)), "none", "#92400E", 0.8);
      },
      Jewellery: () => {
        shadow(24, 36, 40, 40);
        box(24, 36, 10, 40, 40, 20, "#0E7C6B", "#0B6457", "#095247");
        add(Lf(36, 24, 30, 64, 60), "#0B6457", "#095247", 0.8);
        add(Lf(36.1, 28, 34, 60, 56), "#F8FAFC");
        add(flat(30, 50, 30.1, 28, 16), "#F1F5F9", "#CBD5E1", 0.6);
        add(open(ring((t) => P(44 + 7 * Math.cos(t), 58, 38 + 7 * Math.sin(t)), 28).concat([P(51, 58, 38)])), "none", "#EAB308", 2.4);
        const g = P(44, 58, 47.5);
        add(path([[g[0], g[1] - 6], [g[0] + 4, g[1] - 2], [g[0], g[1] + 3], [g[0] - 4, g[1] - 2]]), "#E0F2FE", "#7DD3FC", 0.8);
        shadow(92, 44, 22, 22);
        const q = P(102, 54, 22);
        add(path([[q[0] - 11, q[1] - 4], [q[0] - 6, q[1] - 10], [q[0] + 6, q[1] - 10], [q[0] + 11, q[1] - 4], [q[0], q[1] + 10]]), "#5EEAD4", "#0E7C6B", 0.9);
        add(open([[q[0] - 11, q[1] - 4], [q[0] + 11, q[1] - 4]]), "none", "#0E7C6B", 0.7);
        add(open([[q[0] - 6, q[1] - 10], [q[0] - 3, q[1] - 4], [q[0], q[1] + 10], [q[0] + 3, q[1] - 4], [q[0] + 6, q[1] - 10]]), "none", "#0E7C6B", 0.6);
      },
      Health: () => {
        shadow(22, 32, 48, 38);
        box(22, 32, 10, 48, 38, 26, "#FFFFFF", "#F8FAFC", "#E2E8F0", "#CBD5E1");
        add(flat(41, 39, 36.1, 10, 24), "#DC2626");
        add(flat(34, 46, 36.1, 24, 10), "#DC2626");
        add(Lf(70.2, 22, 26, 70, 30), "#DC2626", null, 0, 0.85);
        add(open([P(40, 51, 36.2), P(40, 51, 42), P(52, 51, 42), P(52, 51, 36.2)]), "none", "#94A3B8", 1.6);
        shadow(88, 38, 24, 24);
        cyl(100, 50, 10, 12, 28, "#F59E0B", "#D97706", "#B45309");
        add(path((() => { const fr = []; for (let a = -45; a <= 135; a += 9) fr.push((a * Math.PI) / 180); return fr.map((t) => P(100 + 12.05 * Math.cos(t), 50 + 12.05 * Math.sin(t), 16)).concat(fr.slice().reverse().map((t) => P(100 + 12.05 * Math.cos(t), 50 + 12.05 * Math.sin(t), 30))); })()), "#FFFFFF", null, 0, 0.95);
        cyl(100, 50, 38, 12.5, 7, "#FFFFFF", "#E2E8F0", "#CBD5E1");
        add(path(disc(84, 84, 10.2, 4)), "#0891B2");
        add(path(disc(94, 90, 10.2, 4)), "#22D3EE");
      },
      Electronics: () => {
        shadow(18, 30, 62, 44);
        box(18, 30, 10, 62, 44, 3, "#E2E8F0", "#CBD5E1", "#94A3B8", "#94A3B8");
        add(flat(24, 36, 13.1, 50, 22), "#CBD5E1", "#94A3B8", 0.5);
        for (let k = 1; k < 5; k++) add(open([P(24, 36 + k * 4.4, 13.2), P(74, 36 + k * 4.4, 13.2)]), "none", "#94A3B8", 0.4);
        add(flat(40, 62, 13.1, 18, 8), "#CBD5E1", "#94A3B8", 0.5);
        add(Lf(30, 18, 13, 80, 52), "#334155", "#1E293B", 0.8);
        add(Lf(30.1, 22, 16, 76, 49), "#0EA5E9");
        add(Lf(30.2, 26, 40, 60, 44), "#FFFFFF", null, 0, 0.8);
        add(Lf(30.2, 26, 32, 70, 35), "#BAE6FD");
        add(Lf(30.2, 26, 24, 50, 27), "#BAE6FD");
        shadow(96, 40, 18, 34);
        box(96, 40, 10, 18, 34, 3, "#1E293B", "#0F172A", "#334155");
        add(flat(98, 43, 13.1, 14, 28), "#38BDF8");
        add(flat(101, 46, 13.2, 8, 6), "#FFFFFF", null, 0, 0.7);
      },
      Pet: () => {
        shadow(20, 36, 40, 40);
        cyl(40, 56, 10, 20, 10, "#C2410C", "#9A3412");
        add(path(disc(40, 56, 20.1, 15)), "#7C2D12");
        [[34, 52], [42, 50], [46, 58], [36, 60], [41, 55], [48, 52], [31, 57]].forEach(([x, y]) => add(path(disc(x, y, 20.4, 2.2)), "#B45309"));
        shadow(94, 22, 26, 18);
        box(94, 22, 10, 26, 18, 38, "#FDBA74", "#FB923C", "#EA580C");
        add(Lf(40.2, 98, 22, 116, 38), "#FFFFFF");
        const p = P(107, 40.3, 30);
        [[0, 0, 2.4], [-3, -4, 1.3], [0, -5, 1.3], [3, -4, 1.3]].forEach(([dx, dy, r]) => add(path(ring((t) => [p[0] + dx + r * Math.cos(t), p[1] + dy + r * Math.sin(t)], 14)), "#C2410C"));
        add(flat(76, 76, 10.15, 30, 7), "#FFFFFF", "#CBD5E1", 0.7);
        [[76, 76], [76, 83], [106, 76], [106, 83]].forEach(([x, y]) => add(path(disc(x, y, 10.2, 4)), "#FFFFFF", "#CBD5E1", 0.7));
      },
    };
    const inds = [["Fashion", 0, "#B45309", "#FEF3C7", "#FDE68A"], ["Homewares", 0, "#1D4ED8", "#DBEAFE", "#BFDBFE"], ["Beauty", 0, "#BE185D", "#FCE7F3", "#FBCFE8"],
      ["Baby & kids", 0, "#7C3AED", "#EDE9FE", "#DDD6FE"], ["Sports & outdoors", 0, "#15803D", "#DCFCE7", "#BBF7D0"], ["Jewellery", 0, "#0E7C6B", "#CCFBF1", "#99F6E4"],
      ["Health", 0, "#0E7490", "#CFFAFE", "#A5F3FC"], ["Electronics", 0, "#475569", "#E2E8F0", "#CBD5E1"], ["Pet", 0, "#C2410C", "#FFEDD5", "#FED7AA"]];
    const cells = inds.map((d, i) => ({ d, gx: i % 3, gy: Math.floor(i / 3) })).sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx);
    const SLUG = { Fashion: "fashion", Homewares: "homewares", Beauty: "beauty", "Baby & kids": "baby-kids", "Sports & outdoors": "sports-outdoors", Jewellery: "jewellery", Health: "health", Electronics: "electronics", Pet: "pet" };
    inds.forEach((d) => (d[1] = counts[SLUG[d[0]]] || 0));
    const plates = [];
    cells.forEach(({ d, gx, gy }) => {
      shapes = []; texts = [];
      TX = gx * 172; TY = gy * 172;
      const [name, cnt, col, side1, side2] = d;
      add(flat(6, 6, 0, 140, 140), "#0F172A", null, 0, 0.05);
      box(0, 0, 0, 140, 140, 10, "#FFFFFF", side1, side2, "#E2E8F0");
      for (let g = 20; g < 140; g += 20) { add(open([P(g, 0, 10), P(g, 100, 10)]), "none", "#F1F5F9", 0.6); add(open([P(0, g, 10), P(140, g, 10)]), "none", g < 100 ? "#F1F5F9" : "none", 0.6); }
      add(open([P(8, 100, 10.05), P(132, 100, 10.05)]), "none", "#E2E8F0", 0.8);
      draw[name]();
      txt(mTop(70, 116, 10.2), name, 12.5, "#0F172A", 800);
      txt(mTop(70, 130, 10.2), cnt + " stores", 10.5, col, 600);
      plates.push({ slug: SLUG[name], name, n: cnt, shapes, texts });
    });
    return plates;
}
