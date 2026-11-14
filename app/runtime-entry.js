// Shared offline React 18 runtime for Windows and macOS.
// Built with esbuild and embedded into the desktop executable.
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {
  AlertCircle, ArrowUpRight, BriefcaseBusiness, Calculator, CalendarDays,
  Check, ChevronRight, ClipboardList, CloudOff, Download, Edit3, Eye,
  FileDown, FileImage, FileSpreadsheet, FileText, Filter, FolderOpen,
  FolderPlus, HardHat, Info, LayoutDashboard, MapPin, Menu, Paperclip,
  Plus, Rows3, Save, Search, Settings2, Trash2, Upload, X
} from 'lucide-react';

Object.assign(window, {
  React, createRoot,
  useState:React.useState, useEffect:React.useEffect,
  useMemo:React.useMemo, useRef:React.useRef, useCallback:React.useCallback,
  AlertCircle, ArrowUpRight, BriefcaseBusiness, Calculator, CalendarDays,
  Check, ChevronRight, ClipboardList, CloudOff, Download, Edit3, Eye,
  FileDown, FileImage, FileSpreadsheet, FileText, Filter, FolderOpen,
  FolderPlus, HardHat, Info, LayoutDashboard, MapPin, Menu, Paperclip,
  Plus, Rows3, Save, Search, Settings2, Trash2, Upload, X
});
