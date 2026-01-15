/* eslint-disable react-refresh/only-export-components */
/** DnDMultipleSelector.tsx */
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Command as CommandPrimitive, useCommandState } from 'cmdk'
import { Eye, GripVertical, X } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { Badge } from '@/components/ui/badge'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/* -----------------------------------------
   Original MultipleSelector types & utils
----------------------------------------- */

export interface Option {
  value: string
  label: string
  disable?: boolean
  fixed?: boolean
  [key: string]: string | boolean | undefined
}

interface GroupOption {
  [key: string]: Option[]
}

export interface MultipleSelectorProps {
  value?: Option[]
  defaultOptions?: Option[]
  options?: Option[]
  placeholder?: string
  loadingIndicator?: React.ReactNode
  emptyIndicator?: React.ReactNode
  delay?: number
  onSearch?: (value: string) => Promise<Option[]>
  onSearchSync?: (value: string) => Option[]
  onChange?: (options: Option[]) => void
  maxSelected?: number
  onMaxSelected?: (maxLimit: number) => void
  hidePlaceholderWhenSelected?: boolean
  disabled?: boolean
  groupBy?: string
  className?: string
  badgeClassName?: string
  selectFirstItem?: boolean
  creatable?: boolean
  triggerSearchOnFocus?: boolean
  commandProps?: React.ComponentPropsWithoutRef<typeof Command>
  inputProps?: Omit<React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>, 'value' | 'placeholder' | 'disabled'>
  hideClearAllButton?: boolean
}

/** The ref for controlling the MultiSelector from outside */
export interface MultipleSelectorRef {
  selectedValue: Option[]
  input: HTMLInputElement
  focus: () => void
  reset: () => void
}

export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

function transToGroupOption(options: Option[], groupBy?: string) {
  if (!options?.length) return {}
  if (!groupBy) {
    return { '': options }
  }

  const groupOption: GroupOption = {}
  options.forEach(option => {
    const key = (option[groupBy] as string) || ''
    if (!groupOption[key]) {
      groupOption[key] = []
    }
    groupOption[key].push(option)
  })
  return groupOption
}

function removePickedOption(groupOption: GroupOption, picked: Option[]) {
  const cloneOption = JSON.parse(JSON.stringify(groupOption)) as GroupOption

  for (const [key, value] of Object.entries(cloneOption)) {
    cloneOption[key] = value.filter(val => !picked.find(p => p.value === val.value))
  }
  return cloneOption
}

// Removed unused function isOptionsExist

const CommandEmpty = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof CommandPrimitive.Empty>>(
  ({ className, ...props }, forwardedRef) => {
    const render = useCommandState(state => state.filtered.count === 0)
    if (!render) return null
    return (
      <div
        ref={forwardedRef}
        className={cn('py-4 text-center text-sm bg-background', className)}
        cmdk-empty=""
        role="presentation"
        {...props}
      />
    )
  },
)
CommandEmpty.displayName = 'CommandEmpty'

/* -----------------------------------------
   DnD-Specific: SortableBadge
----------------------------------------- */

function SortableBadge({
  option,
  index: _index,
  disabled,
  badgeClassName,
  handleUnselect,
  onViewOption,
  showViewIcon,
}: {
  option: Option
  index: number
  disabled?: boolean
  badgeClassName?: string
  handleUnselect: (opt: Option) => void
  onViewOption?: (option: Option) => void
  showViewIcon?: boolean
}) {
  const { t: tCommon } = useTranslation('common')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.value })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled || option.fixed ? 'not-allowed' : 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Badge
        className={cn(
          'flex items-center py-2 h-9',
          'data-disabled:bg-muted-foreground data-disabled:text-muted data-disabled:hover:bg-muted-foreground',
          'data-fixed:bg-muted-foreground data-fixed:text-muted data-fixed:hover:bg-muted-foreground',
          badgeClassName,
        )}
        data-fixed={option.fixed}
        data-disabled={disabled || undefined}
      >
        <GripVertical className="w-4 h-4 mr-2 text-muted-foreground hover:text-foreground" />
        {option.label}

        {/* View icon button - only shows if onViewOption is provided and showViewIcon is true */}
        {showViewIcon && onViewOption && (
          <button
            className={cn(
              'ml-2 rounded-full outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer',
              disabled && 'hidden',
            )}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onViewOption(option)
              }
            }}
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={e => {
              e.stopPropagation()
              onViewOption(option)
            }}
            title={tCommon('viewDetails')}
          >
            <Eye className="m-1 w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
        {showViewIcon && onViewOption && <Separator orientation="vertical" className="h-4 mx-1" />}

        {/* Delete button */}
        <button
          className={cn(
            'ml-1 rounded-full outline-hidden ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer',
            (disabled || option.fixed) && 'hidden',
          )}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleUnselect(option)
            }
          }}
          onMouseDown={e => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={e => {
            e.stopPropagation()
            handleUnselect(option)
          }}
          title={tCommon('remove')}
        >
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </Badge>
    </div>
  )
}

