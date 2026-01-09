"""
UI/UX Design Knowledge Base Search Tool

Based on ui-ux-pro-max-skill, provides design intelligence
for building professional UI/UX.

Features:
- 57 UI Styles (Glassmorphism, Brutalism, Minimalism, etc.)
- 95 Color Palettes (SaaS, E-commerce, Healthcare, etc.)
- 56 Font Pairings with Google Fonts imports
- 24 Chart Types for dashboards
- 98 UX Guidelines and best practices
- Landing page patterns
- Product type design recommendations
- 10 Stack-specific guidelines (React, Next.js, Vue, etc.)
"""

import csv
import re
from pathlib import Path
from math import log
from collections import defaultdict
from typing import Literal, Annotated, Any
from langchain_core.tools import tool

# ============ Configuration ============
DATA_DIR = Path(__file__).parent.parent / "data" / "ui-ux-pro-max" / "data"
STACKS_DIR = DATA_DIR / "stacks"
MAX_RESULTS = 3

# Available tech stacks with their CSV files
STACK_CONFIG = {
    "react": "react.csv",
    "nextjs": "nextjs.csv",
    "vue": "vue.csv",
    "nuxtjs": "nuxtjs.csv",
    "nuxt-ui": "nuxt-ui.csv",
    "svelte": "svelte.csv",
    "react-native": "react-native.csv",
    "flutter": "flutter.csv",
    "swiftui": "swiftui.csv",
    "html-tailwind": "html-tailwind.csv",  # Default
}

# Stack search columns (same for all stacks)
STACK_SEARCH_COLS = ["Category", "Guideline", "Description", "Do", "Don't"]
STACK_OUTPUT_COLS = ["Category", "Guideline", "Description", "Do", "Don't", "Code Good", "Code Bad", "Severity", "Docs URL"]

CSV_CONFIG = {
    "style": {
        "file": "styles.csv",
        "search_cols": ["Style Category", "Keywords", "Best For", "Type"],
        "output_cols": ["Style Category", "Type", "Keywords", "Primary Colors",
                       "Effects & Animation", "Best For", "Framework Compatibility"]
    },
    "color": {
        "file": "colors.csv",
        "search_cols": ["Product Type", "Keywords", "Notes"],
        "output_cols": ["Product Type", "Keywords", "Primary (Hex)", "Secondary (Hex)",
                       "CTA (Hex)", "Background (Hex)", "Text (Hex)", "Notes"]
    },
    "typography": {
        "file": "typography.csv",
        "search_cols": ["Font Pairing Name", "Category", "Mood/Style Keywords", "Best For"],
        "output_cols": ["Font Pairing Name", "Category", "Heading Font", "Body Font",
                       "Mood/Style Keywords", "Best For", "Google Fonts URL", "Tailwind Config"]
    },
    "chart": {
        "file": "charts.csv",
        "search_cols": ["Data Type", "Keywords", "Best Chart Type"],
        "output_cols": ["Data Type", "Keywords", "Best Chart Type", "Secondary Options",
                       "Color Guidance", "Library Recommendation"]
    },
    "ux": {
        "file": "ux-guidelines.csv",
        "search_cols": ["Category", "Issue", "Description", "Platform"],
        "output_cols": ["Category", "Issue", "Platform", "Description", "Do", "Don't", "Severity"]
    },
    "landing": {
        "file": "landing.csv",
        "search_cols": ["Pattern Name", "Keywords", "Conversion Optimization"],
        "output_cols": ["Pattern Name", "Keywords", "Section Order", "Primary CTA Placement",
                       "Color Strategy", "Conversion Optimization"]
    },
    "product": {
        "file": "products.csv",
        "search_cols": ["Product Type", "Keywords", "Primary Style Recommendation"],
        "output_cols": ["Product Type", "Keywords", "Primary Style Recommendation",
                       "Secondary Styles", "Landing Page Pattern", "Color Palette Focus"]
    }
}


