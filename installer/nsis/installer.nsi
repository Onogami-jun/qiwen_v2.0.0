; ══════════════════════════════════════════════════════════
;  启文软件 · Windows NSIS 安装脚本
;  NSIS 3.09+  |  Unicode 编码
;  编译: makensis installer.nsi
; ══════════════════════════════════════════════════════════

Unicode True
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; ── 基本信息 ──────────────────────────────────────────────
!define PRODUCT_NAME        "启文"
!define PRODUCT_NAME_EN     "QiWen"
!define PRODUCT_VERSION     "1.0.0"
!define PRODUCT_PUBLISHER   "启文团队"
!define PRODUCT_URL         "https://qiwen.studio"
!define PRODUCT_HELP_URL    "https://qiwen.studio/support"
!define PRODUCT_EXE         "QiWen.exe"
!define PRODUCT_UNINST_KEY  "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME_EN}"
!define PRODUCT_UNINST_ROOT HKLM
!define MIN_WIN_VER         "10"

Name           "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile        "QiWen-Setup-${PRODUCT_VERSION}.exe"
InstallDir     "$PROGRAMFILES64\${PRODUCT_NAME_EN}"
InstallDirRegKey HKLM "Software\${PRODUCT_NAME_EN}" ""
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show
SetCompressor   /SOLID lzma

; ── MUI 主题设置 ──────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "确定要退出安装向导吗？"

; 图标
!define MUI_ICON   "..\..\assets\icon.ico"
!define MUI_UNICON "..\..\assets\icon.ico"

; 欢迎页横幅（左侧品牌图）
!define MUI_WELCOMEFINISHPAGE_BITMAP   "assets\installer-banner.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "assets\installer-banner.bmp"

; 页眉图
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "assets\installer-header.bmp"

; 品牌颜色
!define MUI_BGCOLOR "FFFFFF"

; 文字定制
!define MUI_WELCOMEPAGE_TITLE       "欢迎使用启文安装向导"
!define MUI_WELCOMEPAGE_TEXT        "本向导将引导您完成「启文 ${PRODUCT_VERSION}」的安装。$\r$\n$\r$\n启文是一款本地优先的知识管理与写作平台，为深度创作者而生。$\r$\n$\r$\n建议您关闭其他应用程序后再继续安装，以避免重启系统。$\r$\n$\r$\n启于思，行于文。"
!define MUI_FINISHPAGE_TITLE        "启文安装完成"
!define MUI_FINISHPAGE_TEXT         "启文 ${PRODUCT_VERSION} 已成功安装到您的计算机。$\r$\n$\r$\n感谢您的选择，祝您创作愉快！$\r$\n$\r$\n启于思，行于文。"
!define MUI_FINISHPAGE_RUN          "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT     "立即启动启文"
!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "查看版本发行说明"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION ShowReleaseNotes
!define MUI_UNFINISHPAGE_NOAUTOCLOSE

; ── 安装页面顺序 ──────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ── 卸载页面 ──────────────────────────────────────────────
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ── 语言 ──────────────────────────────────────────────────
!insertmacro MUI_LANGUAGE "SimpChinese"

