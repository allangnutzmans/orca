// Author typings for Orca declarative panels (`"runtime": "declarative"`). Experimental: the API may
// change before 1.0. Copy this file into a plugin project and list it in tsconfig `files`/`include`.
// Mirrors src/shared/plugins/declarative/ (checked by plugin-declarative-typings.test.ts).

declare module 'orca' {
  export type OrcaElement = { readonly $$typeof: symbol }
  export type OrcaNode =
    | OrcaElement
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly OrcaNode[]
  /** Catalog tags are JSX-only: write `<Stack>`, never call `Stack()`. */
  export type OrcaComponent<P> = (props: P) => OrcaNode
  export type Atom<T> = { readonly __orcaAtom: T }
  export type Disposable = { dispose(): void }
  export type Theme = { colorScheme: 'light' | 'dark' }

  export type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg'
  export type Align = 'start' | 'center' | 'end' | 'stretch'
  /** The one colour vocabulary every component shares. */
  export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  export type Size = 'xs' | 'sm' | 'md'
  export type Variant = 'solid' | 'outline' | 'ghost'
  export type Press = () => unknown
  /** Orca-owned icon names; any other name shows a fallback glyph. */
  export type IconName =
    | 'add'
    | 'remove'
    | 'delete'
    | 'edit'
    | 'refresh'
    | 'search'
    | 'settings'
    | 'check'
    | 'close'
    | 'info'
    | 'warning'
    | 'error'
    | 'open-external'
    | 'copy'
    | 'download'
    | 'upload'
    | 'play'
    | 'pause'
    | 'stop'
    | 'more'
    | 'expand'
    | 'collapse'
    | 'next'
    | 'filter'
    | 'branch'
    | 'file'
    | 'folder'
    | 'terminal'
    | 'agent'
    | 'star'
    | 'bell'
    | 'calendar'
    | 'link'

  type WithChildren = { children?: OrcaNode }
  type Leaf = { children?: never }

  export type StackProps = WithChildren & { gap?: Gap; align?: Align }
  export type RowProps = WithChildren & {
    gap?: Gap
    align?: Align
    justify?: 'start' | 'center' | 'end' | 'between'
    wrap?: boolean
  }
  export type TextProps = WithChildren & {
    tone?: Tone
    muted?: boolean
    size?: Size
    weight?: 'regular' | 'medium' | 'semibold'
    truncate?: boolean
  }
  export type HeadingProps = WithChildren & { level?: 1 | 2 | 3 }
  export type ButtonProps = WithChildren & {
    variant?: Variant
    tone?: Tone
    size?: Size
    icon?: IconName
    disabled?: boolean
    onPress?: Press
  }
  export type IconButtonProps = Leaf & {
    icon: IconName
    /** Accessible name and tooltip. */
    label: string
    variant?: Variant
    tone?: Tone
    size?: Size
    disabled?: boolean
    onPress?: Press
  }
  export type BadgeProps = WithChildren & { tone?: Tone }
  export type CardProps = WithChildren & { title?: string; description?: string }
  export type ListProps = WithChildren & { label?: string }
  /** With `onPress` the whole row is the press target, so it cannot contain other controls. */
  export type ListItemProps = WithChildren & {
    title?: string
    description?: string
    icon?: IconName
    current?: boolean
    disabled?: boolean
    onPress?: Press
  }
  /**
   * Orca keeps the text as the person types. `defaultValue` seeds it; a changed `value` replaces
   * it (an echo of what was typed does not). `value` without `onChange` is read-only.
   */
  export type InputProps = Leaf & {
    label: string
    labelHidden?: boolean
    value?: string
    defaultValue?: string
    placeholder?: string
    type?: 'text' | 'search' | 'password'
    maxLength?: number
    invalid?: boolean
    disabled?: boolean
    onChange?: (value: string) => void
    onSubmit?: (value: string) => void
  }
  export type SwitchProps = Leaf & {
    label: string
    checked?: boolean
    defaultChecked?: boolean
    disabled?: boolean
    onChange?: (checked: boolean) => void
  }
  export type SelectProps = Leaf & {
    label: string
    labelHidden?: boolean
    value?: string
    defaultValue?: string
    placeholder?: string
    options: readonly { value: string; label: string; disabled?: boolean }[]
    disabled?: boolean
    onChange?: (value: string) => void
  }
  export type SeparatorProps = Leaf & { orientation?: 'horizontal' | 'vertical' }
  export type ProgressProps = Leaf & { label: string; labelHidden?: boolean; value?: number }
  export type SpinnerProps = Leaf & { label: string; labelHidden?: boolean }
  export type EmptyStateProps = WithChildren & {
    title: string
    description?: string
    icon?: IconName
  }
  export type LinkProps = WithChildren & { href?: string; onPress?: Press }
  export type CodeProps = WithChildren & { block?: boolean }

