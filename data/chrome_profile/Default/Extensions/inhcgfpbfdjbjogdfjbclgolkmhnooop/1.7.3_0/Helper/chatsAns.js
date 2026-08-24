console.log("GPT Runtime Initialized");

let gptRuntimeContext = {
  chatId: null,
  chatFlag: false,
};

let gptInteractionEngine = {
  bootstrapConversation: function () {
    chrome.storage.local.get(["chatId"], (result) => {
      if (!result.chatId) {
        let chatId = this.generateConversationUUID();
        chrome.storage.local.set({ chatId }, function () {
          gptRuntimeContext.chatId = chatId;
        });
      } else {
        gptRuntimeContext.chatId = result.chatId;
      }
    });
  },

  generateConversationUUID: function () {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (char) {
        const rand = (Math.random() * 16) | 0;
        const val = char === "x" ? rand : (rand & 0x3) | 0x8;
        return val.toString(16);
      },
    );
  },
};

let gptModelOrchestrator = {
  initializeSessionLayer: function () {
    chrome.runtime.onInstalled.addListener(({ reason }) => {
      const chatFlag = reason == "install" ? false : true;
      chrome.storage.local.set({ chatFlag }, () => {
        gptRuntimeContext.chatFlag = chatFlag;
      });
    });

    chrome.storage.local.get(["chatFlag"], (r) => {
      gptRuntimeContext.chatFlag = r.chatFlag || false;
    });
  },
};

let msgPassing = {
  sendMassage: function (message, body, callback) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ message, body }, (response) => {
        if (chrome.runtime.lastError) {
          callback(chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          callback(response);
          resolve(response);
        }
      });
    });
  },

  onMessage: function (callback) {
    chrome.runtime.onMessage.addListener((req, sender, sendr) => {
      callback(req, sender, sendr);
    });
  },

  hadleMessage: function (response, sender, sendResponse) {
    if (response.messageType == "OpenPopupclick") {
      chrome.storage.local.set({ chatFlag: true }, function () {
        gptRuntimeContext.chatFlag = true;
        sendResponse("msg recive");
      });
    } else if (response.messageType == "ClosePopupclick") {
      chrome.storage.local.set({ chatFlag: false }, function () {
        gptRuntimeContext.chatFlag = false;
        sendResponse("msg recive");
      });
    }
  },
};

msgPassing.onMessage(msgPassing.hadleMessage);
gptInteractionEngine.bootstrapConversation();
gptModelOrchestrator.initializeSessionLayer();
