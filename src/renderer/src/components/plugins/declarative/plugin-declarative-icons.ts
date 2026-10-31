import {
  Bell,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleDashed,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Filter,
  Folder,
  GitBranch,
  Info,
  Link,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Square,
  Star,
  Terminal,
  Trash2,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon
} from 'lucide-react'
import { createElement } from 'react'
import {
  PLUGIN_DECLARATIVE_ICON_SET,
  type PluginDeclarativeIconName
} from '../../../../../shared/plugins/declarative/plugin-declarative-catalog'

// Why a closed map: names are Orca's, so the glyph set can change without breaking plugins, and
// lucide's full `icons` table would defeat tree-shaking.
const ICONS: Record<PluginDeclarativeIconName, LucideIcon> = {
  add: Plus,
  remove: Minus,
  delete: Trash2,
  edit: Pencil,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  check: Check,
  close: X,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  'open-external': ExternalLink,
  copy: Copy,
  download: Download,
  upload: Upload,
  play: Play,
  pause: Pause,
  stop: Square,
  more: Ellipsis,
  expand: ChevronDown,
  collapse: ChevronUp,
  next: ChevronRight,
  filter: Filter,
  branch: GitBranch,
  file: FileText,
  folder: Folder,
  terminal: Terminal,
  agent: Bot,
  star: Star,
  bell: Bell,
  calendar: Calendar,
  link: Link
}

function isIconName(name: string): name is PluginDeclarativeIconName {
  return PLUGIN_DECLARATIVE_ICON_SET.has(name)
}

/** Any other name (a newer catalog, or a typo) shows a neutral fallback glyph. */
export function resolvePluginDeclarativeIcon(name: string): LucideIcon {
  return isIconName(name) ? ICONS[name] : CircleDashed
}

/** Renders a catalog icon; a component so callers never create one during render. */
export function PluginDeclarativeIconGlyph({
  name,
  className
}: {
  name: string
  className?: string
}): React.JSX.Element {
  return createElement(resolvePluginDeclarativeIcon(name), { className })
}