  export const Stack: OrcaComponent<StackProps>
  export const Row: OrcaComponent<RowProps>
  export const Text: OrcaComponent<TextProps>
  export const Heading: OrcaComponent<HeadingProps>
  export const Button: OrcaComponent<ButtonProps>
  export const IconButton: OrcaComponent<IconButtonProps>
  export const Badge: OrcaComponent<BadgeProps>
  export const Card: OrcaComponent<CardProps>
  export const List: OrcaComponent<ListProps>
  export const ListItem: OrcaComponent<ListItemProps>
  export const Input: OrcaComponent<InputProps>
  export const Switch: OrcaComponent<SwitchProps>
  export const Select: OrcaComponent<SelectProps>
  export const Separator: OrcaComponent<SeparatorProps>
  export const Progress: OrcaComponent<ProgressProps>
  export const Spinner: OrcaComponent<SpinnerProps>
  export const EmptyState: OrcaComponent<EmptyStateProps>
  export const Link: OrcaComponent<LinkProps>
  export const Code: OrcaComponent<CodeProps>

  /** Grows with the component catalog, for feature detection. */
  export const ui: { readonly version: number }

  export const Fragment: unique symbol
  export function h(type: unknown, props: object | null, ...children: OrcaNode[]): OrcaElement

  export function atom<T>(initial: T): Atom<T>
  /** Reading during render subscribes the panel to the atom. */
  export function read<T>(atom: Atom<T>): T
  /**
   * Batched: several updates in one task re-render once. A function is treated as an updater.
   * Throws when called while rendering.
   */
  export function update<T>(atom: Atom<T>, next: T | ((previous: T) => T)): void
  /** Optional: a module's default export is mounted automatically. */
  export function mount(component: () => OrcaNode): void

  export const host: {
    call<R = unknown>(
      method: string,
      params?: unknown,
      options?: { signal?: AbortSignal }
    ): Promise<R>
  }
  export function on(event: string, handler: (payload: unknown) => void): Disposable
  /** Reading during render re-renders on light/dark switches. */
  export function theme(): Theme
}

declare module 'orca/jsx-runtime' {
  import type { OrcaElement, OrcaNode } from 'orca'
  export { Fragment } from 'orca'
  export function jsx(type: unknown, props: object, key?: string | number): OrcaElement
  export function jsxs(type: unknown, props: object, key?: string | number): OrcaElement
  export namespace JSX {
    type Element = OrcaElement
    type ElementType = (props: never) => OrcaNode
    type ElementChildrenAttribute = { children: unknown }
    type IntrinsicAttributes = { key?: string | number }
    // No lowercase tags: panels never render DOM.
    type IntrinsicElements = {}
  }
}

declare module 'orca/jsx-dev-runtime' {
  import type { OrcaElement } from 'orca'
  export { Fragment, JSX } from 'orca/jsx-runtime'
  export function jsxDEV(type: unknown, props: object, key?: string | number): OrcaElement
}
