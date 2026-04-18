(function (window, document) {
  const skipDelayMs = 2000;

  const body = document.body;
  const skipButton = document.getElementById("skip");
  let skipTimerId = null;

  function hideSkipButton() {
    skipButton.style.display = "none";
  }

  function enterEngagementMode() {
    body.classList.add("engagement-active");
  }

  function resetOverlayState() {
    body.classList.remove("engagement-active");
    hideSkipButton();
  }

  function scheduleSkipButton() {
    window.clearTimeout(skipTimerId);
    resetOverlayState();
    skipTimerId = window.setTimeout(() => {
      skipButton.style.display = "block";
    }, skipDelayMs);
  }

  // Listen for messages from the game shell
  window.addEventListener("message", (event) => {
    if (!event.data || !event.data.type) return;

    if (event.data.type === "adStarted") {
      scheduleSkipButton();
    }

    // By default, if the user doesn't "skip" the ad before the video ends,
    // we call fail to restart. You're welcome to replace this with a survey
    // or other interaction instead (see examples/survey).
    if (event.data.type === "adFinished") {
      window.clearTimeout(skipTimerId);
      resetOverlayState();
      window.top.postMessage({ type: "fail" }, "*");
    }
  });

  // Your ad overlay code goes here, we've added a simple example below:
  skipButton.addEventListener("click", () => {
    window.clearTimeout(skipTimerId);
    enterEngagementMode();
    hideSkipButton();
  });
})(window, document);