/* -----------------------------------------
   The main DnDMultipleSelector
----------------------------------------- */

export interface DnDMultipleSelectorProps extends MultipleSelectorProps {
  /** Whether to enable reordering of the selected badges by dragging (true by default). */
  enableReordering?: boolean
  /** Function to handle when eye icon is clicked on a badge. Receives the option that was clicked. */
  onViewOption?: (option: Option) => void
  /** Whether to show the eye icon for viewing items (only shows if onViewOption is provided) */
  showViewIcon?: boolean
  /** The name of the item type being added, displayed as "Add {itemName}" (e.g., "product" would display "Add product") */
  itemName?: string
  /** Whether to show the fixed "Add {itemName}" option in the dropdown (true by default) */
  showAddItemText?: boolean
}

const DnDMultipleSelector = React.forwardRef<MultipleSelectorRef, DnDMultipleSelectorProps>(
  (
    {
      value,
      onChange,
      placeholder,
      defaultOptions = [],
      options: manualOptions,
      delay,
      onSearch,
      onSearchSync,
      loadingIndicator,
      emptyIndicator,
      maxSelected = Number.MAX_SAFE_INTEGER,
      onMaxSelected,
      hidePlaceholderWhenSelected,
      disabled,
      groupBy,
      className,
      badgeClassName,
      selectFirstItem = true,
      creatable = false,
      triggerSearchOnFocus = false,
      commandProps,
      inputProps,
      hideClearAllButton = false,
      enableReordering = true,
      onViewOption,
      showViewIcon = false,
      itemName = '',
      showAddItemText = true,
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const { t: tCommon } = useTranslation('common')

    const [open, setOpen] = React.useState(false)
    const [onScrollbar, setOnScrollbar] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [selected, setSelected] = React.useState<Option[]>(value || [])
    const [options, setOptions] = React.useState<GroupOption>(transToGroupOption(defaultOptions, groupBy))

    const [inputValue, setInputValue] = React.useState('')
    const debouncedSearchTerm = useDebounce(inputValue, delay || 500)

    // DnDKit setup
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    React.useImperativeHandle(
      ref,
      () => ({
        selectedValue: [...selected],
        input: inputRef.current as HTMLInputElement,
        focus: () => inputRef.current?.focus(),
        reset: () => setSelected([]),
      }),
      [selected],
    )

    // Close dropdown if click outside
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
        inputRef.current.blur()
      }
    }

    const handleUnselect = React.useCallback(
      (option: Option) => {
        const newOptions = selected.filter(s => s.value !== option.value)
        setSelected(newOptions)
        onChange?.(newOptions)
      },
      [onChange, selected],
    )

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        const input = inputRef.current
        if (!input) return
        // If user presses Delete or Backspace with empty input, remove last
        if ((e.key === 'Delete' || e.key === 'Backspace') && input.value === '' && selected.length > 0) {
          const lastOption = selected[selected.length - 1]
          if (!lastOption.fixed) {
            handleUnselect(lastOption)
          }
        }
        if (e.key === 'Escape') {
          input.blur()
        }
      },
      [handleUnselect, selected],
    )

    React.useEffect(() => {
      if (open) {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchend', handleClickOutside)
      } else {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchend', handleClickOutside)
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchend', handleClickOutside)
      }
    }, [open])

    // If "value" changes from outside
    React.useEffect(() => {
      if (value) {
        setSelected(value)
      }
    }, [value])

    // If manualOptions exist and there's no onSearch, use them
    React.useEffect(() => {
      if (!manualOptions || onSearch) return
      const newOption = transToGroupOption(manualOptions, groupBy)
      if (JSON.stringify(newOption) !== JSON.stringify(options)) {
        setOptions(newOption)
      }
    }, [manualOptions, groupBy, onSearch, options])

    // On focusing or typing: run onSearchSync
    React.useEffect(() => {
      const doSearchSync = () => {
        const res = onSearchSync?.(debouncedSearchTerm)
        setOptions(transToGroupOption(res || [], groupBy))
      }
      const exec = async () => {
        if (!onSearchSync || !open) return
        // If user focuses or typed something
        if (triggerSearchOnFocus || debouncedSearchTerm) {
          doSearchSync()
        }
      }
      void exec()
    }, [debouncedSearchTerm, groupBy, open, triggerSearchOnFocus, onSearchSync])

    // On focusing or typing: run onSearch (async)
    React.useEffect(() => {
      const doSearch = async () => {
        setIsLoading(true)
        const res = await onSearch?.(debouncedSearchTerm)
        setOptions(transToGroupOption(res || [], groupBy))
        setIsLoading(false)
      }
      const exec = async () => {
        if (!onSearch || !open) return
        if (triggerSearchOnFocus || debouncedSearchTerm) {
          await doSearch()
        }
      }
      void exec()
    }, [debouncedSearchTerm, groupBy, open, triggerSearchOnFocus, onSearch])

    // CreatableItem functionality has been moved to the fixed footer section below

    // Show empty indicator (or fallback) if no results
    const EmptyItem = React.useCallback(() => {
      if (!emptyIndicator) return <CommandEmpty />
      // For async search
      if (onSearch && !creatable && Object.keys(options).length === 0) {
        return (
          <CommandItem value="-" disabled>
            {emptyIndicator}
          </CommandItem>
        )
      }
      return <CommandEmpty>{emptyIndicator}</CommandEmpty>
    }, [creatable, emptyIndicator, onSearch, options])

    // Filter out already-selected
    const selectables = React.useMemo(() => removePickedOption(options, selected), [options, selected])

    // Overwrite default filtering if needed
    const commandFilter = React.useCallback(() => {
      if (commandProps?.filter) return commandProps.filter
      if (creatable) {
        return (value: string, search: string) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : -1)
      }
      return undefined
    }, [creatable, commandProps?.filter])

    // Reordering via Drag and Drop
    function handleDragEnd(event: DragEndEvent) {
      if (!enableReordering) return
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = selected.findIndex(s => s.value === active.id)
      const newIndex = selected.findIndex(s => s.value === over.id)
      if (oldIndex < 0 || newIndex < 0) return

      const newSelected = arrayMove(selected, oldIndex, newIndex)
      setSelected(newSelected)
      onChange?.(newSelected)
    }

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <Command
          ref={dropdownRef}
          {...commandProps}
          onKeyDown={e => {
            handleKeyDown(e)
            commandProps?.onKeyDown?.(e)
          }}
          className={cn('h-auto overflow-visible bg-background', commandProps?.className)}
          shouldFilter={commandProps?.shouldFilter !== undefined ? commandProps.shouldFilter : !onSearch}
          filter={commandFilter()}
        >
          {/* The input + badges area */}
          <div
            className={cn(
              'min-h-10 rounded-md border border-input text-base md:text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              { 'px-3 py-2': selected.length !== 0, 'cursor-text': !disabled && selected.length !== 0 },
              className,
            )}
            onClick={() => {
              if (disabled) return
              inputRef.current?.focus()
            }}
          >
            <div className="relative flex items-start">
              {/* Badges container with limited width to prevent extending into clear button area */}
              <div className="flex-1 flex flex-wrap gap-1 pr-2">
                <SortableContext items={selected.map(s => s.value)} strategy={verticalListSortingStrategy}>
                  {selected.map((option, index) => (
                    <SortableBadge
                      key={option.value ?? index}
                      option={option}
                      index={index}
                      disabled={disabled}
                      badgeClassName={badgeClassName}
                      handleUnselect={handleUnselect}
                      onViewOption={onViewOption}
                      showViewIcon={showViewIcon}
                    />
                  ))}
                </SortableContext>

                {/* This section is now handled inside the badges container */}

                {/* Input element placed inside the badges container */}
                <CommandPrimitive.Input
                  {...inputProps}
                  ref={inputRef}
                  value={inputValue}
                  disabled={disabled}
                  onValueChange={val => {
                    setInputValue(val)
                    inputProps?.onValueChange?.(val)
                  }}
                  onBlur={event => {
                    if (!onScrollbar) {
                      setOpen(false)
                    }
                    inputProps?.onBlur?.(event)
                  }}
                  onFocus={event => {
                    setOpen(true)
                    // Possibly trigger an immediate search
                    if (triggerSearchOnFocus) {
                      onSearch?.(debouncedSearchTerm)
                    }
                    inputProps?.onFocus?.(event)
                  }}
                  placeholder={hidePlaceholderWhenSelected && selected.length ? '' : placeholder}
                  className={cn(
                    'flex-1 bg-transparent outline-hidden placeholder:text-muted-foreground',
                    {
                      'w-full': hidePlaceholderWhenSelected,
                      'px-3 py-2': selected.length === 0,
                      'ml-1': selected.length !== 0,
                    },
                    inputProps?.className,
                  )}
                />
              </div>

              {/* Clear-all button in its own dedicated space */}
              <div className="shrink-0 flex items-start justify-center w-8 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const keptFixed = selected.filter(s => s.fixed)
                    setSelected(keptFixed)
                    onChange?.(keptFixed)
                  }}
                  className={cn(
                    'h-6 w-6 rounded-lg p-1 flex items-center justify-center bg-muted/50 text-muted-foreground hover:bg-muted/70 transition-colors',
                    (hideClearAllButton || disabled || selected.length < 1 || selected.filter(s => s.fixed).length === selected.length) &&
                      'hidden',
                  )}
                  title={tCommon('clearAll')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* The dropdown list */}
          <div className="relative">
            {open && (
              <div className="absolute z-10 w-full border rounded-md shadow-md top-1 bg-popover text-popover-foreground animate-in overflow-hidden flex flex-col">
                {/* Scrollable content area */}
                <CommandList
                  className="max-h-56 overflow-y-auto overflow-x-hidden outline-hidden grow"
                  onMouseLeave={() => {
                    setOnScrollbar(false)
                  }}
                  onMouseEnter={() => {
                    setOnScrollbar(true)
                  }}
                  onMouseUp={() => {
                    inputRef?.current?.focus()
                  }}
                >
                  {isLoading ? (
                    <>{loadingIndicator}</>
                  ) : (
                    <>
                      {/* Empty state if no results */}
                      {EmptyItem()}

                      {/* Hide auto-select if selectFirstItem === false */}
                      {!selectFirstItem && <CommandItem value="-" className="hidden" />}

                      {/* Render existing groups/options */}
                      {Object.entries(selectables).map(([key, groupItems]) => (
                        <CommandGroup key={key} heading={key} className="bg-background">
                          {groupItems.map(option => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              disabled={option.disable}
                              onMouseDown={e => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              onSelect={() => {
                                if (selected.length >= maxSelected) {
                                  onMaxSelected?.(selected.length)
                                  return
                                }
                                setInputValue('')
                                const newOptions = [...selected, option]
                                setSelected(newOptions)
                                onChange?.(newOptions)
                              }}
                              className={cn('cursor-pointer', option.disable && 'cursor-default text-muted-foreground')}
                            >
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}

                      {/* Create button functionality is handled in the footer below */}
                    </>
                  )}
                </CommandList>

                {/* Fixed footer - Add item button at the bottom */}
                {showAddItemText && (
                  <div className="w-full border-t bg-background z-50 p-1">
                    <CommandItem
                      value="add-item-fixed-option"
                      className="cursor-pointer font-medium bg-muted/40 hover:bg-muted/60"
                      onMouseDown={e => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onSelect={() => {
                        // If onViewOption is provided, handle it like a navigation command
                        if (onViewOption) {
                          // Using a dummy option since we don't have a specific one
                          // We use special "_new" value that you can detect in your handler
                          onViewOption({
                            value: '_new',
                            label: `New ${itemName}`,
                          })
                        } else {
                          // Otherwise just focus the input
                          inputRef.current?.focus()
                        }
                      }}
                    >
                      + Agregar {itemName ? itemName : 'opción'}
                    </CommandItem>
                  </div>
                )}
              </div>
            )}
          </div>
        </Command>
      </DndContext>
    )
  },
)

DnDMultipleSelector.displayName = 'DnDMultipleSelector'
export default DnDMultipleSelector
