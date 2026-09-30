"""
NarcoLens brand asset builder.

Generates every SVG the app needs from one source of truth:
  svg/mark.svg, svg/mark-light.svg          logo mark (on light / on dark)
  svg/wordmark.svg, svg/wordmark-light.svg  mark + "NarcoLens" (text outlined to paths)
  svg/app-icon.svg                          512px Play Store icon (full bleed)
  svg/adaptive-foreground.svg / -background.svg / -monochrome.svg   Android adaptive icon layers (108dp)
  svg/splash-icon.svg                       splash screen mark
  svg/prahari.svg                           Prahari assistant mark
  icons/*.svg                               24px stroke UI icons (currentColor)

Run:  python build_brand.py
"""
import json
import re
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).parent
OUT = HERE / "svg"
ICONS = HERE / "icons"
APP_HTML = HERE.parent.parent / "design" / "app.html"

INK = "#1B1C1F"
BRAND = "#E8590C"
BRAND_LIGHT = "#FF8A3D"
WHITE = "#FFFFFF"

# ---------------------------------------------------------------- mark geometry (64 x 64)
SHIELD = "M32 5C24 8.5 16 11 9.5 12V29C9.5 43.5 18.5 54.5 32 59.5C45.5 54.5 54.5 43.5 54.5 29V12C48 11 40 8.5 32 5Z"
DROP = "M32 17C32 17 43 28.5 43 36.5A11 11 0 0 1 21 36.5C21 28.5 32 17 32 17Z"
LENS = "M40.89 23.8A15.5 15.5 0 1 1 23.11 23.8"          # open lens ring around the drop
GLINT = '<ellipse cx="27.6" cy="34.2" rx="2.1" ry="3.5" transform="rotate(-25 27.6 34.2)"/>'


def mark_group(shield=INK, drop=BRAND, ring=WHITE, glint=WHITE):
    return (f'<path d="{SHIELD}" fill="{shield}"/>'
            f'<path d="{DROP}" fill="{drop}"/>'
            f'<path d="{LENS}" fill="none" stroke="{ring}" stroke-width="2.6" stroke-linecap="round"/>'
            f'<g fill="{glint}" opacity=".9">{GLINT}</g>')


def svg(view, body, w=None, h=None, title=None):
    size = f' width="{w}" height="{h}"' if w else ""
    t = f"<title>{title}</title>" if title else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}"{size}>{t}{body}</svg>\n'


# ---------------------------------------------------------------- wordmark: outline the text
def text_paths(text, font_path, size, x0, baseline, axes):
    font = TTFont(font_path)
    font = instancer.instantiateVariableFont(font, axes)
    upem = font["head"].unitsPerEm
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    scale = size / upem
    x = x0
    paths = []
    for ch in text:
        gname = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        # flip y (font units are y-up) and scale to px
        gs[gname].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        d = pen.getCommands()
        if d:
            paths.append(d)
        x += hmtx[gname][0] * scale - size * 0.012     # slight tightening, like the UI wordmark
    return paths, x


def build_wordmark(dark=False):
    font = HERE / "fonts" / "RobotoFlex.ttf"
    axes = {"wght": 800, "opsz": 40, "wdth": 100}
    narco, x = text_paths("Narco", font, 40, 76, 45, axes)
    lens, x2 = text_paths("Lens", font, 40, x, 45, axes)
    ink = WHITE if dark else INK
    mark = mark_group(shield=WHITE, drop=BRAND, ring=INK, glint=WHITE) if dark else mark_group()
    body = (f'<g transform="translate(0 0)">{mark}</g>'
            f'<path fill="{ink}" d="{" ".join(narco)}"/>'
            f'<path fill="{BRAND_LIGHT if dark else BRAND}" d="{" ".join(lens)}"/>')
    width = round(x2 + 4)
    return svg(f"0 0 {width} 64", body, width, 64, "NarcoLens")


