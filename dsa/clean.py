import os
import re

def clean_html_content(text):
    # 1. Convert Markdown **bold** to <strong>bold</strong>
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    
    # 2. Convert Markdown `code` to <code>code</code>
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

    # 3. Clean specific LaTeX math expressions into clean HTML
    latex_replacements = {
        r'\\mathcal\{O\}': 'O',
        r'\\log_2': 'log<sub>2</sub>',
        r'\\log': 'log',
        r'\\min_\{([^}]+)\}': r'min<sub>\1</sub>',
        r'\\min': 'min',
        r'\\max': 'max',
        r'\\gcd': 'gcd',
        r'\\lfloor\s*': '⌊',
        r'\\rfloor': '⌋',
        r'\\lceil\s*': '⌈',
        r'\\rceil': '⌉',
        r'\\le\b': '&le;',
        r'\\ge\b': '&ge;',
        r'\\neq\b': '&ne;',
        r'\\times\b': '&times;',
        r'\\cdot\b': '&middot;',
        r'\\dots\b': '...',
        r'\\oplus\b': '&oplus;',
        r'\\rightarrow\b': '&rarr;',
        r'\\approx\b': '&approx;',
        r'\\pm\b': '&plusmn;',
        r'\\in\b': '&isin;',
        r'\\alpha': '&alpha;',
        r'\\epsilon': '&epsilon;',
        r'\\delta': '&delta;',
        r'\\sigma': '&sigma;',
        r'\\Sigma': '&Sigma;',
        r'\\rho': '&rho;',
        r'\\phi': '&phi;',
        r'\\binom\{([^}]+)\}\{([^}]+)\}': r'C(\1, \2)',
        r'\\frac\{([^}]+)\}\{([^}]+)\}': r'(\1 / \2)',
        r'\\text\{([^}]+)\}': r'\1',
    }
    
    for pattern, replacement in latex_replacements.items():
        text = re.sub(pattern, replacement, text)

    # 4. Convert LaTeX superscripts (e.g., 2^{10} or 2^k) and subscripts (e.g., B_{k-1} or x_0)
    text = re.sub(r'\^\{([^}]+)\}', r'<sup>\1</sup>', text)
    text = re.sub(r'\^([a-zA-Z0-9\-]+)', r'<sup>\1</sup>', text)
    text = re.sub(r'_\{([^}]+)\}', r'<sub>\1</sub>', text)
    text = re.sub(r'_([a-zA-Z0-9\-]+)', r'<sub>\1</sub>', text)

    # 5. Strip remaining $ math delimiters
    text = text.replace('$', '')
    
    return text

# Process all .html files in the current directory
folder_path = "."  # Change this to your HTML folder path if needed
for filename in os.listdir(folder_path):
    if filename.endswith(".html"):
        filepath = os.path.join(folder_path, filename)
        with open(filepath, "r", encoding="utf-8") as file:
            content = file.read()
        
        cleaned = clean_html_content(content)
        
        with open(filepath, "w", encoding="utf-8") as file:
            file.write(cleaned)
        print(f"Cleaned: {filename}")