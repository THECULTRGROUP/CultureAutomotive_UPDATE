$w.onReady(function () {
  $w("#wixForm1").onWixFormSubmitted(() => {
    console.log("Wix Form was submitted.");

    const $iframe = $w("#progressBarEmbed");
    if ($iframe && $iframe.postMessage) {
      $iframe.postMessage({ action: "updateProgress" });
    }

    const $popupIframe = $w("#popupEmbed");
    if ($popupIframe && $popupIframe.postMessage) {
      $popupIframe.postMessage({ action: "showNextSteps" });
    }
  });
});
