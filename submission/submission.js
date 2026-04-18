(function (window, document) {
  const skipDelayMs = 2000;
  const catBaseOffsetPx = 16;
  const catSpeedPxPerSecond = 160;

  const body = document.body;
  const overlayContainer = document.getElementById("overlay-container");
  const cat = document.getElementById("cat");
  const skipButton = document.getElementById("skip");
  let skipTimerId = null;
  let catAnimationFrameId = null;
  let lastFrameTime = null;
  let catX = 0;
  let catDirection = 1;

  function hideSkipButton() {
    skipButton.style.display = "none";
  }

  function stopCatAnimation() {
    if (catAnimationFrameId !== null) {
      window.cancelAnimationFrame(catAnimationFrameId);
      catAnimationFrameId = null;
    }

    lastFrameTime = null;
    catX = 0;
    catDirection = 1;
    cat.style.transform = "translateX(0)";
  }

  function stepCat(timestamp) {
    if (lastFrameTime === null) {
      lastFrameTime = timestamp;
    }

    const frameDeltaSeconds = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    const maxX = Math.max(
      0,
      overlayContainer.clientWidth - cat.offsetWidth - catBaseOffsetPx * 2,
    );

    catX += catDirection * catSpeedPxPerSecond * frameDeltaSeconds;

    if (catX >= maxX) {
      catX = maxX;
      catDirection = -1;
    } else if (catX <= 0) {
      catX = 0;
      catDirection = 1;
    }

    cat.style.transform = `translateX(${catX}px) scaleX(${catDirection})`;
    catAnimationFrameId = window.requestAnimationFrame(stepCat);
  }

  function startCatAnimation() {
    stopCatAnimation();
    catAnimationFrameId = window.requestAnimationFrame(stepCat);
  }

  function enterEngagementMode() {
    body.classList.add("engagement-active");
    startCatAnimation();
  }

  function resetOverlayState() {
    body.classList.remove("engagement-active");
    stopCatAnimation();
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
