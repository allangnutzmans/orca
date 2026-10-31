import { useState } from 'react'

// Edits not yet echoed back; bounded so a guest that never echoes cannot grow it.
const MAX_UNECHOED_EDITS = 64

type HostValueState<T> = { local: T; remote: T | undefined; unechoed: T[] }

/**
 * Value of a control the host owns: what the person typed stays put across re-renders. A guest
 * `value` that echoes one of the person's own edits is ignored (it lags their typing); any other
 * new `value` is the guest setting the control explicitly (clearing an input after submit, say).
 */
export function usePluginDeclarativeHostValue<T>(options: {
  value: T | undefined
  defaultValue: T | undefined
  fallback: T
  callback: string | undefined
  send: (callback: string, value: T) => void
}): { value: T; change: (next: T) => void; readOnly: boolean } {
  const { value, callback, send } = options
  const [state, setState] = useState<HostValueState<T>>(() => ({
    local: value ?? options.defaultValue ?? options.fallback,
    remote: value,
    unechoed: []
  }))
  let current = state
  if (!Object.is(state.remote, value)) {
    const echo =
      value === undefined ? -1 : state.unechoed.findIndex((sent) => Object.is(sent, value))
    current =
      value === undefined
        ? { ...state, remote: value }
        : echo >= 0
          ? { ...state, remote: value, unechoed: state.unechoed.slice(echo + 1) }
          : { local: value, remote: value, unechoed: [] }
    setState(current)
  }
  return {
    value: current.local,
    // A controlled value with no handler is the guest's to set: the person cannot edit it.
    readOnly: value !== undefined && callback === undefined,
    change: (next) => {
      setState((previous) => ({
        ...previous,
        local: next,
        unechoed: [...previous.unechoed, next].slice(-MAX_UNECHOED_EDITS)
      }))
      if (callback) {
        send(callback, next)
      }
    }
  }
}
