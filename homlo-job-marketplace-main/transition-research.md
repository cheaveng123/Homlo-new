# Transition Refinement Notes

The transition refinement follows Apple’s guidance that motion should convey status, feedback, and instruction rather than act as decoration. It also respects the guidance to make motion optional, avoid making users wait for repeated animation, and retain an understandable visual frame of reference.[1]

For Homlo Jobs, this means the Home search remains tied to the real position of the Explore Opportunities action instead of animating as an arbitrary overlay. Job Detail uses a contextual push from related listing content, while the application flow enters as a contained upward sheet. These movements are short, interruptible, and paired with static hierarchy and haptics so information is not conveyed by motion alone.

The intended timing language is a 180–240 ms fade/slide for contextual screen changes, with restrained 90–150 ms press scaling. The banner and sticky action elements retain a stationary safe-area frame, avoiding large screen-wide movement while content changes.

## Gesture safety and visual hierarchy update

The refreshed interaction model treats a back swipe as a shortcut, not the only way to leave a page. It must stay visually and behaviorally distinct from normal vertical scrolling, with an explicit back affordance remaining available on detail screens. This follows Apple’s guidance to supplement standard navigation with shortcuts rather than replace familiar controls, and to avoid conflicting or ambiguous custom gestures.[3]

For Homlo, edge-back navigation is therefore limited to a deliberate horizontal gesture that begins at the screen edge and travels predominantly rightward. Scrolling content should retain control whenever vertical movement is stronger. Screen emphasis will prioritize one primary action or key job fact, then supporting context, using scale, weight, spacing, and containment rather than adding more color. Motion stays short and functional: standard, interruptible transitions for navigation and more noticeable motion only for a confirmed application or other key state change.[4] [5]

## Sources

[1] [Apple Human Interface Guidelines — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
[2] [Material Design 3 — Transitions](https://m3.material.io/styles/motion/transitions)
[3] [Apple Human Interface Guidelines — Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)
[4] [Material Design 3 — Gestures](https://m3.material.io/foundations/interaction/gestures)
[5] [Material Design 3 — Motion physics system](https://m3.material.io/styles/motion/overview/how-it-works)
