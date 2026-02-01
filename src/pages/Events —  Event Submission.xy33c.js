import wixWindow from 'wix-window';

$w.onReady(() => {
  wixWindow.resizeTo(760, 720);

  $w('#eventSubmitForm').onSubmit(async () => {
    await new Promise(r => setTimeout(r, 200));
    wixWindow.lightbox.close({ refresh: true });
  });

  $w('#button1').onClick(() => wixWindow.lightbox.close({ refresh: false }));
});