from PIL import Image

for filename in ["sidebar-open.png", "sidebar-close.png"]:
    img = Image.open(filename).convert("RGBA")
    r, g, b, a = img.split()

    recolored = Image.new("RGBA", img.size, "#4c4c4c")
    recolored.putalpha(a)

    recolored.save(filename.replace(".png", "_recolored.png"))