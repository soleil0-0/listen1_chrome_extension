const parentId = "#content > div > div.header > h2";
const buttonId = "aButton";
const addButton = setInterval(function () {
  if (document.getElementById(buttonId)) {
    clearInterval(addButton);
    return false;
  } else {
    if (document.querySelector(parentId)) {
      const button = document.createElement("button");
      button.innerHTML = "Listen";
      button.id = buttonId;
      button.type = "button";
      button.style = "margin-left: 20px;";
      document.querySelector(parentId).appendChild(button);

      const theButton = document.getElementById(buttonId);
      theButton.addEventListener("click", function () {

        artistElement = document.querySelector("#content > div > div.header > h2 > a");
        albumElement = document.querySelector("#content > div > div.header > h2 > span");
        const artist = artistElement? artistElement.innerText: "";
        const album = albumElement.innerText;
        chrome.runtime.sendMessage(
          {
            type: "play",
            query: artist + '|' + album,
          },
          (response) => { // eslint-disable-line no-unused-vars
          }
        );
      });
    }
  }
}, 500);