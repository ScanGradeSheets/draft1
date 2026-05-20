# Worksheet Fonts

Printed worksheets use the worksheet font family `Lexend`.

The generator embeds `@font-face` references for:

- `Lexend-wght.ttf`

If the file is missing, browsers and print workflows will fall back to the system sans-serif stack, which is not fully worksheet-style compliant.

Run generation with `SG_REQUIRE_LEXEND_FONT=1` when you want missing font files to fail the build instead of warning.
