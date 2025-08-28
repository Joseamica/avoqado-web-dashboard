import React, { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TimePickerProps {
  value?: string // 24-hour format: "14:30" or "08:00"
  onChange?: (value: string) => void // Emits 24-hour format
  placeholder?: string
  className?: string
}

const TimePicker: React.FC<TimePickerProps> = ({ 
  value, 
  onChange, 
  _placeholder = "Seleccionar hora",
  className = ""
}) => {
  // Internal state to maintain the current selections
  const [internalState, setInternalState] = useState<{
    hour?: string
    minute?: string  
    period?: string
  }>({ hour: undefined, minute: undefined, period: undefined })

  // Convert 24-hour format to 12-hour format for display
  const parseTime = (time24: string) => {
    if (!time24 || time24.trim() === '') return { hour: undefined, minute: undefined, period: undefined }
    
    const parts = time24.split(':')
    if (parts.length !== 2) return { hour: undefined, minute: undefined, period: undefined }
    
    const [hours24, minutes] = parts
    const hour24 = parseInt(hours24, 10)
    
    if (isNaN(hour24) || hour24 < 0 || hour24 > 23) {
      return { hour: undefined, minute: undefined, period: undefined }
    }
    
    let hour12 = hour24
    let period = 'AM'
    
    if (hour24 === 0) {
      hour12 = 12
      period = 'AM'
    } else if (hour24 === 12) {
      hour12 = 12
      period = 'PM'
    } else if (hour24 > 12) {
      hour12 = hour24 - 12
      period = 'PM'
    }
    
    return {
      hour: hour12.toString(),
      minute: minutes,
      period
    }
  }

  // Update internal state when value prop changes
  useEffect(() => {
    const parsed = parseTime(value || '')
    setInternalState(parsed)
  }, [value])

  // Convert 12-hour format to 24-hour format
  const formatTo24Hour = (hour: string, minute: string, period: string) => {
    if (!hour || !minute || !period) return ''
    
    let hour24 = parseInt(hour, 10)
    
    if (period === 'AM' && hour24 === 12) {
      hour24 = 0
    } else if (period === 'PM' && hour24 !== 12) {
      hour24 += 12
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`
  }

  const handleTimeChange = (field: 'hour' | 'minute' | 'period', newValue: string) => {
    const updatedTime = { ...internalState, [field]: newValue }
    setInternalState(updatedTime)
    
    console.log('TimePicker - Field changed:', field, '=', newValue)
    console.log('TimePicker - Updated time:', updatedTime)
    
    if (updatedTime.hour && updatedTime.minute && updatedTime.period) {
      const time24 = formatTo24Hour(updatedTime.hour, updatedTime.minute, updatedTime.period)
      console.log('TimePicker - Formatted 24h time:', time24)
      onChange?.(time24)
    } else {
      console.log('TimePicker - Incomplete time, not calling onChange')
    }
  }

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  
  // Generate minute options (00, 15, 30, 45)
  const minuteOptions = ['00', '15', '30', '45']

  return (
    <div className={`flex gap-2 ${className}`}>
      <Select
        value={internalState.hour}
        onValueChange={(value) => handleTimeChange('hour', value)}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Hora" />
        </SelectTrigger>
        <SelectContent>
          {hourOptions.map((hour) => (
            <SelectItem key={hour} value={hour}>
              {hour}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="self-center text-lg font-medium">:</span>

      <Select
        value={internalState.minute}
        onValueChange={(value) => handleTimeChange('minute', value)}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {minuteOptions.map((minute) => (
            <SelectItem key={minute} value={minute}>
              {minute}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={internalState.period}
        onValueChange={(value) => handleTimeChange('period', value)}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export default TimePicker