# ============ BM25 Search Engine ============
class BM25:
    """BM25 ranking algorithm for text search"""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus: list[list[str]] = []
        self.doc_lengths: list[int] = []
        self.avgdl: float = 0
        self.idf: dict[str, float] = {}
        self.doc_freqs: dict[str, int] = defaultdict(int)
        self.N: int = 0

    def tokenize(self, text: str) -> list[str]:
        """Lowercase, split, remove punctuation, filter short words"""
        text = re.sub(r'[^\w\s]', ' ', str(text).lower())
        return [w for w in text.split() if len(w) > 2]

    def fit(self, documents: list[str]) -> None:
        """Build BM25 index from documents"""
        self.corpus = [self.tokenize(doc) for doc in documents]
        self.N = len(self.corpus)
        if self.N == 0:
            return
        self.doc_lengths = [len(doc) for doc in self.corpus]
        self.avgdl = sum(self.doc_lengths) / self.N

        for doc in self.corpus:
            seen: set[str] = set()
            for word in doc:
                if word not in seen:
                    self.doc_freqs[word] += 1
                    seen.add(word)

        for word, freq in self.doc_freqs.items():
            self.idf[word] = log((self.N - freq + 0.5) / (freq + 0.5) + 1)

    def score(self, query: str) -> list[tuple[int, float]]:
        """Score all documents against query"""
        query_tokens = self.tokenize(query)
        scores: list[tuple[int, float]] = []

        for idx, doc in enumerate(self.corpus):
            score = 0.0
            doc_len = self.doc_lengths[idx]
            term_freqs: dict[str, int] = defaultdict(int)
            for word in doc:
                term_freqs[word] += 1

            for token in query_tokens:
                if token in self.idf:
                    tf = term_freqs[token]
                    idf = self.idf[token]
                    numerator = tf * (self.k1 + 1)
                    denominator = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avgdl)
                    score += idf * numerator / denominator

            scores.append((idx, score))

        return sorted(scores, key=lambda x: x[1], reverse=True)


