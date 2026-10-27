import sys
from PIL import Image

for filename in sys.argv[1:]:
    img = Image.open(filename).convert("RGBA")
    r, g, b, a = img.split()

    recolored = Image.new("RGBA", img.size, "#4c4c4c")
    recolored.putalpha(a)

    output = filename.rsplit(".", 1)[0] + "1.png"
    recolored.save(output)

    print(f"Saved: {output}")