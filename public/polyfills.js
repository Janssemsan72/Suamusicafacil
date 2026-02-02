/**
 * Polyfills and Critical Scripts
 * 
 * This file contains:
 * 1. Polyfills for older browsers (IE8+, Android 4.3+)
 * 
 * This file MUST load before any other scripts to ensure compatibility.
 */

(function() {
  'use strict';
  
  // ============================================================================
  // POLYFILLS - Compatibilidade Navegadores Antigos
  // ============================================================================
  
  // ✅ Polyfill para console (alguns navegadores antigos podem não ter)
  if (typeof console === 'undefined') {
    window.console = {
      log: function() {},
      warn: function() {},
      error: function() {},
      info: function() {},
      debug: function() {}
    };
  }
  
  // ✅ Polyfill para Promise (navegadores muito antigos - Android 4.3-)
  if (typeof Promise === 'undefined') {
    console.warn('[Polyfills] Promise não suportado - navegador muito antigo');
    // Promise é crítico, sem ele não podemos continuar
    var root = document.getElementById('root');
    if (root) {
      root.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: Arial, sans-serif; padding: 20px;"><div style="text-align: center; max-width: 500px;"><h1 style="color: #e74c3c; margin-bottom: 20px;">Navegador Muito Antigo</h1><p style="color: #666; margin-bottom: 20px;">Seu navegador não suporta recursos básicos necessários.</p><p style="color: #666; margin-bottom: 30px;">Por favor, atualize seu navegador ou use Chrome/Firefox.</p></div></div>';
    }
    return;
  }
  
  // ✅ Polyfill para JSON (muito raro, mas possível - Android 2.x)
  if (typeof JSON === 'undefined') {
    console.error('[Polyfills] JSON não suportado - navegador extremamente antigo');
    var root = document.getElementById('root');
    if (root) {
      root.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: Arial, sans-serif; padding: 20px;"><div style="text-align: center; max-width: 500px;"><h1 style="color: #e74c3c; margin-bottom: 20px;">Navegador Não Compatível</h1><p style="color: #666; margin-bottom: 20px;">Seu navegador não suporta recursos básicos necessários.</p><p style="color: #666; margin-bottom: 30px;">Por favor, atualize seu navegador.</p></div></div>';
    }
    return;
  }
  
  // ✅ Polyfill para Object.defineProperty (IE8-, navegadores muito antigos)
  if (!Object.defineProperty) {
    Object.defineProperty = function(obj, prop, descriptor) {
      // Fallback simples para navegadores muito antigos
      try {
        if (descriptor && descriptor.value !== undefined) {
          obj[prop] = descriptor.value;
        }
        if (descriptor && descriptor.get) {
          // Não podemos fazer getter real, mas podemos tentar
          try {
            // Tentar usar __defineGetter__ se disponível (não padrão, mas funciona em alguns navegadores antigos)
            if (obj.__defineGetter__) {
              obj.__defineGetter__(prop, descriptor.get);
            }
            if (descriptor.set && obj.__defineSetter__) {
              obj.__defineSetter__(prop, descriptor.set);
            }
          } catch (e) {
            // Se não funcionar, apenas atribuir valor se disponível
            if (descriptor.value !== undefined) {
              obj[prop] = descriptor.value;
            }
          }
        }
      } catch (e) {
        // Se tudo falhar, apenas atribuir valor se disponível
        if (descriptor && descriptor.value !== undefined) {
          obj[prop] = descriptor.value;
        }
      }
      return obj;
    };
  }
  
  // ✅ Polyfill para Object.defineProperties (IE8-)
  if (!Object.defineProperties) {
    Object.defineProperties = function(obj, properties) {
      for (var prop in properties) {
        if (properties.hasOwnProperty(prop)) {
          Object.defineProperty(obj, prop, properties[prop]);
        }
      }
      return obj;
    };
  }
  
  // ✅ Polyfill para Array.isArray (IE8-)
  if (!Array.isArray) {
    Array.isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    };
  }
  
  // ✅ Polyfill para Object.keys (IE8-)
  if (!Object.keys) {
    Object.keys = function(obj) {
      if (obj !== Object(obj)) {
        throw new TypeError('Object.keys called on non-object');
      }
      var keys = [];
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
  }
  
  // ✅ Polyfill para Object.create (IE8-)
  if (!Object.create) {
    Object.create = function(proto, propertiesObject) {
      if (typeof proto !== 'object' && typeof proto !== 'function') {
        throw new TypeError('Object prototype may only be an Object or null');
      }
      function F() {}
      F.prototype = proto;
      var obj = new F();
      if (propertiesObject) {
        Object.defineProperties(obj, propertiesObject);
      }
      if (proto === null) {
        obj.__proto__ = null;
      }
      return obj;
    };
  }
  
  // ✅ Polyfill para Array.forEach (IE8-)
  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(callback, thisArg) {
      if (this == null) {
        throw new TypeError('Array.prototype.forEach called on null or undefined');
      }
      if (typeof callback !== 'function') {
        throw new TypeError(callback + ' is not a function');
      }
      var O = Object(this);
      var len = parseInt(O.length) || 0;
      var k = 0;
      while (k < len) {
        if (k in O) {
          callback.call(thisArg, O[k], k, O);
        }
        k++;
      }
    };
  }
  
  // ✅ Polyfill para Array.filter (IE8-)
  if (!Array.prototype.filter) {
    Array.prototype.filter = function(callback, thisArg) {
      if (this == null) {
        throw new TypeError('Array.prototype.filter called on null or undefined');
      }
      if (typeof callback !== 'function') {
        throw new TypeError(callback + ' is not a function');
      }
      var O = Object(this);
      var len = parseInt(O.length) || 0;
      var k = 0;
      var res = [];
      while (k < len) {
        if (k in O) {
          var val = O[k];
          if (callback.call(thisArg, val, k, O)) {
            res.push(val);
          }
        }
        k++;
      }
      return res;
    };
  }
  
  // ✅ Polyfill para Array.slice (para converter NodeList em Array)
  if (!Array.prototype.slice) {
    Array.prototype.slice = function(begin, end) {
      var len = this.length;
      var start = begin || 0;
      var finish = end !== undefined ? end : len;
      if (start < 0) start = Math.max(len + start, 0);
      if (finish < 0) finish = Math.max(len + finish, 0);
      var result = [];
      for (var i = start; i < finish; i++) {
        if (i in this) {
          result.push(this[i]);
        }
      }
      return result;
    };
  }
  
  console.log('[Polyfills] ✅ Polyfills críticos carregados');
  
})();
