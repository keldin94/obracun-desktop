//go:build windows
package main
import ("os/exec";"syscall")
func setHiddenWindow(c *exec.Cmd){c.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}}
