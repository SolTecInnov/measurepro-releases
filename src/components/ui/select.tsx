import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Select({ value = '', onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  
  return (
    <SelectContext.Provider value={{ 
      value, 
      onValueChange: onValueChange || (() => {}), 
      open, 
      setOpen 
    }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    
    return (
      <button
        ref={ref}
        type="button"
        onClick={() => context?.setOpen(!context.open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

interface SelectValueProps {
  placeholder?: string
}

function SelectValue({ placeholder }: SelectValueProps) {
  const context = React.useContext(SelectContext)
  return <span>{context?.value || placeholder}</span>
}

interface SelectContentProps {
  children: React.ReactNode
}

function SelectContent({ children }: SelectContentProps) {
  const context = React.useContext(SelectContext)
  
  if (!context?.open) return null
  
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => context.setOpen(false)}
      />
      <div className="absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
        {children}
      </div>
    </>
  )
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  children: React.ReactNode
}

function SelectItem({ value, children, className, ...props }: SelectItemProps) {
  const context = React.useContext(SelectContext)
  
  return (
    <div
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        context?.value === value && "bg-accent",
        className
      )}
      onClick={() => {
        context?.onValueChange(value)
        context?.setOpen(false)
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
