# Declarative plugin UI (TSX)

> **Experimental:** the declarative API may change before 1.0. Check `ui.version` to feature-detect.

A declarative panel describes its UI as data; Orca draws it with its own components, so it matches the
app in light and dark, follows its keyboard and focus rules, and needs no HTML or CSS. The module runs in
the plugin's isolated frame ([plugin-isolated-frames.md](./plugin-isolated-frames.md)).

## Manifest

```json
{
  "execution": "sandboxed-ui",
  "contributes": {
    "panels": [
      { "id": "todos", "title": "Todos", "entry": "dist/panel.js", "runtime": "declarative" }
    ]
  }
}
```

`runtime` defaults to `frame` (an HTML page). With `declarative`, `entry` must be a `.js` or `.mjs` ES module.

## Writing a panel

```tsx
/** @jsxImportSource orca */
import { atom, read, update, Stack, Text, Button } from 'orca'

const count = atom(0)

export default function Panel() {
  return (
    <Stack gap="sm">
      <Text>Clicked {read(count)} times</Text>
      <Button onPress={() => update(count, (n) => n + 1)}>Click</Button>
    </Stack>
  )
}
```

- The default export must be a component function; it is mounted as the panel. `mount(Component)` does
  the same explicitly.
- Catalog components are imported from `orca` by name. They are JSX tags only, and lowercase tags such as
  `<div>` do not exist.
- Function components take props and `children` as in React. There are no hooks: keep state in atoms.
- `atom(initial)`, `read(atom)`, `update(atom, valueOrUpdater)`: reading an atom while rendering subscribes
  the panel to it; updates are batched and re-render at most about once per frame. A function passed to
  `update` is an updater, so an atom cannot hold a function. Calling `update` while rendering throws.
- Props are plain JSON data (strings, finite numbers, booleans, null, arrays, plain objects) or event
  handler functions. Anything else (a `Date`, a `Map`, a class instance) is reported as an error and the
  render is not shown.
- `key` works as in React. Give items of lists that reorder a `key`; siblings must not share one.
- `host.call(method, params)` and `on(event, handler)` are the same host API and events as frame panels
  ([plugin-host-api.md](./plugin-host-api.md)); capability rules are unchanged.
- `theme()` returns `{ colorScheme: 'light' | 'dark' }`; reading it while rendering re-renders on a switch.
- `ui.version` is a number that grows with the component catalog.

Types: copy [`resources/plugins/declarative/orca.d.ts`](../../resources/plugins/declarative/orca.d.ts) into
your project and include it from `tsconfig.json` with `"jsx": "react-jsx"` and `"jsxImportSource": "orca"`.

## Building

`orca` is provided by Orca at runtime, so leave it out of the bundle:

```sh
esbuild src/panel.tsx --bundle --format=esm --jsx=automatic --jsx-import-source=orca \
  --external:orca --external:'orca/*' --outfile=dist/panel.js
```

`/** @jsx h */` with `import { h, Fragment } from 'orca'` (classic `jsxFactory`) also works. The sample in
[`examples/plugins/hello-declarative`](../../examples/plugins/hello-declarative) has a build script.

## Catalog

Props are semantic: tones, sizes and gaps, never class names, styles or colours. Colour has one
vocabulary, `tone`: `neutral` `accent` `success` `warning` `danger`.

| Component    | Props                                                                                                                                                                                    | Children                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `Stack`      | `gap` (`none` `xs` `sm` `md` `lg`), `align` (`start` `center` `end` `stretch`)                                                                                                           | any                                |
| `Row`        | `gap`, `align`, `justify` (`start` `center` `end` `between`), `wrap`                                                                                                                     | any                                |
| `Text`       | `tone`, `muted`, `size` (`xs` `sm` `md`), `weight` (`regular` `medium` `semibold`), `truncate`                                                                                           | text, `Text` `Link` `Code` `Badge` |
| `Heading`    | `level` (1–3, below the panel title)                                                                                                                                                     | as `Text`                          |
| `Button`     | `variant` (`solid` `outline` `ghost`), `tone`, `size`, `icon`, `disabled`, `onPress()`                                                                                                   | text                               |
| `IconButton` | `icon` and `label` (required; the label is its name and tooltip), `variant`, `tone`, `size`, `disabled`, `onPress()`                                                                     | none                               |
| `Badge`      | `tone`                                                                                                                                                                                   | text                               |
| `Card`       | `title`, `description`                                                                                                                                                                   | any                                |
| `List`       | `label`                                                                                                                                                                                  | `ListItem` only                    |
| `ListItem`   | `title`, `description`, `icon`, `current`, `disabled`, `onPress()`                                                                                                                       | any; no controls with `onPress`    |
| `Input`      | `label` (required), `labelHidden`, `value`, `defaultValue`, `placeholder`, `type` (`text` `search` `password`), `maxLength`, `invalid`, `disabled`, `onChange(value)`, `onSubmit(value)` | none                               |
| `Switch`     | `label` (required), `checked`, `defaultChecked`, `disabled`, `onChange(checked)`                                                                                                         | none                               |
| `Select`     | `label` (required), `labelHidden`, `value`, `defaultValue`, `placeholder`, `options` (`{ value, label, disabled? }[]`), `disabled`, `onChange(value)`                                    | none                               |
| `Separator`  | `orientation` (`horizontal` `vertical`)                                                                                                                                                  | none                               |
| `Progress`   | `label` (required), `labelHidden`, `value` (0–100)                                                                                                                                       | none                               |
| `Spinner`    | `label` (required), `labelHidden`                                                                                                                                                        | none                               |
| `EmptyState` | `title` (required), `description`, `icon`                                                                                                                                                | actions                            |
| `Link`       | `href` (`https:`, `http:`, `mailto:`; opened in the OS browser), `onPress()`                                                                                                             | text                               |
| `Code`       | `block`                                                                                                                                                                                  | text                               |

