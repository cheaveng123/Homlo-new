# Profile and Search Visual-System Research

## Research position

The supplied reference is treated only as a structural cue: a compact identity header, a single visible progress signal, and a calm sequence of actionable profile rows. Homlo will not reproduce its illustrations, yellow palette, dark header treatment, or screen composition.

| Research finding | Applied Homlo decision |
| --- | --- |
| Airbnb designed **Airbnb Cereal** as a proprietary UI typeface around legibility, balanced weights, generous apertures, and a subdued reading texture rather than decorative personality. [1] | Retain the licensed in-project **Inter** family instead of copying unavailable Airbnb Cereal. Use a stable semantic scale: 24/30 for screen titles, 17/22 for search prompts, 15/20 for rows, 13/18 for metadata, and semibold only where hierarchy needs it. |
| Airbnb’s design-language work stresses a shared foundation for typography, color, icons, spacing, and information architecture, with components designed as coherent, evolving patterns. [2] | Consolidate recurring surfaces into quieter row, field, card, and action treatments. Elevation and rounded rectangles will be reserved for true grouping, selection, or primary action rather than applied to every section. |
| Apple’s platform guidance recommends a readable 17-point iOS default, avoiding light weights, minimizing typeface mixing, and using size, weight, and color to establish hierarchy. [3] | Quick-search labels use Inter Medium/Semibold at 17px with 22px leading; helper text uses Inter Regular at 13px with 18px leading. The primary search affordance uses one calm text weight rather than oversized or over-styled copy. |
| Apple recommends simple, single-concept icons with consistent size, detail, stroke weight, perspective, and visual weight matched to adjacent text. [4] | Use the existing cross-platform IconSymbol bridge (SF Symbols on iOS, Material fallback elsewhere), normalized to 20px search/action glyphs and 16px supporting row glyphs. Use line-style symbols such as magnifyingglass/search, location, sliders/filter, chevron, and person rather than bespoke decorative illustrations. |

## Design rules for this pass

The profile will use a warm white page, a compact portrait/monogram anchor, a contextual completion meter, and divider-led action rows. It will surface job-seeker identity and next steps without fabricating achievements or gamified scores.

Quick search will be rebuilt as one composed search surface with a clear prompt, a location row, a compact route cue, and a single high-contrast action. It will not emulate Airbnb’s product UI, palette, copy, or proprietary typeface.

Across touched areas, this pass avoids gradients, ornamental stickers, excessive shadows, pill-shaped containers used as decoration, unrelated icon styles, and multiple simultaneous visual accents. The working test is whether the page reads as a purposeful marketplace interface before any individual card is inspected.

## References

[1]: https://medium.com/airbnb-design/working-type-81294544608b "Airbnb Design — Working Type"
[2]: https://karrisaarinen.com/posts/building-airbnb-design-system/ "Creating the Airbnb Design System"
[3]: https://developer.apple.com/design/human-interface-guidelines/typography "Apple Human Interface Guidelines — Typography"
[4]: https://developer.apple.com/design/human-interface-guidelines/icons "Apple Human Interface Guidelines — Icons"
