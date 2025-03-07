// Background script for YouTube Smart Transcript extension

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('YouTube Smart Transcript extension installed');
  
  // Initialize storage with default settings if needed
  chrome.storage.local.get(['settings'], function(result) {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          // Default settings
          redirectCodingVideos: true,
          maxImportantPoints: 10
        }
      });
    }
  });
});

// Listen for tab updates to check if we're on YouTube
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only run when the page is fully loaded
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    // Send a message to the content script
    chrome.tabs.sendMessage(tabId, { action: 'pageLoaded', url: tab.url });
  }
}); 