(function(options) {
if (!options.path_max_depth) options.path_max_depth = 6;

let __logActive = false;
const __href = window.location.href;

const __document = document;
const __document_evaluate = document.evaluate;
function __xpath(el) {
  if (typeof el == "string") return __document_evaluate(el, __document, null, 0, null);
  if (!el || el.nodeType != 1) return '';
  if (el.id) return "//*[@id='" + el.id + "']";
  var sames = [].filter.call(el.parentNode.children, function (x) { return x.tagName == el.tagName });
  return xpath(el.parentNode) + '/' + el.tagName.toLowerCase() + (sames.length > 1 ? '['+([].indexOf.call(sames, el)+1)+']' : '');
}

function __prepareValueToBeSerialized(value) {
  if (value === undefined) return "undefined";
  if (value === null) return null;
  if (['boolean', 'number', 'bigint', 'string', 'symbol'].includes(typeof(value))) return value;
  if (typeof(value) == 'function') return value.toString();
  if (value instanceof Window) return 'window';
  if (value instanceof HTMLDocument) return 'document';
  if (value instanceof Node) {
    const s = {};
    try { s.xpath = __xpath(value) } catch (e) { s.xpath = null };
    s.outerHTML = value.outerHTML;
    s.style = value.style;
    return s;
  };
  try { if (value.__proxy_target.constructor.name !== 'Object') return `${value.__proxy_target.constructor.name} - ${value.__proxy_target.toString()}` } catch (e) { }
  try { if (value.constructor.name !== 'Object') return `${value.constructor.name} - ${value.toString()}` } catch (e) { return 'UnknownObjectClass' }
  try { if (value.__instance_of_proxy) return 'proxy_object' } catch (e) { };
  return "serialization-failed";
}

function __serialize(object) {
  const serialized = __prepareValueToBeSerialized(object);
  if (serialized != "serialization-failed")
    if (typeof(serialized) === 'string') { return serialized } else { return JSON.stringify(serialized) };
  return JSON.stringify(object, function(k, v) {
    if (k == '') return v;
    const serializedValue = __prepareValueToBeSerialized(v);
    if (serializedValue != 'serialization-failed') return serializedValue;
    return v;
  });
}

function __logMessage(message) { if (__logActive) console.debug(message); }

function __logObject(obj={}) {
  let msg = {}
  msg.href = __href;
  msg.time = (new Date()).getTime();
  msg = {...msg, ...obj}; // merge
  const message = __serialize(msg)
  let _should_log = false;
  if (!options.log_regex || options.log_regex.test(message)) _should_log = true;
  if (options.no_log_regex && options.no_log_regex.test(message)) _should_log = false;
  if (/\_\_instance\_of\_proxy|\_\_proxy\_target/.test(message) || /\.toJSON\"/.test(message)) _should_log = false;
  if (msg.force_log) _should_log = true;
  if (_should_log) __logMessage(message);
}

function __buildProxy(object, path) {
  if (object == null) return object; // Null or Undefined
  if (['boolean', 'number', 'bigint', 'string', 'symbol'].includes(typeof(object))) return object; // can't build a proxy for these objects
  try { if (object.__instance_of_proxy === true) return object } catch (e) { return object; } // will fail if object is a cross origin resource

  let originalTarget = object;
  while (originalTarget.__proxy_target) originalTarget = originalTarget.__proxy_target;

  let proxy = originalTarget;

  if (typeof(originalTarget) == 'object') {
    proxy = new Proxy(originalTarget, {
      get: function (target, key) {
        let return_value;
        if (key == '__instance_of_proxy') {
          return_value = true;
        } else if (key == '__proxy_target') {
          return_value = originalTarget;
        } else {
          return_value = Reflect.get(target, key);
        }
        if (typeof(return_value) == 'function') return_value = return_value.bind(originalTarget);
        __logObject({event: 'proxy-object-get', path: `${path}.${key}`, typeof: typeof(return_value), return: return_value});
        return return_value;
      },
      set: function (target, key, value) {
        __logObject({event: 'proxy-object-set', path: `${path}.${key}`, typeof: typeof(value), value: value});
        return Reflect.set(target, key, value);
      },
      getPrototypeOf: function (target) {
        __logObject({event: 'proxy-object-prototype', path: path});
        return originalTarget.__proto__;
      },
      // deleteProperty: function (target, key) {
      //   __logObject({event: 'deleteProperty', path: path, key: key});
      //   return Reflect.deleteProperty(target, key);
      // },
      // ownKeys: function (target) {
      //   const return_value = Reflect.ownKeys(target);
      //   __logObject({event: 'ownKeys', path: path, return: return_value});
      //   return return_value;
      // },
      // has: function (target, key) {
      //   const return_value = Reflect.has(target, key);
      //   __logObject({event: 'has', path: path, key: key, return: return_value});
      //   return return_value;
      // },
      // defineProperty: function (target, key, desc) {
      //   __logObject({event: 'defineProperty', path: path, key: key, desc: desc});
      //   return Reflect.defineProperty(target, key, desc);
      // },
      // getOwnPropertyDescriptor: function (target, key) {
      //   const return_value = Reflect.getOwnPropertyDescriptor(target, key);
      //   __logObject({event: 'getOwnPropertyDescriptor', path: path, key: key, return: return_value});
      //   return return_value;
      // },
    });

  } else if (typeof(target) == 'function') {
    proxy = new Proxy(target, {
      get: function (target, key) {
        let return_value = undefined;
        if (!return_value && key == '__instance_of_proxy') return_value = true;
        if (!return_value && key == '__proxy_target') return_value = target;
        if (!return_value) return_value = Reflect.get(target, key);
        if (typeof(return_value) == 'function') return_value = return_value.bind(originalTarget);
        __logObject({event: 'proxy-function-get', path: `${path}.${key}`, typeof: typeof(return_value), return: return_value});
        return return_value;
      },
      apply: function(target, thisArg, arguments) {
        __logObject({event: 'proxy-function-apply-before', path: path, target: target, originalTarget: originalTarget, thisArg: thisArg, args: arguments});
        for (let i = 0; arguments.length; i++)
          arguments[i] = (arguments[i].__instance_of_proxy ? arguments[i].__proxy_target : arguments[i])
        let return_value = Reflect.apply.apply(target, thisArg, arguments);
        __logObject({event: 'proxy-function-apply-after', path: path, target: target, originalTarget: originalTarget, thisArg: thisArg, args: arguments, typeof: typeof(return_value), return: return_value});
        return __buildProxy(return_value, `${path}(${arguments.join(', ')})`);
      },
    });
  }

  return proxy;
}

function __trackObjectProperty(obj, path, key, value) {
  try { obj[key] } catch (e) { return; } // will fail if obj is a cross origin resource

  const keyPath = `${path}.${key}`;
  const descriptorOriginal = Object.getOwnPropertyDescriptor(obj, key);

  const descriptorTracked  = {}
  let proxy = __buildProxy(value, keyPath);
  descriptorTracked.get = function() {
    __logObject({event: 'descriptor-get', path: keyPath, typeof: typeof(proxy), value: proxy});
    return proxy;
  };
  if(descriptorOriginal && descriptorOriginal.writable)
    descriptorTracked.set = function(valueNew) {
      __logObject({event: 'descriptor-set', path: keyPath, typeof: typeof(valueNew), new: valueNew, old: proxy});
      proxy = __buildProxy(value, keyPath);
      return proxy;
    }
  descriptorTracked.configurable = (descriptorOriginal ? descriptorOriginal.configurable : true);
  descriptorTracked.enumerable   = (descriptorOriginal ? descriptorOriginal.enumerable   : true);

  try {
    Object.defineProperty(obj, key, descriptorTracked);
  } catch (e) {
    if (obj instanceof Location) return; // ignore tracking Location if it's failing
    try {
      obj[key] = proxy;
      if (obj[key] != proxy) __logObject({event: '__trackObjectProperty-fail-assign', path: keyPath, typeof: typeof(value), value: value});
    } catch(e) {
      __logObject({event: '__trackObjectProperty-fail', path: keyPath, typeof: typeof(value), value: value});
    }
  }
}

function __track(obj, path) {
  if (options.skip_path_regex.test(path)) return;
  try { if (obj.__tracked__ === true) return; } catch (e) { return; } // skip tracked objects and fail if obj is a cross origin resource
  if (path.split('.enabledPlugin').length >= 3) return; // avoid stack overflow
  if (path.split('.').length >= options.path_max_depth) return; // avoid logging deep paths

  for (key in obj) {
    const keyPath = `${path}.${key}`;
    let value;
    try { value = obj[key] } catch (e) { continue; } // skip cross origin error

    // these are cases we're not going to track themselves neither their children
    if (options.skip_path_regex.test(keyPath)) continue; // skip
    if (obj instanceof HTMLDocument && path.indexOf('.document') >= 0 && key.startsWith('a-')) continue; // don't mess with global document (cross origin frame)
    if (obj instanceof Node) continue; // don't mess with DOM Nodes
    if (typeof(value) == 'function' && key == 'toJSON') continue; // avoid stack overflow when calling __logObject

    __trackObjectProperty(obj, path, key, value)

    // these are cases we've tracked themselves but not their children
    if (value instanceof Window) continue; // avoid cross-origin errors accessing parent, frames or top
    if (value instanceof HTMLDocument && path != 'window') continue; // avoid stack overflow with cross references
    if (value instanceof Location && path != 'window') continue; // avoid stack overflow with cross references
    if (typeof(value) != 'object') continue; // we will not install __track on something that is not an object
    __track(value, keyPath)
  };
}

__track(window, 'window');
__logActive = true;
__logObject({event: 'trackBrowser.js Initialized', href: window.location.href, options: options});

})({
  path_max_depth: 6,
  skip_path_regex: /window\.clientInformation/i,
});
