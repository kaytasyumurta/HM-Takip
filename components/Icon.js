'use client'
import {
  Home, Building2, Users, ShieldCheck, Sun, Moon, Power, Search, Plus, Eye, Pencil,
  Filter, RefreshCw, Clock, CheckCircle2, Truck, Scale, BarChart3, KeyRound, Menu,
  Ban, CalendarDays, X, ArrowLeft, UserPlus, History, AlertTriangle, Trash2, Layers, Download, Printer, RotateCcw,
} from 'lucide-react'

const MAP = {
  home: Home, building: Building2, users: Users, shield: ShieldCheck, sun: Sun, moon: Moon,
  power: Power, search: Search, plus: Plus, eye: Eye, pencil: Pencil, filter: Filter,
  refresh: RefreshCw, clock: Clock, check: CheckCircle2, truck: Truck, scale: Scale,
  chart: BarChart3, key: KeyRound, menu: Menu, ban: Ban, calendar: CalendarDays, close: X,
  back: ArrowLeft, userplus: UserPlus, history: History, alert: AlertTriangle, trash: Trash2, layers: Layers, download: Download, printer: Printer, rotate: RotateCcw,
}

export default function Icon({ name, size = 18, ...rest }) {
  const C = MAP[name] || Home
  return <C size={size} {...rest} />
}
