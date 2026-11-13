//go:build !windows
package main
import "os/exec"
func setHiddenWindow(c *exec.Cmd){}
