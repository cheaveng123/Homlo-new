# Homlo Jobs Refinement Research

## Practical Findings

| Finding | Design implication for Homlo Jobs | Source |
|---|---|---|
| Essential information should be easy to find and not crowded by nonessential detail. | Shorten the home header, reduce its vertical footprint, and make the main search action immediately legible without a visually dominant container. | Apple Layout HIG [1] |
| Alignment and shared edges communicate organization and make screens easier to scan. | Use consistent 20 px content edges, align the brand, search module, headings, and cards, and use one understated divider rhythm rather than repeated large containers. | Apple Layout HIG [1] |
| Motion should support the experience rather than overshadow it, and should be brief and precise. | Use a single 220–280 ms entrance sequence for the compact search card and use restrained press feedback. Avoid decorative looping or large bounce effects. | Apple Motion HIG [2] |
| Important state should never be conveyed only through motion. | Continue using selected color, heart state, text confirmation, and haptics alongside motion. | Apple Motion HIG [2] |

## Implementation Decisions

The redesign will replace the oversized title/header treatment with a compact top bar, move the primary search affordance higher in the visual hierarchy, reduce rounded-card density, and give the home screen a more editorial rhythm through restrained spacing. The application action will lead to an explicit preparation screen with a concise checklist, role summary, availability selection, and a clear submission moment instead of an undifferentiated alert.

## References

[1]: https://developer.apple.com/design/human-interface-guidelines/layout "Apple Human Interface Guidelines — Layout"
[2]: https://developer.apple.com/design/human-interface-guidelines/motion "Apple Human Interface Guidelines — Motion"
