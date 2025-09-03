chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "paraphrase",
    title: "Paraphrase with 100GPT",
    contexts: ["selection"]
  });
});
