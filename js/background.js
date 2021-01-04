/* global chrome Github */
chrome.browserAction.onClicked.addListener((tab) => { // eslint-disable-line no-unused-vars
  chrome.tabs.create({
    url: chrome.extension.getURL('listen1.html'),
  }, (new_tab) => { // eslint-disable-line no-unused-vars
    // Tab opened.
  });
});


function hack_referer_header(details) {
  const replace_referer = true;
  let replace_origin = true;
  const add_referer = true;
  let add_origin = true;

  let referer_value = '';
  let origin_value = "";

  if (details.url.indexOf('://music.163.com/') !== -1) {
    referer_value = 'http://music.163.com/';
  }
  if (details.url.indexOf('://gist.githubusercontent.com/') !== -1) {
    referer_value = 'https://gist.githubusercontent.com/';
  }

  if (details.url.indexOf(".xiami.com/") !== -1) {
    add_origin = false;
    referer_value = "https://www.xiami.com";
  }

  if (details.url.indexOf('www.xiami.com/api/search/searchSongs') !== -1) {
    const key = /key%22:%22(.*?)%22/.exec(details.url)[1];
    add_origin = false;
    referer_value = `https://www.xiami.com/search?key=${key}`;
  }

  if (details.url.indexOf('c.y.qq.com/') !== -1) {
    referer_value = 'https://y.qq.com/';
    origin_value = "https://y.qq.com";
  }
  if ((details.url.indexOf('i.y.qq.com/') !== -1)
    || (details.url.indexOf('qqmusic.qq.com/') !== -1)
    || (details.url.indexOf('music.qq.com/') !== -1)
    || (details.url.indexOf('imgcache.qq.com/') !== -1)) {
    referer_value = 'https://y.qq.com/';
  }

  if (details.url.indexOf('.kugou.com/') !== -1) {
    referer_value = 'http://www.kugou.com/';
  }

  if (details.url.indexOf('.kuwo.cn/') !== -1) {
    referer_value = 'http://www.kuwo.cn/';
  }

  if (details.url.indexOf('.bilibili.com/') !== -1 || details.url.indexOf(".bilivideo.com/") !== -1) {
    referer_value = 'https://www.bilibili.com/';
    replace_origin = false;
    add_origin = false;
  }
  if (details.url.indexOf('.migu.cn') !== -1) {
    referer_value = 'http://music.migu.cn/v3/music/player/audio?from=migu';
  }
  if (details.url.indexOf('m.music.migu.cn') !== -1) {
    referer_value = 'https://m.music.migu.cn/';
  }
  if (origin_value == "") {
    origin_value = referer_value;
  }

  let isRefererSet = false;
  let isOriginSet = false;
  const headers = details.requestHeaders;
  const blockingResponse = {};

  for (let i = 0, l = headers.length; i < l; i += 1) {
    if (replace_referer && (headers[i].name === 'Referer') && (referer_value !== '')) {
      headers[i].value = referer_value;
      isRefererSet = true;
    }
    if (replace_origin && (headers[i].name === 'Origin') && (origin_value !== '')) {
      headers[i].value = origin_value;
      isOriginSet = true;
    }
  }

  if (add_referer && (!isRefererSet) && (referer_value !== '')) {
    headers.push({
      name: 'Referer',
      value: referer_value,
    });
  }

  if (add_origin && (!isOriginSet) && (origin_value !== '')) {
    headers.push({
      name: 'Origin',
      value: origin_value,
    });
  }

  blockingResponse.requestHeaders = headers;
  return blockingResponse;
}

const urls = ['*://music.163.com/*', '*://*.xiami.com/*', '*://i.y.qq.com/*', '*://c.y.qq.com/*', '*://*.kugou.com/*', '*://*.kuwo.cn/*', '*://*.bilibili.com/*', "*://*.bilivideo.com/*", '*://*.migu.cn/*', '*://*.githubusercontent.com/*'];

try {
  chrome.webRequest.onBeforeSendHeaders.addListener(hack_referer_header, {
    urls: urls,
  }, ['requestHeaders', 'blocking', 'extraHeaders']);
}
catch (err) {
  // before chrome v72, extraHeader is not supported
  chrome.webRequest.onBeforeSendHeaders.addListener(hack_referer_header, {
    urls: urls,
  }, ['requestHeaders', 'blocking']);
}

let lastKeyword = "";
function goToURL(targetURL) {
  return new Promise(resolve => {
    chrome.tabs.query({}, function(tabs) {
      for (let i = 0, tab; tab = tabs[i]; i++) {
          if (tab.url === targetURL) {
              chrome.tabs.update(tab.id, {active: true});
              resolve(tab);
              return;
          }
      }
      chrome.tabs.create({url: targetURL}, async tab => {
        chrome.tabs.onUpdated.addListener(function listener (tabId, info) {
          if (info.status === 'complete' && tabId === tab.id) {
              chrome.tabs.onUpdated.removeListener(listener);
              lastKeyword = "";
              resolve(tab);
          }
        });
      });
    });
  });
}
/**
 * listen message.
 */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  switch (request.type) {
    case "code":
      const code = request.query.split("=")[1];
      Github.handleCallback(code);
      sendResponse();
      break;
    case "play":
      // parse artist and album
      const artist = request.query.split("|")[0].replace(/\(.*\)/, "");
      const album = request.query.split("|")[1];

      // open extension ui
      await goToURL(chrome.extension.getURL('listen1.html'));

      // type content to input
      const [viewWindow] = chrome.extension.getViews().filter(p => p.location.href.endsWith('listen1.html'));
      const searchInput = viewWindow.document.querySelector('#search-input');
      keyword = artist + " " + album;
      if (keyword === lastKeyword) {
        sendResponse();
        return;
      }
      searchInput.value = keyword;
      lastKeyword = keyword;

      // change source
      const allMusic = viewWindow.document.querySelector(".searchbox .source-list .source-button:first-child");
      if (!allMusic.classList.contains('active')) allMusic.click();

      // remove last search result
      const results = viewWindow.document.querySelector(".detail-songlist").children;
      if (results) Array.from(results).forEach((value, index) => { if (index !== 0) value.remove(); });

      // trigger ng-model change to make search happen
      const $searchInput = viewWindow.angular.element(searchInput);
      $searchInput.triggerHandler('input');

      // wait search content appear, and play first song
      let timeout = 3 * 60 * 1000;
      const playFirstSong = setInterval(function () {
        const firstSong = viewWindow.document.querySelector('.detail-songlist .title a[add-and-play="song"]');
        if (firstSong || timeout <= 0) {
          firstSong.click();
          // viewWindow.document.querySelector('.li-play')?.click();

          clearInterval(playFirstSong);
          sendResponse();
          return;
        }
        timeout -= 500;
      }, 500);


      break;
    default:
      console.error("request type not support: " + request.type);
  }
});

// at end of background.js
chrome.commands.onCommand.addListener((command) => {
  const [viewWindow] = chrome.extension.getViews().filter(p => p.location.href.endsWith('listen1.html'));

  switch (command) {
    case 'play_next':
      viewWindow.document.querySelector('.li-next').click();
      break;
    case 'play_prev':
      viewWindow.document.querySelector('.li-previous').click();
      break;
    case 'play_pause':
      viewWindow.document.querySelector('.play').click();
      break;
    default:
    // console.log('不支持的快捷键')
  }
});
