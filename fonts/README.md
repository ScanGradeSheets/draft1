# Worksheet Fonts

Printed worksheets use the style-guide font family `Legend`.

Add the licensed font files here:

- `Legend-Regular.woff2`
- `Legend-Medium.woff2`

The worksheet generator embeds `@font-face` references for these files in each generated SVG. If the files are missing, browsers and print workflows will fall back to the system sans-serif stack, which is not fully style-guide compliant.

Run generation with `SG_REQUIRE_LEGEND_FONT=1` when you want missing font files to fail the build instead of warning.
