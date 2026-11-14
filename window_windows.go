//go:build windows

package main

import (
    "os/exec"
    "syscall"
    "unsafe"
)

func setHiddenWindow(c *exec.Cmd) {
    c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
func showRunningVersionAlert(version string) {
    text, _ := syscall.UTF16PtrFromString("OBRAČUN v" + version + " je još pokrenut. Zatvori staru aplikaciju, zatim ponovo otvori OBRAČUN iz Start menija.")
    title, _ := syscall.UTF16PtrFromString("OBRAČUN — stara verzija je pokrenuta")
    proc := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
    _, _, _ = proc.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x30)
}
