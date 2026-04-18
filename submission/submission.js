(function (window, document) {
  const skipDelayMs = 2000;
  const catBaseOffsetPx = 16;
  const catSpeedPxPerSecond = 160;
  const toyFrameWidthPx = 32;
  const toyFrameHeightPx = 34;
  const toyFrameCount = 14;
  const toyFrameDurationMs = 45;
  const walkFrames = [
    { x: 8, y: 68 },
    { x: 96, y: 68 },
    { x: 184, y: 68 },
    { x: 272, y: 68 },
    { x: 356, y: 68 },
    { x: 444, y: 68 },
  ];
  const catFrameDurationMs = 110;

  const body = document.body;
  const overlayContainer = document.getElementById("overlay-container");
  const cat = document.getElementById("cat");
  const toyBall = document.getElementById("toy-ball");
  const skipButton = document.getElementById("skip");
  let skipTimerId = null;
  let catAnimationFrameId = null;
  let toyAnimationTimeoutId = null;
  let lastFrameTime = null;
  let lastSpriteFrameTime = null;
  let catX = 0;
  let catDirection = 1;
  let catFrameIndex = 0;

  function hideSkipButton() {
    skipButton.style.display = "none";
  }

  function setToyFrame(frameIndex) {
    toyBall.style.backgroundPosition = `-${frameIndex * toyFrameWidthPx}px 0`;
  }

  function clearToyAnimation() {
    if (toyAnimationTimeoutId !== null) {
      window.clearTimeout(toyAnimationTimeoutId);
      toyAnimationTimeoutId = null;
    }
  }

  function hideToyBall() {
    clearToyAnimation();
    toyBall.classList.remove("is-visible");
    setToyFrame(0);
  }

  function playToyImpactAnimation(frameIndex = 0) {
    setToyFrame(frameIndex);

    if (frameIndex >= toyFrameCount - 1) {
      toyAnimationTimeoutId = null;
      return;
    }

    toyAnimationTimeoutId = window.setTimeout(() => {
      playToyImpactAnimation(frameIndex + 1);
    }, toyFrameDurationMs);
  }

  function dropToyBall(clientX) {
    const containerRect = overlayContainer.getBoundingClientRect();
    const left = Math.max(
      0,
      Math.min(
        containerRect.width - toyFrameWidthPx,
        clientX - containerRect.left - toyFrameWidthPx / 2,
      ),
    );

    clearToyAnimation();
    toyBall.style.left = `${left}px`;
    toyBall.style.height = `${toyFrameHeightPx}px`;
    toyBall.classList.add("is-visible");
    playToyImpactAnimation();
  }

  function renderCatFrame() {
    const frame = walkFrames[catFrameIndex];
    cat.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
  }

  function stopCatAnimation() {
    if (catAnimationFrameId !== null) {
      window.cancelAnimationFrame(catAnimationFrameId);
      catAnimationFrameId = null;
    }

    lastFrameTime = null;
    lastSpriteFrameTime = null;
    catX = 0;
    catDirection = 1;
    catFrameIndex = 0;
    renderCatFrame();
    cat.style.transform = "translateX(0) scaleX(1)";
  }

  function stepCat(timestamp) {
    if (lastFrameTime === null) {
      lastFrameTime = timestamp;
    }

    if (lastSpriteFrameTime === null) {
      lastSpriteFrameTime = timestamp;
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

    if (timestamp - lastSpriteFrameTime >= catFrameDurationMs) {
      catFrameIndex = (catFrameIndex + 1) % walkFrames.length;
      lastSpriteFrameTime = timestamp;
      renderCatFrame();
    }

    const facingScale = catDirection === 1 ? -1 : 1;
    cat.style.transform = `translateX(${catX}px) scaleX(${facingScale})`;
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
    hideToyBall();
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
  skipButton.addEventListener("click", (event) => {
    event.stopPropagation();
    window.clearTimeout(skipTimerId);
    enterEngagementMode();
    hideSkipButton();
  });

  overlayContainer.addEventListener("click", (event) => {
    if (!body.classList.contains("engagement-active")) return;
    dropToyBall(event.clientX);
  });
})(window, document);
