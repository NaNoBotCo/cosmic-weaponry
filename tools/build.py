#!/usr/bin/env python3
"""build.py — writes docs/index.html (English), docs/th/index.html (Thai), sitemap.xml, robots.txt,
llms.txt and icon.svg. All copy, both languages, is in copy_text.py; photo credits in credits.json.

Run:  python3 tools/build.py
"""
import html
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from copy_text import UI, NAV, WORDS, SOURCES  # noqa: E402

DOCS = os.path.join(HERE, "..", "docs")
BASE = "https://nanobotco.github.io/cosmic-weaponry/"
SITE = "Cosmic Weaponry, Drawn · อาวุธเทพ วาดด้วยคณิต"
E = html.escape
CSS = open(os.path.join(HERE, "site.css")).read()
PHOTOS = {p["key"]: p for p in json.load(open(os.path.join(HERE, "credits.json")))}
GOOGLE_ESCAPE = '<script>if(/[.]translate[.]goog$/.test(location.hostname))location.replace("https://"+location.hostname.slice(0,-15).replace(/--/g,"~").replace(/-/g,".").replace(/~/g,"-")+location.pathname+location.search.replace(/([?&])_x_tr_[^&]*/g,"$1").replace(/[?&]+$/,"").replace(/[?]&+/,"?")+location.hash)</script>'


def paras(ps):
    return "".join(f"<p>{p}</p>" for p in ps)


def rng(id_, label, lo, hi, step, val):
    return f'<label class="lab" for="{id_}">{E(label)} <b id="{id_}v"></b></label><input id="{id_}" type="range" min="{lo}" max="{hi}" step="{step}" value="{val}">'


def ro(*pairs):
    return '<div class="readout">' + "".join(f'<div><span>{E(a)}</span><b id="{b}">–</b></div>' for a, b in pairs) + "</div>"


def btn(id_, label, hot=False, pressed=None, cls=""):
    p = f' aria-pressed="{pressed}"' if pressed is not None else ""
    return f'<button id="{id_}" class="pill{" hot" if hot else ""}{" " + cls if cls else ""}" type="button"{p}>{E(label)}</button>'


def sec(id_, cls, kick, h, body):
    return f'<section id="{id_}" class="sec {cls}"><div class="in">{f"<p class=kick>{kick}</p>" if kick else ""}<h2>{h}</h2>{body}</div></section>\n'


def figs(u, root, keys, cls="ph"):
    out = []
    for k in keys:
        p = PHOTOS[k]
        licl = f'<a href="{p["license_url"]}">{E(p["license"])}</a>' if p.get("license_url") else E(p["license"])
        cap = u["photo"][k]
        out.append(f'<figure><img class="nat" loading="lazy" src="{root}img/{p["file"]}" width="{p["width"]}" height="{p["height"]}" alt="{E(cap)}"><figcaption>{E(cap)} <a href="{p["commons_page"]}">{E(p["author"])}</a> · {licl}</figcaption></figure>')
    return f'<div class="{cls}">{"".join(out)}</div>'


