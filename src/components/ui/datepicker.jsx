import React from "react"
        import { format } from "date-fns"
        import { id } from "date-fns/locale"
        import { Calendar as CalendarIcon } from "lucide-react"

        import { cn } from "@/lib/utils"
        import { Button } from "@/components/ui/button"
        import { Calendar } from "@/components/ui/calendar"
        import {
          Popover,
          PopoverContent,
          PopoverTrigger,
        } from "@/components/ui/popover"

        export function DatePicker({ date, onDateChange, placeholder }) {
          return (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: id }) : <span>{placeholder || "Pilih tanggal"}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={onDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )
        }

        export function DatePickerWithRange({
          className,
          date,
          onDateChange
        }) {
          return (
            <div className={cn("grid gap-2", className)}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "d MMM yyyy", { locale: id })} -{" "}
                          {format(date.to, "d MMM yyyy", { locale: id })}
                        </>
                      ) : (
                        format(date.from, "d MMM yyyy", { locale: id })
                      )
                    ) : (
                      <span>Pilih rentang tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={onDateChange}
                    numberOfMonths={2}
                    locale={id}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )
        }