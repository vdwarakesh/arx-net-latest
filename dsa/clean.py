import os
import re

FOLDER_PATH = "./"  # Change to your folder path containing the .html files

def clean_to_pure_html(text):
    # 1. Replace specific LaTeX expressions first
    # latex_replacements = {
    #     r"\\mathcal\{O\}": "O",
    #     r"\\log_2": "log<sub>2</sub>",
    #     r"\\log": "log",
    #     r"\\min_\{i\}": "min<sub>i</sub>",
    #     r"\\min": "min",
    #     r"\\max": "max",
    #     r"\\gcd": "gcd",
    #     r"\\lfloor": "⌊",
    #     r"\\rfloor": "⌋",
    #     r"\\lceil": "⌈",
    #     r"\\rceil": "⌉",
    #     r"\\le": "&le;",
    #     r"\\ge": "&ge;",
    #     r"\\neq": "&ne;",
    #     r"\\approx": "&approx;",
    #     r"\\times": "&times;",
    #     r"\\cdot": "&middot;",
    #     r"\\rightarrow": "&rarr;",
    #     r"\\oplus": "&oplus;",
    #     r"\\alpha": "&alpha;",
    #     r"\\epsilon": "&epsilon;",
    #     r"\\delta": "&delta;",
    #     r"\\sigma": "&sigma;",
    #     r"\\Sigma": "&Sigma;",
    #     r"\\rho": "&rho;",
    #     r"\\phi": "&phi;",
    #     r"\\dots": "...",
    #     r"\\in": "in",
    #     r"\\pm": "&plusmn;",
    #     r"\\binom\{V\}\{2\}": "V(V &minus; 1) / 2",
    #     r"\\frac\{V\(V-1\)\}\{2\}": "V(V &minus; 1) / 2",
    #     r"\\text\{([a-zA-Z0-9_]+)\}": r"\1",
    #     r"\\_": "_",
    #     r"\\%": "%",
    # }
    # for pattern, repl in latex_replacements.items():
    #     text = re.sub(pattern, repl, text)

    # # 2. Convert LaTeX superscripts and subscripts: ^{...}, ^x, _{...}, _x
    # text = re.sub(r"\^\{([^}]+)\}", r"<sup>\1</sup>", text)
    # text = re.sub(r"\^([a-zA-Z0-9\-]+)", r"<sup>\1</sup>", text)
    # text = re.sub(r"_\{([^}]+)\}", r"<sub>\1</sub>", text)
    # text = re.sub(r"_([a-zA-Z0-9]+)", r"<sub>\1</sub>", text)

    # # 3. Strip remaining $ math delimiters
    # text = re.sub(r"\$([^$]+)\$", r"\1", text)

    # 4. Convert Markdown **bold**, *italic*, and `code` to HTML tags
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)

    return text

for filename in os.listdir(FOLDER_PATH):
    if filename.endswith(".html"):
        filepath = os.path.join(FOLDER_PATH, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        cleaned = clean_to_pure_html(content)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(cleaned)
        print(f"Cleaned: {filename}")