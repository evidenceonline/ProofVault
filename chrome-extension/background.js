chrome.runtime.onInstalled.addListener(() => {
    console.log('ProofVault extension installed');
});

chrome.action.onClicked.addListener((tab) => {
    chrome.action.openPopup();
});