def page(lang):
    u = UI[lang]
    root = "" if lang == "en" else "../"
    url = BASE if lang == "en" else BASE + "th/"
    js = dict(u["js"])
    for k in ("s_things", "x_earth", "x_sky", "x_odd", "x_hexa", "x_atax", "m_tap1", "m_tap2", "f_pump", "m_mek", "m_ram", "m_you"):
        js[k] = u[k]
    js["lang"] = lang
    nav = "".join(f'<a href="#{a}">{E(b)}</a>' for a, b in zip(NAV, u["nav"]))
    ol = u["lang_other"]
    head = f'''<!doctype html><html lang="{lang}" translate="no" class="notranslate"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="google" content="notranslate">
{GOOGLE_ESCAPE}
<title>{E(u["title"])} · {E(u["other_title"])}</title>
<meta name="description" content="{E(u["desc"])}">
<meta name="theme-color" content="#0a0f1f">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{BASE}"><link rel="alternate" hreflang="th" href="{BASE}th/"><link rel="alternate" hreflang="x-default" href="{BASE}">
<meta property="og:type" content="website"><meta property="og:site_name" content="{SITE}">
<meta property="og:title" content="{E(u["title"])}"><meta property="og:description" content="{E(u["desc"])}"><meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}card.jpg"><meta property="og:image:secure_url" content="{BASE}card.jpg"><meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{E(u["card_alt"])}">
<meta property="og:locale" content="{"en_US" if lang == "en" else "th_TH"}"><meta property="og:locale:alternate" content="{"th_TH" if lang == "en" else "en_US"}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{BASE}card.jpg">
<link rel="icon" href="{root}icon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="{BASE}llms.txt" title="llms.txt">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Noto+Sans+Thai:wght@400;600;700&family=Noto+Serif+Thai:wght@600;700&display=swap" rel="stylesheet">
<script>if(/[?&]card/.test(location.search))document.documentElement.classList.add("card")</script>
<style>{CSS}</style>
</head><body>
<header class="top"><div class="in"><a class="brand" href="#top"><img src="{root}icon.svg" width="28" height="28" alt=""><span>{E(u["title"])}</span></a>
<nav aria-label="{E(u["nav_label"])}">{nav}</nav>
<span class="lang"><b>{E(u["lang_this"])}</b> | <a href="{ol[0]}" hreflang="{ol[2]}">{E(ol[1])}</a></span></div></header>
'''
    hero = f'''<section id="top" class="hero"><canvas id="scene" role="img" aria-label="{E(u["hero_alt"])}"></canvas>
<div class="hero-t"><p class="kick">{E(u["kicker"])}</p><h1>{E(u["title"])}</h1><p class="lede">{E(u["lede"])}</p>
<p class="go"><a class="pill hot" href="#vajra">{E(u["hero_go"])}</a></p>
<p class="cardline">{E(u["other_title"])} · {E(u["cardline"])}<br><span>nanobotco.github.io/cosmic-weaponry</span></p></div></section>
'''
    what = sec("what", "", E(u["what_kick"]), E(u["what_h"]), paras(u["what_p"]))

    vajra = sec("vajra", "dark", E(u["vajra_kick"]), E(u["vajra_h"]), f'''<div class="two"><div><canvas id="vjcv" class="cv vj" role="img" aria-label="{E(u["vajra_h"])}"></canvas></div>
<div>{paras(u["vajra_p"])}{rng("vprong", u["v_prongs"], 1, 9, 1, 5)}
<div class="btns">{btn("vspin", u["v_spin"], pressed="true")}{btn("vstrike", u["v_strike"], hot=True)}</div>
{ro((u["v_sym"], "vsym"), (u["v_curves"], "vcurves"), (u["v_ends"], "vends"))}<p class="note">{u["vajra_note"]}</p></div></div>''')

    bell = sec("bell", "", E(u["bell_kick"]), E(u["bell_h"]), f'''<div class="two"><div>{paras(u["bell_p"])}</div>
<div><canvas id="bellcv" class="cv bell" role="img" aria-label="{E(u["b_ring"])}"></canvas>
<div class="btns">{btn("bring", u["b_ring"], hot=True)}</div><p class="note">{u["bell_note"]}</p></div></div>
{figs(u, root, ["vajra", "sankosho", "bell", "vajrapani"], "ph four")}''')

    bolt = sec("bolt", "night", E(u["bolt_kick"]), E(u["bolt_h"]), f'''<div class="two"><div><canvas id="boltcv" class="cv bolt" role="img" aria-label="{E(u["bolt_h"])}"></canvas></div>
<div>{paras(u["bolt_p"])}{rng("leta", u["l_eta"], 0, 4, 0.1, 1)}
<div class="btns">{btn("lgrow", u["l_grow"], hot=True)}</div>
{ro((u["l_steps"], "lsteps"), (u["l_tips"], "ltips"), (u["l_dim"], "ldim"))}<p class="note">{u["bolt_note"]}</p></div></div>
{figs(u, root, ["fulgurite"], "ph one")}''')

    mek = sec("mekhala", "dark", E(u["mek_kick"]), E(u["mek_h"]), f'''{paras(u["mek_p"][:2])}
<canvas id="mekcv" class="cv mek" role="img" aria-label="{E(u["mek_h"])}"></canvas>
<div class="two" style="margin-top:14px;align-items:start"><div>{rng("mdist", u["m_dist"], 0.5, 20, 0.1, 5)}
<div class="btns">{btn("mflash", u["m_flash"], hot=True)}</div>
{ro((u["m_light"], "mlight"), (u["m_delay"], "mdelay"), (u["m_km"], "mkm"))}</div>
<div><p class="lab">{E(u["m_count"])}</p><div class="btns">{btn("mtap", u["m_tap1"], cls="tapbig")}</div>{ro((u["m_delay"], "mtd"), (u["m_km"], "mtk"))}</div></div>
<p class="note">{u["mek_note"]}</p>{paras(u["mek_p"][2:])}
{figs(u, root, ["mekhala", "rammasun"])}''')

    skyaxe = sec("skyaxe", "", E(u["ax_kick"]), E(u["ax_h"]), f'''{paras(u["ax_p"][:2])}
{figs(u, root, ["axe", "dagger"])}
<div class="two" style="margin-top:28px"><div><canvas id="widcv" class="cv wid" role="img" aria-label="{E(u["ax_h"])}"></canvas></div>
<div>{paras(u["ax_p"][2:])}{rng("xni", u["x_ni"], 0, 30, 0.1, 10.8)}{rng("xang", u["x_angle"], 0, 90, 1, 30)}
<p class="lab">{E(u["x_verdict"])}</p><p class="verdict" id="xverdict"></p>{ro((u["x_bands"], "xbands"))}<p class="note">{u["ax_note"]}</p></div></div>''')

    sun = sec("sun", "rock", E(u["sun_kick"]), E(u["sun_h"]), f'''{paras(u["sun_p"][:2])}
<canvas id="suncv" class="cv sun" role="img" aria-label="{E(u["sun_h"])}"></canvas>
<div class="ctl2" style="margin-top:12px"><div><div class="btns">{btn("sgrind", u["s_grind"], hot=True)}</div>{rng("steeth", u["s_teeth"], 6, 108, 1, 16)}</div>
<div>{ro((u["s_light"], "slight"), (u["s_radius"], "srad"), (u["s_made"], "smade"))}</div></div>
<p class="note">{u["sun_note"]}</p>{paras(u["sun_p"][2:])}''')

    forge = sec("forge", "dark", E(u["forge_kick"]), E(u["forge_h"]), f'''<div class="two"><div><canvas id="forgecv" class="cv forge" role="img" aria-label="{E(u["forge_h"])}"></canvas>
<div class="btns">{btn("fpump", u["f_pump"], hot=True, cls="tapbig")}{btn("fthrow", u["f_throw"])}{btn("freset", u["f_reset"])}</div>
{ro((u["f_handle"], "fhandle"), (u["f_heat"], "fheat"), (u["f_bites"], "fbites"))}</div>
<div>{paras(u["forge_p"])}<p class="note">{u["forge_note"]}</p></div></div>''')

    staff = sec("staff", "night", E(u["staff_kick"]), E(u["staff_h"]), f'''{paras(u["staff_p"])}
<canvas id="staffcv" class="cv staff" role="img" aria-label="{E(u["staff_h"])}"></canvas>
{rng("tlen", u["t_len"], 0, 1, 0.001, 0.62)}
{ro((u["t_density"], "tden"), (u["t_vs_water"], "twater"), (u["t_like"], "tlike"))}<p class="note">{u["staff_note"]}</p>''')

    cards = "".join(f'<div><canvas data-icon="{r[3]}" width="128" height="128" aria-hidden="true"></canvas><span><b>{E(r[0])}</b><i>{E(r[1])}</i><p>{E(r[2])}</p></span></div>' for r in u["rack"])
    rack = sec("rack", "", E(u["rack_kick"]), E(u["rack_h"]), paras(u["rack_p"]) + f'<div class="rack">{cards}</div>')

    i = 0 if lang == "en" else 1
    words = "".join(f'<div><b>{E(w[i])}</b><i>{E(w[1 - i])}</i><p>{w[2 + i]}</p></div>' for w in WORDS)
    wd = sec("words", "", "", E(u["words_h"]), f'<div class="glos">{words}</div>')
    src = "".join(f'<li><a href="{h}">{E(t)}</a></li>' for t, h in SOURCES)
    so = sec("sources", "", "", E(u["src_h"]), f'<p>{E(u["src_p"])}</p><ul class="src">{src}</ul>')

    tail = f'''<footer class="bot"><div class="in">{E(u["foot"])} · <a href="https://github.com/NaNoBotCo/cosmic-weaponry">GitHub</a> · <a href="https://wichaa.net/widgets/">wichaa.net</a> · <a href="https://nanobotco.github.io/indras-net/">Indra's Net</a> · <a href="https://motdang.net/">motdang.net</a> · <a href="https://hongdam.net/">hongdam.net</a></div></footer>
<script>window.UI={json.dumps(js, ensure_ascii=False)};</script>
<script src="{root}app.js"></script><script src="{root}top.js"></script>
</body></html>
'''
    return head + "<main>" + hero + what + vajra + bell + bolt + mek + skyaxe + sun + forge + staff + rack + wd + so + "</main>" + tail


