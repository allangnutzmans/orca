// Built from src/panel.tsx by build.mjs.

// examples/plugins/hello-declarative/src/panel.tsx
import {
  atom,
  Badge,
  Button,
  EmptyState,
  Heading,
  IconButton,
  Input,
  List,
  ListItem,
  read,
  Row,
  Stack,
  Text,
  update
} from "orca";
import { jsx, jsxs } from "orca/jsx-runtime";
var draft = atom("");
var todos = atom([
  { id: 1, title: "Read the declarative UI guide", done: true },
  { id: 2, title: "Build a panel", done: false }
]);
var nextId = 3;
function add() {
  const title = read(draft).trim();
  if (!title) {
    return;
  }
  update(todos, (list) => [...list, { id: nextId++, title, done: false }]);
  update(draft, "");
}
function toggle(id) {
  update(
    todos,
    (list) => list.map((todo) => todo.id === id ? { ...todo, done: !todo.done } : todo)
  );
}
function TodoList({ items }) {
  if (items.length === 0) {
    return /* @__PURE__ */ jsx(EmptyState, { icon: "check", title: "Nothing to do", description: "Add a task above." });
  }
  return /* @__PURE__ */ jsx(List, { label: "Tasks", children: items.map((todo) => /* @__PURE__ */ jsx(
    ListItem,
    {
      icon: todo.done ? "check" : "stop",
      title: todo.title,
      description: todo.done ? "Done" : "Open",
      onPress: () => toggle(todo.id)
    },
    String(todo.id)
  )) });
}
function Panel() {
  const items = read(todos);
  const open = items.filter((todo) => !todo.done).length;
  return /* @__PURE__ */ jsxs(Stack, { gap: "md", children: [
    /* @__PURE__ */ jsxs(Row, { justify: "between", children: [
      /* @__PURE__ */ jsx(Heading, { children: "Tasks" }),
      /* @__PURE__ */ jsxs(Badge, { tone: open > 0 ? "accent" : "neutral", children: [
        open,
        " open"
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Row, { gap: "xs", children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          label: "New task",
          labelHidden: true,
          placeholder: "New task",
          value: read(draft),
          onChange: (value) => update(draft, value),
          onSubmit: add
        }
      ),
      /* @__PURE__ */ jsx(IconButton, { icon: "add", label: "Add task", onPress: add, disabled: !read(draft).trim() })
    ] }),
    /* @__PURE__ */ jsx(TodoList, { items }),
    /* @__PURE__ */ jsx(Row, { justify: "end", children: /* @__PURE__ */ jsx(
      Button,
      {
        variant: "ghost",
        onPress: () => update(todos, (list) => list.filter((todo) => !todo.done)),
        children: "Clear done"
      }
    ) }),
    /* @__PURE__ */ jsx(Text, { muted: true, size: "xs", children: "Runs isolated with no network; Orca draws every control." })
  ] });
}
export {
  Panel as default
};
