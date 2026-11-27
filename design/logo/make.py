INK = "#15171C"; BG = "#F6F5F1"; TEAL = "#0E6B62"; LT = "#8FC9C0"; MUTED = "#5B616E"


def svg(body, size, label):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 64 64" role="img" aria-label="{label}">{body}</svg>'


def pulse(ink, acc):
    return (f'<path d="M10 16 H54 M10 30 H40" stroke="{ink}" stroke-width="5" stroke-linecap="round" fill="none"/>'
            f'<path d="M10 46 H24 L30 36 L36 56 L42 46 H54" stroke="{acc}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')


def scope(ink, acc):
    return (f'<circle cx="31" cy="33" r="23" stroke="{ink}" stroke-width="5" fill="none"/>'
            f'<path d="M20 26 H42 M20 34 H37 M20 42 H31" stroke="{ink}" stroke-width="4.5" stroke-linecap="round" fill="none"/>'
            f'<circle cx="49" cy="15" r="6" fill="{acc}"/>')


def live(ink, acc):
    return f'<circle cx="32" cy="32" r="21" stroke="{ink}" stroke-width="6" fill="none"/><circle cx="32" cy="32" r="8" fill="{acc}"/>'


def changed(tile, line, acc):
    return (f'<rect x="2" y="2" width="60" height="60" rx="14" fill="{tile}"/>'
            f'<path d="M15 20 H43 M15 44 H35" stroke="{line}" stroke-width="5" stroke-linecap="round" fill="none"/>'
            f'<path d="M15 32 H50" stroke="{acc}" stroke-width="5" stroke-linecap="round" fill="none"/>')


C = [
    ("Pulse", "Log lines, and the last one comes alive. The story in one mark: records that start to behave like a living thing.",
     lambda s: svg(pulse(INK, TEAL), s, "Pulse mark"), lambda s: svg(pulse(BG, LT), s, "Pulse mark, dark")),
    ("Scope", "A lens over stacked records, with a dot of awareness at the edge. Nods to “scope”, and reads as watching closely.",
     lambda s: svg(scope(INK, TEAL), s, "Scope mark"), lambda s: svg(scope(BG, LT), s, "Scope mark, dark")),
    ("Live dot", "A ring with a live dot, the same signal the site already shows next to “Checked”. It can stand in for the o in Logs.",
     lambda s: svg(live(INK, TEAL), s, "Live dot mark"), lambda s: svg(live(BG, LT), s, "Live dot mark, dark")),
    ("Changed line", "Three records; the middle one changed. Change history is the core of the product, so the mark is a change.",
     lambda s: svg(changed(INK, BG, LT), s, "Changed line mark"), lambda s: svg(changed(BG, INK, TEAL), s, "Changed line mark, inverted")),
]
WORD = "font-family:'Space Grotesk',sans-serif;font-weight:600;letter-spacing:-0.5px"


def tile(i, c):
    name, why, light, dark = c
    if name == "Live dot":
        lock = (f'<div style="display:flex;align-items:center;gap:1px;{WORD};font-size:30px;color:{INK}">'
                f'<span>SentientL</span>{svg(live(INK, TEAL), 25, "o")}<span>gs</span></div>')
    else:
        lock = f'<div style="display:flex;align-items:center;gap:12px">{light(44)}<span style="{WORD};font-size:30px;color:{INK}">SentientLogs</span></div>'
    darklock = f'<div style="display:flex;align-items:center;gap:12px">{dark(36)}<span style="{WORD};font-size:24px;color:{BG}">SentientLogs</span></div>'
    return f'''<section style="background:#FFFFFF;border:1px solid #E2E0D8;border-radius:16px;padding:32px;display:flex;flex-direction:column;gap:22px">
<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0;font-family:'Space Grotesk',sans-serif;font-size:24px;color:{INK}">{chr(65 + i)}. {name}</h2><span style="display:flex;align-items:center;gap:8px;font-size:13px;color:{MUTED}">Favicon {light(32)} {light(16)}</span></div>
<div style="display:flex;gap:28px;align-items:center">{light(120)}<div style="display:flex;flex-direction:column;gap:16px">{lock}<div style="background:{INK};border-radius:10px;padding:14px 18px">{darklock}</div></div></div>
<p style="margin:0;font-size:15px;line-height:1.5;color:#3D424C">{why}</p>
</section>'''


tiles = "\n".join(tile(i, c) for i, c in enumerate(C))
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SentientLogs logo concepts</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Space+Grotesk:wght@500;600;700&amp;display=swap">
<style>
body{{margin:0}}
a{{color:#0E6B62}}a:hover{{color:#0A4F48}}
</style>
</helmet>
<div style="width:1440px;box-sizing:border-box;padding:56px 64px;background:{BG};font-family:Inter,sans-serif;display:flex;flex-direction:column;gap:28px">
<div style="display:flex;flex-direction:column;gap:8px"><h1 style="margin:0;font-family:'Space Grotesk',sans-serif;font-size:44px;letter-spacing:-1px;color:{INK}">SentientLogs logo concepts</h1>
<p style="margin:0;font-size:17px;color:#3D424C;max-width:900px">Four directions in the site's own colours (ink #15171C, teal #0E6B62, paper #F6F5F1) and its heading font, Space Grotesk. Each is shown large, as a lockup on light and dark, and at favicon size.</p></div>
<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:24px">
{tiles}
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":1060}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>'''
open("project/Main.dc.html", "w").write(html)
print(len(html))