# ---------------------------------------------------------------- Prahari mark
# Prahari = "the guard": a geometric owl — the night-watch that never sleeps. No text, no AI sparkle.
OWL_HEAD = "M13 20L20 9.5C24.5 13 28.2 14.2 32 14.2S39.5 13 44 9.5L51 20C54.8 25 56.5 30.4 56.5 36.5C56.5 50.5 45.6 58.5 32 58.5S7.5 50.5 7.5 36.5C7.5 30.4 9.2 25 13 20Z"
def owl(body_top="#FF8A3D", body_bottom="#C94A05", face="#FFF1E6", ink="#1B1C1F", uid="o"):
    return (f'<defs><linearGradient id="{uid}g" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{body_top}"/><stop offset="1" stop-color="{body_bottom}"/></linearGradient></defs>'
            f'<path d="{OWL_HEAD}" fill="url(#{uid}g)"/>'
            '<path d="M21.5 49.5C24.5 52 28 53.2 32 53.2S39.5 52 42.5 49.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>'
            f'<circle cx="23" cy="34" r="11" fill="{face}"/><circle cx="41" cy="34" r="11" fill="{face}"/>'
            f'<circle cx="23" cy="34.5" r="5.6" fill="{ink}"/><circle cx="41" cy="34.5" r="5.6" fill="{ink}"/>'
            '<circle cx="25" cy="32.4" r="1.8" fill="#fff"/><circle cx="43" cy="32.4" r="1.8" fill="#fff"/>'
            f'<path d="M29.4 42.2H34.6L32 47.2Z" fill="{ink}"/>')
PRAHARI = svg("0 0 64 64", owl(), 64, 64, "Prahari")
PRAHARI_BADGE = svg("0 0 64 64", '<circle cx="32" cy="32" r="32" fill="#1B1C1F"/><g transform="translate(6.4 5.5) scale(.8)">' + owl(uid="b") + '</g>', 64, 64, "Prahari")


# ---------------------------------------------------------------- UI icons, read from the prototype's icon map
def read_icon_map():
    html = APP_HTML.read_text(encoding="utf-8")
    block = re.search(r"const P = \{(.*?)\n\};", html, re.S).group(1)
    icons = dict(re.findall(r"(\w+):'([^']+)'", block))
    for name, d in re.findall(r"P\.(\w+)='([^']+)'", html):
        icons[name] = d
    return icons


def icon_svg(d):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="{d}"/></svg>\n')


def main():
    OUT.mkdir(exist_ok=True)
    ICONS.mkdir(exist_ok=True)
    files = {
        "mark.svg": svg("0 0 64 64", mark_group(), 64, 64, "NarcoLens"),
        "mark-light.svg": svg("0 0 64 64", mark_group(shield=WHITE, ring=INK), 64, 64, "NarcoLens"),
        "wordmark.svg": build_wordmark(False),
        "wordmark-light.svg": build_wordmark(True),
        # Play Store 512 icon: full-bleed ink square, mark centred (Play applies its own mask)
        "app-icon.svg": svg("0 0 512 512", f'<rect width="512" height="512" fill="{INK}"/>'
                            f'<g transform="translate(96 88) scale(5)">{mark_group(shield=WHITE, ring=INK)}</g>', 512, 512),
        # Android adaptive icon: 108dp canvas, keep art inside the 66dp safe circle
        "adaptive-background.svg": svg("0 0 108 108", f'<rect width="108" height="108" fill="{INK}"/>', 108, 108),
        "adaptive-foreground.svg": svg("0 0 108 108", f'<g transform="translate(24 23) scale(.94)">{mark_group(shield=WHITE, ring=INK)}</g>', 108, 108),
        "adaptive-monochrome.svg": svg("0 0 108 108", f'<g transform="translate(24 23) scale(.94)"><path d="{SHIELD}" fill="#000"/>'
                                       f'<path d="{DROP}" fill="#fff"/></g>', 108, 108),
        "splash-icon.svg": svg("0 0 64 64", mark_group(shield=WHITE, ring=INK), 200, 200, "NarcoLens"),
        "prahari.svg": PRAHARI,
        "prahari-badge.svg": PRAHARI_BADGE,
    }
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")

    icons = read_icon_map()
    for name, d in sorted(icons.items()):
        (ICONS / f"{name}.svg").write_text(icon_svg(d), encoding="utf-8")
    (ICONS / "icons.json").write_text(json.dumps(icons, indent=2), encoding="utf-8")
    print(f"wrote {len(files)} brand SVGs to {OUT} and {len(icons)} icons to {ICONS}")


if __name__ == "__main__":
    main()
