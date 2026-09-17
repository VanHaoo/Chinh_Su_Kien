param(
    [int]$monLeft = 0,
    [int]$monTop = 0,
    [int]$monRight = 1920,
    [int]$monBottom = 1080,
    [int]$targetX = 100,
    [int]$targetY = 100,
    [int]$myPid = 0
)

$csharpCode = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class DisplayLocker2 {
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TOOLWINDOW = 0x00000080;

    public const uint SWP_NOSIZE     = 0x0001;
    public const uint SWP_NOZORDER   = 0x0004;
    public const uint SWP_NOACTIVATE = 0x0010;

    private static readonly HashSet<string> SkipClasses = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
        "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd",
        "Windows.UI.Core.CoreWindow", "DV2ControlHost", "SysListView32",
        "SHELLDLL_DefView", "EdgeUiInputTopWndClass", "MultitaskingViewFrame",
        "SearchPane", "ImmersiveLauncher", "ImmersiveBackgroundWindow",
        "NativeHWNDHost", "tooltips_class32", "SysShadow", "MsgrIMEWindowClass",
        "#32769"
    };

    public static int CheckAndMove(int monLeft, int monTop, int monRight, int monBottom, int destX, int destY, uint myPid) {
        int count = 0;
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;

            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == myPid) return true;

            int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
            if ((exStyle & WS_EX_TOOLWINDOW) != 0) return true;

            StringBuilder cls = new StringBuilder(256);
            GetClassName(hWnd, cls, 256);
            string className = cls.ToString();
            if (SkipClasses.Contains(className)) return true;

            RECT rect;
            if (!GetWindowRect(hWnd, out rect)) return true;

            int width  = rect.Right  - rect.Left;
            int height = rect.Bottom - rect.Top;
            if (width < 50 || height < 50) return true;

            // Move if window overlaps output monitor AT ALL (any pixel overlap)
            bool overlapsOutput =
                rect.Left   < monRight  &&
                rect.Right  > monLeft   &&
                rect.Top    < monBottom &&
                rect.Bottom > monTop;

            if (overlapsOutput) {
                SetWindowPos(hWnd, IntPtr.Zero, destX, destY, 0, 0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
                count++;
            }
            return true;
        }, IntPtr.Zero);
        return count;
    }
}
"@

# Use unique class name to avoid Add-Type cache collision on restart
if (-not ([System.Management.Automation.PSTypeName]'DisplayLocker2').Type) {
    try {
        Add-Type -TypeDefinition $csharpCode -Language CSharp
    } catch {}
}

$running = $true
while ($running) {
    try {
        [DisplayLocker2]::CheckAndMove($monLeft, $monTop, $monRight, $monBottom, $targetX, $targetY, [uint32]$myPid) | Out-Null
    } catch {}

    Start-Sleep -Milliseconds 200
}