# ============ Search Functions ============
def _load_csv(filepath: Path) -> list[dict[str, Any]]:
    """Load CSV and return list of dicts"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def _search_csv(
    filepath: Path,
    search_cols: list[str],
    output_cols: list[str],
    query: str,
    max_results: int
) -> list[dict[str, str]]:
    """Core search function using BM25"""
    if not filepath.exists():
        return []

    data = _load_csv(filepath)
    documents = [" ".join(str(row.get(col, "")) for col in search_cols) for row in data]

    bm25 = BM25()
    bm25.fit(documents)
    ranked = bm25.score(query)

    results: list[dict[str, str]] = []
    for idx, score in ranked[:max_results]:
        if score > 0:
            row = data[idx]
            results.append({col: row.get(col, "") for col in output_cols if col in row})

    return results


def _detect_domain(query: str) -> str:
    """Auto-detect the most relevant domain from query"""
    query_lower = query.lower()

    domain_keywords = {
        "color": ["color", "palette", "hex", "#", "rgb", "配色", "颜色", "theme"],
        "chart": ["chart", "graph", "visualization", "图表", "可视化", "data viz"],
        "landing": ["landing", "page", "cta", "conversion", "落地页", "首页", "hero"],
        "product": ["saas", "ecommerce", "e-commerce", "fintech", "healthcare", "dashboard",
                   "产品", "app", "application"],
        "style": ["style", "design", "ui", "minimalism", "glassmorphism", "brutalism",
                 "neumorphism", "风格", "设计", "aesthetic"],
        "ux": ["ux", "usability", "accessibility", "用户体验", "可用性", "a11y", "wcag"],
        "typography": ["font", "typography", "字体", "排版", "heading", "text"]
    }

    scores = {domain: sum(1 for kw in keywords if kw in query_lower)
              for domain, keywords in domain_keywords.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "style"


def search_design_knowledge(
    query: str,
    domain: str | None = None,
    max_results: int = MAX_RESULTS
) -> dict[str, Any]:
    """Main search function with auto-domain detection"""
    if domain is None:
        domain = _detect_domain(query)

    config = CSV_CONFIG.get(domain, CSV_CONFIG["style"])
    filepath = DATA_DIR / config["file"]

    if not filepath.exists():
        return {
            "error": f"Data file not found: {filepath}. Please ensure UI/UX data is installed.",
            "domain": domain
        }

    results = _search_csv(
        filepath,
        config["search_cols"],
        config["output_cols"],
        query,
        max_results
    )

    return {
        "domain": domain,
        "query": query,
        "count": len(results),
        "results": results
    }


def search_stack_guidelines(
    query: str,
    stack: str = "html-tailwind",
    max_results: int = MAX_RESULTS
) -> dict[str, Any]:
    """Search stack-specific guidelines"""
    stack = stack.lower()
    if stack not in STACK_CONFIG:
        return {
            "error": f"Unknown stack '{stack}'. Available: {', '.join(STACK_CONFIG.keys())}",
            "stack": stack
        }

    filepath = STACKS_DIR / STACK_CONFIG[stack]

    if not filepath.exists():
        return {
            "error": f"Stack data file not found: {filepath}. Please ensure stack data is installed.",
            "stack": stack
        }

    results = _search_csv(
        filepath,
        STACK_SEARCH_COLS,
        STACK_OUTPUT_COLS,
        query,
        max_results
    )

    return {
        "stack": stack,
        "query": query,
        "count": len(results),
        "results": results
    }


# ============ Output Formatters ============
def _extract_hex_color(color_str: str) -> str | None:
    """Extract first hex color from a string like 'Primary Blue #3B82F6'"""
    match = re.search(r'#[0-9A-Fa-f]{6}', str(color_str))
    return match.group(0) if match else None


def _format_color_tokens(results: list[dict]) -> dict:
    """Extract usable color tokens from color search results"""
    if not results:
        return {}

    r = results[0]
    tokens = {
        "product_type": r.get("Product Type", ""),
        "colors": {}
    }

    # Extract hex values
    color_fields = [
        ("primary", "Primary (Hex)"),
        ("secondary", "Secondary (Hex)"),
        ("cta", "CTA (Hex)"),
        ("background", "Background (Hex)"),
        ("text", "Text (Hex)"),
    ]

    for key, field in color_fields:
        hex_val = _extract_hex_color(r.get(field, ""))
        if hex_val:
            tokens["colors"][key] = hex_val

    return tokens


def _format_typography_tokens(results: list[dict]) -> dict:
    """Extract usable typography tokens from typography search results"""
    if not results:
        return {}

    r = results[0]
    return {
        "pairing_name": r.get("Font Pairing Name", ""),
        "heading_font": r.get("Heading Font", ""),
        "body_font": r.get("Body Font", ""),
        "google_fonts_url": r.get("Google Fonts URL", ""),
        "category": r.get("Category", ""),
    }


def _format_style_tokens(results: list[dict]) -> dict:
    """Extract usable style tokens from style search results"""
    if not results:
        return {}

    r = results[0]
    style_name = r.get("Style Category", "").lower()

    # Infer common CSS properties from style
    css_hints = {
        "border_radius": "rounded-2xl" if any(kw in style_name for kw in ["glass", "clay", "soft", "bento"]) else "rounded-lg",
        "shadow": "shadow-xl" if any(kw in style_name for kw in ["glass", "3d", "neumorph"]) else "shadow-md",
    }

    return {
        "style_name": r.get("Style Category", ""),
        "type": r.get("Type", ""),
        "primary_colors": r.get("Primary Colors", ""),
        "effects": r.get("Effects & Animation", ""),
        "tailwind_hints": css_hints,
    }


def _format_stack_output(result: dict) -> str:
    """Format stack-specific guidelines as actionable output"""
    stack = result.get("stack", "unknown")
    results = result.get("results", [])

    if not results:
        return f"No guidelines found for stack '{stack}'"

    output_parts = [
        f"## {stack.upper()} Guidelines",
        ""
    ]

    for i, item in enumerate(results, 1):
        category = item.get("Category", "General")
        guideline = item.get("Guideline", "")
        severity = item.get("Severity", "Medium")

        # Severity indicator
        severity_icon = "🔴" if severity == "High" else "🟡" if severity == "Medium" else "🟢"

        output_parts.append(f"### {i}. [{category}] {guideline} {severity_icon}")

        # Description
        if item.get("Description"):
            output_parts.append(f"{item['Description']}")
            output_parts.append("")

        # Do/Don't
        if item.get("Do"):
            output_parts.append(f"✅ **Do**: {item['Do']}")
        dont_value = item.get("Don't")
        if dont_value:
            output_parts.append(f"❌ **Don't**: {dont_value}")

        # Code examples
        if item.get("Code Good"):
            code_good = item["Code Good"].replace("\\n", "\n")
            output_parts.append(f"```tsx\n// Good\n{code_good}\n```")
        if item.get("Code Bad"):
            code_bad = item["Code Bad"].replace("\\n", "\n")
            output_parts.append(f"```tsx\n// Bad\n{code_bad}\n```")

        # Docs link
        if item.get("Docs URL"):
            output_parts.append(f"📚 [Documentation]({item['Docs URL']})")

        output_parts.append("")

    return "\n".join(output_parts)


def _format_structured_output(result: dict) -> str:
    """
    Format search results as structured output with actionable tokens.
    Returns Markdown with embedded design tokens that can be directly used.
    """
    domain = result["domain"]
    results = result["results"]

    if not results:
        return f"No results found for domain '{domain}'"

    output_parts = []

    # Header
    output_parts.append(f"## Design Tokens ({domain})")
    output_parts.append("")

    # Domain-specific structured tokens
    if domain == "color":
        tokens = _format_color_tokens(results)
        output_parts.append(f"**Product Type**: {tokens.get('product_type', 'N/A')}")
        output_parts.append("")
        output_parts.append("**Color Palette** (copy hex values directly):")
        for name, hex_val in tokens.get("colors", {}).items():
            # Provide both hex and Tailwind-style class hint
            output_parts.append(f"- {name}: `{hex_val}` → use in `bg-[{hex_val}]` or `text-[{hex_val}]`")

    elif domain == "typography":
        tokens = _format_typography_tokens(results)
        output_parts.append(f"**Pairing**: {tokens.get('pairing_name', 'N/A')}")
        output_parts.append(f"- Heading: `font-family: '{tokens.get('heading_font', '')}'`")
        output_parts.append(f"- Body: `font-family: '{tokens.get('body_font', '')}'`")
        if tokens.get("google_fonts_url"):
            output_parts.append(f"- Import: `{tokens.get('google_fonts_url')}`")

    elif domain == "style":
        tokens = _format_style_tokens(results)
        output_parts.append(f"**Style**: {tokens.get('style_name', 'N/A')}")
        output_parts.append(f"**Type**: {tokens.get('type', 'N/A')}")
        output_parts.append("")
        output_parts.append("**Tailwind Classes** (use directly):")
        hints = tokens.get("tailwind_hints", {})
        for prop, val in hints.items():
            output_parts.append(f"- {prop}: `{val}`")
        if tokens.get("effects"):
            effects = tokens.get("effects", "")[:150]
            output_parts.append(f"- Effects hint: {effects}")

    else:
        # Generic format for other domains (landing, product, chart, ux)
        for i, item in enumerate(results[:2], 1):
            title = next((v for v in item.values() if v), "Unknown")
            output_parts.append(f"### {i}. {title}")
            for key, value in list(item.items())[1:4]:  # First 3 fields after title
                if value:
                    val_str = str(value)[:150] + "..." if len(str(value)) > 150 else value
                    output_parts.append(f"- **{key}**: {val_str}")
            output_parts.append("")

    # Usage instruction (short, actionable)
    output_parts.append("")
    output_parts.append("---")
    output_parts.append("*Apply these tokens directly in your Tailwind classes or inline styles.*")

    return "\n".join(output_parts)


def _format_markdown_output(result: dict) -> str:
    """Format search results as readable Markdown (legacy format)"""
    output_parts = [
        f"**UI/UX Design Recommendations**",
        f"Domain: {result['domain']} | Query: {result['query']} | Results: {result['count']}",
        ""
    ]

    for i, item in enumerate(result["results"], 1):
        title = next((v for v in item.values() if v), "Unknown")
        output_parts.append(f"### {i}. {title}")

        for key, value in item.items():
            if value and key != list(item.keys())[0]:
                if len(str(value)) > 200:
                    value = str(value)[:200] + "..."
                output_parts.append(f"- **{key}**: {value}")

        output_parts.append("")

    return "\n".join(output_parts)


# ============ LangChain Tool ============
@tool
def search_ui_design(
    query: Annotated[str, "Product type or design need, e.g. 'SaaS dashboard', 'e-commerce landing', 'fintech app', or for stack: 'useState hooks', 'navigation'"],
    domain: Annotated[
        Literal["style", "color", "typography", "chart", "ux", "landing", "product"] | None,
        "Search domain (auto-detected if not specified): style, color, typography, chart, ux, landing, product"
    ] = None,
    stack: Annotated[
        Literal["react", "nextjs", "vue", "nuxtjs", "nuxt-ui", "svelte", "react-native", "flutter", "swiftui", "html-tailwind"] | None,
        "Tech stack for framework-specific guidelines. If specified, searches stack guidelines instead of design domains."
    ] = None,
    output_format: Annotated[
        Literal["structured", "markdown"],
        "Output format: 'structured' returns actionable design tokens, 'markdown' returns detailed descriptions"
    ] = "structured",
) -> str:
    """
    Query the UI/UX design knowledge base for professional design recommendations.

    Returns design tokens (colors, fonts, styles) that can be directly applied to code.

    When to use:
    - Creating landing pages, dashboards, forms, or UI components
    - User hasn't specified a design style/color scheme
    - Need professional color palettes, font pairings, or style guidance
    - Need framework-specific best practices (use stack parameter)

    When NOT to use:
    - User already specified exact colors/fonts/style
    - Simple code fixes or non-UI tasks

    Domains (design knowledge):
    - style: UI styles (Glassmorphism, Brutalism, Bento Grid, etc.)
    - color: Industry color palettes with hex values
    - typography: Font pairings with Google Fonts URLs
    - chart: Data visualization recommendations
    - ux: UX best practices and anti-patterns
    - landing: Landing page patterns
    - product: Product-type specific guidance

    Stacks (framework guidelines):
    - react: React hooks, state, components, performance
    - nextjs: Next.js App Router, SSR, data fetching
    - vue: Vue 3 Composition API, reactivity, components
    - nuxtjs: Nuxt 3 server components, routing
    - nuxt-ui: Nuxt UI component library patterns
    - svelte: Svelte stores, reactivity, components
    - react-native: Mobile components, navigation, performance
    - flutter: Widgets, state management, platform-specific
    - swiftui: SwiftUI views, state, gestures
    - html-tailwind: Pure HTML + Tailwind CSS (default)

    Examples:
    - search_ui_design("SaaS dashboard") → style + color tokens
    - search_ui_design("fintech", domain="color") → hex color palette
    - search_ui_design("state management", stack="react") → React state guidelines
    - search_ui_design("navigation", stack="nextjs") → Next.js routing best practices
    """
    # If stack is specified, search stack guidelines instead
    if stack:
        result = search_stack_guidelines(query, stack, 3)
        if "error" in result:
            return f"Stack search error: {result['error']}"
        if result["count"] == 0:
            return f"No guidelines found for '{query}' in {stack}. Try: 'state', 'components', 'performance', 'routing', 'styling'."
        return _format_stack_output(result)

    # Otherwise search design knowledge
    result = search_design_knowledge(query, domain, 3)

    if "error" in result:
        return f"Search error: {result['error']}"

    if result["count"] == 0:
        return f"No design recommendations found for '{query}'. Try: 'SaaS', 'e-commerce', 'healthcare', 'fintech', 'dashboard', 'landing page'."

    if output_format == "structured":
        return _format_structured_output(result)
    else:
        return _format_markdown_output(result)


# Alias for import
search_ui_design_tool = search_ui_design
