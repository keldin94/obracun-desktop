; OBRAČUN Windows installer (per-user, no administrator rights required).
; Interactive setup / silent updates (/S). User's browser data is never removed.
Unicode True
!include "MUI2.nsh"
!ifndef APP_VERSION
  !define APP_VERSION "0.2.1"
!endif
!define APP_NAME "OBRAČUN"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\KeldinObracun"
!define APP_REG_KEY "Software\Keldin\Obracun"
!define MUI_ICON "../../branding/obracun-icon.ico"
!define MUI_UNICON "../../branding/obracun-icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\Obracun-Windows.exe"

Name "${APP_NAME}"
OutFile "../../Obracun-Setup-Windows.exe"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\Obracun"
InstallDirRegKey HKCU "${APP_REG_KEY}" "Install_Dir"
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  SetShellVarContext current
FunctionEnd
Function un.onInit
  SetShellVarContext current
FunctionEnd

Section "OBRAČUN (required)" SecProgram
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File "../../Obracun-Windows.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\OBRAČUN"
  CreateShortcut "$SMPROGRAMS\OBRAČUN\OBRAČUN.lnk" "$INSTDIR\Obracun-Windows.exe" "" "$INSTDIR\Obracun-Windows.exe" 0
  CreateShortcut "$SMPROGRAMS\OBRAČUN\Uninstall OBRAČUN.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\OBRAČUN.lnk" "$INSTDIR\Obracun-Windows.exe" "" "$INSTDIR\Obracun-Windows.exe" 0
  WriteRegStr HKCU "${APP_REG_KEY}" "Install_Dir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\Obracun-Windows.exe"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Keldin"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\OBRAČUN\OBRAČUN.lnk"
  Delete "$SMPROGRAMS\OBRAČUN\Uninstall OBRAČUN.lnk"
  RMDir "$SMPROGRAMS\OBRAČUN"
  Delete "$DESKTOP\OBRAČUN.lnk"
  Delete "$INSTDIR\Obracun-Windows.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${APP_REG_KEY}"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  ; Never touch %LOCALAPPDATA%\Keldin Obracun\BrowserProfile.
SectionEnd