; ── 版本信息 ──────────────────────────────────────────────
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey /LANG=2052 "ProductName"      "${PRODUCT_NAME}"
VIAddVersionKey /LANG=2052 "Comments"         "启于思，行于文"
VIAddVersionKey /LANG=2052 "CompanyName"      "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=2052 "LegalCopyright"   "© 2024 ${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=2052 "FileDescription"  "启文软件安装程序"
VIAddVersionKey /LANG=2052 "FileVersion"      "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "ProductVersion"   "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "InternalName"     "QiWen"
VIAddVersionKey /LANG=2052 "OriginalFilename" "QiWen-Setup.exe"

; ══════════════════════════════════════════════════════════
;  安装组件定义
; ══════════════════════════════════════════════════════════
InstType "标准安装（推荐）"
InstType "完整安装"
InstType "最小安装"

Section "!启文核心程序" SecCore
  SectionIn RO   ; 必装，不可取消
  SetOutPath "$INSTDIR"
  File /r "..\..\dist\win-unpacked\*.*"

  ; 注册卸载信息
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "DisplayName"      "${PRODUCT_NAME} ${PRODUCT_VERSION}"
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"  '"$INSTDIR\uninst.exe"'
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "InstallLocation"  "$INSTDIR"
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon"      "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "Publisher"        "${PRODUCT_PUBLISHER}"
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout"     "${PRODUCT_URL}"
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "URLUpdateInfo"    "${PRODUCT_URL}/releases"
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "HelpLink"         "${PRODUCT_HELP_URL}"
  WriteRegStr   HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion"   "${PRODUCT_VERSION}"
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify"         1
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair"         1

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"

  ; 写入安装路径注册表
  WriteRegStr HKLM "Software\${PRODUCT_NAME_EN}" "" "$INSTDIR"
  WriteRegStr HKLM "Software\${PRODUCT_NAME_EN}" "Version" "${PRODUCT_VERSION}"

  WriteUninstaller "$INSTDIR\uninst.exe"
SectionEnd

Section "桌面快捷方式" SecDesktop
  SectionIn 1 2
  CreateShortCut "$DESKTOP\启文.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0 SW_SHOWNORMAL "" "启文 - 本地优先的知识管理平台"
SectionEnd

Section "开始菜单" SecStartMenu
  SectionIn 1 2
  CreateDirectory "$SMPROGRAMS\启文"
  CreateShortCut  "$SMPROGRAMS\启文\启文.lnk"      "$INSTDIR\${PRODUCT_EXE}"
  CreateShortCut  "$SMPROGRAMS\启文\卸载启文.lnk"  "$INSTDIR\uninst.exe"
  CreateShortCut  "$SMPROGRAMS\启文\官方网站.lnk"  "${PRODUCT_URL}"
SectionEnd

Section "关联 .md 文件" SecFileAssoc
  SectionIn 1 2
  WriteRegStr HKCR ".md"           "" "QiWen.Document"
  WriteRegStr HKCR ".qiwen"        "" "QiWen.Document"
  WriteRegStr HKCR "QiWen.Document"          "" "启文文档"
  WriteRegStr HKCR "QiWen.Document\DefaultIcon" "" "$INSTDIR\${PRODUCT_EXE},0"
  WriteRegStr HKCR "QiWen.Document\shell\open\command" "" '"$INSTDIR\${PRODUCT_EXE}" "%1"'
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
SectionEnd

Section "快速访问工具栏" SecQuickLaunch
  SectionIn 2
  CreateShortCut "$QUICKLAUNCH\启文.lnk" "$INSTDIR\${PRODUCT_EXE}"
SectionEnd

; ── 组件描述 ──────────────────────────────────────────────
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore}       "启文核心应用程序（必须安装）"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop}    "在桌面创建启文的快捷方式图标"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu}  "在开始菜单中添加启文启动项"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecFileAssoc}  "将 .md 和 .qiwen 文件关联到启文，双击可直接打开"
  !insertmacro MUI_DESCRIPTION_TEXT ${SecQuickLaunch} "在任务栏快速启动区域添加图标"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ══════════════════════════════════════════════════════════
;  安装前检查
; ══════════════════════════════════════════════════════════
Function .onInit
  ; 检查 Windows 版本
  ${If} ${AtLeastWin10}
  ${Else}
    MessageBox MB_OK|MB_ICONSTOP "启文需要 Windows 10 或更高版本，您的系统不满足要求。"
    Abort
  ${EndIf}

  ; 检查 64 位
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "启文需要 64 位 Windows 系统才能运行。"
    Abort
  ${EndIf}

  ; 检查是否已安装旧版本
  ReadRegStr $R0 HKLM "${PRODUCT_UNINST_KEY}" "UninstallString"
  ${If} $R0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到已安装的启文版本，建议先卸载旧版本再继续。$\r$\n是否先卸载旧版本？" IDNO NoUninstall
      ExecWait '$R0 _?=$INSTDIR'
    NoUninstall:
  ${EndIf}
FunctionEnd

Function ShowReleaseNotes
  ExecShell "open" "${PRODUCT_URL}/changelog"
FunctionEnd

; ══════════════════════════════════════════════════════════
;  卸载程序
; ══════════════════════════════════════════════════════════
Section "Uninstall"
  ; 关闭正在运行的实例
  FindWindow $0 "" "启文"
  ${If} $0 != 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到启文正在运行，请先关闭后再继续卸载。" IDOK 0 IDCANCEL +2
    Quit
    SendMessage $0 ${WM_CLOSE} 0 0
    Sleep 1000
  ${EndIf}

  ; 删除注册表
  DeleteRegKey ${PRODUCT_UNINST_ROOT} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "Software\${PRODUCT_NAME_EN}"
  DeleteRegKey HKCR "QiWen.Document"
  DeleteRegStr HKCR ".md" ""
  DeleteRegStr HKCR ".qiwen" ""

  ; 删除快捷方式
  Delete "$DESKTOP\启文.lnk"
  Delete "$QUICKLAUNCH\启文.lnk"
  RMDir  /r "$SMPROGRAMS\启文"

  ; 删除安装目录（询问是否保留用户数据）
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除您的本地文档数据？$\r$\n$\r$\n选择「是」将永久删除所有本地文档（不可恢复）$\r$\n选择「否」仅卸载程序，保留您的文档数据" IDNO KeepData
    RMDir /r "$APPDATA\QiWen"
    RMDir /r "$LOCALAPPDATA\QiWen"
  KeepData:

  RMDir /r "$INSTDIR"
  SetAutoClose true
SectionEnd

Section "un.onUninstSuccess"
  MessageBox MB_OK|MB_ICONINFORMATION "启文已从您的计算机中卸载完毕。$\r$\n$\r$\n感谢您曾经使用启文，期待再次相遇。"
SectionEnd
