/** @jsxImportSource orca */
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
} from 'orca'

type Todo = { id: number; title: string; done: boolean }

const draft = atom('')
const todos = atom<Todo[]>([
  { id: 1, title: 'Read the declarative UI guide', done: true },
  { id: 2, title: 'Build a panel', done: false }
])
let nextId = 3

function add(): void {
  const title = read(draft).trim()
  if (!title) {
    return
  }
  update(todos, (list) => [...list, { id: nextId++, title, done: false }])
  update(draft, '')
}

function toggle(id: number): void {
  update(todos, (list) =>
    list.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo))
  )
}

function TodoList({ items }: { items: Todo[] }) {
  if (items.length === 0) {
    return <EmptyState icon="check" title="Nothing to do" description="Add a task above." />
  }
  return (
    <List label="Tasks">
      {items.map((todo) => (
        <ListItem
          key={String(todo.id)}
          icon={todo.done ? 'check' : 'stop'}
          title={todo.title}
          description={todo.done ? 'Done' : 'Open'}
          onPress={() => toggle(todo.id)}
        />
      ))}
    </List>
  )
}

export default function Panel() {
  const items = read(todos)
  const open = items.filter((todo) => !todo.done).length
  return (
    <Stack gap="md">
      <Row justify="between">
        <Heading>Tasks</Heading>
        <Badge tone={open > 0 ? 'accent' : 'neutral'}>{open} open</Badge>
      </Row>
      <Row gap="xs">
        <Input
          label="New task"
          labelHidden
          placeholder="New task"
          value={read(draft)}
          onChange={(value) => update(draft, value)}
          onSubmit={add}
        />
        <IconButton icon="add" label="Add task" onPress={add} disabled={!read(draft).trim()} />
      </Row>
      <TodoList items={items} />
      <Row justify="end">
        <Button
          variant="ghost"
          onPress={() => update(todos, (list) => list.filter((todo) => !todo.done))}
        >
          Clear done
        </Button>
      </Row>
      <Text muted size="xs">
        Runs isolated with no network; Orca draws every control.
      </Text>
    </Stack>
  )
}
