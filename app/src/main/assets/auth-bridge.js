(function () {
  'use strict';
  if (window.__MSY_ANDROID_AUTH_BRIDGE__) return;
  window.__MSY_ANDROID_AUTH_BRIDGE__ = true;
  var preferredSession = 'madreseyar.session.v14';
  var preferredToken = 'madreseyar.staff.token.v14';
  var nativeSetItem = Storage.prototype.setItem;
  var nativeRemoveItem = Storage.prototype.removeItem;
  var nativeClear = Storage.prototype.clear;
  var lastSignature = '';

  function post(type, data) {
    try {
      if (window.MSYNative && typeof window.MSYNative.postMessage === 'function') {
        window.MSYNative.postMessage(JSON.stringify(Object.assign({type:type}, data || {})));
      }
    } catch (_) {}
  }

  function readAuth() {
    var out = {session:'', token:'', sessionKey:'', tokenKey:''};
    try {
      var s = sessionStorage.getItem(preferredSession) || '';
      var t = sessionStorage.getItem(preferredToken) || '';
      if (s) { out.session=s; out.sessionKey=preferredSession; }
      if (t) { out.token=t; out.tokenKey=preferredToken; }
      if (!out.session || !out.token) {
        for (var i=0;i<sessionStorage.length;i++) {
          var k=sessionStorage.key(i)||'', v=sessionStorage.getItem(k)||'';
          if (!out.session && /session/i.test(k)) {
            try { var obj=JSON.parse(v); if (obj && obj.authUser && obj.authUser.role) { out.session=v; out.sessionKey=k; } } catch (_) {}
          }
          if (!out.token && /token/i.test(k) && v.length>=20) { out.token=v; out.tokenKey=k; }
        }
      }
    } catch (_) {}
    return out;
  }

  function capture() {
    var found=readAuth();
    if (!found.session || !found.token) return;
    var sig=found.token.slice(0,24);
    if (sig===lastSignature) return;
    lastSignature=sig;
    post('sessionCaptured', found);
  }

  Storage.prototype.setItem=function(){
    var r=nativeSetItem.apply(this,arguments);
    if (this===window.sessionStorage) capture();
    return r;
  };
  Storage.prototype.removeItem=function(){
    var r=nativeRemoveItem.apply(this,arguments);
    if (this===window.sessionStorage) post('sessionCleared');
    return r;
  };
  Storage.prototype.clear=function(){
    var r=nativeClear.apply(this,arguments);
    if (this===window.sessionStorage) post('sessionCleared');
    return r;
  };

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', capture, {once:true});
  else capture();
  setTimeout(capture, 150);
  setTimeout(capture, 500);
})();
