"""Assemble the single-file prototype: python build.py  ->  ../../design/app.html
Embeds the trained per-well model from ../ml/models so the prototype classifies exactly like the app."""
from pathlib import Path

here = Path(__file__).parent
src = sorted((here / "src").iterdir())
head = next(p for p in src if p.suffix == ".html").read_text(encoding="utf-8")
model = (here.parent / "ml" / "models" / "narcolens-wells-v1.json").read_text(encoding="utf-8")
js = "/* trained per-well model (narcolens/ml) */\nconst WELL_MODEL = " + model + ";\n"
js += "".join(p.read_text(encoding="utf-8") for p in src if p.suffix == ".js")
out = here.parent.parent / "design" / "app.html"
out.write_text(head + "\n" + js + "\n</script>\n</body>\n</html>\n", encoding="utf-8")
print("wrote", out, f"({len(js) // 1024} KB js)")
