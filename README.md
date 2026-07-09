# ApexWorkspace

A desktop workspace application with document editing and notifications.

## How to Download and Install

1. Go to the **Releases** section on the right side of this GitHub repository.
2. Click on the **v1.0.0** tag version to open the asset list.
3. Download the Mac installer file ending in `.dmg` (e.g., `ApexWorkspace-1.0.0-arm64.dmg`).
4. Double-click the downloaded `.dmg` file and drag **ApexWorkspace** into your **Applications** folder.

---

## ⚠️ Fix: "App is damaged and can't be opened"

Because this application is not signed with a paid Apple Developer Account, macOS Gatekeeper will incorrectly flag it as "damaged" when you first open it. The app is completely safe. 

To bypass this safety check and run the application, use one of the two methods below:

### Method 1: The Right-Click Bypass (Easiest)
1. Open your Mac's **Applications** folder in Finder.
2. Right-click (or hold `Control` and click) on **ApexWorkspace**.
3. Click **Open** from the menu.
4. A new popup will appear asking if you are sure. Click **Open** again to launch the app.

### Method 2: The Terminal Bypass (If Method 1 Fails)
If macOS still blocks the application, open your native Mac Terminal and run this command to remove the system quarantine flag:

```bash
xattr -cr /Applications/ApexWorkspace.app
