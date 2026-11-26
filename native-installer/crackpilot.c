#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/*
 * Dynamic URL slot patched at download time by Express server.ts so the
 * downloaded Crackpilot-Setup.exe always opens the exact live Crackpilot URL.
 */
static const char TARGET_URL_SLOT[256] =
    "CRACKPILOT_URL_SLOT_BEGIN_https://localhost:3000/?mode=software"
    "________________________________________________________________"
    "________________________________________________________________"
    "_______________________________________________________________";

static void get_launch_url(char *out, size_t out_size) {
    const char *prefix = "CRACKPILOT_URL_SLOT_BEGIN_";
    size_t plen = strlen(prefix);
    if (strncmp(TARGET_URL_SLOT, prefix, plen) == 0) {
        const char *start = TARGET_URL_SLOT + plen;
        size_t i = 0;
        while (start[i] && start[i] != '_' && i + 1 < out_size) {
            out[i] = start[i];
            i++;
        }
        out[i] = '\0';
        if (i > 8) return;
    }
    snprintf(out, out_size, "http://localhost:3000/?mode=software");
}

static int file_exists(const char *path) {
    DWORD attr = GetFileAttributesA(path);
    return (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY));
}

static void launch_crackpilot_app(const char *url) {
    const char *browsers[] = {
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        NULL
    };

    char args[768];
    snprintf(args, sizeof(args), "--app=\"%s\" --window-size=1080,760", url);

    for (int i = 0; browsers[i] != NULL; i++) {
        if (file_exists(browsers[i])) {
            HINSTANCE res = ShellExecuteA(NULL, "open", browsers[i], args, NULL, SW_SHOWNORMAL);
            if ((INT_PTR)res > 32) {
                return;
            }
        }
    }

    /* Fallback to user's default browser */
    ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
}

static void create_desktop_shortcut(const char *installed_exe) {
    char cmd[1400];
    snprintf(
        cmd,
        sizeof(cmd),
        "-NoProfile -WindowStyle Hidden -Command \""
        "$ws = New-Object -ComObject WScript.Shell; "
        "$desk = [Environment]::GetFolderPath('Desktop'); "
        "$lnk = $ws.CreateShortcut($desk + '\\Crackpilot.lnk'); "
        "$lnk.TargetPath = '%s'; "
        "$lnk.IconLocation = '%s,0'; "
        "$lnk.Description = 'Crackpilot Live Interview Assistant'; "
        "$lnk.Save()\"",
        installed_exe,
        installed_exe
    );

    SHELLEXECUTEINFOA sei;
    ZeroMemory(&sei, sizeof(sei));
    sei.cbSize = sizeof(sei);
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    sei.lpVerb = "open";
    sei.lpFile = "powershell.exe";
    sei.lpParameters = cmd;
    sei.nShow = SW_HIDE;

    if (ShellExecuteExA(&sei) && sei.hProcess) {
        WaitForSingleObject(sei.hProcess, 6000);
        CloseHandle(sei.hProcess);
    }
}

int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR lpCmdLine, int nShow) {
    (void)hInst;
    (void)hPrev;
    (void)lpCmdLine;
    (void)nShow;

    char url[256];
    get_launch_url(url, sizeof(url));

    char current_exe[MAX_PATH] = {0};
    GetModuleFileNameA(NULL, current_exe, MAX_PATH);

    char local_app[MAX_PATH] = {0};
    DWORD len = GetEnvironmentVariableA("LOCALAPPDATA", local_app, MAX_PATH);

    if (len > 0 && len < MAX_PATH - 40) {
        char install_dir[MAX_PATH];
        char installed_exe[MAX_PATH];
        snprintf(install_dir, sizeof(install_dir), "%s\\Crackpilot", local_app);
        snprintf(installed_exe, sizeof(installed_exe), "%s\\Crackpilot.exe", install_dir);

        /* If not already running from the installed location, install & create Desktop icon */
        if (_stricmp(current_exe, installed_exe) != 0) {
            int choice = MessageBoxA(
                NULL,
                "Install Crackpilot on this PC?\n\n"
                "This will:\n"
                "  1. Install Crackpilot into your local apps folder\n"
                "  2. Create a Crackpilot icon on your Desktop\n"
                "  3. Launch Crackpilot so you can paste your Auth Token",
                "Crackpilot Setup",
                MB_OKCANCEL | MB_ICONINFORMATION
            );

            if (choice != IDOK) {
                return 0;
            }

            CreateDirectoryA(install_dir, NULL);
            CopyFileA(current_exe, installed_exe, FALSE);
            create_desktop_shortcut(installed_exe);

            MessageBoxA(
                NULL,
                "Crackpilot has been installed!\n\n"
                "A Crackpilot icon has been added to your Desktop.\n"
                "Click OK to launch Crackpilot now.",
                "Crackpilot Setup Complete",
                MB_OK | MB_ICONINFORMATION
            );

            launch_crackpilot_app(url);
            return 0;
        }
    }

    /* Running directly from the installed Crackpilot Desktop icon */
    launch_crackpilot_app(url);
    return 0;
}
