(function (window, document) {
  const skipDelayMs = 2000;

  // This is how you tell the parent window that the ad was successfully skipped.
  function adSuccess() {
    window.top.postMessage({ type: "success" }, "*");
  }

  const skipButton = document.getElementById("skip");
  let skipTimerId = null;

  function hideSkipButton() {
    skipButton.style.display = "none";
  }

  function scheduleSkipButton() {
    window.clearTimeout(skipTimerId);
    hideSkipButton();
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
      hideSkipButton();
      window.top.postMessage({ type: "fail" }, "*");
    }
  });

  // Your ad overlay code goes here, we've added a simple example below:
  skipButton.addEventListener("click", () => {
    window.clearTimeout(skipTimerId);
    hideSkipButton();
    adSuccess();
  });
})(window, document);
