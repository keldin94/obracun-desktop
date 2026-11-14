//go:build !windows

package main

import (
    "os/exec"
    "runtime"
)

func setHiddenWindow(c *exec.Cmd) {}

func showRunningVersionAlert(version string) {
    if runtime.GOOS == "darwin" {
        _ = exec.Command("osascript", "-e", "display alert \"OBRAČUN\" message \"Zatvori staru verziju aplikacije, pa ponovno pokreni OBRAČUN iz Applications.\"").Run()
    }
}