`labelHidden` keeps the label as the control's accessible name without showing it.

**Icons** are Orca's own names, not a glyph library's: `add` `remove` `delete` `edit` `refresh` `search`
`settings` `check` `close` `info` `warning` `error` `open-external` `copy` `download` `upload` `play`
`pause` `stop` `more` `expand` `collapse` `next` `filter` `branch` `file` `folder` `terminal` `agent` `star`
`bell` `calendar` `link`. Any other name shows a neutral fallback glyph.

**Forward compatibility:** an unknown prop or enum value is dropped (Orca logs a warning once), and an
unknown component, or one missing a required prop, is drawn as a neutral placeholder, so a panel built for a
newer Orca still shows the rest of its UI. Only structural problems (a `ListItem` outside a `List`, a
`Stack` inside `Text`, duplicate keys, controls inside a pressable `ListItem`) and the limits below refuse a
render.

Import only the components your minimum supported Orca exports. `orca` is a real ES module, so a named
import it lacks (`import { Carousel } from 'orca'` on an older Orca) is a link error: the whole panel
module fails to load, rather than getting `undefined`. For a component newer than your minimum, check
`ui.version` and create it by name with `h`; an Orca that does not know it draws the placeholder:

```tsx
import { h, ui, Text } from 'orca'

// Carousel arrived in catalog version 2 (hypothetical).
const gallery =
  ui.version >= 2 ? (
    h('Carousel', { label: 'Shots' })
  ) : (
    <Text muted>Update Orca to see the gallery.</Text>
  )
```

## Inputs

Orca owns what the person types, so a re-render never drops characters and Enter submits exactly what is on
screen. `onChange(value)` reports each edit; `onSubmit(value)` fires on Enter.

- `defaultValue` seeds an uncontrolled field.
- `value` controls it: when you render a new `value` (for example `''` after submit) the field shows it. A
  `value` that only echoes what the person typed does not move their cursor or text.
- `value` without `onChange` makes the field read-only. `Switch` (`checked`/`defaultChecked`) and `Select`
  (`value`/`defaultValue`) work the same way.

A handler that throws (or rejects) is reported in a banner attributed to your plugin; the panel keeps its
last good render.

## Limits

A render is refused, and the last good one kept, beyond 5000 nodes, depth 64, about 512 KiB of data,
16 KiB per text, 1 KiB per label prop, 32 props per node or 500 `Select` options.

## User gestures

`host.call('shell.openExternal' | 'files.saveAs')` needs a user gesture, and only a press on Orca's own
controls counts (the hidden module never has one of its own). A press on a `Button`, `IconButton`,
`ListItem` or `Link` grants one call within 1 s, but only when that control has been stationary for 500 ms:
the same place in the tree, the same label and target, and the same position on screen. Anything that
moves it (including a sibling growing above it) restarts the wait, so a panel cannot slide a control under
the pointer just before a click. Scrolling the panel does not count as a move.

A `Link` follows the same rule before anything happens: a press on an unsettled `Link` neither opens its
`href` nor runs its `onPress`. When a `Link` has both, the `href` open uses the press, and `onPress` runs
without granting a second gesture.

## Isolation

The module runs in a hidden, sandboxed guest of the plugin's own partition, with the same isolation as frame
panels: no network (requests outside the plugin's own files are cancelled; Electron 43 still resolves
`dns-prefetch` hostnames), no Node, no popups, no DOM the person sees. It reaches Orca only through
`host.call`, `on`, and the UI it renders. Declarative panels need the desktop app: browser clients
(`orca serve` in a web browser) show that instead of the panel.
