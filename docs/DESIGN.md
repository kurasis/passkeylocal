# Appearance and design references

The interface has three explicit palettes, available from the header before
unlocking and from Settings. The preference is stored locally in IndexedDB.

- **Colorful** (default): violet accents, mint and peach details, warm white cards.
- **Light**: neutral blue-white surfaces with a blue primary action.
- **Dark**: graphite surfaces with lavender accents.

The optional **System** setting follows the device's light/dark preference.
Existing saved choices remain valid. Keyboard users can tab to a theme,
select it with Space or arrow keys, and close the header picker with Escape.

Navigation is a sidebar on desktop and a bottom bar on mobile. Search, entry
cards and primary actions use a consistent hierarchy, locally bundled SVG
icons and system fonts. Colors change without a background transition so
button text never flashes against a previous theme's background. Reduced
motion preferences disable remaining transitions and animations.

## References consulted

- [1Password](https://1password.com/product/password-manager): clear hierarchy,
  sidebar navigation, compact entry identities and prominent primary actions.
- [Proton Pass](https://proton.me/pass): a recognizable violet accent and calm
  surfaces around the password-management workflow.
- [Bitwarden](https://bitwarden.com/products/personal/): mobile search, grouped
  content and bottom navigation with labels and icons.

These are visual references, not dependencies. No artwork, remote fonts,
analytics, third-party scripts or favicon requests were added to the app.

## Preview

Screenshots use only synthetic entries and a desktop Chromium browser. The
mobile screenshots use a 390-pixel viewport; they are not physical-iPhone
test evidence.

| Palette | Preview |
| --- | --- |
| Colorful | [Desktop vault](design/color-desktop.png) |
| Light | [Desktop vault](design/light-desktop.png) |
| Dark | [Desktop vault](design/dark-desktop.png) |

[Mobile settings](design/settings-mobile.png) · [Locked screen](design/locked-mobile.png)
