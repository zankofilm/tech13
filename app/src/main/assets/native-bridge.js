(function () {
  'use strict';
  if (window.__MSY_ANDROID_BRIDGE_INSTALLED__) return;
  window.__MSY_ANDROID_BRIDGE_INSTALLED__ = true;

  var PREFERRED_SESSION_KEY = 'madreseyar.session.v14';
  var PREFERRED_TOKEN_KEY = 'madreseyar.staff.token.v14';
  var nativeSetItem = Storage.prototype.setItem;
  var nativeRemoveItem = Storage.prototype.removeItem;
  var nativeClear = Storage.prototype.clear;
  var rejected = false;
  var teacherReadySent = '';
  var previousAppVisible = false;
  function postNative(type, data) {
    try {
      if (window.MSYNative && typeof window.MSYNative.postMessage === 'function') {
        window.MSYNative.postMessage(JSON.stringify(Object.assign({ type: type }, data || {})));
      }
    } catch (_) {}
  }

  function findSessionAndToken() {
    var result = { session: '', token: '', sessionKey: '', tokenKey: '' };
    try {
      var preferredSession = sessionStorage.getItem(PREFERRED_SESSION_KEY) || '';
      var preferredToken = sessionStorage.getItem(PREFERRED_TOKEN_KEY) || '';
      if (preferredSession) {
        try {
          var preferredObj = JSON.parse(preferredSession);
          if (preferredObj && preferredObj.authUser && preferredObj.authUser.role) {
            result.session = preferredSession;
            result.sessionKey = PREFERRED_SESSION_KEY;
          }
        } catch (_) {}
      }
      if (preferredToken && preferredToken.length >= 20) {
        result.token = preferredToken;
        result.tokenKey = PREFERRED_TOKEN_KEY;
      }

      for (var i = 0; i < sessionStorage.length; i++) {
        var key = sessionStorage.key(i) || '';
        var value = sessionStorage.getItem(key) || '';
        if (!result.session && /session/i.test(key)) {
          try {
            var parsed = JSON.parse(value);
            if (parsed && parsed.authUser && parsed.authUser.role) {
              result.session = value;
              result.sessionKey = key;
            }
          } catch (_) {}
        }
        if (!result.token && /token/i.test(key) && value.length >= 20) {
          result.token = value;
          result.tokenKey = key;
        }
      }
    } catch (_) {}
    return result;
  }

  function captureIfReady() {
    var found = findSessionAndToken();
    if (found.session && found.token) postNative('sessionCaptured', found);
  }

  Storage.prototype.setItem = function (key, value) {
    var result = nativeSetItem.apply(this, arguments);
    if (this === window.sessionStorage) captureIfReady();
    return result;
  };
  Storage.prototype.removeItem = function (key) {
    var result = nativeRemoveItem.apply(this, arguments);
    if (this === window.sessionStorage) postNative('sessionCleared');
    return result;
  };
  Storage.prototype.clear = function () {
    var result = nativeClear.apply(this, arguments);
    if (this === window.sessionStorage) postNative('sessionCleared');
    return result;
  };

  function visible(el) {
    if (!el) return false;
    try {
      var style = getComputedStyle(el);
      var rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    } catch (_) { return false; }
  }

  function removeRefreshButton() {
    var old = document.getElementById('__msyAndroidRefresh');
    if (old) old.remove();
  }

  function addRefreshButton() {
    if (!document.body || document.getElementById('__msyAndroidRefresh')) return;
    var wrap = document.createElement('div');
    wrap.id = '__msyAndroidRefresh';
    wrap.dir = 'rtl';
    wrap.innerHTML = '<button type="button" aria-label="بروزرسانی داشبورد"><span class="msy-ar">↻</span><span>بروزرسانی</span></button><small>بروزرسانی دستی</small>';
    var style = document.createElement('style');
    style.textContent = '#__msyAndroidRefresh{position:fixed;z-index:2147483000;left:14px;bottom:88px;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:inherit;direction:rtl}#__msyAndroidRefresh button{border:0;border-radius:999px;padding:10px 15px;background:linear-gradient(120deg,#1767e8,#243fbd);color:#fff;font:700 13px Arial,sans-serif;box-shadow:0 5px 18px #1459d955;display:flex;align-items:center;gap:7px}#__msyAndroidRefresh button:active{transform:scale(.97)}#__msyAndroidRefresh .msy-ar{font-size:19px;line-height:14px}#__msyAndroidRefresh small{background:#fff;color:#315078;border:1px solid #dce7f7;border-radius:20px;padding:3px 8px;font-size:9px;box-shadow:0 2px 8px #183d7015}';
    wrap.appendChild(style);
    wrap.querySelector('button').addEventListener('click', function () {
      if (window.confirm('داشبورد دوباره از سرور دریافت شود؟ اگر فرم باز یا اطلاعات ذخیره‌نشده دارید، ابتدا آن را ذخیره کنید.')) postNative('refreshDashboard');
    });
    document.body.appendChild(wrap);
  }

  function checkAppState() {
    try {
      var app = document.getElementById('appView');
      var login = document.getElementById('loginView');
      var isVisible = visible(app);
      var found = findSessionAndToken();
      if (found.session && found.token) {
        try {
          var parsed = JSON.parse(found.session);
          var role = parsed && parsed.authUser && parsed.authUser.role;
          if (role && role !== 'teacher') {
            if (!rejected) {
              rejected = true;
              postNative('roleRejected', { token: found.token });
            }
            return;
          }
          if (role === 'teacher' && isVisible) {
            rejected = false;
            var signature = found.token.slice(0, 18);
            if (signature !== teacherReadySent) {
              teacherReadySent = signature;
              postNative('teacherReady', found);
            }
          }
        } catch (_) {}
      }
      if (isVisible) {
        var route = document.getElementById('page');
        if (route && route.dataset.route === 'home') addRefreshButton(); else removeRefreshButton();
      } else {
        removeRefreshButton();
        if (previousAppVisible && visible(login)) postNative('sessionCleared');
      }
      previousAppVisible = isVisible;

      var msg = document.getElementById('loginMessage');
      if (!isVisible && location.search.indexOf('p635_return=1') >= 0 && msg) {
        var message = String(msg.textContent || '');
        if (/معتبر نیست|پایان یافته|دوباره وارد سامانه|در دسترس نیست/.test(message)) postNative('restoreFailed');
      }
    } catch (_) {}
  }

  document.addEventListener('click', function (event) {
    var logout = event.target && event.target.closest ? event.target.closest('#logoutBtn') : null;
    if (logout) postNative('sessionCleared');
  }, true);

  function startObserver() {
    if (!document.body) return;
    captureIfReady();
    checkAppState();
    var observer = new MutationObserver(function () {
      captureIfReady();
      checkAppState();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-route'] });
    setTimeout(captureIfReady, 100);
    setTimeout(checkAppState, 250);
    setTimeout(captureIfReady, 650);
    setTimeout(checkAppState, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();

  try {
    window.open = function (url) {
      var html = '';
      var currentUrl = String(url || '');
      var closed = false;
      var doc = {
        open: function () { html = ''; return doc; },
        write: function () {
          if (closed) return;
          for (var i = 0; i < arguments.length; i++) html += String(arguments[i] == null ? '' : arguments[i]);
        },
        writeln: function () {
          if (closed) return;
          for (var i = 0; i < arguments.length; i++) html += String(arguments[i] == null ? '' : arguments[i]);
          html += '\n';
        },
        close: function () {
          if (closed || !html) return;
          var printable = /window\.print\s*\(|@media\s+print|ذخیره\s*(?:یا|\/)\s*چاپ\s*PDF|چاپ\s*\/\s*ذخیره\s*PDF/i.test(html);
          if (!printable && /در حال آماده(?:‌|\s)*سازی|در حال بارگذاری|loading/i.test(html)) return;
          postNative(printable ? 'printHtml' : 'openHtml', { html: html });
        },
        get body() { return null; }
      };
      var locationProxy = {};
      Object.defineProperty(locationProxy, 'href', {
        configurable: true,
        enumerable: true,
        get: function () { return currentUrl; },
        set: function (value) {
          currentUrl = String(value || '');
          if (currentUrl && currentUrl !== 'about:blank') {
            var blob = typeof blobUrls !== 'undefined' && blobUrls && blobUrls.get ? blobUrls.get(currentUrl) : null;
            if (blob) transferBlob(blob, 'preview', 'preview');
            else if (/^data:/i.test(currentUrl)) transferDataUrl(currentUrl, 'preview');
            else postNative('openUrl', { url: currentUrl });
          }
        }
      });
      var popup = {
        document: doc,
        location: locationProxy,
        closed: false,
        focus: function () {},
        close: function () { closed = true; popup.closed = true; },
        print: function () { if (html) postNative('printHtml', { html: html }); else postNative('printPage'); }
      };
      if (currentUrl && currentUrl !== 'about:blank') {
        var initialBlob = typeof blobUrls !== 'undefined' && blobUrls && blobUrls.get ? blobUrls.get(currentUrl) : null;
        if (initialBlob) transferBlob(initialBlob, 'preview', 'preview');
        else if (/^data:/i.test(currentUrl)) transferDataUrl(currentUrl, 'preview');
        else postNative('openUrl', { url: currentUrl });
      }
      return popup;
    };
  } catch (_) {}

  var blobUrls = new Map();
  try {
    var originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) {
      var url = originalCreateObjectURL(blob);
      if (blob instanceof Blob) blobUrls.set(url, blob);
      return url;
    };
  } catch (_) {}

  function transferDataUrl(dataUrl, name) {
    try {
      var match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
      if (!match) return postNative('openUrl', { url: String(dataUrl || '') });
      var mime = match[1] || 'application/octet-stream';
      var payload = match[3] || '';
      if (!match[2]) payload = btoa(unescape(encodeURIComponent(decodeURIComponent(payload))));
      if (payload.length > Math.ceil(40 * 1024 * 1024 * 4 / 3) + 16) {
        alert('حجم فایل برای پیش‌نمایش مستقیم در اپلیکیشن بیش از ۴۰ مگابایت است.');
        return;
      }
      postNative('beginBlobPreview', { name: name || 'preview', mime: mime });
      var chunkSize = 180000;
      for (var i = 0; i < payload.length; i += chunkSize) postNative('appendBlobDownloadChunk', { chunk: payload.slice(i, i + chunkSize) });
      postNative('finishBlobDownload');
    } catch (_) { alert('نمایش فایل انجام نشد.'); }
  }

  function transferBlob(blob, name, mode) {
    if (!(blob instanceof Blob)) return;
    if (blob.size > 40 * 1024 * 1024) {
      alert('حجم فایل برای انتقال مستقیم در اپلیکیشن بیش از ۴۰ مگابایت است. از نسخه وب استفاده کنید.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = String(reader.result || '').split(',')[1] || '';
        postNative(mode === 'preview' ? 'beginBlobPreview' : 'beginBlobDownload', { name: name || 'download', mime: blob.type || 'application/octet-stream' });
        var chunkSize = 180000;
        for (var i = 0; i < data.length; i += chunkSize) postNative('appendBlobDownloadChunk', { chunk: data.slice(i, i + chunkSize) });
        postNative('finishBlobDownload');
      } catch (_) { alert(mode === 'preview' ? 'نمایش فایل انجام نشد.' : 'ذخیره فایل انجام نشد.'); }
    };
    reader.onerror = function () { alert('خواندن فایل انجام نشد.'); };
    reader.readAsDataURL(blob);
  }

  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[download]') : null;
    if (!anchor || !/^blob:/i.test(anchor.href || '')) return;
    var blob = blobUrls.get(anchor.href);
    if (!blob) return;
    event.preventDefault();
    transferBlob(blob, anchor.download || 'download', 'download');
  }, true);

  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[target="_blank"]') : null;
    if (!anchor || anchor.hasAttribute('download') || !/^blob:/i.test(anchor.href || '')) return;
    var blob = blobUrls.get(anchor.href);
    if (!blob) return;
    event.preventDefault();
    transferBlob(blob, anchor.getAttribute('data-name') || 'preview', 'preview');
  }, true);

  try { window.print = function () { postNative('printPage'); }; } catch (_) {}
})();
