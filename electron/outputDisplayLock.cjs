const { spawn } = require("child_process");
const path = require("path");

let psProcess = null;
let isLockEnabled = true;

function startDisplayLock(outputBounds, controlBounds, myPid) {
  stopDisplayLock();

  if (!isLockEnabled || !outputBounds || !controlBounds) return;

  const monLeft = outputBounds.x;
  const monTop = outputBounds.y;
  const monRight = outputBounds.x + outputBounds.width;
  const monBottom = outputBounds.y + outputBounds.height;

  const targetX = controlBounds.x + 80;
  const targetY = controlBounds.y + 80;

  const scriptPath = path.join(__dirname, "lockService.ps1");

  try {
    psProcess = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
        scriptPath,
        "-monLeft",
        monLeft,
        "-monTop",
        monTop,
        "-monRight",
        monRight,
        "-monBottom",
        monBottom,
        "-targetX",
        targetX,
        "-targetY",
        targetY,
        "-myPid",
        myPid || process.pid,
      ],
      {
        windowsHide: true,
        stdio: "ignore",
      }
    );

    psProcess.on("error", (err) => {
      console.warn("DisplayLock process error:", err);
    });
  } catch (err) {
    console.error("Failed to start DisplayLock:", err);
  }
}

function stopDisplayLock() {
  if (psProcess) {
    try {
      psProcess.kill();
    } catch (e) {}
    psProcess = null;
  }
}

function setLockState(enabled, outputBounds, controlBounds, myPid) {
  isLockEnabled = enabled;
  if (!enabled) {
    stopDisplayLock();
  } else if (outputBounds && controlBounds) {
    startDisplayLock(outputBounds, controlBounds, myPid);
  }
  return isLockEnabled;
}

function getLockState() {
  return isLockEnabled;
}

module.exports = {
  startDisplayLock,
  stopDisplayLock,
  setLockState,
  getLockState,
};