def icon():
    # five-pronged vajra, side view, gold on night
    paths = []
    for side in (-1, 1):
        for k, off in enumerate((-1, -0.5, 0, 0.5, 1)):
            r = 9 * off
            x0, x1 = 32 + side * 7, 32 + side * 27
            mx = 32 + side * 18
            paths.append(f'M{x0} {32 + r * 0.5:.1f} Q{mx} {32 + r * 1.6:.1f} {x1} 32')
    d = " ".join(paths)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0a0f1f"/>'
            f'<path d="{d}" fill="none" stroke="#f2c14e" stroke-width="2.6" stroke-linecap="round"/>'
            '<circle cx="32" cy="32" r="6" fill="#f2c14e"/><rect x="24" y="27" width="16" height="10" rx="4" fill="#f2c14e"/></svg>\n')


def main():
    os.makedirs(os.path.join(DOCS, "th"), exist_ok=True)
    for lang, path in (("en", "index.html"), ("th", "th/index.html")):
        with open(os.path.join(DOCS, path), "w") as f:
            f.write(page(lang))
    with open(os.path.join(DOCS, "icon.svg"), "w") as f:
        f.write(icon())
    with open(os.path.join(DOCS, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                f'<url><loc>{BASE}</loc></url>\n<url><loc>{BASE}th/</loc></url>\n</urlset>\n')
    with open(os.path.join(DOCS, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {BASE}sitemap.xml\n")
    u = UI["en"]
    strip = lambda s: html.unescape(re.sub("<[^>]+>", "", s))
    lines = ["# " + SITE, "", u["desc"], "", f"English: {BASE}", f"Thai: {BASE}th/", ""]
    for key, h in (("what", "what"), ("vajra", "vajra"), ("bell", "bell"), ("bolt", "bolt"), ("mek", "mek"), ("ax", "ax"), ("sun", "sun"), ("forge", "forge"), ("staff", "staff")):
        lines += ["## " + strip(u[h + "_h"]), ""] + [strip(p) for p in u[key + "_p"]]
        if key + "_note" in u:
            lines.append(strip(u[key + "_note"]))
        lines.append("")
    lines += ["## " + u["rack_h"], ""] + [f"- {a} ({b}): {c}" for a, b, c, _ in u["rack"]]
    lines += ["", "## Words", ""] + [f"- {a} · {b}: {strip(c)}" for a, b, c, _ in WORDS]
    lines += ["", "## Sources", ""] + [f"- {t}: {h}" for t, h in SOURCES]
    lines += ["", "## Licence", "", "Text CC BY 4.0, NaNoBotCo. Code MIT. Photographs keep their own licences, listed on the page.", ""]
    with open(os.path.join(DOCS, "llms.txt"), "w") as f:
        f.write("\n".join(lines))
    print("built en + th -> docs/")


if __name__ == "__main__":
    main()
